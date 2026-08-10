import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { and, eq, isNull, ne, notInArray, sql } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  planDraftsTable,
  type PlanDraft,
  type PlanDraftStatus,
} from "@workspace/db";
import { PLAN_CATALOG } from "@workspace/subscription-rules";
import { requireAuthUser } from "../middlewares/requireAuth";
import {
  PLAN_DRAFT_TTL_MS,
  setPlanDraftCookie,
  readPlanDraftCookie,
  resolvePlanDraftAccess,
} from "../lib/planDraftAuth";
import { casUpdateDraft, loadLiveDraft } from "../lib/planDraftStore";
import {
  CLIENT_SETTABLE_STATUS_VALUES,
  canTransitionPlanDraftStatus,
  isPlanDraftStatusTerminal,
} from "../lib/planDraftStateMachine";

// ─────────────────────────────────────────────────────────────────────────────
// PlanDraft routes (PR A2.1 — domain and persistence only).
//
// This is the "create / restore draft" slice of the full API contract the
// rebuild spec lists. Generation, shuffle/candidates, delivery/quote, and
// subscription-origination endpoints are later PRs (A2.2-A2.4) and are
// deliberately NOT here — a PlanDraft created by this router can only ever
// reach "ready_to_generate" until an engine that doesn't exist yet is built.
// ─────────────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

const TERMINAL_STATUSES: PlanDraftStatus[] = [
  "converted",
  "abandoned",
  "superseded",
];

function paramId(raw: unknown): string {
  return typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
}

const journeyEnum = z.enum(["recommended", "custom"]);
const acquisitionContextEnum = z.enum([
  "recommended",
  "custom",
  "trial",
  "corporate_sponsored",
  "partner_discounted",
  "rd_referred",
  "challenge_support",
]);
const mealPeriodEnum = z.enum(["breakfast", "lunch", "dinner", "snack"]);

const mealtimeSchema = z.object({
  periods: z.array(mealPeriodEnum).min(1).max(4),
});

const routineSchema = z.object({
  mealPeriods: z.array(mealPeriodEnum).min(1).max(4),
  daysPerWeek: z.number().int().min(1).max(7),
  deliveryContext: z.string().trim().min(1).max(120),
});

const intensitySchema = z.object({
  portionProfile: z.enum(["light", "standard", "hearty"]),
  proteinDirection: z.enum(["lower", "standard", "higher"]),
  carbDirection: z.enum(["lower", "standard", "higher"]),
  // Capped to 3 per the rebuild spec ("up to three nutrition priorities").
  priorities: z.array(z.string().trim().min(1).max(48)).max(3),
});

const durationSchema = z.object({
  cycle: z.enum(["weekly", "monthly", "quarterly"]),
  renewal: z.enum(["auto_renew", "end_after", "decide_later"]),
});

const tagListSchema = z.array(z.string().trim().min(1).max(64)).max(32);
const shortLabel = (max: number) => z.string().trim().min(1).max(max);

function isKnownPlanId(planId: string): boolean {
  return Object.prototype.hasOwnProperty.call(PLAN_CATALOG, planId);
}

/** Fields an already-generated lineup was derived from. Changing any of them
 *  makes that lineup either unsafe (the first three) or structurally wrong for
 *  the plan the customer now wants (the rest). */
const LINEUP_INPUT_KEYS = [
  "hardAllergens",
  "hardExclusions",
  "dietaryPattern",
  "planId",
  "mealtime",
  "routine",
  "duration",
] as const;

/** True when this PATCH actually changes one of those inputs. Re-sending an
 *  identical value is not a change and must not discard a good lineup. */
function changesLineupInputs(
  draft: PlanDraft,
  patch: Record<string, unknown>,
): boolean {
  return LINEUP_INPUT_KEYS.some((key) => {
    if (patch[key] === undefined) return false;
    return JSON.stringify(patch[key]) !== JSON.stringify(draft[key]);
  });
}

const createDraftSchema = z.object({
  journey: journeyEnum,
  acquisitionContext: acquisitionContextEnum.optional(),
  planId: z.string().min(1).max(32).optional(),
});

const patchDraftSchema = z.object({
  version: z.number().int().min(1),
  status: z.enum(CLIENT_SETTABLE_STATUS_VALUES).optional(),
  planId: z.string().min(1).max(32).optional(),
  goal: shortLabel(64).optional(),
  mealtime: mealtimeSchema.optional(),
  routine: routineSchema.optional(),
  dietaryPattern: shortLabel(32).optional(),
  hardAllergens: tagListSchema.optional(),
  hardExclusions: tagListSchema.optional(),
  softDislikes: tagListSchema.optional(),
  spicePreference: shortLabel(16).optional(),
  varietyPreference: shortLabel(16).optional(),
  intensity: intensitySchema.optional(),
  duration: durationSchema.optional(),
});

router.post("/plan-drafts", async (req: Request, res: Response) => {
  const parsed = createDraftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid request" });
    return;
  }
  const { journey, acquisitionContext, planId } = parsed.data;

  if (planId !== undefined) {
    if (journey !== "recommended") {
      res
        .status(400)
        .json({ error: "planId is only valid for the recommended journey" });
      return;
    }
    if (!isKnownPlanId(planId)) {
      res.status(400).json({ error: "unknown planId" });
      return;
    }
  }

  const id = crypto.randomBytes(32).toString("hex");
  const userId = req.isAuthenticated() ? req.user.id : null;
  const now = Date.now();

  const [draft] = await db
    .insert(planDraftsTable)
    .values({
      id,
      userId,
      journey,
      acquisitionContext: acquisitionContext ?? null,
      planId: planId ?? null,
      expiresAt: new Date(now + PLAN_DRAFT_TTL_MS),
    })
    .returning();

  setPlanDraftCookie(res, id);
  res.status(201).json({ draft });
});

router.get("/plan-drafts/:id", async (req: Request, res: Response) => {
  const id = paramId(req.params.id);
  const draft = await loadLiveDraft(id);
  if (!draft) {
    res.status(404).json({ error: "draft not found" });
    return;
  }

  const access = resolvePlanDraftAccess(req, draft);
  if (!access.ok) {
    res.status(access.status).json({ error: "draft not found" });
    return;
  }

  res.json({ draft });
});

router.patch("/plan-drafts/:id", async (req: Request, res: Response) => {
  const id = paramId(req.params.id);
  const parsed = patchDraftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid request" });
    return;
  }
  const { version, status, planId, ...rest } = parsed.data;

  const draft = await loadLiveDraft(id);
  if (!draft) {
    res.status(404).json({ error: "draft not found" });
    return;
  }

  const access = resolvePlanDraftAccess(req, draft);
  if (!access.ok) {
    res.status(access.status).json({ error: "draft not found" });
    return;
  }

  if (isPlanDraftStatusTerminal(draft.status)) {
    res.status(409).json({ error: "draft is no longer editable" });
    return;
  }

  if (planId !== undefined) {
    if (draft.journey !== "recommended") {
      res
        .status(400)
        .json({ error: "planId is only valid for the recommended journey" });
      return;
    }
    if (!isKnownPlanId(planId)) {
      res.status(400).json({ error: "unknown planId" });
      return;
    }
  }

  if (status !== undefined && !canTransitionPlanDraftStatus(draft.status, status)) {
    res.status(409).json({
      error: "invalid status transition",
      from: draft.status,
      to: status,
    });
    return;
  }

  // A lineup is only as safe as the answers it was generated from. Editing an
  // allergen, an exclusion, the dietary pattern or the plan's shape after
  // generation would otherwise leave a persisted lineup that the customer's
  // CURRENT answers would never have produced — a dairy dish still sitting in
  // the plan of someone who just declared a dairy allergy. Discard it and send
  // them back to re-generate rather than keeping a lineup we know is stale.
  const invalidatesLineup =
    draft.lineup != null && changesLineupInputs(draft, parsed.data);
  if (
    invalidatesLineup &&
    !canTransitionPlanDraftStatus(draft.status, "collecting_preferences")
  ) {
    res.status(409).json({
      error: "this plan has progressed too far to change these answers",
      code: "lineup_locked",
      from: draft.status,
    });
    return;
  }

  const updated = await casUpdateDraft(id, version, {
    ...rest,
    ...(planId !== undefined ? { planId } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(invalidatesLineup
      ? {
          lineup: null,
          previousLineup: null,
          lockedSlotKeys: [],
          generationError: null,
          // Overrides any status the same request asked for: whatever the
          // caller wanted, there is no lineup any more.
          status: "collecting_preferences" as const,
        }
      : {}),
  });

  if (!updated) {
    res.status(409).json({ error: "draft was modified elsewhere", code: "stale_version" });
    return;
  }

  res.json({ draft: updated });
});

router.post("/plan-drafts/:id/claim", async (req: Request, res: Response) => {
  const userId = requireAuthUser(req, res);
  if (!userId) return;

  const id = paramId(req.params.id);
  const draft = await loadLiveDraft(id);
  if (!draft) {
    res.status(404).json({ error: "draft not found" });
    return;
  }

  if (draft.userId != null) {
    if (draft.userId === userId) {
      res.json({ draft });
      return;
    }
    res.status(404).json({ error: "draft not found" });
    return;
  }

  // Guest drafts require cookie possession to claim — knowing the id alone
  // (e.g. a leaked URL) must never be enough to attach someone else's
  // in-progress configuration to your account.
  if (readPlanDraftCookie(req) !== draft.id) {
    res.status(404).json({ error: "draft not found" });
    return;
  }

  const now = Date.now();
  const claimed = await db.transaction(async (tx) => {
    // A customer should have at most one live draft per journey. Claiming a
    // new guest draft supersedes any other draft this user already claimed
    // for the same journey that hasn't reached a terminal status.
    await tx
      .update(planDraftsTable)
      .set({
        status: "superseded",
        version: sql`${planDraftsTable.version} + 1`,
      })
      .where(
        and(
          eq(planDraftsTable.userId, userId),
          eq(planDraftsTable.journey, draft.journey),
          ne(planDraftsTable.id, draft.id),
          notInArray(planDraftsTable.status, TERMINAL_STATUSES),
        ),
      );

    const [row] = await tx
      .update(planDraftsTable)
      .set({
        userId,
        version: draft.version + 1,
        expiresAt: new Date(now + PLAN_DRAFT_TTL_MS),
      })
      .where(and(eq(planDraftsTable.id, id), isNull(planDraftsTable.userId)))
      .returning();
    return row;
  });

  if (!claimed) {
    // Someone else claimed it in the race window between our read and the
    // transaction — treat exactly like "not yours".
    res.status(404).json({ error: "draft not found" });
    return;
  }

  res.json({ draft: claimed });
});

export default router;
