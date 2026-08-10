import { eq, sql } from "drizzle-orm";
import {
  db,
  ordersTable,
  subscriptionDeliveriesTable,
  subscriptionMembersTable,
  subscriptionsTable,
  type SubscriptionDelivery,
} from "@workspace/db";
import { PER_MEAL_PAISE } from "@workspace/subscription-rules";
import { encryptClinicalStrings } from "./crypto";

// ─────────────────────────────────────────────────────────────────────────────
// The money-critical parts of turning a paid-for plan into a live subscription,
// shared by the two origination paths (A2.4).
//
//   • POST /subscriptions            — the legacy path. Prices from the request
//                                      body via the catalog, generates its
//                                      deliveries from a cadence, and creates
//                                      the subscription BEFORE payment.
//   • POST /plan-drafts/:id/convert  — PlanDraft origination. Bills a frozen
//                                      QuoteSnapshot, uses the exact schedule
//                                      that quote priced, and creates nothing
//                                      until settlement is verified.
//
// WHAT IS SHARED IS DELIBERATELY NARROW: the first-cycle order and the member
// rows. Those are where a second implementation would be genuinely dangerous —
// the order is what bills the card, and a member row carries encrypted clinical
// fields whose handling must not diverge.
//
// DELIVERY GENERATION IS NOT SHARED, on purpose. The legacy path derives dates
// from a cadence and a day plan; the plan-draft path must reproduce the exact
// dates and windows the customer was quoted, which is a different operation
// that only looks similar. Forcing one function to do both would mean a
// cadence-shaped parameter set the plan path fills with lies.
// ─────────────────────────────────────────────────────────────────────────────

/** Either the pool or an open transaction. */
export type DbExecutor = Pick<typeof db, "select" | "insert" | "update">;

export interface SubscriptionMemberInput {
  name: string;
  diet: string;
  allergens: string[];
  medicalConditions?: string[];
  dislikedIngredients?: string[];
  lifestyle?: string | null;
  spiceLevel?: string | null;
  dailyCalorieTarget?: number | null;
  dailyProteinTargetGrams?: number | null;
}

/**
 * Insert a subscription's member rows, encrypting every clinical field.
 *
 * `fallbackTargets` backfills macro targets for a SINGLE-member subscription
 * only, because that member unambiguously IS the account holder. A guest on a
 * multi-member subscription has no profile to backfill from and is left null
 * rather than given someone else's numbers.
 */
export async function insertSubscriptionMembers(
  tx: DbExecutor,
  subscriptionId: number,
  members: readonly SubscriptionMemberInput[],
  fallbackTargets: { calorieTarget: number | null; proteinTargetGrams: number | null } | null,
): Promise<void> {
  if (members.length === 0) return;
  await tx.insert(subscriptionMembersTable).values(
    members.map((m) => ({
      subscriptionId,
      name: m.name,
      diet: m.diet,
      allergens: encryptClinicalStrings(m.allergens),
      medicalConditions: encryptClinicalStrings(m.medicalConditions ?? []),
      dislikedIngredients: encryptClinicalStrings(m.dislikedIngredients ?? []),
      lifestyle: m.lifestyle ?? null,
      spiceLevel: m.spiceLevel ?? "medium",
      dailyCalorieTarget: m.dailyCalorieTarget ?? fallbackTargets?.calorieTarget ?? null,
      dailyProteinTargetGrams:
        m.dailyProteinTargetGrams ?? fallbackTargets?.proteinTargetGrams ?? null,
    })),
  );
}

export interface FirstCycleOrderInput {
  /** What the customer is actually charged for this first cycle, in paise.
   *  ALWAYS server-computed — the catalog on the legacy path, a frozen
   *  QuoteSnapshot on the plan-draft path. Never a client-supplied figure. */
  chargePaise: number;
  /** `preparing` when nothing is left to collect (credits covered it, or the
   *  payment already captured); `placed` when a charge is still outstanding. */
  settled: boolean;
}

/**
 * Create the first-cycle order for a new subscription and link it to the
 * earliest delivery.
 *
 * The link matters beyond bookkeeping: `POST /payments/razorpay/order` finds
 * this row by `externalOrderId = sub-<id>`, and `registerAutopayMandate` joins
 * through `subscription_deliveries.order_id`. An unlinked order silently breaks
 * both.
 *
 * `onConflictDoNothing` on (userId, externalOrderId) makes a re-entry harmless:
 * a retry that reaches here twice finds the row already present and returns
 * without creating a second billable order.
 */
export async function createFirstCycleOrder(
  tx: DbExecutor,
  sub: typeof subscriptionsTable.$inferSelect,
  deliveries: readonly SubscriptionDelivery[],
  { chargePaise, settled }: FirstCycleOrderInput,
): Promise<typeof ordersTable.$inferSelect | null> {
  if (deliveries.length === 0) return null;
  const firstDelivery = deliveries.reduce((earliest, d) =>
    d.scheduledFor < earliest.scheduledFor ? d : earliest,
  );

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
      orderChannel: "own_app",
      externalOrderId: `sub-${sub.id}`,
      status: settled ? "preparing" : "placed",
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

  if (!order) return null; // idempotency race — a row already exists for this sub

  await tx
    .update(subscriptionDeliveriesTable)
    .set({ orderId: order.id })
    .where(eq(subscriptionDeliveriesTable.id, firstDelivery.id));

  return order;
}
