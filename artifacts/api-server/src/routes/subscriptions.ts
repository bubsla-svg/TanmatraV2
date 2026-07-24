import * as crypto from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuthUser as requireAuth } from "../middlewares/requireAuth";
import {
  db,
  ordersTable,
  subscriptionsTable,
  subscriptionMembersTable,
  subscriptionDeliveriesTable,
  subscriptionAddonsTable,
  mealCreditsTable,
  userPreferencesTable,
  deliverySlotsTable,
  slotReservationsTable,
  subscriptionMandatesTable,
  isLiveTrialState,
  type SubscriptionCadence,
  type SubscriptionItem,
  type SubscriptionDelivery,
} from "@workspace/db";
import { and, asc, desc, eq, gt, lt, isNull, or, sql } from "drizzle-orm";
import { bridgeCreditDiscountPaise } from "../lib/bridgeCredit";
import { getCreditBalancePaise, issueCredit } from "../lib/loyaltyEngine";
import { z } from "zod/v4";
import { invalidateUserBrief } from "../lib/userBrief";
import { emitServerEvent } from "../lib/serverEvents";
import { resolveDishBySlug, makeBatchDishResolver } from "../lib/menuResolver";
import { evaluateDishForPreferences } from "@workspace/preferences-match";
import { cancelAutopayMandate } from "../lib/autopay";
import { SKIP_SWAP_CUTOFF_MS, isPastSkipCutoff } from "../lib/subscriptionRules";
import {
  PER_MEAL_PAISE,
  GST_RATE,
  computeTrialPricePaise,
  computeDeliveryPricePaise,
} from "../lib/subscriptionPricing";
import {
  type PlanId,
  type DietTrack,
  type AddOnLineItem,
  PLAN_CATALOG,
  computePlanQuote,
  planIsSelfServiceLaunchable,
  planServesTrack,
  resolveAddOns,
} from "@workspace/subscription-rules";
import { isPlanV2Enabled } from "../lib/flags";

// Marker written into a subscription's `notes` so a plan-v2 subscription is
// attributable to its PlanId without a schema migration (the subscriptions
// table has no planId column yet — added in a later slice). Kept short and
// stable so downstream reconciliation can parse it.
const PLAN_V2_NOTE_PREFIX = "plan_v2:";

const PLAN_ID_VALUES = [
  "desk_fuel",
  "steady",
  "glp1_companion",
  "protein_build",
  "teams",
  "trial_3day",
] as const satisfies readonly PlanId[];
import {
  razorpayCredentials,
  razorpayBasicAuth,
  getOrCreateRazorpayCustomer,
  fetchRazorpayPayment,
  upsertActiveMandate,
} from "../lib/razorpayRecurring";
import { encryptClinicalStrings, decryptClinicalStrings } from "../lib/crypto";
import { getDecryptedPreferences } from "../lib/userPreferences";
import { hashTrialPhone } from "../lib/trialEligibility";
import { hasRedeemedTrialPhone } from "../lib/trialRedemption";

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
  // Optional — see the schema-level comment on subscriptionMembersTable for
  // when this is populated automatically vs. left null.
  dailyCalorieTarget: z.number().int().positive().max(10000).optional(),
  dailyProteinTargetGrams: z.number().int().positive().max(500).optional(),
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
  // Plan-v2 (FLAG_PLAN_V2): see quote schema. Ignored while the flag is off.
  planId: z.enum(PLAN_ID_VALUES).optional(),
  track: z.enum(["veg", "egg", "nonveg"]).optional(),
  addOns: z.array(z.enum(["rd_bump", "evening_add"])).max(2).optional(),
});

/**
 * Shared plan-v2 launch gate for the quote/create paths. Returns a typed 4xx
 * body when the plan/track is not self-serve bookable (route to waitlist), or
 * null when it is bookable. Only consulted when FLAG_PLAN_V2 is on and a planId
 * was supplied.
 */
function planV2Rejection(
  planId: PlanId,
  track: DietTrack,
): { status: number; body: Record<string, unknown> } | null {
  if (!planIsSelfServiceLaunchable(planId)) {
    return {
      status: 422,
      body: {
        error: "plan is not available for self-serve booking",
        code: "plan_not_launchable",
        planId,
        waitlist: true,
        reasons: PLAN_CATALOG[planId].blockers,
      },
    };
  }
  if (!planServesTrack(planId, track)) {
    return {
      status: 422,
      body: {
        error: `track "${track}" is not served by ${planId}`,
        code: "plan_track_unavailable",
        planId,
        track,
        servedTracks: PLAN_CATALOG[planId].dietTracks,
        waitlist: true,
      },
    };
  }
  return null;
}

/**
 * Recover a subscription's PlanId from its `notes` tag (`plan_v2:<id>`, written
 * at create — there's no planId column yet). Returns null for a non-plan-v2
 * subscription. Used by the post-purchase add-on endpoints to enforce each
 * plan's add-on allow-list.
 */
function planIdFromNotes(notes: string | null | undefined): PlanId | null {
  if (!notes) return null;
  const idx = notes.indexOf(PLAN_V2_NOTE_PREFIX);
  if (idx === -1) return null;
  // The id runs from just after the prefix to the first space or em-dash
  // separator (create writes `plan_v2:<id>` or `plan_v2:<id> — <rest>`).
  const token = notes.slice(idx + PLAN_V2_NOTE_PREFIX.length).split(/[\s—]/)[0]?.trim();
  return token && (PLAN_ID_VALUES as readonly string[]).includes(token)
    ? (token as PlanId)
    : null;
}

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
// Exported so the recurring-charge driver (lib/chargeMandate.ts) can
// replenish the upcoming-deliveries pool using the exact same cadence-day
// mapping this router uses everywhere else — never a second, drifting copy.
export const CADENCE_DAYS: Record<SubscriptionCadence, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 42, // mapped to 6-week protocol (42 days)
};

// With a per-day plan every plan generates ~4 weeks of dated deliveries
// ahead, regardless of billing cadence (4×7, 2×14, 1×42).
export const CADENCE_CYCLES_AHEAD: Record<SubscriptionCadence, number> = {
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

// The note tag a plan-v2 3-Day Taste Test carries (see the create route). A
// plan-v2 trial is one-off too, so the change-plan / generate-next guards must
// treat it as a trial even though its note isn't the legacy exact-match string.
const PLAN_V2_TRIAL_TAG = `${PLAN_V2_NOTE_PREFIX}trial_3day`;

function isTrialSubscription(sub: { notes: string | null }): boolean {
  if (sub.notes === TRIAL_NOTE || sub.notes === LEGACY_TRIAL_NOTE) return true;
  return sub.notes?.includes(PLAN_V2_TRIAL_TAG) ?? false;
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


export function addDays(date: Date, days: number): Date {
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

// A requested cadence/mealsPerDelivery change (POST .../change-plan) is never
// applied mid-cycle — the customer already committed to the deliveries
// already generated for the CURRENT cycle, and pricePerDeliveryPaise is what
// any live autopay mandate was authorised against. It is stored in the
// pending* columns and only takes effect here, the one place a subscription's
// cycle actually rolls over (POST /subscriptions/:id/generate-next). A change
// still awaiting re-authorisation (price increase, mandate not yet
// re-confirmed) is left untouched — it stays pending until the customer
// completes POST .../change-plan/confirm.
async function applyPendingPlanChangeIfReady(
  sub: typeof subscriptionsTable.$inferSelect,
): Promise<{ cadence: SubscriptionCadence; mealsPerDelivery: number }> {
  if (sub.pendingCadence == null || sub.pendingChangeReauthRequired) {
    return { cadence: sub.cadence, mealsPerDelivery: sub.mealsPerDelivery };
  }
  const cadence = sub.pendingCadence;
  const mealsPerDelivery = sub.pendingMealsPerDelivery ?? sub.mealsPerDelivery;
  const pricePerDeliveryPaise =
    sub.pendingPricePerDeliveryPaise ?? computeDeliveryPricePaise(cadence, mealsPerDelivery);
  await db
    .update(subscriptionsTable)
    .set({
      cadence,
      mealsPerDelivery,
      pricePerDeliveryPaise,
      pendingCadence: null,
      pendingMealsPerDelivery: null,
      pendingPricePerDeliveryPaise: null,
      pendingChangeRequestedAt: null,
      pendingChangeReauthRequired: false,
      pendingChangeRazorpayOrderId: null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionsTable.id, sub.id));
  return { cadence, mealsPerDelivery };
}

// Exported: lib/chargeMandate.ts reuses this exact function (rather than a
// second copy) to replenish the upcoming-deliveries pool when a recurring
// charge succeeds and finds no un-fulfilled delivery left to bill against —
// mirrors POST /subscriptions/:id/generate-next below.
export async function generateDeliveriesForSubscription(
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
  // Decrypt-on-read: once consumer clinical fields are KMS-encrypted at rest,
  // reading the raw row here would feed ciphertext into the strict allergen
  // gate and it would fail OPEN (ciphertext matches no allergen). This is the
  // account-holder's own safety gate — the member path below already decrypts.
  const prefsRow = await getDecryptedPreferences(userId);
  const primaryMatch = evaluateDishForPreferences(dish, prefsRow, { strict: true });
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
        allergens: decryptClinicalStrings(m.allergens),
        medicalConditions: decryptClinicalStrings(m.medicalConditions),
        dislikedIngredients: decryptClinicalStrings(m.dislikedIngredients),
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

// A swap is capped only against calories — protein below a per-meal floor is
// surfaced as a delta, never blocking, since a single lower-protein meal
// choice isn't inherently unsafe the way exceeding a calorie ceiling is
// treated here. Only enforced when the target member has a
// dailyCalorieTarget set (see subscriptionMembersTable's schema comment for
// when that's populated) — a member with no target skips this check
// entirely rather than fabricating one.
const MACRO_CAP_TOLERANCE = 0.15;

function utcDayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/**
 * Checks whether swapping in `newItems` for `deliveryId` would push any
 * targeted member's single-meal calorie share above their daily cap. The
 * daily target is spread evenly across however many meals that member has
 * scheduled on the same calendar day (including the delivery being
 * swapped) — not compared against the sum of everything else already
 * ordered that day, which would require re-resolving every other item's
 * dish data on every swap call.
 */
async function validateMacroCapForSwap(
  subscriptionId: number,
  deliveryId: number,
  scheduledFor: Date,
  newItems: SubscriptionItem[],
): Promise<{ blocked: boolean; reasons: any[] }> {
  const memberIds = Array.from(
    new Set(newItems.map((it) => it.memberId).filter((id): id is number => id != null)),
  );
  if (memberIds.length === 0) return { blocked: false, reasons: [] };

  const members = await db
    .select({
      id: subscriptionMembersTable.id,
      dailyCalorieTarget: subscriptionMembersTable.dailyCalorieTarget,
    })
    .from(subscriptionMembersTable)
    .where(eq(subscriptionMembersTable.subscriptionId, subscriptionId));
  const targetById = new Map(members.map((m) => [m.id, m.dailyCalorieTarget]));

  const { start, end } = utcDayBounds(scheduledFor);
  const sameDayDeliveries = await db
    .select({ id: subscriptionDeliveriesTable.id, items: subscriptionDeliveriesTable.items })
    .from(subscriptionDeliveriesTable)
    .where(
      and(
        eq(subscriptionDeliveriesTable.subscriptionId, subscriptionId),
        gt(subscriptionDeliveriesTable.scheduledFor, new Date(start.getTime() - 1)),
        lt(subscriptionDeliveriesTable.scheduledFor, end),
      ),
    );

  const reasons: any[] = [];
  for (const memberId of memberIds) {
    const dailyCalorieTarget = targetById.get(memberId);
    if (!dailyCalorieTarget) continue; // no target set — skip, don't fabricate one

    let mealsThatDay = 0;
    for (const d of sameDayDeliveries) {
      const items = d.id === deliveryId ? newItems : (d.items as SubscriptionItem[]);
      mealsThatDay += items.filter((it) => it.memberId === memberId).length;
    }
    const perMealAllowance = dailyCalorieTarget / Math.max(mealsThatDay, 1);
    const cap = perMealAllowance * (1 + MACRO_CAP_TOLERANCE);

    for (const item of newItems) {
      if (item.memberId !== memberId) continue;
      const dish = await resolveDishBySlug(item.slug);
      if (!dish) continue;
      if (dish.macros.calories > cap) {
        reasons.push({
          code: "macro_cap_exceeded",
          message: `Exceeds your plan's macro caps · Unavailable`,
          memberId,
          slug: item.slug,
          dishCalories: dish.macros.calories,
          perMealAllowanceCalories: Math.round(perMealAllowance),
        });
      }
    }
  }
  return { blocked: reasons.length > 0, reasons };
}

const quoteSubscriptionSchema = z.object({
  cadence: cadenceSchema,
  mealsPerDelivery: z.number().int().positive().max(50).optional(),
  planType: z.enum(["standard", "trial"]).default("standard"),
  dayPlan: z.array(dayPlanEntrySchema).max(28).optional(),
  // Plan-v2 (FLAG_PLAN_V2): when a planId is supplied and the flag is on, the
  // quote is priced by the corpus plan spine instead of the cadence model.
  // Ignored while the flag is off, so existing callers are unaffected.
  planId: z.enum(PLAN_ID_VALUES).optional(),
  track: z.enum(["veg", "egg", "nonveg"]).optional(),
  // Plan-review add-ons (02 §5). Only plan_review add-ons (rd_bump) affect the
  // quote total; post_purchase add-ons (evening_add) are returned as available
  // but not billed here.
  addOns: z.array(z.enum(["rd_bump", "evening_add"])).max(2).optional(),
});

router.post("/subscriptions/quote", async (req: Request, res: Response) => {
  const parsed = quoteSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;

  // Plan-v2 quote (FLAG_PLAN_V2): price by the corpus plan spine. Same response
  // shape as the legacy quote plus planId/track, so the client renders it
  // identically. Blocked/sales-led plans and unserved tracks return a typed
  // 422 with `waitlist: true` rather than a bookable quote (02e §7).
  if (isPlanV2Enabled() && data.planId) {
    const track: DietTrack = data.track ?? "veg";
    const rejection = planV2Rejection(data.planId, track);
    if (rejection) {
      res.status(rejection.status).json(rejection.body);
      return;
    }
    const q = computePlanQuote(data.planId);

    // Resolve any requested add-ons against the plan's allow-list. A not-allowed
    // add-on is a client error (422); this never happens for the default flow.
    const { items: addOnItems, rejected } = resolveAddOns(
      data.planId,
      data.addOns ?? [],
    );
    if (rejected.length > 0) {
      res.status(422).json({
        error: "add-on not available for this plan",
        code: "addon_not_allowed",
        planId: data.planId,
        rejected,
        allowed: PLAN_CATALOG[data.planId].addOnsAllowed,
      });
      return;
    }
    // Only plan-review add-ons (rd_bump) are billed into the plan-review quote;
    // post_purchase add-ons (evening_add) are surfaced as available but never
    // block or inflate this total (02c: the pay screen shows the real number).
    const planReviewAddOns = addOnItems.filter(
      (a) => a.attachPoint === "plan_review",
    );
    const addOnTotalPaise = planReviewAddOns.reduce(
      (sum, a) => sum + a.pricePaise,
      0,
    );
    const totalPaise = q.cycleTotalPaise + addOnTotalPaise;
    // Re-derive the GST split on the combined (GST-inclusive) total.
    const preTaxPaise = Math.round(totalPaise / (1 + GST_RATE));

    // Signed-in preview of the credits the create route WILL redeem against
    // this first bill, in its exact order: the à-la-carte→trial bridge credit
    // first (trial only), then the general ledger balance against what's left
    // (02e §6). The create route feeds bridgeCreditDiscountPaise the SAME
    // inputs this uses — the storefront sends mealsPerDelivery = this quote's
    // q.mealsPerCycle, and pricePerDeliveryPaise there === totalPaise here — so
    // payableTotalPaise below equals the amount create charges, never a
    // client-side guess that misses the bridge step. READ-ONLY: nothing is
    // consumed; create re-derives and redeems atomically at pay time. Absent
    // for anonymous callers (no req.user) — the pre-OTP quote just shows the
    // gross total, and PlanCheckout re-quotes once signed in.
    let bridgeCreditPaise = 0;
    let creditAppliedPaise = 0;
    const previewUserId = req.user?.id;
    if (previewUserId) {
      if (data.planId === "trial_3day") {
        const [credit] = await db
          .select({ amount: mealCreditsTable.amount })
          .from(mealCreditsTable)
          .where(
            and(
              eq(mealCreditsTable.userId, previewUserId),
              eq(mealCreditsTable.reason, "alacarte_bridge"),
              isNull(mealCreditsTable.consumedAt),
              or(
                isNull(mealCreditsTable.expiresAt),
                gt(mealCreditsTable.expiresAt, new Date()),
              ),
            ),
          )
          .limit(1);
        if (credit) {
          bridgeCreditPaise = bridgeCreditDiscountPaise(
            credit.amount,
            q.mealsPerCycle,
            totalPaise,
          );
        }
      }
      const balancePaise = await getCreditBalancePaise(previewUserId);
      creditAppliedPaise = Math.min(
        balancePaise,
        Math.max(0, totalPaise - bridgeCreditPaise),
      );
    }
    const payableTotalPaise = Math.max(
      0,
      totalPaise - bridgeCreditPaise - creditAppliedPaise,
    );

    res.json({
      planId: data.planId,
      track,
      mealsPerDelivery: q.mealsPerCycle,
      pricePerMealPaise: q.pricePerMealPaise,
      pricePerDeliveryPaise: q.cycleTotalPaise,
      addOns: addOnItems,
      addOnTotalPaise,
      discountPaise: 0,
      deliveryFeePaise: 0,
      gstPaise: totalPaise - preTaxPaise,
      totalPaise,
      // Credit preview (signed-in only) — see the block above.
      bridgeCreditPaise,
      creditAppliedPaise,
      payableTotalPaise,
    });
    return;
  }

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
  
  // finalSubtotal is already GST-inclusive (computeDeliveryPricePaise /
  // computeTrialPricePaise both bake in 5% GST). Derive the GST component for
  // display by splitting finalSubtotal into its pre-tax/post-tax parts —
  // do NOT apply a second 5% on top, or the quote double-counts tax versus
  // what /subscriptions actually bills via /payments/charge-mandate.
  const preTaxSubtotalPaise = Math.round(finalSubtotal / (1 + GST_RATE));
  const gstPaise = finalSubtotal - preTaxSubtotalPaise;
  const totalPaise = finalSubtotal + deliveryFeePaise;

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
  // The plan-v2 `trial_3day` plan also flips this on below (once the flag +
  // plan gates pass), so it persists trialState — without which the paid-time
  // creditback seam (isLiveTrialState) would never fire.
  let isTrial =
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
  // Plan-v2 add-ons resolved from the request, persisted with the subscription
  // inside the create transaction below (empty unless the plan-v2 branch fills
  // it).
  let planV2AddOns: AddOnLineItem[] = [];

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

  // Plan-v2 (FLAG_PLAN_V2): price and gate by the corpus plan spine. This wins
  // over the cadence/trial pricing above — the plan's cycle total is the
  // server-authoritative billed amount — and tags the subscription with its
  // PlanId in notes (no schema migration). Blocked/sales-led plans and unserved
  // tracks are refused here, so a bad combo can never reach mandate creation.
  if (isPlanV2Enabled() && data.planId) {
    const track: DietTrack = data.track ?? "veg";
    const rejection = planV2Rejection(data.planId, track);
    if (rejection) {
      res.status(rejection.status).json(rejection.body);
      return;
    }
    // Resolve requested add-ons against the plan's allow-list — the same gate
    // the quote uses. A not-allowed add-on is a 422, never silently priced.
    const resolvedAddOns = resolveAddOns(data.planId, data.addOns ?? []);
    if (resolvedAddOns.rejected.length > 0) {
      res.status(422).json({
        error: "add-on not available for this plan",
        code: "addon_not_allowed",
        planId: data.planId,
        rejected: resolvedAddOns.rejected,
        allowed: PLAN_CATALOG[data.planId].addOnsAllowed,
      });
      return;
    }
    planV2AddOns = resolvedAddOns.items;
    const q = computePlanQuote(data.planId);
    // Only plan-review add-ons (rd_bump, monthly) are billed into this first
    // cycle — the same rule as /quote. A post_purchase add-on (evening_add) is
    // still persisted active below, but billed by the recurring charge, never
    // inflating this order.
    const planReviewAddOnPaise = planV2AddOns
      .filter((a) => a.attachPoint === "plan_review")
      .reduce((sum, a) => sum + a.pricePaise, 0);
    pricePerDeliveryPaise = q.cycleTotalPaise + planReviewAddOnPaise;
    if (data.planId === "trial_3day") {
      generateCount = 1; // one-off sampler — does not recur
      isTrial = true; // persist trialState so the paid-time creditback fires
      // One 3-Day Taste Test per phone, EVER (02b/02e §6). This is a friendly
      // early rejection — the durable enforcement is the trial_redemptions
      // UNIQUE that the paid-time grant writes (a create whose payment never
      // lands must not burn the allowance, so we only READ here). An
      // unidentifiable phone hashes to "" and is not gated.
      const phoneHash = hashTrialPhone(data.phone);
      if (phoneHash && (await hasRedeemedTrialPhone(phoneHash))) {
        res.status(409).json({
          error: "This phone number has already used its 3-Day Taste Test.",
          code: "trial_already_redeemed",
        });
        return;
      }
    }
    const planTag = `${PLAN_V2_NOTE_PREFIX}${data.planId}`;
    notes = notes ? `${planTag} — ${notes}`.slice(0, 512) : planTag;
  }

  // A single-member subscription's sole member unambiguously IS the account
  // holder, so it's safe to backfill their macro-cap target from their own
  // onboarding quiz answers. A multi-member subscription's guests have no
  // independent profile to backfill from and are left null unless the
  // caller sets them explicitly — see the schema comment on
  // subscriptionMembersTable.dailyCalorieTarget.
  let accountHolderTargets: { calorieTarget: number | null; proteinTargetGrams: number | null } | null = null;
  if (data.members.length === 1) {
    const [prefs] = await db
      .select({
        calorieTarget: userPreferencesTable.calorieTarget,
        proteinTargetGrams: userPreferencesTable.proteinTargetGrams,
      })
      .from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, userId));
    if (prefs) accountHolderTargets = prefs;
  }

  // Subscription creation, delivery generation, and the linked first-cycle
  // order all commit atomically — a partial write here would either leave a
  // subscription with no billable order (the original bug) or an order
  // dangling with no subscription to attach a mandate to.
  const { sub, deliveries, bridgeCreditPaise, ledgerCreditPaise } = await db.transaction(async (tx) => {
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

    // General credit-ledger balance (referral awards, the 3-Day Taste Test's
    // ₹399 paid-time creditback, loyalty/winback grants — anything issued
    // through `issueCredit`) is "redeemable against any plan start" (02e §6):
    // apply whatever remains of THIS bill after the trial bridge credit above,
    // never the full pre-bridge price, so a trial that bridgeCreditPaise
    // already zeroed out can't also burn an unrelated ledger balance for
    // nothing. Same advisory-lock + FIFO-balance pattern as the à-la-carte
    // path's inline redemption (loyaltyEngine.finalizeOrder) — inlined rather
    // than calling redeemCreditAtomic because that helper opens its own
    // transaction and can't nest inside this one.
    let ledgerCreditPaise = 0;
    const billableAfterBridge = Math.max(0, pricePerDeliveryPaise - bridgeCreditPaise);
    if (billableAfterBridge > 0) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${"credit:" + userId}, 0))`,
      );
      const balancePaise = await getCreditBalancePaise(userId, tx);
      ledgerCreditPaise = Math.min(balancePaise, billableAfterBridge);
      if (ledgerCreditPaise > 0) {
        await issueCredit(
          {
            userId,
            deltaPaise: -ledgerCreditPaise,
            reason: "checkout_redemption",
            refType: "subscription",
            refId: String(sub.id),
            note: `Applied at plan checkout for subscription ${sub.id}`,
          },
          tx,
        );
      }
    }

    if (data.members.length > 0) {
      await tx.insert(subscriptionMembersTable).values(
        data.members.map((m) => ({
          subscriptionId: sub.id,
          name: m.name,
          diet: m.diet,
          allergens: encryptClinicalStrings(m.allergens),
          medicalConditions: encryptClinicalStrings(m.medicalConditions),
          dislikedIngredients: encryptClinicalStrings(m.dislikedIngredients),
          lifestyle: m.lifestyle,
          spiceLevel: m.spiceLevel,
          dailyCalorieTarget: m.dailyCalorieTarget ?? accountHolderTargets?.calorieTarget ?? null,
          dailyProteinTargetGrams:
            m.dailyProteinTargetGrams ?? accountHolderTargets?.proteinTargetGrams ?? null,
        })),
      );
    }

    // Persist the plan-v2 add-ons accepted at plan review. price/cadence are
    // snapshotted from the canonical ADD_ONS config (via resolveAddOns) so a
    // later price change never silently reprices an already-attached add-on.
    if (planV2AddOns.length > 0) {
      await tx.insert(subscriptionAddonsTable).values(
        planV2AddOns.map((a) => ({
          subscriptionId: sub.id,
          addonId: a.id,
          pricePaise: a.pricePaise,
          cadence: a.cadence,
          active: true,
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
    await createOrderForNewSubscription(
      tx,
      sub,
      deliveries,
      bridgeCreditPaise + ledgerCreditPaise,
    );

    return { sub, deliveries, bridgeCreditPaise, ledgerCreditPaise };
  });

  // A day plan's first delivery may sit after the cycle start (e.g. a
  // weekdays plan starting Saturday) — align nextDeliveryAt with reality.
  if (data.dayPlan && data.dayPlan.length > 0) {
    sub.nextDeliveryAt = await recomputeNextDeliveryAt(sub.id, startDate);
  }

  // Part 8 A4 — server-truth subscription lifecycle event. A trial pack
  // emits trial_started (F5 funnel entry); a standard subscription emits
  // subscription_started (F3 terminal step). Fire-and-forget: emitServerEvent
  // never throws, so the money path cannot be broken by analytics.
  void emitServerEvent(
    isTrial ? "trial_started" : "subscription_started",
    { cadence: data.cadence, plan_type: isTrial ? "trial" : "standard" },
    userId,
  );
  invalidateUserBrief(userId);
  res.status(201).json({
    subscription: sub,
    deliveries,
    bridgeCreditPaise,
    creditAppliedPaise: ledgerCreditPaise,
  });
});

// ── Plan-v2 subscription add-ons (02 §5 / 02a §4) ────────────────────────────
// rd_bump is billed at create (plan review, above); evening_add is attached
// here, post-purchase, one tap. Each attach snapshots price/cadence from the
// canonical ADD_ONS config (via resolveAddOns) and is enforced against the
// plan's allow-list. Summing active add-ons into the recurring charge is
// roadmap slice S6b.
const attachAddOnSchema = z.object({
  addOnId: z.enum(["rd_bump", "evening_add"]),
});

router.get(
  "/subscriptions/:id/add-ons",
  async (req: Request, res: Response): Promise<void> => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = Number(req.params.id);
    if (!Number.isInteger(subId) || subId <= 0) {
      res.status(400).json({ error: "invalid subscription id" });
      return;
    }
    const [sub] = await db
      .select({ id: subscriptionsTable.id })
      .from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.id, subId), eq(subscriptionsTable.userId, userId)))
      .limit(1);
    if (!sub) {
      res.status(404).json({ error: "subscription not found" });
      return;
    }
    const rows = await db
      .select()
      .from(subscriptionAddonsTable)
      .where(eq(subscriptionAddonsTable.subscriptionId, subId));
    res.json({ addOns: rows });
  },
);

router.post(
  "/subscriptions/:id/add-ons",
  async (req: Request, res: Response): Promise<void> => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = Number(req.params.id);
    if (!Number.isInteger(subId) || subId <= 0) {
      res.status(400).json({ error: "invalid subscription id" });
      return;
    }
    const parsed = attachAddOnSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload", details: parsed.error.issues });
      return;
    }
    const { addOnId } = parsed.data;

    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.id, subId), eq(subscriptionsTable.userId, userId)))
      .limit(1);
    if (!sub) {
      res.status(404).json({ error: "subscription not found" });
      return;
    }

    // The plan's add-on allow-list is keyed off the plan_v2 notes tag.
    const planId = planIdFromNotes(sub.notes);
    if (!planId) {
      res.status(409).json({ error: "not a plan-v2 subscription", code: "not_plan_v2" });
      return;
    }
    const { items, rejected } = resolveAddOns(planId, [addOnId]);
    if (rejected.length > 0 || items.length === 0) {
      res.status(422).json({
        error: "add-on not available for this plan",
        code: "addon_not_allowed",
        planId,
        rejected,
        allowed: PLAN_CATALOG[planId].addOnsAllowed,
      });
      return;
    }
    const addon = items[0]!;

    // Idempotent: a re-tap on an already-active add-on returns the existing row
    // (200) rather than stacking a duplicate charge line.
    const [existing] = await db
      .select()
      .from(subscriptionAddonsTable)
      .where(
        and(
          eq(subscriptionAddonsTable.subscriptionId, subId),
          eq(subscriptionAddonsTable.addonId, addOnId),
          eq(subscriptionAddonsTable.active, true),
        ),
      )
      .limit(1);
    if (existing) {
      res.status(200).json({ addOn: existing, alreadyActive: true });
      return;
    }

    const [row] = await db
      .insert(subscriptionAddonsTable)
      .values({
        subscriptionId: subId,
        addonId: addon.id,
        pricePaise: addon.pricePaise,
        cadence: addon.cadence,
        active: true,
      })
      .returning();
    res.status(201).json({ addOn: row });
  },
);

router.delete(
  "/subscriptions/:id/add-ons/:addOnId",
  async (req: Request, res: Response): Promise<void> => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = Number(req.params.id);
    const addOnId = req.params.addOnId;
    if (!Number.isInteger(subId) || subId <= 0) {
      res.status(400).json({ error: "invalid subscription id" });
      return;
    }
    if (addOnId !== "rd_bump" && addOnId !== "evening_add") {
      res.status(400).json({ error: "invalid add-on id" });
      return;
    }
    const [sub] = await db
      .select({ id: subscriptionsTable.id })
      .from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.id, subId), eq(subscriptionsTable.userId, userId)))
      .limit(1);
    if (!sub) {
      res.status(404).json({ error: "subscription not found" });
      return;
    }
    // Soft-detach (active=false) preserves the audit trail (schema doc).
    const detached = await db
      .update(subscriptionAddonsTable)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(subscriptionAddonsTable.subscriptionId, subId),
          eq(subscriptionAddonsTable.addonId, addOnId),
          eq(subscriptionAddonsTable.active, true),
        ),
      )
      .returning({ id: subscriptionAddonsTable.id });
    if (detached.length === 0) {
      res.status(404).json({ error: "add-on not attached" });
      return;
    }
    res.json({ ok: true, detached: addOnId });
  },
);

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
  const decryptedMembers = members.map((m) => ({
    ...m,
    allergens: decryptClinicalStrings(m.allergens),
    medicalConditions: decryptClinicalStrings(m.medicalConditions),
    dislikedIngredients: decryptClinicalStrings(m.dislikedIngredients),
  }));
  res.json({ subscription: sub, members: decryptedMembers, deliveries, mandate });
});

// Shared "upcoming → paused" delivery transition. Used by the customer-
// initiated /pause route below AND by chargeMandate.ts's failCharge when
// billing halts after MAX_CONSECUTIVE_CHARGE_FAILURES — a halted
// subscription shouldn't keep dispatching deliveries nobody's paying for,
// so it reuses exactly the same delivery-state change a manual pause does.
export async function pauseUpcomingDeliveries(subId: number): Promise<void> {
  await db
    .update(subscriptionDeliveriesTable)
    .set({ status: "paused" })
    .where(
      and(
        eq(subscriptionDeliveriesTable.subscriptionId, subId),
        eq(subscriptionDeliveriesTable.status, "upcoming"),
      ),
    );
}

// Inverse of pauseUpcomingDeliveries — shared by /resume and
// /reactivate-billing (both put a subscription back into normal dispatch).
export async function resumeUpcomingDeliveries(subId: number): Promise<void> {
  await db
    .update(subscriptionDeliveriesTable)
    .set({ status: "upcoming" })
    .where(
      and(
        eq(subscriptionDeliveriesTable.subscriptionId, subId),
        eq(subscriptionDeliveriesTable.status, "paused"),
      ),
    );
}

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
  await pauseUpcomingDeliveries(subId);
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
    await resumeUpcomingDeliveries(subId);
    res.json({ subscription: updated });
  },
);

// ─────────────────────────────────────────────────────────────────────────
// Recovery path for a subscription whose billing was halted after
// MAX_CONSECUTIVE_CHARGE_FAILURES consecutive failed debits (see
// chargeMandate.ts's failCharge). Mirrors what happens when a real Razorpay
// native subscription customer clears a `subscription.halted` state: the
// EXISTING Razorpay customer_id/token is reused as-is (the common case is a
// temporary decline — expired-card-this-cycle, insufficient funds — not a
// permanently revoked token); this route does not re-register a new mandate.
// If the token itself has actually been revoked by Razorpay, the next charge
// attempt will simply fail again and re-halt after MAX_CONSECUTIVE_CHARGE_FAILURES
// — re-registering a fresh token is out of scope for this route.
//
// Folded in as its own endpoint (rather than reusing /resume) because the
// preconditions and the mandate-side reset are meaningfully different from
// a customer-initiated pause: /resume only ever flips subscriptionsTable
// (a paused subscription's mandate was never touched), whereas recovering
// from "halted" must also un-halt subscriptionMandatesTable and reset its
// failure counter — conflating the two into one route/precondition would
// make both harder to reason about.
router.post(
  "/subscriptions/:id/reactivate-billing",
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
    if (sub.status !== "halted") {
      res.status(409).json({ error: "subscription is not halted" });
      return;
    }

    // Resume on the normal cadence, not instantly: land nextChargeAt in the
    // middle of the pre-debit sweep's [now+24h, now+26h) lookahead window
    // (see preDebitScheduler.ts, hourly tick) so the very next tick sends a
    // fresh pre-debit notice and the customer gets the RBI-mandated >=24h
    // notice before being charged, rather than being billed same-day.
    const nextChargeAt = new Date(Date.now() + 25 * 60 * 60 * 1000);

    const [updatedSub] = await db
      .update(subscriptionsTable)
      .set({ status: "active" })
      .where(eq(subscriptionsTable.id, subId))
      .returning();

    const [updatedMandate] = await db
      .update(subscriptionMandatesTable)
      .set({
        status: "active",
        chargeFailureCount: 0,
        nextChargeAt,
      })
      .where(eq(subscriptionMandatesTable.subscriptionId, subId))
      .returning();

    invalidateUserBrief(userId);
    // Billing resuming means deliveries should too — mirrors /resume.
    await resumeUpcomingDeliveries(subId);

    res.json({ subscription: updatedSub, mandate: updatedMandate ?? null });
  },
);

// Core cancel logic, factored out so callers other than the HTTP route (e.g.
// the subscription-abandonment sweep in ../lib/subscriptionAbandonmentScheduler)
// can cancel a subscription — flip status, cancel its upcoming deliveries, and
// revoke its autopay mandate — without duplicating any of these three steps.
// Returns null if the subscription id does not exist (nothing to cancel).
export async function cancelSubscriptionById(
  subId: number,
  log: Parameters<typeof cancelAutopayMandate>[1],
): Promise<typeof subscriptionsTable.$inferSelect | null> {
  const [updated] = await db
    .update(subscriptionsTable)
    .set({ status: "cancelled" })
    .where(eq(subscriptionsTable.id, subId))
    .returning();
  if (!updated) return null;
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
  await cancelAutopayMandate(subId, log);
  return updated;
}

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
    const updated = await cancelSubscriptionById(subId, req.log);
    invalidateUserBrief(userId);
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
      .values({
        subscriptionId: subId,
        ...parsed.data,
        allergens: encryptClinicalStrings(parsed.data.allergens),
        medicalConditions: encryptClinicalStrings(parsed.data.medicalConditions),
        dislikedIngredients: encryptClinicalStrings(parsed.data.dislikedIngredients),
      })
      .returning();
    invalidateUserBrief(userId);
    const decryptedMember = member
      ? {
          ...member,
          allergens: decryptClinicalStrings(member.allergens),
          medicalConditions: decryptClinicalStrings(member.medicalConditions),
          dislikedIngredients: decryptClinicalStrings(member.dislikedIngredients),
        }
      : member;
    res.status(201).json({ member: decryptedMember });
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
  "/subscription-deliveries/:id/unskip",
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
    if (found.delivery.status !== "skipped") {
      res.status(400).json({ error: "delivery is not skipped" });
      return;
    }
    // Same cutoff as skip: the kitchen window has passed, so a resurrected
    // delivery could never actually be prepared.
    if (isPastSkipCutoff(found.delivery.scheduledFor)) {
      res.status(409).json({
        error: "This delivery is too close to its delivery time to restore.",
        code: "past_cutoff",
        cutoffHours: SKIP_SWAP_CUTOFF_MS / 3_600_000,
      });
      return;
    }

    // Money-safety rule (mirror of skip's double-credit guard): NEVER flip a
    // delivery back to upcoming without clawing back its skip credit in the
    // same transaction. The credit DELETE is keyed on consumedAt IS NULL and
    // uses .returning() as the guard — if the credit was already spent (or
    // never existed) we abort WITHOUT touching the delivery, otherwise the
    // customer would get the meals delivered AND keep the spent credit.
    const outcome = await db.transaction(async (tx) => {
      const clawedBack = await tx
        .delete(mealCreditsTable)
        .where(
          and(
            eq(mealCreditsTable.deliveryId, deliveryId),
            eq(mealCreditsTable.reason, "skipped_delivery"),
            isNull(mealCreditsTable.consumedAt),
          ),
        )
        .returning({ id: mealCreditsTable.id });
      if (clawedBack.length === 0) {
        // Nothing deleted → nothing to roll back; safe to return inside the tx.
        return { code: "credit_consumed" as const };
      }
      // Atomic transition guard keyed on status='skipped', same shape as the
      // skip route's — of two concurrent unskips exactly one flips the row.
      const [row] = await tx
        .update(subscriptionDeliveriesTable)
        .set({ status: "upcoming" })
        .where(
          and(
            eq(subscriptionDeliveriesTable.id, deliveryId),
            eq(subscriptionDeliveriesTable.status, "skipped"),
          ),
        )
        .returning();
      // Lost the race to a concurrent unskip: throw so the transaction rolls
      // the credit DELETE back too — the winner's flip keeps exactly one
      // clawed-back credit.
      if (!row) throw new Error("unskip_conflict");
      return { delivery: row };
    }).catch((err: unknown) => {
      if (err instanceof Error && err.message === "unskip_conflict") {
        return { code: "credit_consumed" as const };
      }
      throw err;
    });

    if ("code" in outcome || !outcome.delivery) {
      res.status(409).json({ error: "skip credit already used", code: "credit_consumed" });
      return;
    }
    const updated = outcome.delivery;

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
    const macroMatch = await validateMacroCapForSwap(
      found.subscription.id,
      deliveryId,
      found.delivery.scheduledFor,
      parsed.data.items,
    );
    if (macroMatch.blocked) {
      res.status(422).json({
        error: "Macro cap exceeded",
        code: "macro_cap_exceeded",
        blocked: true,
        reasons: macroMatch.reasons,
      });
      return;
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

// ─────────────────────────────────────────────────────────────────────────────
// Change plan (cadence and/or mealsPerDelivery) — applied at the NEXT cycle,
// never mid-cycle. See applyPendingPlanChangeIfReady for where it takes
// effect. Mirrors /convert's "don't touch the current cycle's deliveries,
// generate the next cycle fresh" pattern rather than delivery-window's
// "mutate + propagate to upcoming rows now" pattern, because a cadence/meals
// change always changes price and the customer already committed to (and, if
// autopay, was authorised for) the deliveries already on the books.
// ─────────────────────────────────────────────────────────────────────────────

const changePlanSchema = z
  .object({
    cadence: cadenceSchema.optional(),
    mealsPerDelivery: z.number().int().positive().max(50).optional(),
    // Accepted for tamper-detection/logging only, exactly like the
    // `amountPaise` field on POST /payments/razorpay/order — the server
    // always recomputes the price itself; this value never changes what a
    // customer is billed.
    clientQuotedPricePerDeliveryPaise: z.number().int().positive().optional(),
  })
  .refine((d) => d.cadence !== undefined || d.mealsPerDelivery !== undefined, {
    message: "at least one of cadence or mealsPerDelivery must be provided",
  });

router.post(
  "/subscriptions/:id/change-plan",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = parseIdParam(req.params.id, res);
    if (subId === null) return;
    const parsed = changePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload", details: parsed.error.issues });
      return;
    }
    const sub = await loadSubscriptionForUser(subId, userId);
    if (!sub) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (isTrialSubscription(sub)) {
      res.status(400).json({ error: "a trial pack is one-off and cannot change plan" });
      return;
    }
    if (sub.status !== "active") {
      res.status(409).json({ error: `cannot change plan while ${sub.status}` });
      return;
    }

    const newCadence = parsed.data.cadence ?? sub.cadence;
    const newMeals = parsed.data.mealsPerDelivery ?? sub.mealsPerDelivery;

    if (newCadence === sub.cadence && newMeals === sub.mealsPerDelivery) {
      res.status(400).json({ error: "requested plan matches the current plan" });
      return;
    }

    // Day-first (dayPlan) subscriptions: the meal composition comes from the
    // per-day item plan, not a flat count, so mealsPerDelivery can't be
    // changed independently here. A cadence-only change is still fine as
    // long as every existing day offset still fits inside the new cycle —
    // same guard the create route applies to a brand-new dayPlan.
    if (sub.dayPlan && sub.dayPlan.length > 0) {
      if (newMeals !== sub.mealsPerDelivery) {
        res.status(400).json({
          error:
            "This plan's meals are set by its day-by-day schedule — edit individual deliveries instead of changing meals per delivery.",
        });
        return;
      }
      const newCycleLen = CADENCE_DAYS[newCadence];
      if (sub.dayPlan.some((d: { dayOffset: number }) => d.dayOffset >= newCycleLen)) {
        res.status(400).json({
          error: `This plan's day-by-day schedule doesn't fit inside a ${newCadence} cycle.`,
        });
        return;
      }
    }

    // Money-path authority: the new price is ALWAYS computed server-side —
    // never trust a client-supplied number, tampered or not.
    const newPricePerDeliveryPaise = computeDeliveryPricePaise(newCadence, newMeals);
    if (
      parsed.data.clientQuotedPricePerDeliveryPaise != null &&
      parsed.data.clientQuotedPricePerDeliveryPaise !== newPricePerDeliveryPaise
    ) {
      req.log.warn(
        {
          subId,
          clientQuoted: parsed.data.clientQuotedPricePerDeliveryPaise,
          serverComputed: newPricePerDeliveryPaise,
        },
        "change-plan price mismatch — billing server-computed price",
      );
    }

    const isIncrease = newPricePerDeliveryPaise > sub.pricePerDeliveryPaise;

    // Re-authorisation is about protecting an EXISTING capped autopay
    // mandate's fixed ceiling, not the nominal cadence label — key it off
    // whether an active mandate actually exists for this subscription. A
    // price decrease or same price is always safe to apply against an
    // unchanged mandate; only an increase against a live mandate needs a
    // fresh OTP authorisation (there is no "amend max_amount" API call).
    let requiresReauth = false;
    if (isIncrease) {
      const [activeMandate] = await db
        .select({ id: subscriptionMandatesTable.id })
        .from(subscriptionMandatesTable)
        .where(
          and(
            eq(subscriptionMandatesTable.subscriptionId, subId),
            eq(subscriptionMandatesTable.status, "active"),
          ),
        )
        .limit(1);
      requiresReauth = activeMandate != null;
    }

    const [updated] = await db
      .update(subscriptionsTable)
      .set({
        pendingCadence: newCadence,
        pendingMealsPerDelivery: newMeals,
        pendingPricePerDeliveryPaise: newPricePerDeliveryPaise,
        pendingChangeRequestedAt: new Date(),
        pendingChangeReauthRequired: requiresReauth,
        pendingChangeRazorpayOrderId: null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionsTable.id, subId))
      .returning();

    invalidateUserBrief(userId);
    res.json({
      subscription: updated,
      requiresReauth,
      currentPricePerDeliveryPaise: sub.pricePerDeliveryPaise,
      newPricePerDeliveryPaise,
    });
  },
);

/**
 * Creates the Razorpay order + recurring token needed to re-authorise a
 * pending, price-increasing plan change — the SAME token-creation shape used
 * at subscription creation (POST /payments/razorpay/order's isRecurring
 * branch), reused via ../lib/razorpayRecurring rather than reinvented. Not
 * routed through the generic checkout order/verify endpoints: those are
 * bound to a real placed order (petpooja push, order-confirmation email,
 * refunds) which a plan-change re-authorisation is not.
 */
router.post(
  "/subscriptions/:id/change-plan/reauth-order",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = parseIdParam(req.params.id, res);
    if (subId === null) return;
    const creds = razorpayCredentials();
    if (!creds) {
      res.status(503).json({ error: "payment gateway not configured" });
      return;
    }
    const [keyId, keySecret] = creds;

    const sub = await loadSubscriptionForUser(subId, userId);
    if (!sub) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (
      !sub.pendingChangeReauthRequired ||
      sub.pendingCadence == null ||
      sub.pendingPricePerDeliveryPaise == null
    ) {
      res.status(409).json({ error: "no pending plan change is awaiting re-authorisation" });
      return;
    }

    let razorpayCustomerId: string;
    try {
      razorpayCustomerId = await getOrCreateRazorpayCustomer(userId, keyId, keySecret, req.log);
    } catch (err) {
      req.log.error({ err, subId }, "failed to set up customer for plan-change re-authorisation");
      res.status(500).json({ error: "failed to set up customer for recurring payment" });
      return;
    }

    const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: sub.pendingPricePerDeliveryPaise,
        currency: "INR",
        receipt: `plan-change-${subId}`.slice(0, 40),
        payment_capture: 1,
        customer_id: razorpayCustomerId,
        token: {
          auth_type: "otp",
          max_amount: 1500000,
          expire_by: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60, // 10 years
          frequency: "as_presented",
        },
      }),
    });

    if (!rpRes.ok) {
      let body: unknown;
      try {
        body = await rpRes.json();
      } catch {
        body = await rpRes.text();
      }
      req.log.error({ status: rpRes.status, body }, "Razorpay plan-change reauth order creation failed");
      res.status(502).json({ error: "payment gateway error" });
      return;
    }

    const rp = (await rpRes.json()) as { id: string; amount: number; currency: string };

    // Bind the confirm step to exactly this order — a signature valid for a
    // different Razorpay order must never be able to confirm this change.
    await db
      .update(subscriptionsTable)
      .set({ pendingChangeRazorpayOrderId: rp.id, updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, subId));

    res.json({ razorpayOrderId: rp.id, amount: rp.amount, currency: rp.currency, keyId });
  },
);

const changePlanConfirmSchema = z.object({
  razorpayPaymentId: z.string().min(1).max(64),
  razorpayOrderId: z.string().min(1).max(64),
  razorpaySignature: z.string().min(1).max(128),
});

/**
 * Confirms a price-increasing plan change after the customer completes the
 * Razorpay OTP modal. Verifies the payment signature (same HMAC pattern as
 * POST /payments/razorpay/verify), binds it to the order created by
 * change-plan/reauth-order, then registers the new mandate — replacing the
 * old one — via the SAME upsert helper subscription creation uses. The plan
 * change itself is NOT applied here: only `pendingChangeReauthRequired` is
 * cleared, so applyPendingPlanChangeIfReady can pick it up at the next cycle
 * boundary (see generate-next).
 */
router.post(
  "/subscriptions/:id/change-plan/confirm",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const subId = parseIdParam(req.params.id, res);
    if (subId === null) return;
    const creds = razorpayCredentials();
    if (!creds) {
      res.status(503).json({ error: "payment gateway not configured" });
      return;
    }
    const [, keySecret] = creds;

    const parsed = changePlanConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }

    const sub = await loadSubscriptionForUser(subId, userId);
    if (!sub) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (!sub.pendingChangeReauthRequired || sub.pendingCadence == null) {
      res.status(409).json({ error: "no pending plan change is awaiting re-authorisation" });
      return;
    }
    if (
      !sub.pendingChangeRazorpayOrderId ||
      sub.pendingChangeRazorpayOrderId !== parsed.data.razorpayOrderId
    ) {
      req.log.warn(
        { subId, presented: parsed.data.razorpayOrderId, stored: sub.pendingChangeRazorpayOrderId },
        "plan-change confirm: razorpay order id does not match — refusing",
      );
      res.status(400).json({ error: "this payment does not belong to this plan change" });
      return;
    }

    const hmac = crypto.createHmac("sha256", keySecret);
    hmac.update(`${parsed.data.razorpayOrderId}|${parsed.data.razorpayPaymentId}`);
    const expected = hmac.digest("hex");
    let signatureValid = false;
    try {
      signatureValid = crypto.timingSafeEqual(
        Buffer.from(expected, "hex"),
        Buffer.from(parsed.data.razorpaySignature, "hex"),
      );
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) {
      req.log.warn({ subId }, "invalid Razorpay signature on plan-change reauth confirm");
      res.status(400).json({ error: "invalid payment signature" });
      return;
    }

    const [keyId] = creds;
    let payment: any;
    try {
      payment = await fetchRazorpayPayment(parsed.data.razorpayPaymentId, keyId, keySecret);
    } catch (err) {
      req.log.error({ err, subId }, "failed to fetch payment for plan-change confirm");
      res.status(502).json({ error: "payment gateway error" });
      return;
    }
    const customerId = payment.customer_id;
    const tokenId = payment.token_id || payment.razorpay_token_id;
    if (!customerId || !tokenId) {
      req.log.warn({ subId }, "plan-change reauth payment carried no autopay token");
      res.status(502).json({ error: "payment did not return an autopay token" });
      return;
    }

    await upsertActiveMandate(subId, sub.pendingCadence, customerId, tokenId);

    // Re-authorised — eligible for the next cycle boundary now, but still
    // does not apply until then (see applyPendingPlanChangeIfReady).
    const [updated] = await db
      .update(subscriptionsTable)
      .set({
        pendingChangeReauthRequired: false,
        pendingChangeRazorpayOrderId: null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionsTable.id, subId))
      .returning();

    invalidateUserBrief(userId);
    res.json({ subscription: updated, requiresReauth: false });
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
    // Cycle-boundary math below is deliberately computed against the OLD
    // (currently-live) cadence — it has to match the cadence the
    // already-generated rows were actually laid down under. Only AFTER
    // locating that boundary do we flip to any pending cadence/meals change,
    // so the newly generated cycles step forward using the new cadence.
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

    // This IS the cycle rollover — apply any ready (non-reauth-pending) plan
    // change now, so the deliveries generated below use the new cadence,
    // meal count and (already recomputed) price.
    const { cadence, mealsPerDelivery } = await applyPendingPlanChangeIfReady(sub);

    const newOnes = await generateDeliveriesForSubscription(
      subId,
      cadence,
      startFrom,
      dayPlan && dayPlan.length > 0 ? CADENCE_CYCLES_AHEAD[cadence] : 4,
      sub.deliveryWindow,
      [],
      dayPlan,
    );
    await recomputeNextDeliveryAt(subId, sub.nextDeliveryAt);
    invalidateUserBrief(userId);
    res.json({
      deliveries: newOnes,
      planChangeApplied: cadence !== sub.cadence || mealsPerDelivery !== sub.mealsPerDelivery,
    });
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

        const isTrial = isLiveTrialState(sub.trialState);
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

