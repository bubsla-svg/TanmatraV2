import * as crypto from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import {
  db,
  planDraftConversionsTable,
  planDraftQuotesTable,
  planDraftsTable,
  subscriptionDeliveriesTable,
  subscriptionsTable,
  operationalInstant,
  type PlanDraftQuote,
  type SubscriptionDelivery,
} from "@workspace/db";
import { isPlanCheckoutDisabled } from "../lib/flags";
import { requireAuthUser as requireAuth } from "../middlewares/requireAuth";
import { planDraftMutateRateLimit } from "../middlewares/rateLimitMiddleware";
import { consumeQuoteTx } from "../lib/planDraftSchedule";
import { createFirstCycleOrder } from "../lib/subscriptionOrigination";

// ─────────────────────────────────────────────────────────────────────────────
// PlanDraft → Subscription origination (PR A2.4), PLAN_CATALOG only.
//
//   POST /plan-drafts/:id/convert
//
// PAY THEN CREATE, deliberately the opposite way round from the legacy
// `POST /subscriptions`. That route creates the subscription first and lets
// `lib/paidGate.ts` withhold fulfilment until payment captures; it works, but
// it means a failed payment leaves a subscription row behind. Origination from
// a quote can do better, because A2.3a's QuoteSnapshot already holds the
// customer's capacity for 30 minutes: nothing needs to exist during payment
// except the quote, so nothing is created unless settlement is real.
//
// EXACTLY-ONCE is held from two sides, so neither is load-bearing alone:
//   • `consumeQuoteTx` claims the quote with `status='active' AND
//     expires_at >= now` evaluated INSIDE the UPDATE;
//   • `plan_draft_conversions.plan_draft_quote_id` is UNIQUE.
// A repeated callback loses one race or the other and is answered with the
// conversion that already exists.
//
// THE MONEY COMES FROM THE QUOTE, never from this request. The body names a
// quote; the amount is that quote's frozen `totalPaise`. A client cannot state
// a price here, and a `zero_charge` settlement is verified by re-deriving the
// payable amount rather than believing the caller — "discount-only ₹0 without
// settlement evidence cannot convert".
//
// Journey 4 (custom plans) cannot reach this route: a non-catalog draft never
// obtains a quote in the first place (DEFECT-CUSTOM-PRICING-001), so the
// pricing decision stays a product input rather than something inferred here.
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

const convertSchema = z.object({
  quoteId: z.string().min(8).max(64),
  settlement: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("razorpay"),
      razorpayOrderId: z.string().min(1).max(128),
      razorpayPaymentId: z.string().min(1).max(128),
      razorpaySignature: z.string().min(1).max(256),
    }),
    // No amount field on purpose: the server decides whether zero is true.
    z.object({ kind: z.literal("zero_charge") }),
  ]),
});

function paramId(raw: unknown): string {
  return typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
}

/** Owner containment (docs/MONEY-PATH-VERIFICATION.md §5). Mounted before any
 *  work so a gated attempt creates nothing at all. */
function planCheckoutGate(_req: Request, res: Response, next: () => void): void {
  if (isPlanCheckoutDisabled()) {
    res.status(503).json({
      code: "PLAN_CHECKOUT_TEMPORARILY_UNAVAILABLE",
      message: "Plan checkout is temporarily unavailable. Please try again shortly.",
      error: "Plan checkout is temporarily unavailable. Please try again shortly.",
    });
    return;
  }
  next();
}

function razorpayCredentials(): [string, string] | null {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  return keyId && keySecret ? [keyId, keySecret] : null;
}

/** Razorpay's `order_id|payment_id` HMAC. Same construction as
 *  `POST /payments/razorpay/verify`; compared in constant time. */
function signatureValid(
  keySecret: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  presented: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(presented, "hex"),
    );
  } catch {
    // Different lengths throw — a mismatch either way.
    return false;
  }
}

/**
 * The deliveries a quote sold, one per quoted day.
 *
 * Built from the quote's OWN frozen schedule, not recomputed from the draft:
 * the draft is mutable and the quote is the offer the customer accepted. Each
 * day's instant is resolved through `operationalInstant`, so a delivery lands
 * at the operational-timezone time the label denotes rather than at whatever
 * the container's clock would have made of it.
 */
function deliveryRowsForQuote(
  subscriptionId: number,
  quote: PlanDraftQuote,
): Array<typeof subscriptionDeliveriesTable.$inferInsert> {
  return quote.schedule.map((day) => {
    const [startLabel] = day.deliveryWindow.split("-");
    const [hourText, minuteText] = (startLabel ?? "00:00").split(":");
    return {
      subscriptionId,
      scheduledFor: operationalInstant(
        day.deliveryDate,
        Number(hourText ?? 0),
        Number(minuteText ?? 0),
      ),
      deliveryWindow: day.deliveryWindow,
      status: "upcoming" as const,
      items: [],
    };
  });
}

type ConversionRefusal =
  | { status: number; code: string; error: string; detail?: unknown };

router.post(
  "/plan-drafts/:id/convert",
  planCheckoutGate,
  planDraftMutateRateLimit,
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const parsed = convertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const idempotencyKey = req.header("idempotency-key")?.trim();
    if (!idempotencyKey) {
      // Mandatory, for the same reason it is mandatory on POST /subscriptions:
      // a retried settlement without one has nothing to converge on.
      res.status(400).json({
        error: "Idempotency-Key header is required",
        code: "idempotency_key_required",
      });
      return;
    }

    const draftId = paramId(req.params.id);
    const { quoteId, settlement } = parsed.data;

    // ── Replay ───────────────────────────────────────────────────────────────
    // Answered before anything else: a retry must return the conversion it
    // already produced, not attempt a second one. Scoped to the caller, so a
    // guessed key belonging to someone else resolves to nothing rather than
    // disclosing that it exists.
    const [prior] = await db
      .select()
      .from(planDraftConversionsTable)
      .where(
        and(
          eq(planDraftConversionsTable.userId, userId),
          eq(planDraftConversionsTable.idempotencyKey, idempotencyKey),
        ),
      );
    if (prior) {
      if (prior.planDraftQuoteId !== quoteId) {
        res.status(409).json({
          error: "that request has already been used to buy a different plan",
          code: "idempotency_key_reused",
        });
        return;
      }
      res.status(200).json({ conversion: prior, replayed: true });
      return;
    }

    // ── Load and authorise ───────────────────────────────────────────────────
    const [draft] = await db
      .select()
      .from(planDraftsTable)
      .where(eq(planDraftsTable.id, draftId));
    // One non-disclosing answer for "no such draft" and "not yours": a
    // 403 would confirm the id exists.
    if (!draft || draft.userId !== userId) {
      res.status(404).json({ error: "draft not found" });
      return;
    }

    const [quote] = await db
      .select()
      .from(planDraftQuotesTable)
      .where(
        and(
          eq(planDraftQuotesTable.id, quoteId),
          eq(planDraftQuotesTable.planDraftId, draft.id),
        ),
      );
    if (!quote) {
      res.status(404).json({ error: "quote not found" });
      return;
    }

    // A quote priced one version of the plan. If the draft has moved since,
    // the customer is buying something they have already changed.
    if (quote.planDraftVersion !== draft.version) {
      res.status(409).json({
        error: "this plan changed after it was quoted — please review it again",
        code: "quote_superseded_by_edit",
      });
      return;
    }

    // ── Settlement evidence ──────────────────────────────────────────────────
    const settledPaise = quote.totalPaise;
    let settlementRef: string | null = null;
    const refusal: ConversionRefusal | null = await (async () => {
      if (settlement.kind === "zero_charge") {
        // The server decides whether zero is true. A quote with a real total
        // is not settled by a client asserting it owes nothing.
        if (settledPaise !== 0) {
          return {
            status: 402,
            code: "settlement_required",
            error: "This plan needs to be paid for before it can start.",
            detail: { payablePaise: settledPaise },
          };
        }
        return null;
      }
      const creds = razorpayCredentials();
      if (!creds) {
        return {
          status: 503,
          code: "gateway_not_configured",
          error: "payment gateway not configured",
        };
      }
      const [, keySecret] = creds;
      if (
        !signatureValid(
          keySecret,
          settlement.razorpayOrderId,
          settlement.razorpayPaymentId,
          settlement.razorpaySignature,
        )
      ) {
        return {
          status: 400,
          code: "invalid_payment_signature",
          error: "invalid payment signature",
        };
      }
      settlementRef = settlement.razorpayPaymentId;
      return null;
    })();

    if (refusal) {
      const { status, ...body } = refusal;
      res.status(status).json(body);
      return;
    }

    // ── Conversion ───────────────────────────────────────────────────────────
    // Everything below commits or rolls back together. A crash between claiming
    // the quote and creating the subscription would otherwise leave a customer
    // who has paid, still holds capacity, and has nothing to show for it.
    const now = new Date();
    const outcome = await db
      .transaction(async (tx) => {
        const claim = await consumeQuoteTx(tx, quote.id, now);
        if (!claim.ok) {
          throw new ConversionRefused(
            claim.refusal === "expired"
              ? {
                  status: 409,
                  code: "quote_expired",
                  error: "That quote has expired. Please review your plan again.",
                }
              : {
                  status: 409,
                  code: "quote_not_active",
                  error: "That quote can no longer be used.",
                  detail: { reason: claim.refusal },
                },
          );
        }

        const firstDay = quote.schedule[0];
        const startDate = firstDay
          ? operationalInstant(firstDay.deliveryDate, 0, 0)
          : now;

        const [sub] = await tx
          .insert(subscriptionsTable)
          .values({
            userId,
            cadence: (draft.duration?.cycle === "quarterly"
              ? "monthly"
              : draft.duration?.cycle === "weekly"
                ? "weekly"
                : "monthly") as "weekly" | "monthly",
            mealsPerDelivery: Math.max(1, quote.schedule.length),
            deliveryWindow: firstDay?.deliveryWindow ?? "",
            status: "active",
            startDate,
            nextDeliveryAt: startDate,
            // The frozen quote total IS the price of this cycle. Nothing here
            // recomputes it from a catalog that may have moved since.
            pricePerDeliveryPaise: quote.totalPaise,
            addressLabel: null,
            addressLine: null,
            city: null,
            pincode: null,
            phone: null,
            notes: `plan-draft:${draft.id}`,
          })
          .returning();
        if (!sub) throw new Error("subscription insert returned no row");

        // One delivery per quoted day, on the quoted date and window. Not
        // regenerated from a cadence — the customer bought these dates.
        const deliveries = (await tx
          .insert(subscriptionDeliveriesTable)
          .values(deliveryRowsForQuote(sub.id, quote))
          .returning()) as SubscriptionDelivery[];

        const order = await createFirstCycleOrder(tx, sub, deliveries, {
          chargePaise: quote.totalPaise,
          // Settlement is already verified by the time we get here, so the
          // order is born settled rather than waiting for a capture that
          // has happened.
          settled: true,
        });
        if (!order) throw new Error("first-cycle order was not created");

        const [conversion] = await tx
          .insert(planDraftConversionsTable)
          .values({
            id: crypto.randomBytes(24).toString("hex"),
            planDraftId: draft.id,
            planDraftQuoteId: quote.id,
            userId,
            idempotencyKey,
            subscriptionId: sub.id,
            orderId: order.id,
            settlementKind: settlement.kind,
            settlementRef,
            settledPaise,
          })
          .returning();

        await tx
          .update(planDraftsTable)
          .set({ status: "converted" })
          .where(eq(planDraftsTable.id, draft.id));

        return { conversion, subscription: sub, order, deliveries };
      })
      .catch((err: unknown) => {
        if (err instanceof ConversionRefused) return { refused: err.body };
        // A unique violation here is the exactly-once constraint doing its job:
        // another settlement of this same quote won the race.
        if (isUniqueViolation(err)) {
          return {
            refused: {
              status: 409,
              code: "already_converted",
              error: "This plan has already been set up.",
            } satisfies ConversionRefusal,
          };
        }
        throw err;
      });

    if ("refused" in outcome) {
      const { status, ...body } = outcome.refused;
      res.status(status).json(body);
      return;
    }

    res.status(201).json({
      conversion: outcome.conversion,
      subscription: outcome.subscription,
      order: outcome.order,
      deliveries: outcome.deliveries,
      replayed: false,
    });
  },
);

class ConversionRefused extends Error {
  constructor(readonly body: ConversionRefusal) {
    super(body.code);
  }
}

function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  const causeCode = (err as { cause?: { code?: unknown } } | null)?.cause?.code;
  return code === "23505" || causeCode === "23505";
}

export default router;
