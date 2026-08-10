import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import {
  db,
  planDraftQuotesTable,
  type PlanDraft,
  type PlanDraftQuoteLineItem,
} from "@workspace/db";
import {
  PLAN_CATALOG,
  computePlanQuote,
  type PlanId,
} from "@workspace/subscription-rules";
import { resolvePlanDraftAccess } from "../lib/planDraftAuth";
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
  releaseSlotsForQuote,
  reserveSlotsForQuote,
  resolveServiceability,
  supersedeActiveQuotes,
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

const quoteSchema = z.object({ version: z.number().int().min(1) });

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
    const quoteId = crypto.randomBytes(24).toString("hex");
    const schedule = (draft.lineup ?? []).map((d) => ({
      deliveryDate: d.deliveryDate,
      deliveryWindow: d.deliveryWindow ?? "",
      slotId: null,
    }));

    // Supersede any previous quote (releasing its capacity) before issuing a
    // new one, so a draft never holds capacity through two quotes at once.
    await supersedeActiveQuotes(draft.id);

    const slotIds = await slotIdsForSchedule(draft);
    const userId = draft.userId;

    const issued = await db.transaction(async (tx) => {
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
          expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
        })
        .returning();

      const { failed } = await reserveSlotsForQuote(tx, quoteId, slotIds, userId);
      if (failed.length > 0) {
        // Someone took the last unit while we were quoting. Roll the whole
        // thing back — a partially-reserved quote would promise deliveries the
        // kitchen cannot make.
        await releaseSlotsForQuote(tx, quoteId);
        await tx
          .delete(planDraftQuotesTable)
          .where(eq(planDraftQuotesTable.id, quoteId));
        return { conflict: failed };
      }
      return { quote: row };
    });

    if ("conflict" in issued && issued.conflict) {
      res.status(409).json({
        error: "Some of your delivery times were just taken.",
        code: "capacity_unavailable",
        detail: { slotIds: issued.conflict },
      });
      return;
    }

    const updated = await casUpdateDraft(draft.id, draft.version, {
      status: "quoted",
    });

    res.status(201).json({
      quote: "quote" in issued ? issued.quote : null,
      draft: updated ?? draft,
    });
  },
);

/** The slot ids behind a draft's scheduled days, resolved from the live slot
 *  table by (date, window) so a client can never name a slot directly. */
async function slotIdsForSchedule(draft: PlanDraft): Promise<number[]> {
  const service = await resolveServiceability(
    draft.deliverySchedule?.addressId ?? null,
  );
  if (!service.ok || !service.zone) return [];
  const dates = await eligibleDates(service.zone);
  const byKey = new Map(
    dates.flatMap((d) =>
      d.windows.map((w) => [`${d.deliveryDate}:${w.deliveryWindow}`, w.slotId] as const),
    ),
  );
  const ids: number[] = [];
  for (const day of draft.lineup ?? []) {
    const id = byKey.get(`${day.deliveryDate}:${day.deliveryWindow ?? ""}`);
    if (id != null) ids.push(id);
  }
  return ids;
}

export default router;
