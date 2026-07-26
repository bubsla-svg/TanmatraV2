import {
  pgTable,
  serial,
  varchar,
  integer,
  doublePrecision,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const inventoryItemsTable = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  itemNo: integer("item_no").notNull(),
  product: varchar("product", { length: 256 }).notNull(),
  buyingQty: varchar("buying_qty", { length: 64 }),
  buyingPricePaise: integer("buying_price_paise"),
  perKgUnitPaise: integer("per_kg_unit_paise"),
  pricePer100GmPcsLabel: varchar("price_per_100_gm_pcs_label", { length: 128 }),
  pricePer10GmLabel: varchar("price_per_10_gm_label", { length: 128 }),
});

export type InventoryItem = typeof inventoryItemsTable.$inferSelect;

/**
 * Bill of Materials (BOM) components table (Autonomous Supply Chain Phase 1A).
 * Maps finished dish SKUs (menu items) directly to their constituent raw inventory inputs
 * with numeric fractional deduction ratios for real-time KDS depletion and 4 AM prep aggregation.
 */
export const dishBomComponentsTable = pgTable(
  "dish_bom_components",
  {
    id: serial("id").primaryKey(),
    dishSlug: varchar("dish_slug", { length: 128 }).notNull(),
    inventoryItemId: integer("inventory_item_id")
      .notNull()
      .references(() => inventoryItemsTable.id, { onDelete: "cascade" }),
    quantityNeeded: doublePrecision("quantity_needed").notNull(),
    unit: varchar("unit", { length: 32 }).notNull().default("g"), // e.g., 'g', 'ml', 'count', 'kg'
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("uniq_dish_bom_item").on(table.dishSlug, table.inventoryItemId),
    index("idx_dish_bom_slug").on(table.dishSlug),
  ],
);

export type DishBomComponent = typeof dishBomComponentsTable.$inferSelect;

