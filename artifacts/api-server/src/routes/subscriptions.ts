import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuthUser as requireAuth } from "../middlewares/requireAuth";
import {
  db,
  ordersTable,
  subscriptionsTable,
  subscriptionMembersTable,
  subscriptionDeliveriesTable,
  mealCreditsTable,
  userPreferencesTable,
  deliverySlotsTable,
  slotReservationsTable,
  subscriptionMandatesTable,
  type SubscriptionCadence,
  type SubscriptionItem,
  type SubscriptionDelivery,
} from "@workspace/db";
import { and, asc, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { bridgeCreditDiscountPaise } from "../lib/bridgeCredit";
import { z } from "zod/v4";
import { invalidateUserBrief } from "../lib/userBrief";
import { resolveDishBySlug, makeBatchDishResolver } from "../lib/menuResolver";
import { evaluateDishForPreferences } from "@workspace/preferences-match";
import { cancelAutopayMandate } from "../lib/autopay";
import { SKIP_SWAP_CUTOFF_MS, isPastSkipCutoff } from "../lib/subscriptionRules";
import {
  PER_MEAL_PAISE,
  computeTrialPricePaise,
  computeDeliveryPricePaise,
} from "../lib/subscriptionPricing";

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
  monthly: 42, // mapped to 6-week protocol (42 days)
};

// With a per-day plan every plan generates ~4 weeks of dated deliveries
// ahead, regardless of billing cadence (4×7, 2×14, 1×42).
const CADENCE_CYCLES_AHEAD: Record<SubscriptionCadence, number> = {
  weekly: 4,
  fortnightly: 2,
  monthly: 1, // generates 1 cycle (6 weeks) ahead
};

// Price math (PER_MEAL_PAISE, CADENCE_DISCOUNT, trial pricing) lives in the pure
// ../lib/subscriptionPricing module so it can be unit-tested without a DB.
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

export function getSunday8PM(date: Date): Date {
  const sunday = new Date(date);
  const day = sunday.getUTCDay();
  const daysToAdd = day === 0 ? 0 : 7 - day;
  sunday.setUTCDate(sunday.getUTCDate() + daysToAdd);
  sunday.setUTCHours(20, 0, 0, 0); // 8:00 PM
  return sunday;
}

export function isCapacityHoldExpired(createdAt: Date): boolean {
  return new Date() > getSunday8PM(createdAt);
}

export async function updateTrialState(
  subscriptionId: number,
  event: "delivery_active" | "delivery_delivered"
): Promise<void> {
  await db.transaction(async (tx) => {
    const [sub] = await tx
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, subscriptionId))
      .for("update")
      .limit(1);

    if (!sub || sub.trialState == null) return;

    if (event === "delivery_active" && sub.trialState === "trial_purchased") {
      await tx
        .update(subscriptionsTable)
        .set({ trialState: "trial_active", updatedAt: new Date() })
        .where(eq(subscriptionsTable.id, subscriptionId));
    } else if (event === "delivery_delivered") {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(subscriptionDeliveriesTable)
        .where(
          and(
            eq(subscriptionDeliveriesTable.subscriptionId, subscriptionId),
            eq(subscriptionDeliveriesTable.status, "delivered")
          )
        );

      if (count >= 3 && sub.trialState === "trial_active") {
        await tx
          .update(subscriptionsTable)
          .set({ trialState: "trial_bridge_eligible", updatedAt: new Date() })
          .where(eq(subscriptionsTable.id, subscriptionId));
      }
    }
  });
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

// Read+write executor shape shared by `db` and a `db.transaction(tx => ...)`
// callback param — lets callers run this inside an existing transaction.
type DbExecutor = Pick<typeof db, "select" | "insert" | "update">;

async function generateDeliveriesForSubscription(
  subscriptionId: number,
  cadence: SubscriptionCadence,
  startFrom: Date,
  count: number,
  deliveryWindow: string,
  defaultItems: SubscriptionItem[],
  dayPlan?: Array<{ dayOffset: number; items: SubscriptionItem[] }> | null,
  executor: DbExecutor = db,
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
  return executor.insert(subscriptionDeliveriesTable).values(rows).returning();
}

/**
 * Creates the `ordersTable` row for a subscription's first billing cycle and
 * links it to the earliest "upcoming" delivery via
 * `subscriptionDeliveriesTable.orderId` — the same linkage
 * `finalizeOrder()` establishes for à-la-carte checkout (loyaltyEngine.ts).
 * `POST /payments/razorpay/order` resolves the charge by looking up
 * `externalOrderId`, and `registerAutopayMandate` (payments.ts) finds the
 * subscription by joining on that delivery link — so both depend on this
 * row existing with the right externalOrderId and the right link.
 *
 * The charge is ALWAYS `sub.pricePerDeliveryPaise - bridgeCreditPaise`,
 * server-computed — never a client-supplied amount, and never recomputed
 * from the delivery's real dish items (subscription pricing is a flat
 * per-meal rate independent of which dishes were picked; see
 * subscriptionPricing.ts). Item rows are recorded for display purposes only
 * with a flat per-meal price so they cannot silently diverge from the flat
 * price actually billed.
 *
 * NOTE: this creates the order and links it for the autopay-mandate join,
 * but registerAutopayMandate additionally requires the gateway order to have
 * been created with subscriptionId (see POST /payments/razorpay/order's
 * isRecurring branch) for a token to exist — that wiring is tracked
 * separately.
 */
async function createOrderForNewSubscription(
  tx: DbExecutor,
  sub: typeof subscriptionsTable.$inferSelect,
  deliveries: SubscriptionDelivery[],
  bridgeCreditPaise: number,
): Promise<void> {
  if (deliveries.length === 0) return;
  const firstDelivery = deliveries.reduce((earliest, d) =>
    d.scheduledFor < earliest.scheduledFor ? d : earliest,
  );

  const chargePaise = Math.max(0, sub.pricePerDeliveryPaise - bridgeCreditPaise);
  const orderItems = firstDelivery.items.map((item) => ({
    id: 0,
    name: item.name,
    qty: item.quantity,
    // Flat per-meal rate breakdown, NOT the (unused) dish catalog price —
    // subscription pricing never depends on which dishes were picked.
    price: PER_MEAL_PAISE * item.quantity,
  }));

  const [order] = await tx
    .insert(ordersTable)
    .values({
      userId: sub.userId,
      externalOrderId: `sub-${sub.id}`,
      status: "placed",
      totalPaise: chargePaise,
      chargePaise,
      items: orderItems,
      addressLabel: sub.addressLabel ?? null,
      addressLine: sub.addressLine ?? null,
      city: sub.city ?? null,
      pincode: sub.pincode ?? null,
      phone: sub.phone ?? null,
      fulfillmentType: "delivery",
    })
    .onConflictDoNothing({
      target: [ordersTable.userId, ordersTable.externalOrderId],
      where: sql`${ordersTable.externalOrderId} is not null`,
    })
    .returning();

  if (!order) return; // idempotency race — a row already exists for this sub

  await tx
    .update(subscriptionDeliveriesTable)
    .set({ orderId: order.id })
    .where(eq(subscriptionDeliveriesTable.id, firstDelivery.id));
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

const quoteSubscriptionSchema = z.object({
  cadence: cadenceSchema,
  mealsPerDelivery: z.number().int().positive().max(50).optional(),
  planType: z.enum(["standard", "trial"]).default("standard"),
  dayPlan: z.array(dayPlanEntrySchema).max(28).optional(),
});

router.post("/subscriptions/quote", async (req: Request, res: Response) => {
  const parsed = quoteSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  const isTrial = data.planType === "trial";
  const meals = data.dayPlan
    ? data.dayPlan.reduce(
        (total, d) => total + d.items.reduce((s, it) => s + it.quantity, 0),
        0,
      )
    : (data.mealsPerDelivery ?? 0);

  const pricePerMealPaise = PER_MEAL_PAISE;
  const baseSubtotal = meals * pricePerMealPaise;
  let finalSubtotal = isTrial ? computeTrialPricePaise(meals) : computeDeliveryPricePaise(data.cadence, meals);
  const discountPaise = baseSubtotal - finalSubtotal;
  
  // Delivery is free for subscriptions (delivery included)
  const deliveryFeePaise = 0;
  
  // Taxes are 5% on food
  const gstPaise = Math.round(finalSubtotal * 0.05);
  const totalPaise = finalSubtotal + gstPaise + deliveryFeePaise;

  res.json({
    mealsPerDelivery: meals,
    pricePerMealPaise,
    pricePerDeliveryPaise: baseSubtotal,
    discountPaise,
    deliveryFeePaise,
    gstPaise,
    totalPaise,
  });
});

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

  // Subscription creation, delivery generation, and the linked first-cycle
  // order all commit atomically — a partial write here would either leave a
  // subscription with no billable order (the original bug) or an order
  // dangling with no subscription to attach a mandate to.
  const { sub, deliveries, bridgeCreditPaise } = await db.transaction(async (tx) => {
    const [sub] = await tx
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
        trialState: isTrial ? "trial_purchased" : null,
      })
      .returning();

    // Phase C2 — redeem the à la carte → trial bridge credit as an explicit line
    // item: it reduces the CHARGE the client bills, never the persisted base
    // trial price. The WHERE guard (unconsumed + unexpired) makes double-redeem
    // impossible even under concurrent trial creates; a consumed credit is linked
    // back to this subscription for audit.
    let bridgeCreditPaise = 0;
    if (isTrial) {
      const consumedRows = await tx
        .update(mealCreditsTable)
        .set({ consumedAt: new Date(), subscriptionId: sub.id })
        .where(
          and(
            eq(mealCreditsTable.userId, userId),
            eq(mealCreditsTable.reason, "alacarte_bridge"),
            isNull(mealCreditsTable.consumedAt),
            or(
              isNull(mealCreditsTable.expiresAt),
              gt(mealCreditsTable.expiresAt, new Date()),
            ),
          ),
        )
        .returning({ amount: mealCreditsTable.amount });
      if (consumedRows.length > 0 && consumedRows[0]) {
        bridgeCreditPaise = bridgeCreditDiscountPaise(
          consumedRows[0].amount,
          mealsPerDelivery,
          pricePerDeliveryPaise,
        );
      }
    }

    if (data.members.length > 0) {
      await tx.insert(subscriptionMembersTable).values(
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
      tx,
    );

    // Create the first-cycle order and link it to the earliest delivery so
    // `POST /payments/razorpay/order` (looked up by externalOrderId
    // `sub-<id>`) and `registerAutopayMandate` (joined via
    // subscriptionDeliveriesTable.orderId) both work.
    await createOrderForNewSubscription(tx, sub, deliveries, bridgeCreditPaise);

    return { sub, deliveries, bridgeCreditPaise };
  });

  // A day plan's first delivery may sit after the cycle start (e.g. a
  // weekdays plan starting Saturday) — align nextDeliveryAt with reality.
  if (data.dayPlan && data.dayPlan.length > 0) {
    sub.nextDeliveryAt = await recomputeNextDeliveryAt(sub.id, startDate);
  }

  invalidateUserBrief(userId);
  res.status(201).json({ subscription: sub, deliveries, bridgeCreditPaise });
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
  const [members, deliveries, mandate] = await Promise.all([
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
    db
      .select()
      .from(subscriptionMandatesTable)
      .where(
        and(
          eq(subscriptionMandatesTable.subscriptionId, subId),
          eq(subscriptionMandatesTable.status, "active")
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);
  res.json({ subscription: sub, members, deliveries, mandate });
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
    // Stop billing: revoke the Razorpay autopay mandate and purge scheduled
    // charge notices. Without this, "cancel in one tap, no hidden fees" is false
    // — the mandate stays active and the next cycle still debits the customer.
    // Gateway errors are swallowed inside the helper; never fail cancel on them.
    await cancelAutopayMandate(subId, req.log);
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
    // Enforce the advertised "skip up to 24h before delivery" cutoff. Without
    // this a skip at T-1min succeeds while the kitchen is already packing, and
    // the customer is credited for a meal they still receive.
    if (isPastSkipCutoff(found.delivery.scheduledFor)) {
      res.status(409).json({
        error: "This delivery is too close to its delivery time to skip.",
        code: "past_cutoff",
        cutoffHours: SKIP_SWAP_CUTOFF_MS / 3_600_000,
      });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 60);
    // Credit only the meals in THE SKIPPED DELIVERY. For day-first (dayPlan)
    // subscriptions, mealsPerDelivery is the whole cycle's meal count, so
    // using it here would massively over-credit a single skipped day. Fall
    // back to mealsPerDelivery only for legacy rows with no items.
    const skippedMeals = (found.delivery.items ?? []).reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    // The status UPDATE is the atomic transition guard: keyed on
    // status='upcoming', so of two concurrent skips exactly one flips the row
    // (and returns it) while the loser gets zero rows. Credit is inserted in the
    // SAME transaction only when the transition actually happened — this closes
    // the double-submit double-credit race.
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(subscriptionDeliveriesTable)
        .set({ status: "skipped" })
        .where(
          and(
            eq(subscriptionDeliveriesTable.id, deliveryId),
            eq(subscriptionDeliveriesTable.status, "upcoming"),
          ),
        )
        .returning();
      if (!row) return null;
      await tx.insert(mealCreditsTable).values({
        userId,
        subscriptionId: found.subscription.id,
        deliveryId,
        amount: skippedMeals > 0 ? skippedMeals : found.subscription.mealsPerDelivery,
        reason: "skipped_delivery",
        expiresAt,
      });
      return row;
    });

    if (!updated) {
      res.status(409).json({ error: "delivery already skipped", code: "already_skipped" });
      return;
    }

    await recomputeNextDeliveryAt(
      found.subscription.id,
      found.subscription.nextDeliveryAt,
    );
    invalidateUserBrief(userId);
    res.json({ delivery: updated });
  },
);

router.post(
  "/subscriptions/:id/skip",
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

    const upcoming = await db
      .select()
      .from(subscriptionDeliveriesTable)
      .where(
        and(
          eq(subscriptionDeliveriesTable.subscriptionId, subId),
          eq(subscriptionDeliveriesTable.status, "upcoming")
        )
      )
      .orderBy(asc(subscriptionDeliveriesTable.scheduledFor))
      .limit(1);

    const delivery = upcoming[0];
    if (!delivery) {
      res.status(400).json({ error: "no upcoming delivery found" });
      return;
    }
    if (isPastSkipCutoff(delivery.scheduledFor)) {
      res.status(409).json({
        error: "The next delivery is too close to its delivery time to skip.",
        code: "past_cutoff",
        cutoffHours: SKIP_SWAP_CUTOFF_MS / 3_600_000,
      });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 60);
    const skippedMeals = (delivery.items ?? []).reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    // Guarded transition + credit in one transaction (see delivery-level skip):
    // concurrent skips can't both credit because only the winning UPDATE (keyed
    // on status='upcoming') returns a row and inserts the credit.
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(subscriptionDeliveriesTable)
        .set({ status: "skipped" })
        .where(
          and(
            eq(subscriptionDeliveriesTable.id, delivery.id),
            eq(subscriptionDeliveriesTable.status, "upcoming"),
          ),
        )
        .returning();
      if (!row) return null;
      await tx.insert(mealCreditsTable).values({
        userId,
        subscriptionId: subId,
        deliveryId: delivery.id,
        amount: skippedMeals > 0 ? skippedMeals : sub.mealsPerDelivery,
        reason: "skipped_delivery",
        expiresAt,
      });
      return row;
    });

    if (!updated) {
      res.status(409).json({ error: "delivery already skipped", code: "already_skipped" });
      return;
    }

    await recomputeNextDeliveryAt(subId, sub.nextDeliveryAt);
    invalidateUserBrief(userId);
    res.json({ delivery: updated });
  }
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
    // Same 24h cutoff as skip/swap/reschedule: once the next delivery is inside
    // its window it's committed to the kitchen, so no items can be added to it.
    if (isPastSkipCutoff(next.delivery.scheduledFor)) {
      res.status(409).json({
        error: "Your next delivery is too close to its delivery time to change.",
        code: "past_cutoff",
        cutoffHours: SKIP_SWAP_CUTOFF_MS / 3_600_000,
      });
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
    if (isPastSkipCutoff(found.delivery.scheduledFor)) {
      res.status(409).json({
        error: "This delivery is too close to its delivery time to change.",
        code: "past_cutoff",
        cutoffHours: SKIP_SWAP_CUTOFF_MS / 3_600_000,
      });
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
    // Guarded on status='upcoming' so a swap can't race a concurrent skip/swap
    // and mutate a delivery that already left the upcoming state.
    const [updated] = await db
      .update(subscriptionDeliveriesTable)
      .set({ items: parsed.data.items })
      .where(
        and(
          eq(subscriptionDeliveriesTable.id, deliveryId),
          eq(subscriptionDeliveriesTable.status, "upcoming"),
        ),
      )
      .returning();
    if (!updated) {
      res.status(409).json({ error: "delivery is no longer upcoming", code: "not_upcoming" });
      return;
    }
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
    // Same 24h cutoff the UI advertises for skip/swap: a delivery already inside
    // its window is committed to the kitchen and can't be moved. Without this,
    // "change up to 24h before" was enforced for skip/swap but not reschedule.
    if (isPastSkipCutoff(found.delivery.scheduledFor)) {
      res.status(409).json({
        error: "This delivery is too close to its delivery time to reschedule.",
        code: "past_cutoff",
        cutoffHours: SKIP_SWAP_CUTOFF_MS / 3_600_000,
      });
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
router.get(
  "/subscriptions/:id/trial-recap",
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

    const isEligibleOrActiveTrial =
      sub.trialState === "trial_purchased" ||
      sub.trialState === "trial_active" ||
      sub.trialState === "trial_bridge_eligible";

    if (!isEligibleOrActiveTrial) {
      res.status(400).json({ error: "subscription is not an active or eligible trial" });
      return;
    }

    const completedDeliveries = await db
      .select()
      .from(subscriptionDeliveriesTable)
      .where(
        and(
          eq(subscriptionDeliveriesTable.subscriptionId, subId),
          eq(subscriptionDeliveriesTable.status, "delivered"),
        )
      );

    const stats = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    };

    const resolver = await makeBatchDishResolver();

    for (const d of completedDeliveries) {
      const items = d.items ?? [];
      for (const item of items) {
        const dish = resolver.bySlug(item.slug);
        if (dish && dish.macros) {
          stats.calories += (dish.macros.calories ?? 0) * item.quantity;
          stats.protein += (dish.macros.protein ?? 0) * item.quantity;
          stats.carbs += (dish.macros.carbs ?? 0) * item.quantity;
          stats.fat += (dish.macros.fat ?? 0) * item.quantity;
          stats.fiber += (dish.macros.fiber ?? 0) * item.quantity;
        }
      }
    }

    const holdExpiration = getSunday8PM(sub.createdAt);

    res.json({
      stats,
      holdExpiration: holdExpiration.toISOString(),
    });
  }
);

router.post(
  "/subscriptions/:id/trial-state",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = parseIdParam(req.params.id, res);
    if (subId === null) return;

    const parsed = z.object({
      event: z.enum(["delivery_active", "delivery_delivered"]),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    const sub = await loadSubscriptionForUser(subId, userId);
    if (!sub) {
      res.status(404).json({ error: "not found" });
      return;
    }

    await updateTrialState(subId, parsed.data.event);
    res.json({ ok: true });
  }
);

router.post(
  "/subscriptions/:id/convert",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = parseIdParam(req.params.id, res);
    if (subId === null) return;

    try {
      const result = await db.transaction(async (tx) => {
        const [sub] = await tx
          .select()
          .from(subscriptionsTable)
          .where(
            and(
              eq(subscriptionsTable.id, subId),
              eq(subscriptionsTable.userId, userId),
            ),
          )
          .for("update")
          .limit(1);

        if (!sub) {
          throw new Error("subscription not found");
        }

        const isTrial = sub.trialState != null && sub.trialState !== "converted" && sub.trialState !== "ended_abandoned";
        if (!isTrial) {
          throw new Error("subscription is not an active trial");
        }

        if (isCapacityHoldExpired(sub.createdAt)) {
          throw new Error("capacity hold expired");
        }

        if (sub.preferredSlotId != null) {
          const [slot] = await tx
            .select()
            .from(deliverySlotsTable)
            .where(eq(deliverySlotsTable.id, sub.preferredSlotId))
            .limit(1);

          if (!slot) {
            throw new Error("preferred slot not found");
          }

          if (slot.reservedCount >= slot.capacity) {
            const [existingReservation] = await tx
              .select()
              .from(slotReservationsTable)
              .where(
                and(
                  eq(slotReservationsTable.subscriptionId, sub.id),
                  eq(slotReservationsTable.slotId, sub.preferredSlotId),
                )
              )
              .limit(1);

            if (!existingReservation) {
              throw new Error("delivery slot full");
            }
          }
        }

        const pricePerDeliveryPaise = computeDeliveryPricePaise(sub.cadence, sub.mealsPerDelivery);

        const [updated] = await tx
          .update(subscriptionsTable)
          .set({
            trialState: "converted",
            pricePerDeliveryPaise,
            notes: sub.notes ? sub.notes.replace(TRIAL_NOTE, "").replace(LEGACY_TRIAL_NOTE, "").trim() : null,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionsTable.id, sub.id))
          .returning();

        const generateCount = sub.dayPlan ? CADENCE_CYCLES_AHEAD[sub.cadence] : 4;
        const last = await tx
          .select()
          .from(subscriptionDeliveriesTable)
          .where(eq(subscriptionDeliveriesTable.subscriptionId, sub.id))
          .orderBy(desc(subscriptionDeliveriesTable.scheduledFor))
          .limit(1);
        const lastDate = last[0]?.scheduledFor ?? sub.startDate;
        const stepDays = CADENCE_DAYS[sub.cadence];
        const dayPlan = sub.dayPlan ?? null;
        let startFrom: Date;
        if (dayPlan && dayPlan.length > 0) {
          const base = new Date(sub.startDate);
          const elapsedMs = new Date(lastDate).getTime() - base.getTime();
          const cyclesElapsed = Math.floor(elapsedMs / (stepDays * 86400000)) + 1;
          startFrom = addDays(base, cyclesElapsed * stepDays);
        } else {
          startFrom = addDays(new Date(lastDate), stepDays);
        }

        const newOnes = await generateDeliveriesForSubscription(
          sub.id,
          sub.cadence,
          startFrom,
          generateCount - 1,
          sub.deliveryWindow,
          [],
          dayPlan,
        );

        return { subscription: updated, deliveries: newOnes };
      });

      invalidateUserBrief(userId);
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "subscription not found" || msg === "preferred slot not found") {
        res.status(404).json({ error: msg });
        return;
      }
      if (msg === "subscription is not an active trial") {
        res.status(400).json({ error: msg });
        return;
      }
      if (msg === "capacity hold expired" || msg === "delivery slot full") {
        res.status(409).json({ error: msg });
        return;
      }
      req.log.error({ err }, "subscription conversion failed");
      res.status(500).json({ error: "subscription conversion failed" });
    }
  }
);

export default router;

