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
    // + 5% GST on that meal value + the delivery fee + 18% GST on that fee.
    // (The previous wording here said "+ 18% GST", which is the rate on the
    // delivery service, not on food — see computeChargePaise, which is the
    // implementation this comment describes and has always split the two.)
    // The composition matters beyond bookkeeping: it is the breakdown the POS
    // is sent per order, so the outlet files GST against it.
    // Written once by finalizeOrder and is the ONLY
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
    uniqueIndex("uniq_orders_user_external")
      .on(table.userId, table.externalOrderId)
      .where(sql`external_order_id is not null`),
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
    // Speeds up dispatch.ts's live-order scans, which now must filter to
    // orderKind = 'meal' on every query.
    index("idx_orders_kind_status").on(table.orderKind, table.status),
  ],
);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
