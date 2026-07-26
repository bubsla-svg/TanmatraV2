import { check, index, pgTable, serial, varchar, integer, timestamp, jsonb, uniqueIndex, doublePrecision } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";
import { ridersTable } from "./riders";
import { deliverySlotsTable } from "./deliverySlots";
import { pickupLocationsTable } from "./pickupLocations";
import type { MarketplaceOrderLine } from "./marketplace";

export const orderKindValues = ["meal", "marketplace"] as const;
export type OrderKind = (typeof orderKindValues)[number];

// The channel an order arrived through. Orthogonal to orderKind: a `meal`
// order can be ours or an aggregator's, and both come out of the same kitchen.
//
// This exists because "manage our own app's orders internally and let Petpooja
// keep carrying Zomato/Swiggy" was a sentence the schema could not express.
// order_kind separates meal from marketplace — not us from them. So an order
// Petpooja pushed to /integrations/petpooja/saveorder landed as
// order_kind = 'meal', indistinguishable from a clinical subscription order,
// and therefore surfaced on the RD console's active-patient feed, queued on
// the KDS and swept by the dispatcher for rider assignment.
//
//   • own_app       originated in our own checkout / subscription path. The
//                   column default, and the ONLY value our own writers set.
//   • zomato/swiggy an aggregator order relayed by the POS. Ours to cook, not
//                   ours to dispatch, track, or show on a clinical surface.
//   • pos           pushed to us by Petpooja with no channel stated. Means
//                   "not ours" — never assume own_app from silence.
//   • other         reserved, so a channel we haven't met has somewhere to
//                   land that isn't a lie.
//
// Deliberately NOT indexed. Today every row is own_app, so an index on this
// column has no selectivity to offer; the reads that matter stay covered by
// idx_orders_kind_status. If aggregator volume ever becomes material the right
// shape is a partial index on `where order_channel <> 'own_app'`, not a plain
// one. See claude/order-channel-split.md for the full rationale.
export const orderChannelValues = ["own_app", "zomato", "swiggy", "pos", "other"] as const;
export type OrderChannel = (typeof orderChannelValues)[number];

// The order-status vocabulary. `orders.status` is a plain varchar with no
// check constraint, so this tuple is documentation-plus-types rather than an
// enforced enum — but it is the ONLY place the full set is written down, and
// every writer of `orders.status` should be typed against `OrderStatus` so a
// new value cannot be invented at a keyboard.
//
// This exists because it was possible to invent one: the Petpooja webhook
// mappers used to emit "confirmed" and "dispatched", two values that no
// reader in the system recognised. An order the POS moved to either one
// disappeared from the customer's active-order list, the dispatch sweep and
// the storefront tracker. See mapPetpoojaStatus in
// artifacts/api-server/src/lib/petpooja.ts.
//
// The readers that must accept a value for it to be usable — keep this list
// current, it is the reason the vocabulary is closed:
//   • artifacts/api-server/src/routes/orders.ts    ACTIVE_STATUSES, CANCELLABLE
//   • artifacts/api-server/src/routes/payments.ts  PAID_STATES
//   • artifacts/api-server/src/routes/ops.ts       the KDS queue filter
//   • artifacts/api-server/src/lib/dispatch.ts     liveStatuses, partnerStatuses
//   • artifacts/api-server/src/lib/etaModel.ts     ACTIVE_STATUSES
//   • artifacts/api-server/src/routes/addons.ts    ATTACHABLE_STATUSES
//   • artifacts/storefront/lib/orderStatus.ts      STATUS_LABELS, TRACKABLE_STATUSES
export const orderStatusValues = [
  // Pre-kitchen.
  "placed",
  // In the kitchen. This is what an accepted/confirmed POS order becomes —
  // there is no separate "confirmed" state; acceptance IS the start of prep.
  "preparing",
  "ready",
  // Out the door.
  "rider_assigned",
  "out_for_delivery",
  "delivered",
  // Terminal, unhappy.
  "cancelled",
  "failed",
  "refunded",
  // Marketplace/ops settlement state, not part of the delivery ladder.
  "billed",
] as const;
export type OrderStatus = (typeof orderStatusValues)[number];

// Position on the forward delivery ladder — the order in which an order is
// supposed to move through the world. `null` means "not on the ladder": an end
// state, or a settlement state that is not part of the delivery story at all.
//
// The vocabulary above says which values exist; this says which way time runs
// between them. That was missing, and its absence is a live bug on the three
// Petpooja status webhooks — none of them compared the incoming status to the
// one already stored, so a replayed or out-of-order webhook could walk an order
// BACKWARDS, including out of `delivered`. See classifyPosStatusTransition in
// artifacts/api-server/src/lib/petpooja.ts, which is what consumes this.
//
// Deliberately a Record and not a lookup function: a new value added to
// `orderStatusValues` fails to compile here until someone decides where on the
// ladder it sits. That tripwire is the point — this table is only correct while
// it is exhaustive, and "someone will remember to update it" is not a mechanism.
export const orderStatusLadderRank: Record<OrderStatus, number | null> = {
  placed: 0,
  preparing: 1,
  ready: 2,
  rider_assigned: 3,
  out_for_delivery: 4,
  delivered: 5,
  // Off the ladder. `cancelled` is reachable from any live rung — an outlet can
  // cancel an order at any point before it lands — but nothing is reachable
  // from it, so it has no rank of its own.
  cancelled: null,
  failed: null,
  refunded: null,
  billed: null,
};

// The runtime gate for a status that came out of the database rather than out
// of this file. It stays necessary even now that `orders_status_chk` exists,
// and that is worth being explicit about, because the constraint looks like it
// makes the check redundant: migration 0015 adds it as NOT VALID, which binds
// every INSERT and UPDATE from the moment it runs but deliberately makes no
// claim about rows written before it. Until an owner runs `VALIDATE
// CONSTRAINT` (see that migration's header), a row read back really can hold a
// value outside the vocabulary — which is why the column is not typed
// `$type<OrderStatus>()`. A read is `string`, and anything reasoning about
// where an order sits must be able to say "I do not recognise this" rather
// than casting and hoping.
export function isOrderStatus(value: string): value is OrderStatus {
  return (orderStatusValues as readonly string[]).includes(value);
}

// Whether an external status webhook is allowed to move an order out of this
// state at all. False means settled: the order's delivery story is over, and a
// webhook claiming otherwise is stale, replayed, or wrong.
//
// `delivered` is false despite being the top of the ladder. The only status
// that legitimately follows it is `refunded`, which is written by our own
// refund path against a payment we control — never by the POS, whose mappers
// cannot even produce the value.
//
// Same Record-not-function reasoning as the ladder above: adding a status value
// must be a decision made in both tables, and the compiler is what makes it one.
export const orderStatusAcceptsExternalUpdate: Record<OrderStatus, boolean> = {
  placed: true,
  preparing: true,
  ready: true,
  rider_assigned: true,
  out_for_delivery: true,
  delivered: false,
  cancelled: false,
  failed: false,
  refunded: false,
  billed: false,
};

// Meal-order line item: {id,name,qty,price}. Marketplace-order lines use
// MarketplaceOrderLine (see ./marketplace) instead. orders.items is a
// union of the two shapes — see isMealOrderItem below.
export interface MealOrderItem {
  id: number;
  name: string;
  qty: number;
  price: number;
}

export type OrderItem = MealOrderItem | MarketplaceOrderLine;

// Narrows an order line to the meal shape (id/price) vs. the marketplace
// shape (itemId/unitPricePaise/...). Drizzle's $type<> can't correlate the
// orderKind column with the items shape for TypeScript, so call sites that
// read id/price must narrow per-item with this guard even when the query
// already filters to orderKind = 'meal'.
export function isMealOrderItem(item: OrderItem): item is MealOrderItem {
  return "id" in item;
}

export const ordersTable = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").references(() => usersTable.id),
    // Discriminator: 'meal' = kitchen-prepared delivery order (dispatch,
    // Petpooja push, delivery-slot/rider fields all apply). 'marketplace' =
    // shelf-stable goods order (catalog in lib/db/src/schema/marketplace.ts).
    // payments.ts's Razorpay create/webhook/capture logic works on either
    // kind unchanged (keyed on externalOrderId / razorpayOrderId), but
    // dispatch.ts and the Petpooja push MUST filter to orderKind = 'meal'
    // so a grocery order never gets a rider assigned or pushed to the
    // kitchen POS.
    orderKind: varchar("order_kind", { length: 16 }).notNull().default("meal"),
    // Which channel the order came in through — see orderChannelValues above.
    // Defaults to 'own_app' because that is true of every row that existed
    // before this column did. Typed so a writer cannot invent a sixth value at
    // a keyboard the way the Petpooja status mappers once invented "confirmed".
    orderChannel: varchar("order_channel", { length: 16 })
      .notNull()
      .default("own_app")
      .$type<OrderChannel>(),
    externalOrderId: varchar("external_order_id", { length: 64 }),
    razorpayOrderId: varchar("razorpay_order_id", { length: 64 }),
    // The captured Razorpay payment id (set at verify / webhook capture).
    // Refunds target a payment, not an order, so this is what the refund
    // pipeline issues against.
    razorpayPaymentId: varchar("razorpay_payment_id", { length: 64 }),
    status: varchar("status", { length: 32 }).notNull().default("placed"),
    // Meal subtotal after discounts/credit (NO GST, NO delivery fee). Kept
    // for historical/ops continuity — do not use this to charge.
    totalPaise: integer("total_paise").notNull(),
    // THE authoritative amount to charge, in paise: post-discount meal total
    // + 18% GST + delivery fee. Written once by finalizeOrder and is the ONLY
    // number the payment path may bill or reconcile against (mirrors Medusa's
    // "the order carries its own payable total" rule). Nullable so legacy rows
    // and the guest-checkout path — whose total_paise already includes GST+fee
    // — remain valid; the payment path falls back to total_paise when null.
    chargePaise: integer("charge_paise"),
    addressLabel: varchar("address_label", { length: 64 }),
    addressLine: varchar("address_line", { length: 256 }),
    city: varchar("city", { length: 64 }),
    pincode: varchar("pincode", { length: 16 }),
    phone: varchar("phone", { length: 32 }),
    // Real geocoded drop coordinates from the customer address.
    // Populated at checkout (see geocodeAddress / finalizeOrder) so the
    // dispatcher computes real distances and batching radii instead of
    // synthesising a (lat,lng) from the pincode prefix. Nullable so legacy
    // rows and pickup orders (no delivery address) remain valid; the
    // backfill script in scripts/src/backfill-order-coords.ts fills these
    // in for historical rows.
    dropLat: doublePrecision("drop_lat"),
    dropLng: doublePrecision("drop_lng"),
    // Meal orders store {id,name,qty,price} lines. Marketplace orders store
    // the full MarketplaceOrderLine shape (adds slug/supplierName/
    // commissionPaise/vendorPayoutPaise for the vendor-payout audit trail
    // that used to live in the now-retired marketplace_orders.items).
    // Discriminate on orderKind before reading line-item fields.
    items: jsonb("items").notNull().$type<
      | Array<{ id: number; name: string; qty: number; price: number }>
      | Array<{
          itemId: number;
          slug: string;
          name: string;
          qty: number;
          unitPricePaise: number;
          supplierName: string;
          commissionPaise: number;
          vendorPayoutPaise: number;
        }>
    >(),
    riderId: integer("rider_id").references(() => ridersTable.id, { onDelete: "set null" }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    deliverySlotId: integer("delivery_slot_id").references(() => deliverySlotsTable.id, { onDelete: "set null" }),
    pickupLocationId: integer("pickup_location_id").references(() => pickupLocationsTable.id, { onDelete: "set null" }),
    fulfillmentType: varchar("fulfillment_type", { length: 16 }).notNull().default("delivery"),
    ecoPackagingOptIn: integer("eco_packaging_opt_in").notNull().default(0),
    deliveryInstructions: varchar("delivery_instructions", { length: 512 }),
    // Clinical priority. `stat` is dispatched ahead of every routine
    // order regardless of `created_at`, refuses to be batched with any
    // other order, and emits an `sla_breach` event the moment it sits
    // unassigned past the dispatch threshold (see dispatch.ts). Promotion
    // / demotion writes an `ops_actions` audit row.
    priority: varchar("priority", { length: 16 }).notNull().default("routine"),
    // First time the STAT SLA-breach scanner stamped this row. Used as
    // an idempotency guard so the breach event fires exactly once even
    // when the dispatch loop runs many times per minute.
    slaBreachAt: timestamp("sla_breach_at", { withTimezone: true }),
    // --- marketplace-kind-only fields (null for orderKind = 'meal') ---
    // 'ship' (courier to customer) or 'bundle_with_meal' (ride along with
    // an existing meal delivery). Mirrors marketplaceOrdersTable's old
    // deliveryMode column.
    marketplaceDeliveryMode: varchar("marketplace_delivery_mode", { length: 24 }),
    // Self-reference: the meal order this marketplace order is bundled
    // with, when marketplaceDeliveryMode = 'bundle_with_meal'.
    bundleWithOrderId: integer("bundle_with_order_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    // Scoped by user, so it is NULL-blind: Postgres treats NULLs as distinct
    // in a unique index, and every order the POS pushes us whose customer
    // email matches no user of ours gets `user_id = null`. Three own-app money
    // writers infer their ON CONFLICT spec against this exact index
    // (loyaltyEngine.ts, chargeMandate.ts, subscriptions.ts) — including the
    // partial predicate, which Postgres requires to match — so it must not be
    // dropped or altered. The companion index below covers what it cannot.
    uniqueIndex("uniq_orders_user_external")
      .on(table.userId, table.externalOrderId)
      .where(sql`external_order_id is not null`),
    // The other half of the same guarantee: one row per POS order id.
    //
    // POST /integrations/petpooja/saveorder writes `external_order_id` from
    // Petpooja's own `orderID`, and a webhook that is not acknowledged is a
    // webhook that gets retried. Without this index a retry inserts a second
    // row — a second KDS ticket, a second dispatch, one meal — and nothing
    // anywhere notices. Demonstrated against a real Postgres: three identical
    // aggregator inserts, three rows, no error.
    //
    // Keyed on `external_order_id` ALONE, deliberately, not on
    // (order_channel, external_order_id):
    //   - Petpooja assigns the id, so it is already unique within the outlet
    //     across every channel it serves. A wider key would let a retry whose
    //     `order_from` differed — a field our push interface does not even
    //     model — slip past as a "different" order, which is the precise
    //     failure this index exists to stop.
    //   - The rest of the system already assumes this. /callback,
    //     /orderstatus and /rider-info all resolve an order with
    //     `where external_order_id = ? limit 1` and no channel predicate. If
    //     two POS rows ever shared an id, those routes would already be
    //     picking one arbitrarily. This makes an existing assumption
    //     enforceable rather than introducing a new one.
    //
    // `order_channel <> 'own_app'` in the predicate is load-bearing, not a
    // tidy-up. Own-app orders derive `external_order_id` from a client-supplied
    // order id, so two users could legitimately present the same string; a
    // global unique index would 500 the second user's checkout on a violation
    // their ON CONFLICT (user_id, external_order_id) spec does not cover.
    // Excluding own_app puts those rows entirely outside this index, so the
    // three money writers above cannot collide with it at all.
    //
    // Migration caveat: creating this index FAILS if prod already holds
    // duplicate POS rows — which is exactly the bug being fixed. Run
    //   select external_order_id, count(*) from orders
    //   where external_order_id is not null and order_channel <> 'own_app'
    //   group by 1 having count(*) > 1;
    // and reconcile any hits before applying migration 0014.
    uniqueIndex("uniq_orders_external_pos")
      .on(table.externalOrderId)
      .where(sql`external_order_id is not null and order_channel <> 'own_app'`),
    // Postgres does NOT auto-index FK columns. These three indexes back
    // the most common access patterns:
    //   - "my orders" page (filter by user, sort by createdAt desc)
    //   - ops dashboards (filter by status, sort by createdAt desc)
    //   - rider load heuristics (filter by riderId)
    index("idx_orders_user_created").on(table.userId, table.createdAt.desc()),
    index("idx_orders_status_created").on(table.status, table.createdAt.desc()),
    index("idx_orders_rider").on(table.riderId),
    index("idx_orders_razorpay_order_id").on(table.razorpayOrderId),
    // Partial index that backs the STAT-first dispatch query. Tiny
    // because `stat` is the rare exception (~<1% of order volume), so
    // the dispatcher reads only a handful of rows even at peak.
    index("idx_orders_stat_unassigned")
      .on(table.createdAt)
      .where(sql`priority = 'stat' and rider_id is null`),
    // DB-level enum guard so any non-validated write path (raw SQL,
    // backfill scripts, future routes) cannot poison the dispatcher
    // with a priority value it doesn't understand.
    check(
      "orders_priority_chk",
      sql`${table.priority} in ('routine','urgent','stat')`,
    ),
    // Same guard for the new discriminator — keeps raw SQL / backfill
    // scripts from writing a value dispatch.ts and the Petpooja gate
    // don't understand.
    check(
      "orders_order_kind_chk",
      sql`${table.orderKind} in ('meal','marketplace')`,
    ),
    // Same guard for the channel discriminator. Keep this literal in step with
    // orderChannelValues above — api-server's orderChannel.schema.test.ts
    // compares the two and fails if they drift apart.
    check(
      "orders_order_channel_chk",
      sql`${table.orderChannel} in ('own_app','zomato','swiggy','pos','other')`,
    ),
    // The status vocabulary, finally enforced by the database rather than only
    // described by `orderStatusValues`. Keep this literal in step with that
    // tuple — orderStatus.schema.test.ts compares the two and fails on drift.
    //
    // This is the constraint whose absence let the Petpooja mappers write
    // "confirmed" and "dispatched" into production: two values no reader in the
    // system recognised, so an order the POS moved to either one vanished from
    // the customer's active-order list, the dispatch sweep and the tracker. The
    // mappers were fixed in claude/petpooja-status-vocabulary; this is what
    // makes the *next* one impossible rather than merely unlikely.
    //
    // MIGRATION 0015 ADDS THIS AS `NOT VALID`, deliberately. See that file: the
    // constraint binds every new INSERT and UPDATE immediately, while existing
    // rows go unscanned, because we cannot see production from here and do not
    // know whether any row still holds a stranded value. Drizzle's `check()`
    // helper has no way to express NOT VALID, so the declaration here and the
    // migration differ in exactly that one clause until an owner runs
    // `VALIDATE CONSTRAINT` — at which point they converge and this comment can
    // go. `pnpm --filter @workspace/scripts run audit-order-status` is what
    // tells them whether it is safe to.
    check(
      "orders_status_chk",
      sql`${table.status} in ('placed','preparing','ready','rider_assigned','out_for_delivery','delivered','cancelled','failed','refunded','billed')`,
    ),
    // Speeds up dispatch.ts's live-order scans, which now must filter to
    // orderKind = 'meal' on every query.
    index("idx_orders_kind_status").on(table.orderKind, table.status),
  ],
);

// drizzle-zod generates from the column's SQL type and does not honour
// `$type<>`, so without this refinement `InsertOrder["orderChannel"]` widens
// back to plain `string` — which both defeats the compile-time guard on the
// column and lets a value the check constraint will reject through any path
// that validates with this schema. Naming the enum here closes the vocabulary
// at the Zod layer too, so a bad channel fails at parse time with a readable
// error instead of at INSERT time with a constraint violation.
export const insertOrderSchema = createInsertSchema(ordersTable, {
  // `.optional()` is load-bearing: supplying a custom schema for a column makes
  // drizzle-zod treat it as required, dropping the optionality the column's
  // DEFAULT earns it. Without it, every writer that legitimately omits the
  // field — relying on the 'own_app' default — would fail validation.
  orderChannel: z.enum(orderChannelValues).optional(),
  // Same treatment for status, and note the asymmetry it creates on purpose:
  // the WRITE side is closed here, while the READ side stays `string`.
  //
  // The obvious-looking move is `$type<OrderStatus>()` on the column, which
  // would type reads as OrderStatus too. That would be a lie while migration
  // 0015's constraint is still NOT VALID — a row written before it existed can
  // hold anything, and telling the compiler otherwise is how `isOrderStatus`
  // stops being called and the fail-closed paths quietly become unreachable.
  // Writes are a different matter: every one of them happens after the
  // constraint, so closing them costs nothing and turns a runtime constraint
  // violation into a parse error with a readable message.
  status: z.enum(orderStatusValues).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
