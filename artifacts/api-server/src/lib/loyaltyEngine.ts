import { and, asc, count, desc, eq, gt, isNull, sql } from "drizzle-orm";
import {
  bundlesTable,
  creditLedgerTable,
  db,
  deliverySlotsTable,
  loyaltyConfigTable,
  notificationsTable,
  orderClaimsTable,
  ordersTable,
  packagingReturnsTable,
  pickupLocationsTable,
  referralRedemptionsTable,
  slotReservationsTable,
  subscriptionDeliveriesTable,
  subscriptionsTable,
  companySubsidyChargesTable,
  userProfileTable,
  type CreditLedgerReason,
  type LoyaltyConfig,
  type Notification,
  type NotificationKind,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import { makeBatchDishResolver } from "./menuResolver";
import { computeBundleDiscountPaise } from "./bundlePricing";
import { reserveSubsidyForOrder } from "./corporateSubsidy";
import {
  evaluateDishForPreferences,
  type PreferencesForMatch,
} from "@workspace/preferences-match";
import { recordOpsAction } from "./opsAudit";
import type { DishData } from "@workspace/menu-catalog";
import type { PgTransaction } from "drizzle-orm/pg-core";
import {
  defaultChannelForKind,
  dispatchNotificationEmail,
} from "./notificationMail";
import { invalidateUserBrief } from "./userBrief";
import { geocodeAddress } from "./geocode";
import { isDeliverySlotBookable } from "./deliverySlotBooking";
import { getDecryptedPreferences } from "./userPreferences";

type DbOrTx = typeof db | PgTransaction<any, any, any>;

const DEFAULTS: Omit<LoyaltyConfig, "updatedAt"> = {
  id: 1,
  referrerAwardPaise: 30000,
  refereeAwardPaise: 30000,
  referralExpiryDays: 90,
  winbackPausedDays: 14,
  winbackOfferPaise: 25000,
  birthdayPaise: 50000,
  anniversaryPaise: 75000,
  loyaltyFreeEveryN: 4,
  premiumUnlockDeliveries: 8,
  premiumUnlockBonusPaise: 75000,
  proteinStreakThreshold: 3,
};

let _cachedConfig: LoyaltyConfig | null = null;
let _cachedAt = 0;
const CONFIG_TTL_MS = 60_000;

export async function getLoyaltyConfig(force = false): Promise<LoyaltyConfig> {
  if (!force && _cachedConfig && Date.now() - _cachedAt < CONFIG_TTL_MS) {
    return _cachedConfig;
  }
  const [row] = await db
    .select()
    .from(loyaltyConfigTable)
    .where(eq(loyaltyConfigTable.id, 1));
  if (row) {
    _cachedConfig = row;
  } else {
    const [created] = await db
      .insert(loyaltyConfigTable)
      .values(DEFAULTS)
      .onConflictDoNothing()
      .returning();
    if (created) _cachedConfig = created;
    else
      _cachedConfig = {
        ...DEFAULTS,
        updatedAt: new Date(),
      } as LoyaltyConfig;
  }
  _cachedAt = Date.now();
  return _cachedConfig;
}

export function invalidateLoyaltyConfigCache(): void {
  _cachedConfig = null;
}

/** Snapshot of current config for clients that need labels (UI). */
export async function getLoyaltyConstantsSnapshot(): Promise<{
  REFERRER_AWARD_PAISE: number;
  REFEREE_AWARD_PAISE: number;
  REFERRAL_EXPIRY_DAYS: number;
  WINBACK_PAUSED_DAYS: number;
  WINBACK_OFFER_PAISE: number;
  BIRTHDAY_PAISE: number;
  ANNIVERSARY_PAISE: number;
  LOYALTY_FREE_EVERY_N: number;
  PREMIUM_UNLOCK_DELIVERIES: number;
  PREMIUM_UNLOCK_BONUS_PAISE: number;
  PROTEIN_STREAK_THRESHOLD: number;
}> {
  const c = await getLoyaltyConfig();
  return {
    REFERRER_AWARD_PAISE: c.referrerAwardPaise,
    REFEREE_AWARD_PAISE: c.refereeAwardPaise,
    REFERRAL_EXPIRY_DAYS: c.referralExpiryDays,
    WINBACK_PAUSED_DAYS: c.winbackPausedDays,
    WINBACK_OFFER_PAISE: c.winbackOfferPaise,
    BIRTHDAY_PAISE: c.birthdayPaise,
    ANNIVERSARY_PAISE: c.anniversaryPaise,
    LOYALTY_FREE_EVERY_N: c.loyaltyFreeEveryN,
    PREMIUM_UNLOCK_DELIVERIES: c.premiumUnlockDeliveries,
    PREMIUM_UNLOCK_BONUS_PAISE: c.premiumUnlockBonusPaise,
    PROTEIN_STREAK_THRESHOLD: c.proteinStreakThreshold,
  };
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export async function issueCredit(
  args: {
    userId: string;
    deltaPaise: number;
    reason: CreditLedgerReason;
    refType?: string;
    refId?: string;
    note?: string;
    expiresAt?: Date | null;
  },
  tx: DbOrTx = db,
): Promise<void> {
  await tx.insert(creditLedgerTable).values({
    userId: args.userId,
    deltaPaise: args.deltaPaise,
    reason: args.reason,
    refType: args.refType ?? null,
    refId: args.refId ?? null,
    note: args.note ?? null,
    expiresAt: args.expiresAt ?? null,
  });
}

// FIFO lot-based balance — redemptions consume oldest-expiring
// unexpired lots first, so an expired grant can't drive balance < 0.
async function computeRemainingLots(
  userId: string,
  tx: DbOrTx,
): Promise<Array<{ remaining: number; expiresAt: Date | null }>> {
  const rows = await tx
    .select({
      deltaPaise: creditLedgerTable.deltaPaise,
      expiresAt: creditLedgerTable.expiresAt,
      createdAt: creditLedgerTable.createdAt,
    })
    .from(creditLedgerTable)
    .where(eq(creditLedgerTable.userId, userId))
    .orderBy(asc(creditLedgerTable.createdAt), asc(creditLedgerTable.id));

  const lots: Array<{
    remaining: number;
    expiresAt: Date | null;
    createdAt: Date;
  }> = [];

  for (const r of rows) {
    if (r.deltaPaise > 0) {
      lots.push({
        remaining: r.deltaPaise,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      });
      continue;
    }
    let needed = -r.deltaPaise;
    const eligible = lots
      .filter(
        (l) =>
          l.remaining > 0 &&
          (l.expiresAt === null || l.expiresAt > r.createdAt),
      )
      .sort((a, b) => {
        const ea = a.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
        const eb = b.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
        if (ea !== eb) return ea - eb;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
    for (const lot of eligible) {
      if (needed <= 0) break;
      const take = Math.min(lot.remaining, needed);
      lot.remaining -= take;
      needed -= take;
    }
  }
  return lots;
}

export async function getCreditBalancePaise(
  userId: string,
  tx: DbOrTx = db,
): Promise<number> {
  const lots = await computeRemainingLots(userId, tx);
  const now = Date.now();
  let total = 0;
  for (const l of lots) {
    if (l.remaining <= 0) continue;
    if (l.expiresAt !== null && l.expiresAt.getTime() <= now) continue;
    total += l.remaining;
  }
  return total;
}

export async function redeemCreditAtomic(args: {
  userId: string;
  paise: number;
  refId?: string;
  note?: string;
}): Promise<{ ok: true; balancePaise: number } | { ok: false; reason: "insufficient" }> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"credit:" + args.userId}, 0))`,
    );
    const balance = await getCreditBalancePaise(args.userId, tx);
    if (balance < args.paise) {
      return { ok: false, reason: "insufficient" } as const;
    }
    await issueCredit(
      {
        userId: args.userId,
        deltaPaise: -args.paise,
        reason: "checkout_redemption",
        refType: "checkout",
        refId: args.refId,
        note: args.note ?? "Applied at checkout",
      },
      tx,
    );
    const newBalance = await getCreditBalancePaise(args.userId, tx);
    return { ok: true, balancePaise: newBalance } as const;
  });
}

async function ensureNotification(
  args: {
    userId: string;
    kind: NotificationKind;
    title: string;
    body: string;
    dedupeKey: string;
    payload?: Record<string, unknown>;
    channel?: "email" | "in_app";
  },
  tx: DbOrTx = db,
  pendingDispatches?: Notification[],
): Promise<Notification | null> {
  const channel = args.channel ?? defaultChannelForKind(args.kind);
  // For email-channel rows we leave status="pending" + sentAt=null until the
  // mail dispatcher actually delivers (or downgrades) the notification.
  const isEmail = channel === "email";
  const [created] = await tx
    .insert(notificationsTable)
    .values({
      userId: args.userId,
      kind: args.kind,
      title: args.title,
      body: args.body,
      channel,
      dedupeKey: args.dedupeKey,
      payload: args.payload ?? null,
      status: isEmail ? "pending" : "sent",
      sentAt: isEmail ? null : new Date(),
    })
    .onConflictDoNothing({
      target: [notificationsTable.userId, notificationsTable.dedupeKey],
    })
    .returning();
  if (created && isEmail) {
    if (pendingDispatches) {
      // Caller is inside a transaction and will dispatch after commit so
      // the dispatcher's row update can't race the insert.
      pendingDispatches.push(created);
    } else {
      // No transaction in play — dispatch off the hot path. The dispatcher
      // owns its own error handling and final row state.
      setImmediate(() => {
        void dispatchNotificationEmail(created);
      });
    }
  }
  return created ?? null;
}

// Award pending referral on first order. Idempotent via awardedAt
// + advisory lock + unique notification dedupe key.
export type AwardReferralResult =
  | { awarded: true; redemptionId: number }
  | {
      awarded: false;
      reason:
        | "no_pending_referral"
        | "order_already_claimed"
        | "no_qualifying_activity"
        | "already_awarded";
    };

async function awardPendingReferralInTx(
  tx: DbOrTx,
  args: { refereeUserId: string; orderId: string },
  pendingDispatches?: Notification[],
): Promise<AwardReferralResult> {
  const config = await getLoyaltyConfig();
  // Find the pending redemption for this user (if any).
  const [pending] = await tx
    .select()
    .from(referralRedemptionsTable)
    .where(
      and(
        eq(referralRedemptionsTable.refereeUserId, args.refereeUserId),
        isNull(referralRedemptionsTable.awardedAt),
      ),
    );
  if (!pending) {
    return { awarded: false, reason: "no_pending_referral" } as const;
  }

  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${"referral:" + pending.id}, 0))`,
  );
  const [stillPending] = await tx
    .select()
    .from(referralRedemptionsTable)
    .where(
      and(
        eq(referralRedemptionsTable.id, pending.id),
        isNull(referralRedemptionsTable.awardedAt),
      ),
    );
  if (!stillPending) {
    return { awarded: false, reason: "already_awarded" } as const;
  }
  const expiresAt = addDays(new Date(), config.referralExpiryDays);
  await issueCredit(
    {
      userId: pending.referrerUserId,
      deltaPaise: pending.referrerAwardPaise,
      reason: "referral_referrer_award",
      refType: "referral_redemption",
      refId: String(pending.id),
      note: "Friend completed their first order",
      expiresAt,
    },
    tx,
  );
  await issueCredit(
    {
      userId: pending.refereeUserId,
      deltaPaise: pending.refereeAwardPaise,
      reason: "referral_referee_signup",
      refType: "referral_redemption",
      refId: String(pending.id),
      note: "Welcome bonus",
      expiresAt,
    },
    tx,
  );
  await tx
    .update(referralRedemptionsTable)
    .set({ awardedAt: new Date(), firstOrderId: args.orderId })
    .where(eq(referralRedemptionsTable.id, pending.id));
  await ensureNotification(
    {
      userId: pending.referrerUserId,
      kind: "referral_redeemed",
      title: "A friend just placed their first order",
      body: `You earned Rs.${(pending.referrerAwardPaise / 100).toFixed(0)} in credits.`,
      dedupeKey: `referral_award:${pending.id}`,
      payload: { redemptionId: pending.id },
    },
    tx,
    pendingDispatches,
  );
  return { awarded: true, redemptionId: pending.id };
}

// Server-owned checkout finalization: one transaction that records
// the order, redeems credits, and awards any pending referral.
export interface FinalizeOrderItem {
  id: number;
  name: string;
  qty: number;
  price: number;
}

export interface FinalizeOrderAddress {
  label?: string | null;
  line?: string | null;
  city?: string | null;
  pincode?: string | null;
  phone?: string | null;
}

export const PREORDER_DISCOUNT_BPS = 500; // 5% off scheduled orders

// First-order offer: flat 25% off the meal subtotal, capped at ₹80.
// Applied after bundle/pickup/preorder discounts, before credit
// redemption. Eligibility = authenticated user has no prior
// non-cancelled order.
export const FIRST_ORDER_DISCOUNT_BPS = 2500;
export const FIRST_ORDER_DISCOUNT_CAP_PAISE = 8_000;

// Charge composition — must mirror the client cart display (cartMath.ts):
// statutory GST split (prepared food 5% without ITC, delivery/platform
// service 18%), ₹50 delivery fee waived at/above a ₹500 subtotal.
export const FOOD_GST_BPS = 500; // 5% GST on prepared food (India, no ITC)
export const DELIVERY_GST_BPS = 1800; // 18% GST on the delivery service
export const DELIVERY_FEE_PAISE = 5_000;
export const FREE_DELIVERY_THRESHOLD_PAISE = 50_000;

/**
 * The single authoritative payable amount for an order, in paise.
 *
 *   charge = payable meal total (post-discount, post-credit)
 *          + 5% GST on that taxable meal value
 *          + delivery fee (waived when the pre-discount subtotal clears the
 *            free-delivery threshold; always zero for pickup)
 *          + 18% GST on the delivery fee
 *
 * This is the ONLY number the payment path may bill or reconcile against.
 * `subtotalPaise` is the pre-discount meal subtotal used purely for the
 * free-delivery threshold, so the fee tracks the same basis the cart's
 * free-delivery progress bar shows the customer. `gstPaise` is the blended
 * total (food + delivery) so the payment path stays a single scalar.
 */
export function computeChargePaise(args: {
  finalPaise: number;
  subtotalPaise: number;
  fulfillmentType: "delivery" | "pickup";
}): { chargePaise: number; gstPaise: number; deliveryFeePaise: number } {
  const deliveryFeePaise =
    args.fulfillmentType === "pickup" ||
    args.subtotalPaise === 0 ||
    args.subtotalPaise >= FREE_DELIVERY_THRESHOLD_PAISE
      ? 0
      : DELIVERY_FEE_PAISE;
  const foodGstPaise = Math.round((args.finalPaise * FOOD_GST_BPS) / 10_000);
  const deliveryGstPaise = Math.round(
    (deliveryFeePaise * DELIVERY_GST_BPS) / 10_000,
  );
  const gstPaise = foodGstPaise + deliveryGstPaise;
  return {
    chargePaise: args.finalPaise + gstPaise + deliveryFeePaise,
    gstPaise,
    deliveryFeePaise,
  };
}

export async function userIsFirstOrderEligible(
  userId: string,
  // Exclude the order being finalized so an idempotent retry of the
  // user's first order still counts as eligible (its own row from the
  // first attempt must not disqualify the replayed response).
  excludeExternalOrderId?: string,
): Promise<boolean> {
  const conditions = [
    eq(ordersTable.userId, userId),
    sql`${ordersTable.status} <> 'cancelled'`,
  ];
  if (excludeExternalOrderId) {
    conditions.push(
      sql`${ordersTable.externalOrderId} is distinct from ${excludeExternalOrderId}`,
    );
  }
  const [prior] = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(and(...conditions))
    .limit(1);
  return !prior;
}

export async function finalizeOrder(args: {
  userId: string;
  orderId: string;
  items: FinalizeOrderItem[];
  address?: FinalizeOrderAddress;
  applyCreditsPaise?: number;
  scheduledFor?: Date | null;
  bundleSlugs?: string[];
  deliverySlotId?: number | null;
  pickupLocationId?: number | null;
  fulfillmentType?: "delivery" | "pickup";
  // Phase B2 — scheduled à la carte: when set, a delivery order MUST carry an
  // explicit, still-open future slot (no "deliver now" ASAP auto-pick), and the
  // order's scheduledFor is taken from that slot's window.
  requireScheduledSlot?: boolean;
  ecoPackagingOptIn?: boolean;
  deliveryInstructions?: string | null;
  subscriptionId?: number | null;
  /**
   * The member's INTENT to spend their corporate allowance on this order — not
   * an amount. Defaults to true, matching the checkout toggle's default; the
   * server computes the paise from company policy under a lock and subtracts it
   * from charge_paise. See lib/corporateSubsidy.ts.
   */
  applySubsidy?: boolean;
}): Promise<{
  orderId: string;
  serverOrderId: number;
  grossPaise: number;
  bundleDiscountPaise: number;
  pickupDiscountPaise: number;
  preorderDiscountPaise: number;
  firstOrderDiscountPaise: number;
  redeemedPaise: number;
  finalPaise: number;
  gstPaise: number;
  deliveryFeePaise: number;
  chargePaise: number;
  /**
   * The company's share, already SUBTRACTED from chargePaise. Present so a
   * receipt can show the line; the payment path must keep billing chargePaise.
   */
  subsidyPaise: number;
  balancePaise: number;
  duplicate: boolean;
  referral: AwardReferralResult;
}> {
  // Server-authoritative pricing from the shared menu catalog.
  // Client-supplied `price` is ignored.
  if (args.items.length === 0) {
    throw new Error("order has no items");
  }
  // Helper: evaluate every cart dish against the user's saved prefs in
  // strict mode (allergens + diet + dislikes + keto carb-cap + RD
  // review state). Returns the per-dish block list for both the
  // outer pre-tx check and the in-tx re-check.
  const runSafetyEvaluation = (
    dishes: DishData[],
    p: PreferencesForMatch | null,
  ): Array<{
    dishId: number;
    dishName: string;
    reasons: ReturnType<typeof evaluateDishForPreferences>["blockReasons"];
  }> => {
    const out: Array<{
      dishId: number;
      dishName: string;
      reasons: ReturnType<typeof evaluateDishForPreferences>["blockReasons"];
    }> = [];
    for (const d of dishes) {
      const m = evaluateDishForPreferences(d, p, { strict: true });
      if (m.blocked) {
        out.push({ dishId: d.id, dishName: d.name, reasons: m.blockReasons });
      }
    }
    return out;
  };
  const validatedItems: FinalizeOrderItem[] = [];
  let grossPaise = 0;
  // Resolve the merged catalog once; subsequent lookups are in-memory.
  const catalog = await makeBatchDishResolver();
  // Track resolved dishes alongside validated line items so we can run
  // allergen + dietary-style safety in one pass without re-resolving below.
  const resolvedDishes: DishData[] = [];
  for (const it of args.items) {
    const dish = catalog.byId(it.id);
    if (!dish) throw new Error(`unknown dish id: ${it.id}`);
    if (!dish.isAvailable) throw new Error(`dish unavailable: ${dish.slug}`);
    const qty = Math.max(0, Math.floor(it.qty));
    if (qty <= 0) throw new Error(`invalid qty for dish ${dish.slug}`);
    grossPaise += dish.price * qty;
    validatedItems.push({ id: dish.id, name: dish.name, qty, price: dish.price });
    resolvedDishes.push(dish);
  }
  if (grossPaise <= 0) {
    throw new Error("order total must be positive");
  }
  // Clinical safety net: cross-check every cart dish against the user's
  // saved allergens AND dietary style before persisting an order. The
  // shared evaluator (@workspace/preferences-match) is the single source
  // of truth used by client + server, so what the patient sees in the
  // menu UI matches what the server enforces. Fails CLOSED — a missing
  // preferences row means "nothing declared", but a single block rejects
  // the whole order with a structured `safety_block` payload (per-dish
  // codes: `allergen_block`, `diet_block`) that the route maps to 422.
  // There is intentionally no override path; the meal-planner / coach
  // flows already filter, so a block reaching finalize means the client
  // bypassed those filters and we refuse + audit.
  // Decrypt-on-read: clinical arrays are envelope-encrypted at rest; the
  // fail-closed safety evaluation below must compare plaintext values.
  const prefRow = await getDecryptedPreferences(args.userId);
  const prefs: PreferencesForMatch | null = prefRow
    ? {
        allergens: prefRow.allergens ?? [],
        dislikedIngredients: prefRow.dislikedIngredients ?? [],
        medicalConditions: prefRow.medicalConditions ?? [],
        cuisines: prefRow.cuisines ?? [],
        dietaryStyle: prefRow.dietaryStyle,
        goal: prefRow.goal,
        calorieTarget: prefRow.calorieTarget,
      }
    : null;
  const blocked = runSafetyEvaluation(resolvedDishes, prefs);
  if (blocked.length > 0) {
    const codes = Array.from(
      new Set(blocked.flatMap((b) => b.reasons.map((r) => r.code))),
    );
    const summary = blocked
      .map(
        (b) =>
          `${b.dishName} (${b.reasons.map((r) => r.code).join(",")})`,
      )
      .join("; ");
    // Audit the block before throwing. We `await` so the insert is
    // attempted before the safety error reaches the caller; the default
    // `db` executor already catches + logs write failures internally so
    // a logging outage here cannot mask the safety block. (Strict
    // "every block has an audit row" durability would need an outbox /
    // queue — tracked separately.)
    await recordOpsAction({
      operatorId: args.userId,
      agent: "checkout",
      action: "safety_block",
      params: {
        orderId: args.orderId,
        codes,
        blocked: blocked.map((b) => ({
          dishId: b.dishId,
          dishName: b.dishName,
          reasons: b.reasons,
        })),
      },
      beforeState: null,
      afterState: null,
      status: "blocked",
      reasoning: `safety gate refused checkout: ${summary}`,
    });
    const err = new Error(`safety_block: ${summary}`) as Error & {
      safetyBlock: { codes: string[]; blocked: typeof blocked };
    };
    err.safetyBlock = { codes, blocked };
    throw err;
  }
  // Bundle discount: for each requested bundle slug, verify every dish
  // in that bundle is present in the cart in sufficient quantity. If
  // valid, apply the bundle's (originalPricePaise - pricePaise) saving.
  // We track a per-dish "remaining qty" budget so the same line cannot
  // satisfy two overlapping bundles. Unknown / unsatisfied bundles are
  // silently dropped — never throw, since stale client state shouldn't
  // block checkout.
  // Preserve multiplicity: a client that bought the same combo twice sends the
  // slug twice and gets two discounts (assuming the cart has enough stock). We
  // dedupe only for the catalog lookup. The fail-closed discount math lives in
  // the pure `computeBundleDiscountPaise` (unit-tested without a DB).
  const requestedSlugs = (args.bundleSlugs ?? []).filter(
    (s) => typeof s === "string" && s.length > 0,
  );
  let bundleDiscountPaise = 0;
  if (requestedSlugs.length > 0) {
    const uniqueSlugs = Array.from(new Set(requestedSlugs));
    const bundleRows = await db
      .select()
      .from(bundlesTable)
      .where(inArray(bundlesTable.slug, uniqueSlugs));
    bundleDiscountPaise = computeBundleDiscountPaise({
      requestedSlugs,
      bundles: bundleRows.map((b) => ({
        slug: b.slug,
        dishIds: Array.isArray(b.dishIds) ? b.dishIds : [],
        originalPricePaise: b.originalPricePaise,
        pricePaise: b.pricePaise,
      })),
      items: args.items.map((it) => ({ id: it.id, qty: it.qty })),
      grossPaise,
    });
  }
  // Fulfillment invariants: a delivery order must reserve a real slot, and
  // a pickup order must point at an active partner location. We fail fast
  // with structured errors so the route can map them to user-friendly
  // 4xx responses instead of a generic 500.
  const fulfillmentType = args.fulfillmentType === "pickup" ? "pickup" : "delivery";
  if (fulfillmentType === "delivery" && !args.deliverySlotId) {
    if (args.requireScheduledSlot) {
      // Scheduled à la carte (Phase B2): windows-only, no "deliver now"
      // fallback. A slot is mandatory — fail closed. The checkout slot-picker
      // maps this to an inline "pick a delivery window" prompt.
      throw new Error("delivery slot required");
    }
    // Legacy/non-scheduled callers: assign the earliest still-open window.
    const [asap] = await db
      .select({ id: deliverySlotsTable.id })
      .from(deliverySlotsTable)
      .where(
        and(
          gt(deliverySlotsTable.endsAt, new Date()),
          sql`${deliverySlotsTable.reservedCount} < ${deliverySlotsTable.capacity}`,
        ),
      )
      .orderBy(asc(deliverySlotsTable.startsAt))
      .limit(1);
    if (!asap) {
      throw new Error("delivery slot required");
    }
    args.deliverySlotId = asap.id;
  }
  if (fulfillmentType === "pickup" && !args.pickupLocationId) {
    throw new Error("pickup location required");
  }
  if (fulfillmentType === "delivery" && args.deliverySlotId) {
    const [slot] = await db
      .select({
        id: deliverySlotsTable.id,
        startsAt: deliverySlotsTable.startsAt,
        endsAt: deliverySlotsTable.endsAt,
        reservedCount: deliverySlotsTable.reservedCount,
        capacity: deliverySlotsTable.capacity,
      })
      .from(deliverySlotsTable)
      .where(eq(deliverySlotsTable.id, args.deliverySlotId))
      .limit(1);
    if (!slot) throw new Error("delivery slot not found");
    if (args.requireScheduledSlot) {
      // Gate on a still-open, non-full window; distinguish expired (re-pick)
      // from full (choose another) so the picker can prompt correctly.
      if (!isDeliverySlotBookable(slot, new Date())) {
        throw new Error(
          slot.reservedCount >= slot.capacity
            ? "delivery slot full"
            : "delivery slot required",
        );
      }
      // orders.scheduledFor is the slot's window start — the single source of
      // truth for the scheduled order (also triggers the pre-order discount).
      args.scheduledFor = slot.startsAt;
    }
  }
  // Pickup discount — choosing self-pickup at a partner location swaps the
  // rider hop for a flat per-order discount sourced from the location row.
  let pickupDiscountPaise = 0;
  let pickupLocation: typeof pickupLocationsTable.$inferSelect | null = null;
  if (fulfillmentType === "pickup" && args.pickupLocationId) {
    const [loc] = await db
      .select()
      .from(pickupLocationsTable)
      .where(eq(pickupLocationsTable.id, args.pickupLocationId))
      .limit(1);
    if (!loc || !loc.active) {
      throw new Error("pickup location unavailable");
    }
    pickupLocation = loc;
    pickupDiscountPaise = Math.min(
      Math.max(0, loc.discountPaise ?? 0),
      Math.max(0, grossPaise - bundleDiscountPaise),
    );
  }
  // Geocode the delivery address up-front so dispatch can use real coords
  // and km savings reported in the A/B comparison are precise. Pickup
  // orders have no drop. Geocoder failures fall back to the synthetic
  // helper inside geocodeAddress, so checkout never breaks because the
  // geocoder is offline — but we *do* require at least one usable address
  // field for delivery so we never persist a NULL drop coordinate that
  // would silently fall back to the metro-default at dispatch time.
  let dropLat: number | null = null;
  let dropLng: number | null = null;
  if (fulfillmentType === "delivery") {
    const hasAddr = !!(
      args.address?.line ||
      args.address?.pincode ||
      args.address?.city
    );
    if (!hasAddr) {
      throw new Error("delivery address required");
    }
    const geo = await geocodeAddress({
      line: args.address?.line ?? null,
      city: args.address?.city ?? null,
      pincode: args.address?.pincode ?? null,
    });
    dropLat = geo.lat;
    dropLng = geo.lng;
  }
  const grossAfterBundles = grossPaise - bundleDiscountPaise - pickupDiscountPaise;
  // Pre-order discount: 5% off the meal subtotal when scheduled for the
  // future. Floored to whole paise; never negative.
  const isScheduled =
    args.scheduledFor instanceof Date &&
    args.scheduledFor.getTime() > Date.now();
  const preorderDiscountPaise = isScheduled
    ? Math.floor((grossAfterBundles * PREORDER_DISCOUNT_BPS) / 10_000)
    : 0;
  const grossAfterPreorder = grossAfterBundles - preorderDiscountPaise;
  // First-order offer (25% up to ₹80) — server-authoritative; the client
  // mirrors the same math for display and reconciles the charge against
  // the value returned from here.
  let firstOrderDiscountPaise = 0;
  if (
    grossAfterPreorder > 0 &&
    (await userIsFirstOrderEligible(args.userId, args.orderId))
  ) {
    firstOrderDiscountPaise = Math.min(
      Math.floor((grossAfterPreorder * FIRST_ORDER_DISCOUNT_BPS) / 10_000),
      FIRST_ORDER_DISCOUNT_CAP_PAISE,
    );
  }
  const discountedGross = grossAfterPreorder - firstOrderDiscountPaise;
  const requested = Math.max(0, Math.floor(args.applyCreditsPaise ?? 0));
  const pendingDispatches: Notification[] = [];
  const txPromise = db.transaction(async (tx) => {
    // 0. Re-validate safety inside the transaction against a fresh
    //    catalog snapshot. Closes a TOCTOU window where a dish (or its
    //    review state) was edited after the initial gate above but
    //    before the order row is written. If anything trips here we
    //    abort the tx so no order is persisted; an audit row is appended
    //    outside the tx (the global `db` write survives the rollback).
    // Use the tx handle as the read executor so the catalog snapshot
    // observes any menu_items writes made earlier in this transaction
    // (and is genuinely tx-scoped for TOCTOU purposes).
    const txCatalog = await makeBatchDishResolver(tx);
    const reResolved = validatedItems.map((it) => {
      const d = txCatalog.byId(it.id);
      if (!d) throw new Error(`unknown dish id: ${it.id}`);
      return d;
    });
    // Re-read user preferences inside the tx — closes the second TOCTOU
    // window where the patient updated their allergens or dietary style
    // between the pre-tx gate and the order insert.
    const txPrefRow = await getDecryptedPreferences(args.userId, tx);
    const txPrefs: PreferencesForMatch | null = txPrefRow
      ? {
          allergens: txPrefRow.allergens ?? [],
          dislikedIngredients: txPrefRow.dislikedIngredients ?? [],
          medicalConditions: txPrefRow.medicalConditions ?? [],
          cuisines: txPrefRow.cuisines ?? [],
          dietaryStyle: txPrefRow.dietaryStyle,
          goal: txPrefRow.goal,
          calorieTarget: txPrefRow.calorieTarget,
        }
      : null;
    const txBlocked = runSafetyEvaluation(reResolved, txPrefs);
    if (txBlocked.length > 0) {
      const codes2 = Array.from(
        new Set(txBlocked.flatMap((b) => b.reasons.map((r) => r.code))),
      );
      const summary2 = txBlocked
        .map((b) => `${b.dishName} (${b.reasons.map((r) => r.code).join(",")})`)
        .join("; ");
      const err = new Error(`safety_block: ${summary2}`) as Error & {
        safetyBlock: { codes: string[]; blocked: typeof txBlocked };
        safetyBlockOrigin?: "tx";
      };
      err.safetyBlock = { codes: codes2, blocked: txBlocked };
      err.safetyBlockOrigin = "tx";
      throw err;
    }
    // 1. Persist a real server-side order row, idempotent on
    //    (userId, externalOrderId). This is the source of truth
    //    that referral awards are tied to — no order row, no award.
    const [createdOrder] = await tx
      .insert(ordersTable)
      .values({
        userId: args.userId,
        orderChannel: "own_app",
        externalOrderId: args.orderId,
        status: "placed",
        totalPaise: discountedGross,
        items: validatedItems,
        addressLabel: args.address?.label ?? null,
        addressLine: args.address?.line ?? null,
        city: args.address?.city ?? null,
        pincode: args.address?.pincode ?? null,
        phone: args.address?.phone ?? null,
        dropLat,
        dropLng,
        scheduledFor: isScheduled ? args.scheduledFor! : null,
        deliverySlotId: fulfillmentType === "delivery" ? args.deliverySlotId ?? null : null,
        pickupLocationId: pickupLocation?.id ?? null,
        fulfillmentType,
        ecoPackagingOptIn:
          args.ecoPackagingOptIn && fulfillmentType === "delivery" ? 1 : 0,
        deliveryInstructions: args.deliveryInstructions ?? null,
      })
      .onConflictDoNothing({
        target: [ordersTable.userId, ordersTable.externalOrderId],
        // Match the partial unique index on orders so Postgres can plan
        // the conflict spec (without this it errors at plan time).
        where: sql`${ordersTable.externalOrderId} is not null`,
      })
      .returning();

    let serverOrderId: number;
    if (createdOrder) {
      serverOrderId = createdOrder.id;
    } else {
      const [existingOrder] = await tx
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.userId, args.userId),
            eq(ordersTable.externalOrderId, args.orderId),
          ),
        );
      if (!existingOrder) throw new Error("order persistence race");
      serverOrderId = existingOrder.id;
    }

    if (args.subscriptionId) {
      const [firstDelivery] = await tx
        .select()
        .from(subscriptionDeliveriesTable)
        .where(
          and(
            eq(subscriptionDeliveriesTable.subscriptionId, args.subscriptionId),
            eq(subscriptionDeliveriesTable.status, "upcoming")
          )
        )
        .orderBy(asc(subscriptionDeliveriesTable.scheduledFor))
        .limit(1);

      if (firstDelivery) {
        await tx
          .update(subscriptionDeliveriesTable)
          .set({ orderId: serverOrderId })
          .where(eq(subscriptionDeliveriesTable.id, firstDelivery.id));
      }
    }

    // 2. Loyalty claim — same idempotency story as the order row.
    const [created] = await tx
      .insert(orderClaimsTable)
      .values({
        userId: args.userId,
        orderId: args.orderId,
        grossPaise: discountedGross,
        redeemedPaise: 0,
        finalPaise: discountedGross,
      })
      .onConflictDoNothing({
        target: [orderClaimsTable.userId, orderClaimsTable.orderId],
      })
      .returning();

    if (!created) {
      // Duplicate finalize call — return the existing claim verbatim.
      const [existing] = await tx
        .select()
        .from(orderClaimsTable)
        .where(
          and(
            eq(orderClaimsTable.userId, args.userId),
            eq(orderClaimsTable.orderId, args.orderId),
          ),
        );
      const balance = await getCreditBalancePaise(args.userId, tx);
      const dupFinalPaise = existing?.finalPaise ?? discountedGross;
      const dupCharge = computeChargePaise({
        finalPaise: dupFinalPaise,
        subtotalPaise: grossPaise,
        fulfillmentType,
      });
      // Read the subsidy already reserved for this order rather than
      // recomputing it: the first finalize subtracted THAT number from the
      // persisted charge_paise, and a replay must report the same figure or
      // the client would show a total the gateway will not bill. Recomputing
      // could differ — budget may have moved since.
      const [dupSubsidy] = await tx
        .select({ paise: companySubsidyChargesTable.paise })
        .from(companySubsidyChargesTable)
        .where(
          and(
            eq(companySubsidyChargesTable.orderId, serverOrderId),
            inArray(companySubsidyChargesTable.status, [
              "reserved",
              "committed",
            ]),
          ),
        );
      const dupSubsidyPaise = dupSubsidy?.paise ?? 0;
      return {
        orderId: args.orderId,
        serverOrderId,
        grossPaise: existing?.grossPaise ?? discountedGross,
        bundleDiscountPaise,
        pickupDiscountPaise,
        preorderDiscountPaise,
        firstOrderDiscountPaise,
        redeemedPaise: existing?.redeemedPaise ?? 0,
        finalPaise: dupFinalPaise,
        gstPaise: dupCharge.gstPaise,
        deliveryFeePaise: dupCharge.deliveryFeePaise,
        chargePaise: Math.max(0, dupCharge.chargePaise - dupSubsidyPaise),
        subsidyPaise: dupSubsidyPaise,
        balancePaise: balance,
        duplicate: true,
        referral: {
          awarded: false,
          reason: "order_already_claimed",
        } as const,
      };
    }

    // 2b. Side effects gated on a fresh claim — running these on duplicate
    //     finalize calls would double-reserve slots and double-issue eco
    //     credit. Unique indexes on `slot_reservations(order_id)` and
    //     `packaging_returns(order_id)` are the belt-and-suspenders.
    if (args.deliverySlotId && fulfillmentType === "delivery") {
      const reserved = await tx
        .update(deliverySlotsTable)
        .set({ reservedCount: sql`${deliverySlotsTable.reservedCount} + 1` })
        .where(
          and(
            eq(deliverySlotsTable.id, args.deliverySlotId),
            sql`${deliverySlotsTable.reservedCount} < ${deliverySlotsTable.capacity}`,
          ),
        )
        .returning({ id: deliverySlotsTable.id });
      if (reserved.length === 0) {
        throw new Error("delivery slot full");
      }
      await tx.insert(slotReservationsTable).values({
        slotId: args.deliverySlotId,
        userId: args.userId,
        orderId: serverOrderId,
        kind: "order",
      });
    }
    if (args.ecoPackagingOptIn && fulfillmentType === "delivery") {
      await tx
        .insert(packagingReturnsTable)
        .values({
          userId: args.userId,
          orderId: serverOrderId,
          status: "opted_in",
          creditPaise: 2000,
        })
        .onConflictDoNothing({ target: packagingReturnsTable.orderId });
    }

    // 3. Optional credit redemption, atomic with the order + claim.
    let redeemed = 0;
    if (requested > 0) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${"credit:" + args.userId}, 0))`,
      );
      const balance = await getCreditBalancePaise(args.userId, tx);
      redeemed = Math.min(requested, balance, discountedGross);
      if (redeemed > 0) {
        await issueCredit(
          {
            userId: args.userId,
            deltaPaise: -redeemed,
            reason: "checkout_redemption",
            refType: "checkout",
            refId: args.orderId,
            note: `Applied at checkout for order ${args.orderId}`,
          },
          tx,
        );
      }
    }
    const finalPaise = discountedGross - redeemed;

    // Authoritative payable amount — the ONLY number the payment path bills.
    const { chargePaise: grossChargePaise, gstPaise, deliveryFeePaise } =
      computeChargePaise({
        finalPaise,
        subtotalPaise: grossPaise,
        fulfillmentType,
      });

    // Corporate subsidy. Reserved HERE, inside the pricing transaction, and
    // subtracted from charge_paise — so the company's share is part of the
    // order's own price rather than a client-side subtraction the server never
    // saw. Everything downstream is then correct without knowing subsidies
    // exist: the gateway bills charge_paise, the webhook reconciles against
    // charge_paise, and the refund cap derives from charge_paise, so a refund
    // can never hand back more than the customer actually paid.
    //
    // The reservation shares this transaction, so a rollback un-reserves the
    // budget automatically — there is no window where the money is held against
    // an order that does not exist.
    const reservation = await reserveSubsidyForOrder(tx, {
      userId: args.userId,
      serverOrderId,
      grossPaise: grossChargePaise,
      optIn: args.applySubsidy ?? true,
    });
    const subsidyPaise = reservation?.paise ?? 0;
    const chargePaise = Math.max(0, grossChargePaise - subsidyPaise);

    // 4. Persist actual amounts on the claim and the order.
    //    charge_paise is written unconditionally (it is the payment source of
    //    truth); total_paise is only rewritten when credit changed the meal
    //    total, preserving its existing meal-subtotal semantics.
    await tx
      .update(orderClaimsTable)
      .set({ redeemedPaise: redeemed, finalPaise })
      .where(eq(orderClaimsTable.id, created.id));
    await tx
      .update(ordersTable)
      .set({ chargePaise, ...(redeemed > 0 ? { totalPaise: finalPaise } : {}) })
      .where(eq(ordersTable.id, serverOrderId));

    // 5. Award referral — server-recorded first order satisfies the
    //    "both earn credits on first order" requirement. We additionally
    //    require this be the user's first qualifying order.
    const [orderCount] = await tx
      .select({ n: count() })
      .from(ordersTable)
      .where(eq(ordersTable.userId, args.userId));
    let referral: AwardReferralResult = {
      awarded: false,
      reason: "no_qualifying_activity",
    };
    if (Number(orderCount?.n ?? 0) === 1) {
      referral = await awardPendingReferralInTx(
        tx,
        {
          refereeUserId: args.userId,
          orderId: args.orderId,
        },
        pendingDispatches,
      );
    }

    const balancePaise = await getCreditBalancePaise(args.userId, tx);
    return {
      orderId: args.orderId,
      serverOrderId,
      grossPaise: discountedGross,
      bundleDiscountPaise,
      pickupDiscountPaise,
      preorderDiscountPaise,
      firstOrderDiscountPaise,
      redeemedPaise: redeemed,
      finalPaise,
      gstPaise,
      deliveryFeePaise,
      chargePaise,
      subsidyPaise,
      balancePaise,
      duplicate: false,
      referral,
    };
  });
  let result: Awaited<typeof txPromise>;
  try {
    result = await txPromise;
  } catch (err) {
    // If the in-tx safety re-check fired, persist an audit row using
    // the global `db` so the rollback of the order tx does not also
    // erase the audit. Same payload shape as the pre-tx audit so the
    // ops console can render both uniformly.
    const e = err as Error & {
      safetyBlock?: { codes: string[]; blocked: unknown };
      safetyBlockOrigin?: "tx";
    };
    if (e.safetyBlockOrigin === "tx" && e.safetyBlock) {
      await recordOpsAction({
        operatorId: args.userId,
        agent: "checkout",
        action: "safety_block",
        params: {
          orderId: args.orderId,
          origin: "tx",
          codes: e.safetyBlock.codes,
          blocked: e.safetyBlock.blocked,
        },
        beforeState: null,
        afterState: null,
        status: "blocked",
        reasoning: `safety gate refused checkout (in-tx revalidation): ${e.message.replace(/^safety_block:\s*/, "")}`,
      });
    }
    throw err;
  }
  // Dispatch any email notifications now that the transaction has committed.
  // Doing this after commit avoids a race where the dispatcher's row update
  // beats the insert visibility, which would leave email rows stuck in
  // "pending".
  for (const n of pendingDispatches) {
    setImmediate(() => {
      void dispatchNotificationEmail(n);
    });
  }
  // Order/credit/referral state changed — drop any cached UserBrief so
  // the next agent turn sees fresh totals.
  invalidateUserBrief(args.userId);
  return result;
}

/**
 * OA-MED-1.2 (TODO_optimization-auditor.md): this and checkProteinStreak each
 * issued their own identical `select * from user_profile where user_id = ?`.
 * Since runLoyaltyEngineForUser calls this twice (birthday, then anniversary —
 * the field is discriminated in JS, not in SQL) plus checkProteinStreak once,
 * that was THREE byte-identical reads of the same row per user, per sweep.
 * The row is now fetched once by the caller and threaded through.
 */
type LoyaltyProfile = typeof userProfileTable.$inferSelect;

async function checkBirthdayOrAnniversary(
  userId: string,
  field: "birthDate" | "anniversaryDate",
  kind: "birthday" | "anniversary",
  profile: LoyaltyProfile | null,
): Promise<Notification | null> {
  const value = profile?.[field];
  if (!value) return null;
  const config = await getLoyaltyConfig();
  // Use UTC consistently for "today"; date columns return YYYY-MM-DD strings.
  const today = new Date();
  const [yStr, mStr, dStr] = String(value).split("-");
  const m = Number(mStr);
  const d = Number(dStr);
  if (
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
    m - 1 !== today.getUTCMonth() ||
    d !== today.getUTCDate()
  ) {
    return null;
  }
  const year = today.getUTCFullYear();
  const dedupe = `${kind}:${year}`;
  const paise =
    kind === "birthday" ? config.birthdayPaise : config.anniversaryPaise;
  const created = await ensureNotification({
    userId,
    kind,
    title:
      kind === "birthday"
        ? "Happy birthday from Tanmatra!"
        : "Happy anniversary with Tanmatra!",
    body: `We've added Rs.${(paise / 100).toFixed(0)} in credits — a meal on us.`,
    dedupeKey: dedupe,
    payload: { since: yStr },
  });
  if (created) {
    await issueCredit({
      userId,
      deltaPaise: paise,
      reason: kind === "birthday" ? "birthday_meal" : "manual_grant",
      refType: "notification",
      refId: String(created.id),
      note: kind === "birthday" ? `Birthday meal ${year}` : `Anniversary ${year}`,
      expiresAt: addDays(today, 30),
    });
  }
  return created;
}

async function checkWinback(userId: string): Promise<Notification[]> {
  const config = await getLoyaltyConfig();
  const cutoff = addDays(new Date(), -config.winbackPausedDays);
  const paused = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.userId, userId),
        eq(subscriptionsTable.status, "paused"),
      ),
    );
  const out: Notification[] = [];
  for (const sub of paused) {
    if (!sub.pausedAt || sub.pausedAt > cutoff) continue;
    const dedupe = `winback:${sub.id}:${sub.pausedAt.toISOString().slice(0, 10)}`;
    const created = await ensureNotification({
      userId,
      kind: "winback",
      title: "Come back to your plan",
      body: `Your ${sub.cadence} plan has been paused. Here's Rs.${(config.winbackOfferPaise / 100).toFixed(0)} to resume.`,
      dedupeKey: dedupe,
      payload: { subscriptionId: sub.id },
    });
    if (created) {
      await issueCredit({
        userId,
        deltaPaise: config.winbackOfferPaise,
        reason: "winback_offer",
        refType: "subscription",
        refId: String(sub.id),
        note: "Win-back offer",
        expiresAt: addDays(new Date(), 30),
      });
      out.push(created);
    }
  }
  return out;
}

async function checkLoyalty(userId: string): Promise<Notification[]> {
  const config = await getLoyaltyConfig();
  const subs = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));
  const out: Notification[] = [];
  for (const sub of subs) {
    const [delivered] = await db
      .select({ n: count() })
      .from(subscriptionDeliveriesTable)
      .where(
        and(
          eq(subscriptionDeliveriesTable.subscriptionId, sub.id),
          eq(subscriptionDeliveriesTable.status, "delivered"),
        ),
      );
    const deliveredCount = Number(delivered?.n ?? 0);

    if (
      deliveredCount > 0 &&
      deliveredCount % config.loyaltyFreeEveryN === 0
    ) {
      const dedupe = `loyalty_free:${sub.id}:${deliveredCount}`;
      const created = await ensureNotification({
        userId,
        kind: "loyalty_free_week",
        title: "Loyalty reward unlocked",
        body: `You've completed ${deliveredCount} deliveries — your next plan delivery is on us.`,
        dedupeKey: dedupe,
        payload: { subscriptionId: sub.id },
      });
      if (created) {
        await issueCredit({
          userId,
          deltaPaise: sub.pricePerDeliveryPaise,
          reason: "loyalty_free_week",
          refType: "subscription",
          refId: String(sub.id),
          note: `Every-${config.loyaltyFreeEveryN} reward (after ${deliveredCount} deliveries)`,
          expiresAt: addDays(new Date(), 60),
        });
        out.push(created);
      }
    }

    if (deliveredCount >= config.premiumUnlockDeliveries) {
      const dedupe = `premium_unlock:${sub.id}`;
      const created = await ensureNotification({
        userId,
        kind: "loyalty_premium_unlock",
        title: "Premium meals unlocked",
        body: `You've completed ${deliveredCount} deliveries — premium meals are now part of your plan.`,
        dedupeKey: dedupe,
        payload: { subscriptionId: sub.id },
      });
      if (created) {
        await issueCredit({
          userId,
          deltaPaise: config.premiumUnlockBonusPaise,
          reason: "premium_unlock_bonus",
          refType: "subscription",
          refId: String(sub.id),
          note: "Premium tier unlock bonus",
          expiresAt: addDays(new Date(), 60),
        });
        out.push(created);
      }
    }
  }
  return out;
}

async function checkProteinStreak(
  userId: string,
  profile: LoyaltyProfile | null,
): Promise<Notification | null> {
  const config = await getLoyaltyConfig();
  if (!profile) return null;
  if ((profile.proteinShortfallStreak ?? 0) < config.proteinStreakThreshold)
    return null;
  const today = new Date().toISOString().slice(0, 10);
  return ensureNotification({
    userId,
    kind: "protein_streak",
    title: "You're behind on protein",
    body: `${profile.proteinShortfallStreak} days under your goal. Try a high-protein bowl today.`,
    dedupeKey: `protein:${today}`,
    payload: { streak: profile.proteinShortfallStreak },
  });
}

export async function runLoyaltyEngineForUser(userId: string): Promise<{
  notifications: Notification[];
}> {
  // Fetched ONCE for all three checks that need it (OA-MED-1.2). `?? null`
  // rather than leaving it undefined so the checks' `!profile` guards read
  // the same either way.
  const [profileRow] = await db
    .select()
    .from(userProfileTable)
    .where(eq(userProfileTable.userId, userId));
  const profile = profileRow ?? null;

  const out: Notification[] = [];
  const bday = await checkBirthdayOrAnniversary(userId, "birthDate", "birthday", profile);
  if (bday) out.push(bday);
  const anniv = await checkBirthdayOrAnniversary(
    userId,
    "anniversaryDate",
    "anniversary",
    profile,
  );
  if (anniv) out.push(anniv);
  out.push(...(await checkWinback(userId)));
  out.push(...(await checkLoyalty(userId)));
  const protein = await checkProteinStreak(userId, profile);
  if (protein) out.push(protein);
  return { notifications: out };
}

// Per-subscription loyalty progress for the UI.
export async function getSubscriptionLoyaltyProgress(
  userId: string,
): Promise<
  Array<{
    subscriptionId: number;
    deliveredCount: number;
    freeEveryN: number;
    deliveriesUntilFree: number;
    premiumUnlockAt: number;
    deliveriesUntilPremium: number;
    premiumUnlocked: boolean;
  }>
> {
  const config = await getLoyaltyConfig();
  const subs = await db
    .select({ id: subscriptionsTable.id })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));
  const out = [];
  for (const sub of subs) {
    const [row] = await db
      .select({ n: count() })
      .from(subscriptionDeliveriesTable)
      .where(
        and(
          eq(subscriptionDeliveriesTable.subscriptionId, sub.id),
          eq(subscriptionDeliveriesTable.status, "delivered"),
        ),
      );
    const delivered = Number(row?.n ?? 0);
    const inCycle = delivered % config.loyaltyFreeEveryN;
    out.push({
      subscriptionId: sub.id,
      deliveredCount: delivered,
      freeEveryN: config.loyaltyFreeEveryN,
      deliveriesUntilFree:
        inCycle === 0 ? config.loyaltyFreeEveryN : config.loyaltyFreeEveryN - inCycle,
      premiumUnlockAt: config.premiumUnlockDeliveries,
      deliveriesUntilPremium: Math.max(
        0,
        config.premiumUnlockDeliveries - delivered,
      ),
      premiumUnlocked: delivered >= config.premiumUnlockDeliveries,
    });
  }
  return out;
}

/**
 * Sweep loyalty rules for users with any engagement signal. Idempotent
 * via dedupe keys + awardedAt guards.
 */
/**
 * Bounded-concurrency map. Deliberately small and local rather than a new
 * dependency: this is the only fan-out in the file, and `p-limit` is not in
 * the workspace.
 */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      await fn(items[i]!);
    }
  });
  await Promise.all(workers);
}

/**
 * OA-MED-1.2: the sweep ran the entire engaged base strictly serially — one
 * user fully finished before the next started, at ~5 queries + one per
 * subscription each.
 *
 * Concurrency is capped LOW and env-tunable, not at the audit's suggested
 * upper bound of 10, for two reasons this file's own surroundings make
 * concrete:
 *   - The main pg pool is 16 connections (PG_POOL_MAX) and is shared with
 *     live request traffic. This sweep runs in-process alongside it, so a
 *     high fan-out here starves request handlers rather than just finishing
 *     sooner.
 *   - `ensureNotification` fires `dispatchNotificationEmail` via setImmediate
 *     for every email-eligible kind — which is every loyalty kind except
 *     protein_streak. Each does 2 more reads plus an SMTP send, and has no
 *     rate limiting of its own. N× user concurrency is N× concurrent
 *     unbounded email sends; that is the highest-risk side effect here, not
 *     the DB load.
 *
 * Parallelising ACROSS users is safe: dedupe keys are user-scoped and
 * `ensureNotification` upserts with onConflictDoNothing, so two users can
 * never contend. The per-user checks stay sequential — running them in
 * parallel would multiply pool pressure for no throughput gain.
 */
const SWEEP_CONCURRENCY = Math.max(
  1,
  Math.min(10, Number(process.env["LOYALTY_SWEEP_CONCURRENCY"] ?? 5)),
);

export async function runLoyaltyEngineForAll(): Promise<{
  scanned: number;
  triggered: number;
}> {
  const rows = await db.execute<{ user_id: string }>(
    sql`select distinct user_id from (
      select user_id from ${subscriptionsTable}
      union select user_id from ${userProfileTable}
      union select referee_user_id as user_id from ${referralRedemptionsTable}
    ) u`,
  );
  const userIds = (rows.rows ?? []).map((r) => r.user_id);
  let triggered = 0;
  // try/catch stays INSIDE the mapped function, not around the whole fan-out:
  // the sweep is best-effort per user, and a Promise.all-style abort on one
  // user's failure would silently skip everyone after them.
  await mapWithConcurrency(userIds, SWEEP_CONCURRENCY, async (userId) => {
    try {
      const out = await runLoyaltyEngineForUser(userId);
      triggered += out.notifications.length;
    } catch {
      // best-effort sweep; continue
    }
  });
  return { scanned: userIds.length, triggered };
}

export async function listNotifications(userId: string): Promise<Notification[]> {
  return db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt));
}
