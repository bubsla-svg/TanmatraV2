import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import {
  type PlanDraft,
  type PlanDraftDay,
  type PlanDraftGenerationFailure,
  type PlanDraftMealSlot,
} from "@workspace/db";
import { PLAN_CATALOG, type PlanId } from "@workspace/subscription-rules";
import { resolvePlanDraftAccess } from "../lib/planDraftAuth";
import {
  casUpdateDraft,
  loadLiveDraft,
  releaseGeneratingClaim,
} from "../lib/planDraftStore";
import { isPlanDraftStatusTerminal } from "../lib/planDraftStateMachine";
import { liveDishes } from "../lib/mealPlanner";
import {
  PlanDraftGenerationError,
  buildMealSlot,
  candidatesForPeriod,
  explainCompatibility,
  findSlot,
  generateLineup,
  isDishSafeForDraft,
  shuffleLineup,
  slotKey,
  withSlotReplaced,
} from "../lib/planDraftGenerator";
import { resolveCustomizations } from "../lib/dishCustomizations";

// ─────────────────────────────────────────────────────────────────────────────
// PlanDraft generation + lineup editing (PR A2.2).
//
// Closes three of the owner's named PR-A2 defects:
//   • DEFECT-PLAN-GEN-001      — generation with real progress state and
//                                recoverable, persisted failure reasons.
//   • DEFECT-PLAN-CANDIDATE-001 — pre-purchase, safety-filtered Change Dish
//                                candidates carrying macro and catalog-price
//                                deltas.
//   • DEFECT-PLAN-OPTIONS-001   — an accompaniment editor whose price modifier
//                                is resolved by the same server-side function
//                                à-la-carte checkout uses.
//
// Money discipline: the ONLY figure this router can move is
// `priceAdjustmentPaise`, and it is written exclusively from
// resolveCustomizations()'s server-computed modifier. The client never sends a
// price and no amount here is ever derived from a request body.
//
// Delivery scheduling, quoting and subscription origination remain A2.3/A2.4.
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

const mealPeriodEnum = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

const versionOnlySchema = z.object({ version: z.number().int().min(1) });

const slotRefSchema = {
  version: z.number().int().min(1),
  deliveryDate: isoDate,
  mealPeriod: mealPeriodEnum,
};

const replaceSchema = z.object({
  ...slotRefSchema,
  dishId: z.number().int().positive(),
});

const lockSchema = z.object({ ...slotRefSchema, locked: z.boolean() });

const accompanimentsSchema = z.object({
  ...slotRefSchema,
  selections: z
    .array(
      z.object({
        groupName: z.string().trim().min(1).max(120),
        optionNames: z.array(z.string().trim().min(1).max(120)).max(20),
      }),
    )
    .max(20),
});

const candidatesQuerySchema = z.object({
  deliveryDate: isoDate,
  mealPeriod: mealPeriodEnum,
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

function paramId(raw: unknown): string {
  return typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
}

/** Draft-level guard shared by every route here: exists, is yours, is still
 *  editable. Responds and returns null on failure so callers just `return`. */
async function requireEditableDraft(
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

/** Lineup edits additionally require a generated lineup to edit. */
function requireLineup(draft: PlanDraft, res: Response): PlanDraftDay[] | null {
  const lineup = draft.lineup;
  if (!lineup || lineup.length === 0) {
    res.status(409).json({
      error: "this plan has no generated lineup yet",
      code: "no_lineup",
    });
    return null;
  }
  return lineup;
}

function staleVersion(res: Response): void {
  res.status(409).json({
    error: "draft was modified elsewhere",
    code: "stale_version",
  });
}

/** trial_3day is a fixed trio with no swaps (planCatalog 02e §3.5). Any plan
 *  flagged non-customizable refuses lineup edits rather than pretending. */
function planForbidsEdits(draft: PlanDraft): boolean {
  const planId = draft.planId as PlanId | null;
  if (draft.journey !== "recommended" || !planId) return false;
  const plan = PLAN_CATALOG[planId];
  return plan ? !plan.customizable : false;
}

function refuseIfNotCustomizable(draft: PlanDraft, res: Response): boolean {
  if (!planForbidsEdits(draft)) return false;
  res.status(409).json({
    error: "this plan's meals are fixed and cannot be changed",
    code: "plan_not_customizable",
  });
  return true;
}

/** Tomorrow, UTC. Provisional only — A2.3 owns real delivery dates. */
function defaultStartDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

router.post(
  "/plan-drafts/:id/generate",
  async (req: Request, res: Response) => {
    const parsed = versionOnlySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const draft = await requireEditableDraft(req, res);
    if (!draft) return;

    if (draft.status !== "ready_to_generate") {
      res.status(409).json({
        error: "this plan is not ready to generate",
        code: "not_ready_to_generate",
        status: draft.status,
      });
      return;
    }

    // Claim the generating state under the caller's version FIRST. A second
    // concurrent generate loses the CAS and 409s instead of both running and
    // one silently overwriting the other's lineup.
    const claimed = await casUpdateDraft(draft.id, parsed.data.version, {
      status: "generating",
      generationError: null,
    });
    if (!claimed) {
      staleVersion(res);
      return;
    }

    try {
      const { lineup, notes } = generateLineup(
        claimed,
        await liveDishes(),
        defaultStartDate(),
      );
      const updated = await casUpdateDraft(claimed.id, claimed.version, {
        status: "lineup_ready",
        lineup,
        // A fresh lineup invalidates any Undo snapshot and every Keep from the
        // previous one — those slot keys refer to dishes that no longer exist
        // in this lineup.
        previousLineup: null,
        lockedSlotKeys: [],
        generationError: null,
      });
      if (!updated) {
        // Someone edited the draft while we were building. Two things are true:
        // the lineup we just built came from answers that are no longer current
        // (persisting it could contradict a safety field the other writer just
        // changed), and the row is still sitting in `generating`, which no
        // client transition can leave. Discard the lineup and release the claim
        // so the customer can retry against their new answers.
        const released = await releaseGeneratingClaim(claimed.id, {
          code: "concurrent_edit",
          message:
            "Your plan changed while we were building it. Please generate again.",
          details: {},
        });
        res.status(409).json({
          error: "draft was modified elsewhere",
          code: "stale_version",
          draft: released ?? undefined,
        });
        return;
      }
      res.json({ draft: updated, notes });
    } catch (err: unknown) {
      // EVERY failure path must leave `generating`. No client transition can
      // exit that status, so a draft left there would be permanently stuck
      // with no way for the customer to retry.
      const expected = err instanceof PlanDraftGenerationError;
      const failure: PlanDraftGenerationFailure = expected
        ? {
            code: (err as PlanDraftGenerationError).code,
            message: (err as PlanDraftGenerationError).message,
            details: (err as PlanDraftGenerationError).details,
          }
        : {
            code: "internal_error",
            // Deliberately generic: an unexpected error's text is ours, not
            // something to render to a customer.
            message: "Something went wrong building your plan. Please try again.",
            details: {},
          };
      // Guarded on the STATUS, not the version: a concurrent write may have
      // moved the version on while we were generating, and a version CAS would
      // then fail and strand the row in `generating` for good.
      const failed = await releaseGeneratingClaim(claimed.id, failure);
      if (!expected) throw err;
      // 422, not 500: the configuration is the problem and the customer can
      // fix it. The state machine allows generation_failed -> ready_to_generate
      // so retrying after an edit needs no special-casing.
      res.status(422).json({
        error: failure.message,
        code: failure.code,
        details: failure.details,
        draft: failed ?? undefined,
      });
    }
  },
);

router.get(
  "/plan-drafts/:id/candidates",
  async (req: Request, res: Response) => {
    const parsed = candidatesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const draft = await requireEditableDraft(req, res);
    if (!draft) return;
    const lineup = requireLineup(draft, res);
    if (!lineup) return;

    const { deliveryDate, mealPeriod, limit } = parsed.data;
    const found = findSlot(lineup, deliveryDate, mealPeriod);
    if (!found) {
      res.status(404).json({ error: "slot not found" });
      return;
    }
    if (planForbidsEdits(draft)) {
      // Honest empty set rather than a 409: the UI can render "this plan's
      // meals are fixed" without treating it as an error.
      res.json({ candidates: [], fixed: true });
      return;
    }

    const dishes = await liveDishes();
    const current = found.slot;
    const currentPricePaise =
      dishes.find((d) => d.id === current.dishId)?.price ?? null;
    const candidates = candidatesForPeriod(draft, mealPeriod, dishes)
      .filter((d) => d.id !== current.dishId)
      .slice(0, limit)
      .map((dish) => ({
        dishId: dish.id,
        slug: dish.slug,
        name: dish.name,
        image: dish.image,
        nutrition: {
          calories: dish.macros.calories,
          protein: dish.macros.protein,
          carbs: dish.macros.carbs,
          fat: dish.macros.fat,
        },
        /** Macro movement vs. the dish currently in this slot. */
        nutritionDelta: {
          calories: dish.macros.calories - current.nutrition.calories,
          protein: dish.macros.protein - current.nutrition.protein,
          carbs: dish.macros.carbs - current.nutrition.carbs,
          fat: dish.macros.fat - current.nutrition.fat,
        },
        /** Catalog list-price difference vs. the dish currently in this slot,
         *  for display only. It is NOT what a swap charges: a PLAN_CATALOG
         *  plan bills its per-meal price whatever in-pool dish fills the slot,
         *  and a custom plan is priced at quote time (A2.3). The slot's own
         *  `priceAdjustmentPaise` stays 0 across a swap. Null when the current
         *  dish has left the catalog and there is no honest baseline to
         *  subtract from. */
        catalogPriceDeltaPaise:
          currentPricePaise === null ? null : dish.price - currentPricePaise,
        compatibilityExplanation: explainCompatibility(draft, dish),
      }));

    res.json({ candidates, fixed: false });
  },
);

router.post(
  "/plan-drafts/:id/lineup/replace",
  async (req: Request, res: Response) => {
    const parsed = replaceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const draft = await requireEditableDraft(req, res);
    if (!draft) return;
    const lineup = requireLineup(draft, res);
    if (!lineup) return;
    if (refuseIfNotCustomizable(draft, res)) return;

    const { version, deliveryDate, mealPeriod, dishId } = parsed.data;
    const found = findSlot(lineup, deliveryDate, mealPeriod);
    if (!found) {
      res.status(404).json({ error: "slot not found" });
      return;
    }

    const dishes = await liveDishes();
    const dish = dishes.find((d) => d.id === dishId);
    // The candidate must be a dish this draft could legitimately have been
    // generated with. Re-checked server-side because a stale or hand-made
    // request could otherwise place an allergen-bearing dish into a plan.
    if (!dish || !dish.isAvailable) {
      res.status(404).json({ error: "dish not found" });
      return;
    }
    if (!isDishSafeForDraft(draft, dish)) {
      res.status(422).json({
        error: "that dish does not meet this plan's dietary requirements",
        code: "dish_not_safe",
      });
      return;
    }
    const inPool = candidatesForPeriod(draft, mealPeriod, dishes).some(
      (d) => d.id === dishId,
    );
    if (!inPool) {
      res.status(422).json({
        error: "that dish is not offered for this meal on this plan",
        code: "dish_not_in_pool",
      });
      return;
    }

    const next = buildMealSlot(draft, mealPeriod, dish);
    const updated = await casUpdateDraft(draft.id, version, {
      lineup: withSlotReplaced(lineup, deliveryDate, mealPeriod, {
        ...next,
        // A manual pick is Keep-protected by intent: the customer chose it, so
        // a later Shuffle must not undo it.
        locked: true,
      }),
      lockedSlotKeys: addKey(draft.lockedSlotKeys, slotKey(deliveryDate, mealPeriod)),
      // "Manual replacement clears Undo" — the rebuild spec's invariant. The
      // snapshot describes a lineup the customer has now edited past.
      previousLineup: null,
    });
    if (!updated) {
      staleVersion(res);
      return;
    }
    res.json({ draft: updated });
  },
);

router.post(
  "/plan-drafts/:id/lineup/lock",
  async (req: Request, res: Response) => {
    const parsed = lockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const draft = await requireEditableDraft(req, res);
    if (!draft) return;
    const lineup = requireLineup(draft, res);
    if (!lineup) return;

    const { version, deliveryDate, mealPeriod, locked } = parsed.data;
    const found = findSlot(lineup, deliveryDate, mealPeriod);
    if (!found) {
      res.status(404).json({ error: "slot not found" });
      return;
    }

    const key = slotKey(deliveryDate, mealPeriod);
    const updated = await casUpdateDraft(draft.id, version, {
      lineup: withSlotReplaced(lineup, deliveryDate, mealPeriod, {
        ...found.slot,
        locked,
      }),
      lockedSlotKeys: locked
        ? addKey(draft.lockedSlotKeys, key)
        : (draft.lockedSlotKeys ?? []).filter((k) => k !== key),
    });
    if (!updated) {
      staleVersion(res);
      return;
    }
    res.json({ draft: updated });
  },
);

router.post(
  "/plan-drafts/:id/lineup/accompaniments",
  async (req: Request, res: Response) => {
    const parsed = accompanimentsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const draft = await requireEditableDraft(req, res);
    if (!draft) return;
    const lineup = requireLineup(draft, res);
    if (!lineup) return;
    if (refuseIfNotCustomizable(draft, res)) return;

    const { version, deliveryDate, mealPeriod, selections } = parsed.data;
    const found = findSlot(lineup, deliveryDate, mealPeriod);
    if (!found) {
      res.status(404).json({ error: "slot not found" });
      return;
    }

    const dishes = await liveDishes();
    const dish = dishes.find((d) => d.id === found.slot.dishId);
    if (!dish) {
      res.status(409).json({
        error: "this meal's dish is no longer available",
        code: "dish_unavailable",
      });
      return;
    }

    // Same resolver à-la-carte checkout uses: unknown group/option is a 422,
    // never a silently-dropped selection, and the modifier is computed here
    // from the catalog — never accepted from the request.
    const resolved = resolveCustomizations(dish.customizations, selections);
    if (!resolved.ok) {
      res.status(422).json({ error: resolved.error, code: "invalid_selection" });
      return;
    }

    const nextSlot: PlanDraftMealSlot = {
      ...found.slot,
      accompanimentSelections: resolved.labels,
      priceAdjustmentPaise: resolved.modifierPaise,
    };
    const updated = await casUpdateDraft(draft.id, version, {
      lineup: withSlotReplaced(lineup, deliveryDate, mealPeriod, nextSlot),
    });
    if (!updated) {
      staleVersion(res);
      return;
    }
    res.json({ draft: updated });
  },
);

router.get(
  "/plan-drafts/:id/accompaniment-options",
  async (req: Request, res: Response) => {
    const parsed = z
      .object({ deliveryDate: isoDate, mealPeriod: mealPeriodEnum })
      .safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const draft = await requireEditableDraft(req, res);
    if (!draft) return;
    const lineup = requireLineup(draft, res);
    if (!lineup) return;

    const found = findSlot(lineup, parsed.data.deliveryDate, parsed.data.mealPeriod);
    if (!found) {
      res.status(404).json({ error: "slot not found" });
      return;
    }
    const dishes = await liveDishes();
    const dish = dishes.find((d) => d.id === found.slot.dishId);
    if (!dish) {
      res.status(409).json({
        error: "this meal's dish is no longer available",
        code: "dish_unavailable",
      });
      return;
    }
    res.json({
      groups: dish.customizations,
      selected: found.slot.accompanimentSelections,
    });
  },
);

router.post(
  "/plan-drafts/:id/lineup/shuffle",
  async (req: Request, res: Response) => {
    const parsed = versionOnlySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const draft = await requireEditableDraft(req, res);
    if (!draft) return;
    const lineup = requireLineup(draft, res);
    if (!lineup) return;
    if (refuseIfNotCustomizable(draft, res)) return;

    try {
      const { lineup: shuffled, notes } = shuffleLineup(
        draft,
        lineup,
        draft.lockedSlotKeys ?? [],
        await liveDishes(),
        // Version doubles as the rotation seed, so consecutive shuffles land
        // differently without needing a random source (which would make the
        // engine untestable and non-reproducible).
        draft.version,
      );
      const updated = await casUpdateDraft(draft.id, parsed.data.version, {
        lineup: shuffled,
        // Exactly one Undo step, per the rebuild spec.
        previousLineup: lineup,
      });
      if (!updated) {
        staleVersion(res);
        return;
      }
      res.json({ draft: updated, notes });
    } catch (err: unknown) {
      if (!(err instanceof PlanDraftGenerationError)) throw err;
      res.status(422).json({
        error: err.message,
        code: err.code,
        details: err.details,
      });
    }
  },
);

router.post(
  "/plan-drafts/:id/lineup/undo",
  async (req: Request, res: Response) => {
    const parsed = versionOnlySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const draft = await requireEditableDraft(req, res);
    if (!draft) return;

    const previous = draft.previousLineup;
    if (!previous || previous.length === 0) {
      res.status(409).json({ error: "nothing to undo", code: "no_undo" });
      return;
    }

    const updated = await casUpdateDraft(draft.id, parsed.data.version, {
      lineup: previous,
      previousLineup: null,
    });
    if (!updated) {
      staleVersion(res);
      return;
    }
    res.json({ draft: updated });
  },
);

function addKey(existing: string[] | null, key: string): string[] {
  const set = new Set(existing ?? []);
  set.add(key);
  return Array.from(set);
}

export default router;
