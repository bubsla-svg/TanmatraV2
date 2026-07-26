import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export type MarketplaceCategory =
  | "oils"
  | "sauces"
  | "supplements"
  | "pantry"
  | "snacks";
export type MarketplaceDeliveryMode = "ship" | "bundle_with_meal";
export type MarketplaceOrderStatus =
  | "placed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

export const marketplaceItemsTable = pgTable(
  "marketplace_items",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description").notNull().default(""),
    longDescription: text("long_description").notNull().default(""),
    category: varchar("category", { length: 32 })
      .$type<MarketplaceCategory>()
      .notNull(),
    pricePaise: integer("price_paise").notNull(),
    weightLabel: varchar("weight_label", { length: 32 }),
    supplierName: varchar("supplier_name", { length: 128 }),
    image: varchar("image", { length: 512 }),
    badges: jsonb("badges").$type<string[]>().notNull().default([]),
    rdVerified: boolean("rd_verified").notNull().default(false),
    stockQty: integer("stock_qty").notNull().default(100),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("idx_marketplace_active").on(table.isActive)],
);

export interface MarketplaceOrderLine {
  itemId: number;
  slug: string;
  name: string;
  qty: number;
  unitPricePaise: number;
  supplierName: string;
  commissionPaise: number;
  vendorPayoutPaise: number;
}

export const marketplaceOrdersTable = pgTable(
  "marketplace_orders",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 16 })
      .$type<MarketplaceOrderStatus>()
      .notNull()
      .default("placed"),
    deliveryMode: varchar("delivery_mode", { length: 24 })
      .$type<MarketplaceDeliveryMode>()
      .notNull()
      .default("ship"),
    items: jsonb("items").$type<MarketplaceOrderLine[]>().notNull(),
    totalPaise: integer("total_paise").notNull(),
    addressLabel: varchar("address_label", { length: 64 }),
    addressLine: varchar("address_line", { length: 256 }),
    city: varchar("city", { length: 64 }),
    pincode: varchar("pincode", { length: 16 }),
    phone: varchar("phone", { length: 32 }),
    bundleWithOrderId: integer("bundle_with_order_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("idx_marketplace_orders_user").on(table.userId)],
);

export const insertMarketplaceItemSchema = createInsertSchema(
  marketplaceItemsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMarketplaceItem = z.infer<typeof insertMarketplaceItemSchema>;
export type MarketplaceItem = typeof marketplaceItemsTable.$inferSelect;
export type MarketplaceOrder = typeof marketplaceOrdersTable.$inferSelect;

export const marketplaceBatchesTable = pgTable(
  "marketplace_batches",
  {
    id: serial("id").primaryKey(),
    inventoryItemId: integer("inventory_item_id")
      .notNull()
      .references(() => marketplaceItemsTable.id, { onDelete: "cascade" }),
    batchNumber: varchar("batch_number", { length: 64 }).notNull(),
    expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),
    currentQty: integer("current_qty").notNull().default(0),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("uniq_marketplace_batch").on(table.inventoryItemId, table.batchNumber),
    index("idx_marketplace_batches_expiry").on(table.inventoryItemId, table.expiryDate),
    check("marketplace_batch_qty_chk", sql`${table.currentQty} >= 0`),
  ],
);

export type MarketplaceBatch = typeof marketplaceBatchesTable.$inferSelect;
export type InsertMarketplaceBatch = typeof marketplaceBatchesTable.$inferInsert;
