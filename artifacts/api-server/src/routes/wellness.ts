import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuthUser as requireAuth } from "../middlewares/requireAuth";
import { and, asc, eq, gte, lte, sql, isNull, desc } from "drizzle-orm";
import { z } from "zod/v4";
import crypto from "crypto";
import {
  db,
  nutritionLogsTable,
  dailyTargetsTable,
  wearableLinksTable,
  streaksTable,
  userPreferencesTable,
  fastingLogsTable,
  precisionPlanDraftsTable,
  type NutritionLog,
  type DailyTargets,
  type WearableLink,
  type Streak,
  type WearableProvider,
} from "@workspace/db";
import {
  PRECISION_PLAN_DRAFT_TTL_MS,
  setPrecisionPlanDraftCookie,
  readPrecisionPlanDraftCookie,
  resolvePrecisionPlanDraftAccess,
} from "../lib/precisionPlanDraftAuth";

const router: IRouter = Router();

// requireAuth: see shared middleware/requireAuth.ts

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysStr(start: string, n: number): string {
  const d = new Date(`${start}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return dayStr(d);
}

const ACTIVITY_BUMP: Record<string, number> = {
  sedentary: 0,
  light: 100,
  moderate: 200,
  active: 350,
  very_active: 500,
};

async function ensureTargets(userId: string): Promise<DailyTargets> {
  const [existing] = await db
    .select()
    .from(dailyTargetsTable)
    .where(eq(dailyTargetsTable.userId, userId));
  if (existing) return existing;
  // Seed from preferences when available so the UI starts with real numbers.
  const [prefs] = await db
    .select()
    .from(userPreferencesTable)
    .where(eq(userPreferencesTable.userId, userId));
  const seed = {
    userId,
    calorieTarget: prefs?.calorieTarget ?? 2000,
    proteinTargetGrams: prefs?.proteinTargetGrams ?? 80,
    fiberTargetGrams: 28,
    waterTargetMl: 2500,
    vegTargetServings: 3,
  };
  const [created] = await db
    .insert(dailyTargetsTable)
    .values(seed)
    .onConflictDoNothing()
    .returning();
  return created ?? seed;
}

interface DayTotals {
  date: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  waterMl: number;
  vegServings: number;
}

function emptyDay(date: string): DayTotals {
  return {
    date,
    calories: 0,
    proteinGrams: 0,
    carbsGrams: 0,
    fatGrams: 0,
    fiberGrams: 0,
    waterMl: 0,
    vegServings: 0,
  };
}

async function aggregateRange(
  userId: string,
  fromInclusive: string,
  toInclusive: string,
): Promise<DayTotals[]> {
  const rows = await db
    .select({
      date: sql<string>`to_char(${nutritionLogsTable.loggedFor}, 'YYYY-MM-DD')`,
      calories: sql<number>`coalesce(sum(${nutritionLogsTable.calories}), 0)`,
      protein: sql<number>`coalesce(sum(${nutritionLogsTable.proteinGrams}), 0)`,
      carbs: sql<number>`coalesce(sum(${nutritionLogsTable.carbsGrams}), 0)`,
      fat: sql<number>`coalesce(sum(${nutritionLogsTable.fatGrams}), 0)`,
      fiber: sql<number>`coalesce(sum(${nutritionLogsTable.fiberGrams}), 0)`,
      water: sql<number>`coalesce(sum(${nutritionLogsTable.waterMl}), 0)`,
      veg: sql<number>`coalesce(sum(${nutritionLogsTable.vegServings}), 0)`,
    })
    .from(nutritionLogsTable)
    .where(
      and(
        eq(nutritionLogsTable.userId, userId),
        gte(nutritionLogsTable.loggedFor, fromInclusive),
        lte(nutritionLogsTable.loggedFor, toInclusive),
      ),
    )
    .groupBy(sql`to_char(${nutritionLogsTable.loggedFor}, 'YYYY-MM-DD')`);

  const byDay = new Map<string, DayTotals>();
  for (const r of rows) {
    byDay.set(r.date, {
      date: r.date,
      calories: Number(r.calories),
      proteinGrams: Number(r.protein),
      carbsGrams: Number(r.carbs),
      fatGrams: Number(r.fat),
      fiberGrams: Number(r.fiber),
      waterMl: Number(r.water),
      vegServings: Number(r.veg),
    });
  }
  // Fill missing days so the UI can render bars without holes.
  const out: DayTotals[] = [];
  let cursor = fromInclusive;
  while (cursor <= toInclusive) {
    out.push(byDay.get(cursor) ?? emptyDay(cursor));
    cursor = addDaysStr(cursor, 1);
  }
  return out;
}

async function loadStreaks(
  userId: string,
): Promise<Record<"protein" | "veg", Streak | null>> {
  const rows = await db
    .select()
    .from(streaksTable)
    .where(eq(streaksTable.userId, userId));
  const result: Record<"protein" | "veg", Streak | null> = {
    protein: null,
    veg: null,
  };
  for (const r of rows) result[r.kind] = r;
  return result;
}

async function loadWearables(userId: string): Promise<WearableLink[]> {
  return db
    .select()
    .from(wearableLinksTable)
    .where(eq(wearableLinksTable.userId, userId))
    .orderBy(asc(wearableLinksTable.id));
}

function effectiveCalorieTarget(
  base: number,
  wearables: WearableLink[],
): { effectiveCalorieTarget: number; activityKcal: number } {
  const today = todayStr();
  let activityKcal = 0;
  for (const w of wearables) {
    if (!w.connected || !w.lastSyncedAt) continue;
    if (dayStr(new Date(w.lastSyncedAt)) !== today) continue;
    activityKcal = Math.max(activityKcal, w.lastActivityKcal ?? 0);
  }
  return { effectiveCalorieTarget: base + activityKcal, activityKcal };
}

async function recomputeStreaks(userId: string): Promise<void> {
  const targets = await ensureTargets(userId);
  // Recompute for the trailing 30 days.
  const today = todayStr();
  const start = addDaysStr(today, -29);
  const days = await aggregateRange(userId, start, today);
  const proteinHits = new Set<string>();
  const vegHits = new Set<string>();
  for (const d of days) {
    if (d.proteinGrams >= targets.proteinTargetGrams) proteinHits.add(d.date);
    if (d.vegServings >= targets.vegTargetServings) vegHits.add(d.date);
  }
  for (const kind of ["protein", "veg"] as const) {
    const hits = kind === "protein" ? proteinHits : vegHits;
    let current = 0;
    let lastDayHit: string | null = null;
    // Walk backward from today as long as the day was a hit.
    let cursor = today;
    while (hits.has(cursor)) {
      current++;
      if (lastDayHit === null) lastDayHit = cursor;
      cursor = addDaysStr(cursor, -1);
    }
    // best of trailing 30
    let best = 0;
    let run = 0;
    for (const d of days) {
      if (hits.has(d.date)) {
        run++;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    }
    await db
      .insert(streaksTable)
      .values({
        userId,
        kind,
        currentDays: current,
        bestDays: Math.max(best, current),
        lastDayHit,
      })
      .onConflictDoUpdate({
        target: [streaksTable.userId, streaksTable.kind],
        set: {
          currentDays: current,
          bestDays: sql`greatest(${streaksTable.bestDays}, ${Math.max(
            best,
            current,
          )})`,
          lastDayHit,
        },
      });
  }
}

const manualLogSchema = z.object({
  label: z.string().min(1).max(128),
  loggedFor: z.string().optional(),
  calories: z.number().int().min(0).max(5000).default(0),
  proteinGrams: z.number().int().min(0).max(400).default(0),
  carbsGrams: z.number().int().min(0).max(800).default(0),
  fatGrams: z.number().int().min(0).max(300).default(0),
  fiberGrams: z.number().int().min(0).max(120).default(0),
  vegServings: z.number().int().min(0).max(20).default(0),
});

const waterLogSchema = z.object({
  ml: z.number().int().min(50).max(3000),
  loggedFor: z.string().optional(),
});

const targetsPatchSchema = z.object({
  calorieTarget: z.number().int().min(800).max(6000).optional(),
  proteinTargetGrams: z.number().int().min(20).max(400).optional(),
  fiberTargetGrams: z.number().int().min(5).max(120).optional(),
  waterTargetMl: z.number().int().min(500).max(8000).optional(),
  vegTargetServings: z.number().int().min(1).max(10).optional(),
});

const wearableConnectSchema = z.object({
  provider: z.enum(["apple_health", "google_fit", "health_connect"]),
});

const wearableSyncSchema = z.object({
  provider: z.enum(["apple_health", "google_fit", "health_connect"]),
  activityKcal: z.number().int().min(0).max(3000),
  steps: z.number().int().min(0).max(60000).optional(),
});

router.get("/wellness/today", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const targets = await ensureTargets(userId);
  const day = todayStr();
  const [days, logs, wearables, streaks] = await Promise.all([
    aggregateRange(userId, day, day),
    db
      .select()
      .from(nutritionLogsTable)
      .where(
        and(
          eq(nutritionLogsTable.userId, userId),
          eq(nutritionLogsTable.loggedFor, day),
        ),
      )
      .orderBy(asc(nutritionLogsTable.createdAt)),
    loadWearables(userId),
    loadStreaks(userId),
  ]);
  const totals = days[0];
  const { effectiveCalorieTarget: effCal, activityKcal } =
    effectiveCalorieTarget(targets.calorieTarget, wearables);
  res.json({
    date: day,
    targets: { ...targets, effectiveCalorieTarget: effCal, activityKcal },
    totals,
    logs,
    wearables,
    streaks,
  });
});

router.get("/wellness/week", async (req: Request, res: Response) => {
  const userId = (req as Request & { user?: { id?: string } }).user?.id;
  const today = todayStr();
  const start = addDaysStr(today, -6);
  if (!userId) {
    res.json({ from: start, to: today, days: [], targets: null });
    return;
  }
  const targets = await ensureTargets(userId);
  const days = await aggregateRange(userId, start, today);
  res.json({ from: start, to: today, days, targets });
});

router.post("/wellness/log", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const parsed = manualLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const data = parsed.data;
  const day = data.loggedFor ?? todayStr();
  const [row] = await db
    .insert(nutritionLogsTable)
    .values({
      userId,
      loggedFor: day,
      source: "manual",
      label: data.label,
      calories: data.calories,
      proteinGrams: data.proteinGrams,
      carbsGrams: data.carbsGrams,
      fatGrams: data.fatGrams,
      fiberGrams: data.fiberGrams,
      vegServings: data.vegServings,
    })
    .returning();
  await recomputeStreaks(userId);
  res.status(201).json({ log: row });
});

router.delete("/wellness/log/:id", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const result = await db
    .delete(nutritionLogsTable)
    .where(
      and(eq(nutritionLogsTable.id, id), eq(nutritionLogsTable.userId, userId)),
    )
    .returning();
  if (result.length === 0) {
    res.status(404).json({ error: "not found" });
    return;
  }
  await recomputeStreaks(userId);
  res.json({ ok: true });
});

router.post("/wellness/water", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const parsed = waterLogSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const day = parsed.data.loggedFor ?? todayStr();
  const [row] = await db
    .insert(nutritionLogsTable)
    .values({
      userId,
      loggedFor: day,
      source: "water",
      label: `Water ${parsed.data.ml} ml`,
      waterMl: parsed.data.ml,
    })
    .returning();
  res.status(201).json({ log: row });
});

router.put("/wellness/targets", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const parsed = targetsPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const current = await ensureTargets(userId);
  const next = { ...current, ...parsed.data };
  const [row] = await db
    .insert(dailyTargetsTable)
    .values(next)
    .onConflictDoUpdate({
      target: dailyTargetsTable.userId,
      set: {
        calorieTarget: next.calorieTarget,
        proteinTargetGrams: next.proteinTargetGrams,
        fiberTargetGrams: next.fiberTargetGrams,
        waterTargetMl: next.waterTargetMl,
        vegTargetServings: next.vegTargetServings,
      },
    })
    .returning();
  await recomputeStreaks(userId);
  res.json({ targets: row });
});

const fastingStartSchema = z.object({
  targetHours: z.number().int().min(1).max(72).default(16),
});

router.post("/wellness/fasting/start", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const parsed = fastingStartSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const [row] = await db.insert(fastingLogsTable).values({
    userId,
    targetHours: parsed.data.targetHours,
    startTime: new Date(),
  }).returning();
  res.status(201).json({ log: row });
});

router.post("/wellness/fasting/end", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  // find the active fast
  const [active] = await db.select().from(fastingLogsTable)
    .where(and(eq(fastingLogsTable.userId, userId), isNull(fastingLogsTable.endTime)))
    .orderBy(desc(fastingLogsTable.startTime))
    .limit(1);
  if (!active) {
    res.status(404).json({ error: "no active fast found" });
    return;
  }
  const [row] = await db.update(fastingLogsTable)
    .set({ endTime: new Date() })
    .where(eq(fastingLogsTable.id, active.id))
    .returning();
  res.json({ log: row });
});

router.get("/wellness/fasting/active", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const [active] = await db.select().from(fastingLogsTable)
    .where(and(eq(fastingLogsTable.userId, userId), isNull(fastingLogsTable.endTime)))
    .orderBy(desc(fastingLogsTable.startTime))
    .limit(1);
  res.json({ log: active || null });
});

router.post(
  "/wellness/wearable/connect",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const parsed = wearableConnectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }
    const provider = parsed.data.provider;
    const [row] = await db
      .insert(wearableLinksTable)
      .values({ userId, provider, connected: true })
      .onConflictDoUpdate({
        target: [wearableLinksTable.userId, wearableLinksTable.provider],
        set: { connected: true },
      })
      .returning();
    res.json({ link: row });
  },
);

router.post(
  "/wellness/wearable/disconnect",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const parsed = wearableConnectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }
    await db
      .update(wearableLinksTable)
      .set({ connected: false })
      .where(
        and(
          eq(wearableLinksTable.userId, userId),
          eq(wearableLinksTable.provider, parsed.data.provider),
        ),
      );
    res.json({ ok: true });
  },
);

router.post("/wellness/wearable/sync", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const parsed = wearableSyncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const provider = parsed.data.provider as WearableProvider;
  const [link] = await db
    .select()
    .from(wearableLinksTable)
    .where(
      and(
        eq(wearableLinksTable.userId, userId),
        eq(wearableLinksTable.provider, provider),
      ),
    );
  if (!link || !link.connected) {
    res.status(409).json({ error: "wearable not connected" });
    return;
  }
  const [updated] = await db
    .update(wearableLinksTable)
    .set({
      lastSyncedAt: new Date(),
      lastActivityKcal: parsed.data.activityKcal,
      lastSteps: parsed.data.steps ?? link.lastSteps,
    })
    .where(eq(wearableLinksTable.id, link.id))
    .returning();
  const today = todayStr();
  await db
    .delete(nutritionLogsTable)
    .where(
      and(
        eq(nutritionLogsTable.userId, userId),
        eq(nutritionLogsTable.loggedFor, today),
        eq(nutritionLogsTable.source, "wearable_adjust"),
      ),
    );
  if (parsed.data.activityKcal > 0) {
    await db
      .insert(nutritionLogsTable)
      .values({
        userId,
        loggedFor: today,
        source: "wearable_adjust",
        label: `Wearable Activity Adjustment (+${parsed.data.activityKcal} kcal)`,
        calories: parsed.data.activityKcal,
      });
  }
  await recomputeStreaks(userId);
  res.json({ link: updated });
});

router.get("/wellness/streaks", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const streaks = await loadStreaks(userId);
  res.json({ streaks });
});

router.get("/wellness/family", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { usersTable } = await import("@workspace/db");

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user || !user.familyGroupId) {
    res.json({ members: [{
      id: userId,
      name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : "You",
      relation: "You (Self)",
      avatar: user?.profileImageUrl || "🧑",
      healthScore: 9.0,
      streakDays: 0,
      hydrationPercent: 0,
      proteinPercent: 0,
      points: 100,
      badge: "New Member",
      rank: 1
    }] });
    return;
  }

  const familyUsers = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.familyGroupId, user.familyGroupId));

  const members = familyUsers.map((m, idx) => ({
    id: m.id,
    name: m.firstName ? `${m.firstName} ${m.lastName || ''}`.trim() : "Member",
    relation: m.id === userId ? "You (Self)" : "Family Member",
    avatar: m.profileImageUrl || "🧑",
    healthScore: 9.0,
    streakDays: 0,
    hydrationPercent: 0,
    proteinPercent: 0,
    points: 100 * (familyUsers.length - idx), // Mocked scoring logic for Phase 1
    badge: "Member",
    rank: idx + 1
  }));

  members.sort((a, b) => b.points - a.points);
  members.forEach((m, idx) => m.rank = idx + 1);

  res.json({ members });
});

const precisionPlannerInputSchema = z.object({
  age: z.number().int().min(12).max(120).default(30),
  gender: z.enum(["male", "female", "other"]).default("male"),
  heightCm: z.number().int().min(100).max(250).default(170),
  weightKg: z.number().int().min(30).max(300).default(70),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).default("moderate"),
  goal: z.enum(["fat_loss", "muscle_gain", "maintenance", "diabetic_friendly"]).default("fat_loss"),
  dietPreference: z.enum(["any", "veg", "vegan", "keto"]).default("any"),
  allergens: z.array(z.string()).optional(),
});

/**
 * Generates the plan AND persists it as an authoritative draft (opaque id,
 * guest-cookie ownership — same security shape as plan-drafts, see
 * lib/precisionPlanDraftAuth.ts). Before this, the plan existed only in the
 * caller's React state: navigating away (including the sign-in redirect the
 * checkout handoff could trigger) silently discarded it, and the "Checkout"
 * CTA pointed at a plan id (`7day_precision`) that PLAN_CATALOG has never
 * heard of, so checkout.tsx's own `if (!id) redirect("/plans")` bounced the
 * customer to a generic plans page with zero explanation. See
 * docs/audit/PRECISION-PLANNER-DRAFT-ID.md.
 */
router.post("/wellness/precision-planner/generate", async (req: Request, res: Response) => {
  const parsed = precisionPlannerInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const { generatePrecisionPlanLogic } = await import("../lib/icmrPrecisionPlanner");
  const plan = await generatePrecisionPlanLogic(parsed.data);

  const id = crypto.randomBytes(32).toString("hex");
  const userId = req.isAuthenticated() ? req.user.id : null;
  await db.insert(precisionPlanDraftsTable).values({
    id,
    userId,
    input: parsed.data,
    result: plan,
    expiresAt: new Date(Date.now() + PRECISION_PLAN_DRAFT_TTL_MS),
  });
  if (!userId) setPrecisionPlanDraftCookie(res, id);

  res.json({ plan, draftId: id });
});

/** Resolve a previously-generated draft by id — lets the results screen (or
 *  whatever it hands off to) survive a reload or a sign-in redirect instead
 *  of forcing the customer to redo the whole quiz. */
router.get("/wellness/precision-planner/drafts/:id", async (req: Request, res: Response) => {
  const id = typeof req.params.id === "string" ? req.params.id : "";
  if (!id) {
    res.status(400).json({ error: "missing draft id" });
    return;
  }
  const [draft] = await db
    .select()
    .from(precisionPlanDraftsTable)
    .where(eq(precisionPlanDraftsTable.id, id))
    .limit(1);
  if (!draft || draft.expiresAt.getTime() < Date.now()) {
    res.status(404).json({ error: "draft not found" });
    return;
  }
  const access = resolvePrecisionPlanDraftAccess(req, draft);
  if (!access.ok) {
    res.status(access.status).json({ error: "draft not found" });
    return;
  }
  res.json({ draft: { id: draft.id, input: draft.input, result: draft.result } });
});

/** Claim a guest-owned draft once the customer signs in — same
 *  cookie-possession-required pattern as POST /plan-drafts/:id/claim. */
router.post(
  "/wellness/precision-planner/drafts/:id/claim",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!id) {
      res.status(400).json({ error: "missing draft id" });
      return;
    }
    const [draft] = await db
      .select()
      .from(precisionPlanDraftsTable)
      .where(eq(precisionPlanDraftsTable.id, id))
      .limit(1);
    if (!draft || draft.expiresAt.getTime() < Date.now()) {
      res.status(404).json({ error: "draft not found" });
      return;
    }
    if (draft.userId != null) {
      if (draft.userId === userId) {
        res.json({ draft: { id: draft.id, input: draft.input, result: draft.result } });
        return;
      }
      res.status(404).json({ error: "draft not found" });
      return;
    }
    if (readPrecisionPlanDraftCookie(req) !== draft.id) {
      res.status(404).json({ error: "draft not found" });
      return;
    }
    const [claimed] = await db
      .update(precisionPlanDraftsTable)
      .set({ userId })
      .where(
        and(
          eq(precisionPlanDraftsTable.id, id),
          isNull(precisionPlanDraftsTable.userId),
        ),
      )
      .returning();
    if (!claimed) {
      res.status(409).json({ error: "draft was claimed elsewhere" });
      return;
    }
    res.json({ draft: { id: claimed.id, input: claimed.input, result: claimed.result } });
  },
);

router.post("/wellness/pantry-scan", async (req: Request, res: Response) => {
  const rawImageContent = (req.body?.imageContent as string) ?? "";
  const { scanPantryVisionLogic } = await import("../lib/pantryVisionScanner");
  const scanResult = await scanPantryVisionLogic(rawImageContent);
  res.json({ scanResult });
});

export default router;

// Exposed for the order-pipeline auto-logger.
export { ensureTargets, recomputeStreaks };
export type { NutritionLog };
