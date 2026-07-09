import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuthUser as requireAuth } from "../middlewares/requireAuth";
import {
  db,
  subscriptionsTable,
  subscriptionMembersTable,
  subscriptionDeliveriesTable,
  mealCreditsTable,
  userPreferencesTable,
  type SubscriptionCadence,
  type SubscriptionItem,
  type SubscriptionDelivery,
} from "@workspace/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { invalidateUserBrief } from "../lib/userBrief";
import { resolveDishBySlug } from "../lib/menuResolver";
import { evaluateDishForPreferences } from "@workspace/preferences-match";

const router: IRouter = Router();

const cadenceSchema = z.enum(["weekly", "fortnightly", "monthly"]);
const dietSchema = z.enum(["any", "veg", "nonveg"]);

const memberInputSchema = z.object({
  name: z.string().min(1).max(64),
  diet: dietSchema.default("any"),
  allergens: z.array(z.string()).default([]),
  medicalConditions: z.array(z.string()).default([]),
  dislikedIngredients: z.array(z.string()).default([]),
  lifestyle: z.string().max(32).optional(),
  spiceLevel: z.enum(["mild", "medium", "hot"]).default("medium"),
});

const itemSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  image: z.string(),
  quantity: z.number().int().positive(),
  unitPricePaise: z.number().int().nonnegative(),
  memberId: z.number().int().positive().optional().nullable(),
});

// Per-day plan: one entry per delivery day within a billing cycle.
// dayOffset is days from the cycle start (0-based, < cycle length).
const dayPlanEntrySchema = z.object({
  dayOffset: z.number().int().min(0).max(27),
  items: z.array(itemSchema).min(1).max(10),
});

const createSubscriptionSchema = z.object({
  cadence: cadenceSchema,
  mealsPerDelivery: z.number().int().positive().max(50),
  deliveryWindow: z.string().min(3).max(32),
  startDate: z.string().or(z.date()),
  // "trial" = one-off 3-day sampler at 25% off list; does not recur.
  // "standard" = the recurring plan priced by cadence.
  planType: z.enum(["standard", "trial"]).default("standard"),
  addressLabel: z.string().max(64).optional(),
  addressLine: z.string().max(256).optional(),
  city: z.string().max(64).optional(),
  pincode: z.string().max(16).optional(),
  phone: z.string().max(32).optional(),
  notes: z.string().max(512).optional(),
  members: z.array(memberInputSchema).min(1),
  defaultItems: z.array(itemSchema).default([]),
  // Day-first plans: when present, each entry becomes its own delivery
  // (scheduled per day), meals are counted server-side from the entries,
  // and the pattern repeats every billing cycle.
  dayPlan: z.array(dayPlanEntrySchema).max(28).optional(),
});

const swapItemsSchema = z.object({
  items: z.array(itemSchema).min(1),
});

const rescheduleSchema = z.object({
  scheduledFor: z.string().or(z.date()),
  deliveryWindow: z.string().min(3).max(32).optional(),
});

// "monthly" is a 4-week cycle (28 days) so a weekly menu pattern always
// divides evenly — a true 30-day month would drift against day-of-week
// plans by 2 days every cycle.
const CADENCE_DAYS: Record<SubscriptionCadence, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 28,
};

// With a per-day plan every plan generates ~4 weeks of dated deliveries
// ahead, regardless of billing cadence (4×7, 2×14, 1×28).
const CADENCE_CYCLES_AHEAD: Record<SubscriptionCadence, number> = {
  weekly: 4,
  fortnightly: 2,
  monthly: 1,
};

const PER_MEAL_PAISE = 26000;
const CADENCE_DISCOUNT: Record<SubscriptionCadence, number> = {
  weekly: 0.95,
  fortnightly: 0.9,
  monthly: 0.85,
};

// First-order 3-day sampler: 25% off list (no cadence discount stacked).
const TRIAL_DISCOUNT = 0.75;
// Canonical marker persisted in `notes` so downstream logic (block
// recurring extension) can recognise a trial without a schema change.
// The API accepts `planType: "trial"`; this string is an internal detail.
const TRIAL_NOTE = "Trial: 3-Day Pack (25% off)";
// Legacy marker from the RD-plan trial flow — still recognised so old
// links and existing rows keep behaving as trials.
const LEGACY_TRIAL_NOTE = "RD Plan: 3-Day Trial Pack";

function isTrialSubscription(sub: { notes: string | null }): boolean {
  return sub.notes === TRIAL_NOTE || sub.notes === LEGACY_TRIAL_NOTE;
}

function computeDeliveryPricePaise(
  cadence: SubscriptionCadence,
  meals: number,
): number {
  return Math.round(meals * PER_MEAL_PAISE * CADENCE_DISCOUNT[cadence]);
}

function computeTrialPricePaise(meals: number): number {
  return Math.round(meals * PER_MEAL_PAISE * TRIAL_DISCOUNT);
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

// requireAuth: see shared middleware/requireAuth.ts

function parseIdParam(
  raw: unknown,
  res: Response,
  name = "id",
): number | null {
  const value = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    res.status(400).json({ error: `invalid ${name}` });
    return null;
  }
  return n;
}

async function loadSubscriptionForUser(
  subId: number,
  userId: string,
): Promise<typeof subscriptionsTable.$inferSelect | null> {
  const rows = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.id, subId),
        eq(subscriptionsTable.userId, userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function loadDeliveryForUser(
  deliveryId: number,
  userId: string,
): Promise<{
  delivery: SubscriptionDelivery;
  subscription: typeof subscriptionsTable.$inferSelect;
} | null> {
  const rows = await db
    .select({
      delivery: subscriptionDeliveriesTable,
      subscription: subscriptionsTable,
    })
    .from(subscriptionDeliveriesTable)
    .innerJoin(
      subscriptionsTable,
      eq(subscriptionDeliveriesTable.subscriptionId, subscriptionsTable.id),
    )
    .where(
      and(
        eq(subscriptionDeliveriesTable.id, deliveryId),
        eq(subscriptionsTable.userId, userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function recomputeNextDeliveryAt(
  subscriptionId: number,
  fallback: Date,
): Promise<Date> {
  const next = await db
    .select({ scheduledFor: subscriptionDeliveriesTable.scheduledFor })
    .from(subscriptionDeliveriesTable)
    .where(
      and(
        eq(subscriptionDeliveriesTable.subscriptionId, subscriptionId),
        eq(subscriptionDeliveriesTable.status, "upcoming"),
      ),
    )
    .orderBy(asc(subscriptionDeliveriesTable.scheduledFor))
    .limit(1);
  const value = next[0]?.scheduledFor ?? fallback;
  await db
    .update(subscriptionsTable)
    .set({ nextDeliveryAt: value })
    .where(eq(subscriptionsTable.id, subscriptionId));
  return value;
}

async function generateDeliveriesForSubscription(
  subscriptionId: number,
  cadence: SubscriptionCadence,
  startFrom: Date,
  count: number,
  deliveryWindow: string,
  defaultItems: SubscriptionItem[],
  dayPlan?: Array<{ dayOffset: number; items: SubscriptionItem[] }> | null,
): Promise<SubscriptionDelivery[]> {
  const stepDays = CADENCE_DAYS[cadence];
  const rows: Array<typeof subscriptionDeliveriesTable.$inferInsert> = [];
  for (let i = 0; i < count; i++) {
    const cycleStart = addDays(startFrom, i * stepDays);
    if (dayPlan && dayPlan.length > 0) {
      // Day-first plan: one dated delivery per planned day in the cycle.
      for (const day of dayPlan) {
        rows.push({
          subscriptionId,
          scheduledFor: addDays(cycleStart, day.dayOffset),
          deliveryWindow,
          status: "upcoming",
          items: day.items,
        });
      }
    } else {
      rows.push({
        subscriptionId,
        scheduledFor: cycleStart,
        deliveryWindow,
        status: "upcoming",
        items: defaultItems,
      });
    }
  }
  if (rows.length === 0) return [];
  return db.insert(subscriptionDeliveriesTable).values(rows).returning();
}

async function validateDishForSubscription(
  dish: any,
  userId: string,
  subscriptionId?: number | null,
  newMembers?: Array<{
    diet: string;
    allergens: string[];
    medicalConditions?: string[];
    dislikedIngredients?: string[];
  }>,
  targetMemberId?: number | null,
): Promise<{ blocked: boolean; reasons: any[] }> {
  const [prefsRow] = await db
    .select()
    .from(userPreferencesTable)
    .where(eq(userPreferencesTable.userId, userId));
  const primaryMatch = evaluateDishForPreferences(dish, prefsRow ?? null, { strict: true });
  if (primaryMatch.blocked) return { blocked: true, reasons: primaryMatch.blockReasons };

  const subProfiles: Array<{
    diet: string;
    allergens: string[];
    medicalConditions?: string[];
    dislikedIngredients?: string[];
    id?: number;
  }> = [];
  if (newMembers && newMembers.length > 0) {
    subProfiles.push(...newMembers);
  } else if (subscriptionId != null) {
    const members = await db
      .select()
      .from(subscriptionMembersTable)
      .where(eq(subscriptionMembersTable.subscriptionId, subscriptionId));
    subProfiles.push(
      ...members.map((m) => ({
        id: m.id,
        diet: m.diet,
        allergens: m.allergens ?? [],
        medicalConditions: m.medicalConditions ?? [],
        dislikedIngredients: m.dislikedIngredients ?? [],
      })),
    );
  }

  if (targetMemberId != null && !subProfiles.some((m) => m.id === targetMemberId)) {
    return {
      blocked: true,
      reasons: [
        {
          code: "invalid_member_id",
          message: "Target member ID does not belong to this subscription",
        },
      ],
    };
  }

  for (const member of subProfiles) {
    if (targetMemberId != null && member.id != null && member.id !== targetMemberId) continue;
    const memberPrefs = {
      allergens: member.allergens ?? [],
      dislikedIngredients: member.dislikedIngredients ?? [],
      medicalConditions: member.medicalConditions ?? [],
      cuisines: [],
      dietaryStyle: (member.diet === "veg" ? "vegetarian" : member.diet === "nonveg" ? "omnivore" : "omnivore") as any,
    };
    const mMatch = evaluateDishForPreferences(dish, memberPrefs, { strict: true });
    if (mMatch.blocked) return { blocked: true, reasons: mMatch.blockReasons };
  }
  return { blocked: false, reasons: [] };
}

router.post("/subscriptions", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const parsed = createSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  // Day offsets must fall inside one billing cycle.
  if (data.dayPlan) {
    const cycleLen = CADENCE_DAYS[data.cadence];
    if (data.dayPlan.some((d) => d.dayOffset >= cycleLen)) {
      res.status(400).json({
        error: `dayPlan offsets must be < ${cycleLen} for ${data.cadence} cadence`,
      });
      return;
    }
  }
  const itemsToValidate = data.dayPlan
    ? data.dayPlan.flatMap((d) => d.items)
    : data.defaultItems;
  if (itemsToValidate.length > 0) {
    // Validate each unique dish once — day plans repeat dishes across days.
    const seenSlugs = new Set<string>();
    for (const item of itemsToValidate) {
      if (seenSlugs.has(item.slug)) continue;
      seenSlugs.add(item.slug);
      const dish = await resolveDishBySlug(item.slug);
      if (dish) {
        const match = await validateDishForSubscription(
          dish,
          userId,
          null,
          data.members,
          item.memberId,
        );
        if (match.blocked) {
          res.status(422).json({
            error: "Safety block",
            code: "safety_block",
            blocked: true,
            reasons: match.reasons,
          });
          return;
        }
      }
    }
  }
  const startDate = new Date(data.startDate);
  if (Number.isNaN(startDate.getTime())) {
    res.status(400).json({ error: "invalid startDate" });
    return;
  }
  const minStart = new Date();
  minStart.setUTCHours(0, 0, 0, 0);
  if (startDate < minStart) {
    res.status(400).json({ error: "startDate must be today or later" });
    return;
  }
  // A trial is any request that asks for planType:"trial" OR carries a
  // recognised trial marker in notes (keeps old RD-plan trial links working).
  const isTrial =
    data.planType === "trial" || isTrialSubscription({ notes: data.notes ?? null });

  // With a day plan the meal count is server-authoritative: sum of item
  // quantities across the cycle. The client's mealsPerDelivery is ignored
  // so displayed price can never drift from billed price.
  const mealsPerDelivery = data.dayPlan
    ? data.dayPlan.reduce(
        (total, d) => total + d.items.reduce((s, it) => s + it.quantity, 0),
        0,
      )
    : data.mealsPerDelivery;
  let pricePerDeliveryPaise = computeDeliveryPricePaise(
    data.cadence,
    mealsPerDelivery,
  );
  let generateCount = data.dayPlan ? CADENCE_CYCLES_AHEAD[data.cadence] : 4;
  // Normalise the persisted note so downstream trial detection is stable
  // regardless of which entry point created it.
  let notes = data.notes;

  if (isTrial) {
    pricePerDeliveryPaise = computeTrialPricePaise(mealsPerDelivery);
    generateCount = 1; // one-off 3-day sampler — does not recur
    notes = notes && notes !== LEGACY_TRIAL_NOTE ? notes : TRIAL_NOTE;
    if (notes !== TRIAL_NOTE && notes !== LEGACY_TRIAL_NOTE) {
      // Caller sent custom notes; append the canonical marker so the
      // trial is still recognisable later.
      notes = `${TRIAL_NOTE} — ${notes}`.slice(0, 512);
    }
  }

  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId,
      cadence: data.cadence,
      mealsPerDelivery,
      deliveryWindow: data.deliveryWindow,
      status: "active",
      startDate,
      nextDeliveryAt: startDate,
      pricePerDeliveryPaise,
      dayPlan: data.dayPlan ?? null,
      addressLabel: data.addressLabel,
      addressLine: data.addressLine,
      city: data.city,
      pincode: data.pincode,
      phone: data.phone,
      notes,
    })
    .returning();

  if (data.members.length > 0) {
    await db.insert(subscriptionMembersTable).values(
      data.members.map((m) => ({
        subscriptionId: sub.id,
        name: m.name,
        diet: m.diet,
        allergens: m.allergens,
        medicalConditions: m.medicalConditions,
        dislikedIngredients: m.dislikedIngredients,
        lifestyle: m.lifestyle,
        spiceLevel: m.spiceLevel,
      })),
    );
  }

  const deliveries = await generateDeliveriesForSubscription(
      sub.id,
      data.cadence,
      startDate,
      generateCount,
      data.deliveryWindow,
      data.defaultItems,
      data.dayPlan ?? null,
    );

  // A day plan's first delivery may sit after the cycle start (e.g. a
  // weekdays plan starting Saturday) — align nextDeliveryAt with reality.
  if (data.dayPlan && data.dayPlan.length > 0) {
    sub.nextDeliveryAt = await recomputeNextDeliveryAt(sub.id, startDate);
  }

  invalidateUserBrief(userId);
  res.status(201).json({ subscription: sub, deliveries });
});

router.get("/subscriptions", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const subs = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .orderBy(desc(subscriptionsTable.createdAt));
  res.json({ subscriptions: subs });
});

router.get("/subscriptions/:id", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const subId = parseIdParam(req.params.id, res);
  if (subId === null) return;
  const sub = await loadSubscriptionForUser(subId, userId);
  if (!sub) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const [members, deliveries] = await Promise.all([
    db
      .select()
      .from(subscriptionMembersTable)
      .where(eq(subscriptionMembersTable.subscriptionId, subId))
      .orderBy(asc(subscriptionMembersTable.id)),
    db
      .select()
      .from(subscriptionDeliveriesTable)
      .where(eq(subscriptionDeliveriesTable.subscriptionId, subId))
      .orderBy(asc(subscriptionDeliveriesTable.scheduledFor)),
  ]);
  res.json({ subscription: sub, members, deliveries });
});

router.post("/subscriptions/:id/pause", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const subId = parseIdParam(req.params.id, res);
  if (subId === null) return;
  const sub = await loadSubscriptionForUser(subId, userId);
  if (!sub) {
    res.status(404).json({ error: "not found" });
    return;
  }
  if (sub.status !== "active") {
    res.status(409).json({ error: "subscription is not active" });
    return;
  }
  const [updated] = await db
    .update(subscriptionsTable)
    .set({ status: "paused", pausedAt: new Date() })
    .where(eq(subscriptionsTable.id, subId))
    .returning();
  invalidateUserBrief(userId);
  await db
    .update(subscriptionDeliveriesTable)
    .set({ status: "paused" })
    .where(
      and(
        eq(subscriptionDeliveriesTable.subscriptionId, subId),
        eq(subscriptionDeliveriesTable.status, "upcoming"),
      ),
    );
  res.json({ subscription: updated });
});

router.post(
  "/subscriptions/:id/resume",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = parseIdParam(req.params.id, res);
    if (subId === null) return;
    const sub = await loadSubscriptionForUser(subId, userId);
    if (!sub) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (sub.status !== "paused") {
      res.status(409).json({ error: "subscription is not paused" });
      return;
    }
    const [updated] = await db
      .update(subscriptionsTable)
      .set({ status: "active", pausedAt: null })
      .where(eq(subscriptionsTable.id, subId))
      .returning();
    invalidateUserBrief(userId);
    await db
      .update(subscriptionDeliveriesTable)
      .set({ status: "upcoming" })
      .where(
        and(
          eq(subscriptionDeliveriesTable.subscriptionId, subId),
          eq(subscriptionDeliveriesTable.status, "paused"),
        ),
      );
    res.json({ subscription: updated });
  },
);

router.post(
  "/subscriptions/:id/cancel",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = parseIdParam(req.params.id, res);
    if (subId === null) return;
    const sub = await loadSubscriptionForUser(subId, userId);
    if (!sub) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (sub.status === "cancelled") {
      res.status(409).json({ error: "subscription already cancelled" });
      return;
    }
    const [updated] = await db
      .update(subscriptionsTable)
      .set({ status: "cancelled" })
      .where(eq(subscriptionsTable.id, subId))
      .returning();
    invalidateUserBrief(userId);
    await db
      .update(subscriptionDeliveriesTable)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(subscriptionDeliveriesTable.subscriptionId, subId),
          eq(subscriptionDeliveriesTable.status, "upcoming"),
        ),
      );
    res.json({ subscription: updated });
  },
);


router.post(
  "/subscriptions/:id/members",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = parseIdParam(req.params.id, res);
    if (subId === null) return;
    const sub = await loadSubscriptionForUser(subId, userId);
    if (!sub) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const parsed = memberInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }
    const [member] = await db
      .insert(subscriptionMembersTable)
      .values({ subscriptionId: subId, ...parsed.data })
      .returning();
    invalidateUserBrief(userId);
    res.status(201).json({ member });
  },
);

router.delete(
  "/subscriptions/:id/members/:memberId",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = parseIdParam(req.params.id, res);
    if (subId === null) return;
    const memberId = parseIdParam(req.params.memberId, res, "memberId");
    if (memberId === null) return;
    const sub = await loadSubscriptionForUser(subId, userId);
    if (!sub) {
      res.status(404).json({ error: "not found" });
      return;
    }
    await db
      .delete(subscriptionMembersTable)
      .where(
        and(
          eq(subscriptionMembersTable.id, memberId),
          eq(subscriptionMembersTable.subscriptionId, subId),
        ),
      );
    invalidateUserBrief(userId);
    res.json({ ok: true });
  },
);

router.post(
  "/subscription-deliveries/:id/skip",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const deliveryId = parseIdParam(req.params.id, res, "deliveryId");
    if (deliveryId === null) return;
    const found = await loadDeliveryForUser(deliveryId, userId);
    if (!found) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (found.delivery.status !== "upcoming") {
      res.status(400).json({ error: "delivery is not upcoming" });
      return;
    }
    const [updated] = await db
      .update(subscriptionDeliveriesTable)
      .set({ status: "skipped" })
      .where(eq(subscriptionDeliveriesTable.id, deliveryId))
      .returning();

    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 60);
    await db.insert(mealCreditsTable).values({
      userId,
      subscriptionId: found.subscription.id,
      deliveryId,
      amount: found.subscription.mealsPerDelivery,
      reason: "skipped_delivery",
      expiresAt,
    });

    await recomputeNextDeliveryAt(
      found.subscription.id,
      found.subscription.nextDeliveryAt,
    );
    invalidateUserBrief(userId);
    res.json({ delivery: updated });
  },
);

router.post(
  "/subscriptions/next-delivery/add-item",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }
    // Find user's earliest upcoming delivery across any active subscription.
    const rows = await db
      .select({
        delivery: subscriptionDeliveriesTable,
        subscription: subscriptionsTable,
      })
      .from(subscriptionDeliveriesTable)
      .innerJoin(
        subscriptionsTable,
        eq(subscriptionDeliveriesTable.subscriptionId, subscriptionsTable.id),
      )
      .where(
        and(
          eq(subscriptionsTable.userId, userId),
          eq(subscriptionsTable.status, "active"),
          eq(subscriptionDeliveriesTable.status, "upcoming"),
        ),
      )
      .orderBy(asc(subscriptionDeliveriesTable.scheduledFor))
      .limit(1);
    const next = rows[0];
    if (!next) {
      res.status(409).json({ error: "no_upcoming_delivery" });
      return;
    }
    const dish = await resolveDishBySlug(parsed.data.slug);
    if (dish) {
      const match = await validateDishForSubscription(
        dish,
        userId,
        next.subscription.id,
        undefined,
        parsed.data.memberId,
      );
      if (match.blocked) {
        res.status(422).json({
          error: "Safety block",
          code: "safety_block",
          blocked: true,
          reasons: match.reasons,
        });
        return;
      }
    }
    const items = [...next.delivery.items];
    const existing = items.findIndex(
      (it) => it.slug === parsed.data.slug && (it.memberId ?? null) === (parsed.data.memberId ?? null),
    );
    if (existing >= 0) {
      const cur = items[existing];
      if (cur) items[existing] = { ...cur, quantity: cur.quantity + parsed.data.quantity };
    } else {
      items.push(parsed.data);
    }
    const [updated] = await db
      .update(subscriptionDeliveriesTable)
      .set({ items })
      .where(eq(subscriptionDeliveriesTable.id, next.delivery.id))
      .returning();
    invalidateUserBrief(userId);
    res.json({ delivery: updated, scheduledFor: next.delivery.scheduledFor });
  },
);

router.post(
  "/subscription-deliveries/:id/swap",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const deliveryId = parseIdParam(req.params.id, res, "deliveryId");
    if (deliveryId === null) return;
    const found = await loadDeliveryForUser(deliveryId, userId);
    if (!found) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (found.delivery.status !== "upcoming") {
      res.status(400).json({ error: "delivery is not upcoming" });
      return;
    }
    const parsed = swapItemsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }
    for (const item of parsed.data.items) {
      const dish = await resolveDishBySlug(item.slug);
      if (dish) {
        const match = await validateDishForSubscription(
          dish,
          userId,
          found.subscription.id,
          undefined,
          item.memberId,
        );
        if (match.blocked) {
          res.status(422).json({
            error: "Safety block",
            code: "safety_block",
            blocked: true,
            reasons: match.reasons,
          });
          return;
        }
      }
    }
    const [updated] = await db
      .update(subscriptionDeliveriesTable)
      .set({ items: parsed.data.items })
      .where(eq(subscriptionDeliveriesTable.id, deliveryId))
      .returning();
    invalidateUserBrief(userId);
    res.json({ delivery: updated });
  },
);

router.post(
  "/subscription-deliveries/:id/reschedule",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const deliveryId = parseIdParam(req.params.id, res, "deliveryId");
    if (deliveryId === null) return;
    const found = await loadDeliveryForUser(deliveryId, userId);
    if (!found) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (found.delivery.status !== "upcoming") {
      res.status(400).json({ error: "delivery is not upcoming" });
      return;
    }
    const parsed = rescheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }
    const newDate = new Date(parsed.data.scheduledFor);
    if (Number.isNaN(newDate.getTime())) {
      res.status(400).json({ error: "invalid scheduledFor" });
      return;
    }
    const minDate = new Date();
    minDate.setUTCHours(0, 0, 0, 0);
    if (newDate < minDate) {
      res.status(400).json({ error: "cannot reschedule to the past" });
      return;
    }
    const [updated] = await db
      .update(subscriptionDeliveriesTable)
      .set({
        scheduledFor: newDate,
        deliveryWindow:
          parsed.data.deliveryWindow ?? found.delivery.deliveryWindow,
      })
      .where(eq(subscriptionDeliveriesTable.id, deliveryId))
      .returning();
    await recomputeNextDeliveryAt(
      found.subscription.id,
      found.subscription.nextDeliveryAt,
    );
    invalidateUserBrief(userId);
    res.json({ delivery: updated });
  },
);

router.get("/meal-credits", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const credits = await db
    .select()
    .from(mealCreditsTable)
    .where(eq(mealCreditsTable.userId, userId))
    .orderBy(desc(mealCreditsTable.createdAt));
  const totalRows = await db
    .select({
      total: sql<number>`coalesce(sum(${mealCreditsTable.amount}), 0)`,
    })
    .from(mealCreditsTable)
    .where(
      and(
        eq(mealCreditsTable.userId, userId),
        sql`${mealCreditsTable.consumedAt} is null`,
        sql`(${mealCreditsTable.expiresAt} is null or ${mealCreditsTable.expiresAt} > now())`,
      ),
    );
  res.json({ credits, balance: Number(totalRows[0]?.total ?? 0) });
});

const updateWindowSchema = z.object({
  deliveryWindow: z.string().min(3).max(32),
});

router.post(
  "/subscriptions/:id/delivery-window",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = parseIdParam(req.params.id, res);
    if (subId === null) return;
    const sub = await loadSubscriptionForUser(subId, userId);
    if (!sub) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const parsed = updateWindowSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }
    const [updated] = await db
      .update(subscriptionsTable)
      .set({ deliveryWindow: parsed.data.deliveryWindow })
      .where(eq(subscriptionsTable.id, subId))
      .returning();
    await db
      .update(subscriptionDeliveriesTable)
      .set({ deliveryWindow: parsed.data.deliveryWindow })
      .where(
        and(
          eq(subscriptionDeliveriesTable.subscriptionId, subId),
          eq(subscriptionDeliveriesTable.status, "upcoming"),
        ),
      );
    invalidateUserBrief(userId);
    res.json({ subscription: updated });
  },
);

router.post(
  "/subscriptions/:id/generate-next",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = parseIdParam(req.params.id, res);
    if (subId === null) return;
    const sub = await loadSubscriptionForUser(subId, userId);
    if (!sub) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (isTrialSubscription(sub)) {
      res
        .status(400)
        .json({ error: "cannot generate more deliveries for a trial pack subscription" });
      return;
    }
    if (sub.status !== "active") {
      res
        .status(400)
        .json({ error: `cannot generate deliveries while ${sub.status}` });
      return;
    }
    const last = await db
      .select()
      .from(subscriptionDeliveriesTable)
      .where(eq(subscriptionDeliveriesTable.subscriptionId, subId))
      .orderBy(desc(subscriptionDeliveriesTable.scheduledFor))
      .limit(1);
    const lastDate = last[0]?.scheduledFor ?? sub.startDate;
    const stepDays = CADENCE_DAYS[sub.cadence];
    const dayPlan = sub.dayPlan ?? null;
    let startFrom: Date;
    if (dayPlan && dayPlan.length > 0) {
      // Cycle starts are anchored to startDate; the last delivery sits
      // mid-cycle (a day offset), so derive the next cycle boundary.
      const base = new Date(sub.startDate);
      const elapsedMs = new Date(lastDate).getTime() - base.getTime();
      const cyclesElapsed = Math.floor(elapsedMs / (stepDays * 86400000)) + 1;
      startFrom = addDays(base, cyclesElapsed * stepDays);
    } else {
      startFrom = addDays(new Date(lastDate), stepDays);
    }
    const newOnes = await generateDeliveriesForSubscription(
      subId,
      sub.cadence,
      startFrom,
      dayPlan && dayPlan.length > 0 ? CADENCE_CYCLES_AHEAD[sub.cadence] : 4,
      sub.deliveryWindow,
      [],
      dayPlan,
    );
    await recomputeNextDeliveryAt(subId, sub.nextDeliveryAt);
    invalidateUserBrief(userId);
    res.json({ deliveries: newOnes });
  },
);

export default router;
