import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import {
  db,
  planDraftQuotesTable,
  planDraftsTable,
  type PlanDraft,
  type PlanDraftQuoteLineItem,
} from "@workspace/db";
import {
  PLAN_CATALOG,
  computePlanQuote,
  type PlanId,
} from "@workspace/subscription-rules";
import { PLAN_DRAFT_TTL_MS, resolvePlanDraftAccess } from "../lib/planDraftAuth";
import {
  planDraftMutateRateLimit,
  planDraftReadRateLimit,
} from "../middlewares/rateLimitMiddleware";
import { casUpdateDraft, loadLiveDraft } from "../lib/planDraftStore";
import { isPlanDraftStatusTerminal } from "../lib/planDraftStateMachine";
import { resolveDietTrack } from "../lib/planDraftGenerator";
import {
  QUOTE_TTL_MS,
  activeQuoteFor,
  eligibleDates,
  reserveSlotsForQuote,
  resolveScheduleSlots,
  resolveServiceability,
  supersedeActiveQuotes,
  supersedeActiveQuotesTx,
  validateSchedule,
  withScheduleApplied,
  type ScheduleAssignment,
} from "../lib/planDraftSchedule";

// ─────────────────────────────────────────────────────────────────────────────
// Delivery scheduling and quote readiness for a PlanDraft (PR A2.3).
//
//   GET  /plan-drafts/:id/delivery-options    — DEFECT-PLAN-SCHEDULE-001
//   PUT  /plan-drafts/:id/delivery-schedule
//   GET  /plan-drafts/:id/quote-readiness     — DEFECT-PLAN-CONVERT-001
//   POST /plan-drafts/:id/quote
//
// The server decides every date, window, fee and amount here. A client renders
// what these return; it must never generate a delivery date, a capacity
// judgement or a price of its own.
//
// Subscription origination (PlanDraft → Order → Subscription) is A2.4 and is
// deliberately absent. A quote issued here is payable but nothing consumes it
// yet, and plan checkout stays gated.
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

function paramId(raw: unknown): string {
  return typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
}

const assignmentSchema = z.object({
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deliveryWindow: z.string().trim().min(1).max(32),
  slotId: z.number().int().positive(),
});

const scheduleSchema = z.object({
  version: z.number().int().min(1),
  addressId: z.number().int().positive(),
  assignments: z.array(assignmentSchema).min(1).max(120),
});

const optionsQuerySchema = z.object({
  addressId: z.coerce.number().int().positive(),
});

const quoteSchema = z.object({
  version: z.number().int().min(1),
  /** Optional retry token; the `Idempotency-Key` header is honoured too. */
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});

async function requireDraft(
  req: Request,
  res: Response,
): Promise<PlanDraft | null> {
  const draft = await loadLiveDraft(paramId(req.params.id));
  if (!draft) {
    res.status(404).json({ error: "draft not found" });
    return null;
  }
  if (!resolvePlanDraftAccess(req, draft).ok) {
    res.status(404).json({ error: "draft not found" });
    return null;
  }
  if (isPlanDraftStatusTerminal(draft.status)) {
    res.status(409).json({ error: "draft is no longer editable" });
    return null;
  }
  return draft;
}

router.get(
  "/plan-drafts/:id/delivery-options",
  planDraftReadRateLimit,
  async (req: Request, res: Response) => {
    const parsed = optionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const draft = await requireDraft(req, res);
    if (!draft) return;

    const service = await resolveServiceability(parsed.data.addressId);
    if (!service.ok || !service.zone) {
      // 200, not an error status: an unserviceable address is a real answer to
      // a legitimate question, and the customer needs the recovery options in
      // the body rather than a failure the UI has to invent copy for.
      res.json({
        serviceable: false,
        reason: service.failure,
        message: service.message,
        recovery: service.recovery,
        dates: [],
      });
      return;
    }

    const dates = await eligibleDates(service.zone);
    res.json({
      serviceable: true,
      addressId: service.addressId,
      zone: service.zone,
      requiredDayCount: draft.lineup?.length ?? 0,
      dates,
    });
  },
);

router.put(
  "/plan-drafts/:id/delivery-schedule",
  planDraftMutateRateLimit,
  async (req: Request, res: Response) => {
    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const draft = await requireDraft(req, res);
    if (!draft) return;
    if (draft.status === "generating") {
      res.status(409).json({
        error: "this plan is being rebuilt right now",
        code: "generation_in_progress",
      });
      return;
    }

    const { version, addressId, assignments } = parsed.data;

    const service = await resolveServiceability(addressId);
    if (!service.ok || !service.zone) {
      res.status(422).json({
        error: service.message,
        code: service.failure,
        recovery: service.recovery,
      });
      return;
    }

    const check = await validateSchedule(
      draft,
      assignments as ScheduleAssignment[],
      service.zone,
    );
    if (!check.ok) {
      res.status(422).json({
        error: "this delivery schedule can't be used",
        code: "schedule_invalid",
        issues: check.issues,
      });
      return;
    }

    const lineup = withScheduleApplied(
      draft.lineup ?? [],
      assignments as ScheduleAssignment[],
      addressId,
    );

    const updated = await casUpdateDraft(draft.id, version, {
      lineup,
      deliverySchedule: {
        addressId,
        deliveryWindow: assignments[0]?.deliveryWindow ?? "",
        // Plan prices are GST-inclusive all-in figures (planCatalog 02c), so
        // there is no separate delivery fee to invent here. A2.4 revisits this
        // only if the owner introduces one.
        deliveryFeePaise: 0,
      },
      status: "schedule_required",
    });
    if (!updated) {
      res.status(409).json({
        error: "draft was modified elsewhere",
        code: "stale_version",
      });
      return;
    }

    // Any schedule change invalidates a quote that priced the old one, and
    // releases the capacity it was holding.
    const superseded = await supersedeActiveQuotes(draft.id);

    res.json({ draft: updated, supersededQuotes: superseded });
  },
);

export type ReadinessBlocker =
  | "no_lineup"
  | "schedule_incomplete"
  | "address_unserviceable"
  | "capacity_unavailable"
  | "pricing_unavailable"
  | "renewal_not_chosen";

interface ReadinessIssue {
  code: ReadinessBlocker;
  message: string;
  detail?: unknown;
}

/**
 * The composite the rebuild spec asks for: every requirement checked, and the
 * exact set that is missing returned — never a generic "not ready".
 */
async function assessReadiness(
  draft: PlanDraft,
): Promise<{ ready: boolean; issues: ReadinessIssue[] }> {
  const issues: ReadinessIssue[] = [];
  const lineup = draft.lineup ?? [];

  if (lineup.length === 0) {
    issues.push({ code: "no_lineup", message: "Your plan has no meals yet." });
  }

  const scheduled = lineup.filter((d) => d.deliveryWindow && d.addressId != null);
  if (lineup.length > 0 && scheduled.length !== lineup.length) {
    issues.push({
      code: "schedule_incomplete",
      message: "Choose a delivery date and time for every day of your plan.",
      detail: { scheduled: scheduled.length, required: lineup.length },
    });
  }

  const addressId = draft.deliverySchedule?.addressId ?? null;
  const service = await resolveServiceability(addressId);
  if (!service.ok) {
    issues.push({
      code: "address_unserviceable",
      message: service.message ?? "Choose a deliverable address.",
      detail: { reason: service.failure, recovery: service.recovery },
    });
  } else if (lineup.length > 0 && scheduled.length === lineup.length) {
    // Re-check capacity at readiness time: availability shown during
    // configuration was advisory, and slots can fill under the customer.
    const dates = await eligibleDates(service.zone!);
    const stillOffered = new Set(
      dates.flatMap((d) => d.windows.map((w) => `${d.deliveryDate}:${w.deliveryWindow}`)),
    );
    const lost = scheduled
      .map((d) => `${d.deliveryDate}:${d.deliveryWindow}`)
      .filter((k) => !stillOffered.has(k));
    if (lost.length > 0) {
      issues.push({
        code: "capacity_unavailable",
        message: "Some of your chosen delivery times are no longer available.",
        detail: { unavailable: lost },
      });
    }
  }

  // Pricing. A PLAN_CATALOG plan is priced by the catalog. A Journey 4 custom
  // plan has NO pricing model anywhere in this codebase, and inventing one
  // would be exactly the fabricated-money defect this series exists to remove
  // — so a custom draft is honestly reported as un-quotable pending an owner
  // pricing decision, rather than quoted at a made-up number.
  const planId = draft.planId as PlanId | null;
  if (draft.journey !== "recommended" || !planId || !PLAN_CATALOG[planId]) {
    issues.push({
      code: "pricing_unavailable",
      message:
        "Custom plans don't have pricing yet, so they can't be quoted.",
      detail: { journey: draft.journey },
    });
  }

  if (!draft.duration?.renewal) {
    issues.push({
      code: "renewal_not_chosen",
      message: "Choose whether this plan should renew automatically.",
    });
  }

  return { ready: issues.length === 0, issues };
}

router.get(
  "/plan-drafts/:id/quote-readiness",
  planDraftReadRateLimit,
  async (req: Request, res: Response) => {
    const draft = await requireDraft(req, res);
    if (!draft) return;

    const { ready, issues } = await assessReadiness(draft);
    const quote = await activeQuoteFor(draft.id);
    res.json({
      ready,
      issues,
      draftVersion: draft.version,
      activeQuote: quote
        ? {
            id: quote.id,
            totalPaise: quote.totalPaise,
            expiresAt: quote.expiresAt,
            /** A quote priced an earlier version — the customer has edited
             *  since, so it is no longer what they would be charged. */
            stale: quote.planDraftVersion !== draft.version,
          }
        : null,
    });
  },
);

router.post(
  "/plan-drafts/:id/quote",
  planDraftMutateRateLimit,
  async (req: Request, res: Response) => {
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const draft = await requireDraft(req, res);
    if (!draft) return;

    const now = new Date();
    const headerKey = req.header("idempotency-key")?.trim();
    const idempotencyKey = parsed.data.idempotencyKey ?? (headerKey || undefined);

    // IDEMPOTENT REPLAY, resolved BEFORE the version check. A retried issue
    // request must resolve to the quote the first attempt already produced;
    // without that, a network timeout on a SUCCESSFUL call becomes a second
    // call that supersedes the quote, releases its capacity and re-reserves —
    // and in that gap another customer can take the slot, so the retry converts
    // a success into a 409 and costs the customer their booking.
    //
    // The comparison is against the version the CALLER asked for, not the
    // draft's current one: the key identifies a request, and answering "you
    // already have this" is only correct if it is a reply to the same question.
    if (idempotencyKey) {
      const [prior] = await db
        .select()
        .from(planDraftQuotesTable)
        .where(
          and(
            eq(planDraftQuotesTable.planDraftId, draft.id),
            eq(planDraftQuotesTable.idempotencyKey, idempotencyKey),
          ),
        );
      if (prior) {
        // Same key, different version: this is NOT the request that produced
        // that quote, so replaying it would hand back a price for a plan the
        // customer has since edited. Refuse rather than guess which they meant.
        if (prior.planDraftVersion !== parsed.data.version) {
          res.status(409).json({
            error:
              "that request has already been used for a different version of this plan",
            code: "idempotency_key_reused",
            detail: {
              quotedVersion: prior.planDraftVersion,
              requestedVersion: parsed.data.version,
            },
          });
          return;
        }
        if (prior.status !== "active" || prior.expiresAt.getTime() < now.getTime()) {
          res.status(409).json({
            error: "that quote is no longer valid — please review your plan again",
            code: "quote_not_active",
            detail: { status: prior.status, expiresAt: prior.expiresAt },
          });
          return;
        }
        res.status(200).json({ quote: prior, draft, replayed: true });
        return;
      }
    }

    // A quote must price the draft the customer is actually looking at. A
    // stale version means they have edited since, so refuse rather than
    // pricing something they can no longer see.
    if (draft.version !== parsed.data.version) {
      res.status(409).json({
        error: "draft was modified elsewhere",
        code: "stale_version",
      });
      return;
    }

    const { ready, issues } = await assessReadiness(draft);
    if (!ready) {
      res.status(422).json({
        error: "this plan isn't ready to quote yet",
        code: "not_ready_for_quote",
        issues,
      });
      return;
    }

    const planId = draft.planId as PlanId;
    const track = resolveDietTrack(draft.dietaryPattern);
    const cycle = draft.duration?.cycle ?? PLAN_CATALOG[planId].cycle;
    // The catalog is the ONLY source of a plan's money. Nothing here computes
    // an amount of its own.
    const priced = computePlanQuote(planId, track, cycle);

    const accompanimentPaise = (draft.lineup ?? [])
      .flatMap((d) => d.slots)
      .reduce((sum, s) => sum + (s.priceAdjustmentPaise ?? 0), 0);

    const lineItems: PlanDraftQuoteLineItem[] = [
      {
        kind: "plan_cycle",
        label: `${planId} — ${cycle}`,
        amountPaise: priced.cycleTotalPaise,
        reference: planId,
      },
    ];
    if (accompanimentPaise !== 0) {
      lineItems.push({
        kind: "accompaniments",
        label: "Accompaniments and add-ons",
        amountPaise: accompanimentPaise,
        reference: null,
      });
    }

    const totalPaise = priced.cycleTotalPaise + accompanimentPaise;

    // Resolve the schedule to real slot rows BEFORE issuing anything. Resolution
    // is capacity-blind on purpose (see resolveScheduleSlots) — a full slot
    // resolves here and is refused by the conditional reservation below, which
    // is the only ordering under which a quote cannot be issued holding less
    // capacity than it promises.
    const service = await resolveServiceability(
      draft.deliverySchedule?.addressId ?? null,
    );
    if (!service.ok || !service.zone) {
      res.status(422).json({
        error: service.message,
        code: service.failure,
        recovery: service.recovery,
      });
      return;
    }
    const lineup = draft.lineup ?? [];
    const { slotIds, unresolved } = await resolveScheduleSlots(lineup, service.zone);
    if (unresolved.length > 0 || slotIds.length !== lineup.length) {
      // A day the kitchen no longer publishes. Refusing is the point: issuing
      // anyway would sell a delivery with nothing behind it.
      res.status(409).json({
        error: "Some of your delivery times are no longer available.",
        code: "capacity_unavailable",
        detail: { unresolved },
      });
      return;
    }
    // Two days resolving to one slot would reserve ONE unit and sell TWO
    // deliveries — `reserveSlotsForQuote` is idempotent per (quote, slot), so
    // the second day would silently ride the first day's reservation. Save-time
    // validation already forbids sharing a slot; this is the same invariant
    // checked where the capacity is actually taken, because on this path an
    // assumption that "cannot happen" has been wrong once already.
    if (new Set(slotIds).size !== slotIds.length) {
      res.status(409).json({
        error: "Each delivery day needs its own date and time window.",
        code: "duplicate_delivery_slot",
      });
      return;
    }

    const schedule = lineup.map((d, i) => ({
      deliveryDate: d.deliveryDate,
      deliveryWindow: d.deliveryWindow ?? "",
      slotId: slotIds[i] ?? null,
    }));
    const quoteId = crypto.randomBytes(24).toString("hex");
    const userId = draft.userId;

    // Supersede-then-insert-then-reserve in ONE transaction. Split across
    // transactions there is a window in which the draft holds no active quote
    // and a concurrent request can issue a second one; the partial unique index
    // on (plan_draft_id) where status='active' is the backstop, and a violation
    // here means exactly that race, so it is answered as a conflict.
    const issued = await db
      .transaction(async (tx) => {
        await supersedeActiveQuotesTx(tx, draft.id, "superseded", now);

        const [row] = await tx
          .insert(planDraftQuotesTable)
          .values({
            id: quoteId,
            planDraftId: draft.id,
            planDraftVersion: draft.version,
            status: "active",
            subtotalPaise: priced.preTaxPaise,
            deliveryFeePaise: 0,
            taxPaise: priced.gstPaise,
            totalPaise,
            lineItems,
            schedule,
            idempotencyKey: idempotencyKey ?? null,
            expiresAt: new Date(now.getTime() + QUOTE_TTL_MS),
          })
          .returning();

        const { failed } = await reserveSlotsForQuote(tx, quoteId, slotIds, userId);
        if (failed.length > 0) {
          // Someone took the last unit while we were quoting. Throwing rolls
          // back the insert AND every increment this transaction made — a
          // partially-reserved quote would promise deliveries the kitchen
          // cannot make, and unwinding by hand is how you leak half of one.
          throw new CapacityConflict(failed);
        }

        // Move the draft to `quoted` in the SAME transaction, and deliberately
        // WITHOUT bumping its version.
        //
        // The usual CAS bump is wrong here: a quote is bound to the draft
        // version it priced, so incrementing the version as a side effect of
        // issuing would make every quote report itself out-of-date the instant
        // it existed — the customer would be told to re-check a plan they had
        // just confirmed. The version still guards the write; it is the status
        // that changes, not the configuration, and nothing the quote priced has
        // moved.
        const [moved] = await tx
          .update(planDraftsTable)
          .set({
            status: "quoted",
            expiresAt: new Date(now.getTime() + PLAN_DRAFT_TTL_MS),
          })
          .where(
            and(
              eq(planDraftsTable.id, draft.id),
              eq(planDraftsTable.version, draft.version),
            ),
          )
          .returning();
        if (!moved) throw new StaleDraft();

        return { quote: row ?? null, draft: moved };
      })
      .catch((err: unknown) => {
        if (err instanceof CapacityConflict) return { conflict: err.slotIds };
        if (err instanceof StaleDraft) return { stale: true as const };
        if (isUniqueViolation(err)) return { conflict: [] as number[] };
        throw err;
      });

    if ("stale" in issued) {
      res.status(409).json({
        error: "draft was modified elsewhere",
        code: "stale_version",
      });
      return;
    }

    if ("conflict" in issued) {
      res.status(409).json({
        error: "Some of your delivery times were just taken.",
        code: "capacity_unavailable",
        detail: { slotIds: issued.conflict },
      });
      return;
    }

    res.status(201).json({
      quote: issued.quote,
      draft: issued.draft,
      replayed: false,
    });
  },
);

/** Thrown inside the issue transaction when the draft moved under us. */
class StaleDraft extends Error {}

/** Thrown inside the issue transaction to roll it back wholesale. */
class CapacityConflict extends Error {
  constructor(readonly slotIds: number[]) {
    super("capacity_unavailable");
  }
}

/** Postgres 23505. The active-quote and idempotency indexes both surface a
 *  concurrent issue attempt this way. */
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  const causeCode = (err as { cause?: { code?: unknown } } | null)?.cause?.code;
  return code === "23505" || causeCode === "23505";
}

export default router;
