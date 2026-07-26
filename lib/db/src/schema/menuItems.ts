import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fulfillmentTypeValues = ["MTO", "FMCG"] as const;
export type FulfillmentType = (typeof fulfillmentTypeValues)[number];

// CMS-managed menu items (separate from the static lib/menu-catalog DISHES
// seed). Editors create / edit items here via the CMS Assistant agent.
//
// `availability_window` allows time-of-day restrictions like "lunch only"
// (e.g. ["lunch","dinner"]). Empty/null means available all day.
export const menuItemsTable = pgTable(
  "menu_items",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description").notNull().default(""),
    pricePaise: integer("price_paise").notNull(),
    category: varchar("category", { length: 64 }).notNull(),
    kitchenLocation: varchar("kitchen_location", { length: 128 })
      .notNull()
      .default("default"),
    isVeg: boolean("is_veg").notNull().default(true),
    isAvailable: boolean("is_available").notNull().default(true),
    availabilityWindow: jsonb("availability_window").$type<string[]>(),
    tags: jsonb("tags").$type<string[]>(),
    imageUrl: text("image_url"),
    longDescription: text("long_description"),
    allergens: jsonb("allergens").$type<string[]>(),
    contraindications: jsonb("contraindications").$type<string[]>().default([]),
    cuisineTags: jsonb("cuisine_tags").$type<string[]>(),
    vibeTags: jsonb("vibe_tags").$type<string[]>(),
    seoTitle: varchar("seo_title", { length: 200 }),
    seoDescription: text("seo_description"),
    macros: jsonb("macros").$type<{
      kcal: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      fiberG?: number;
      // Extended clinical nutrition (Petpooja push_menu `nutrition`). Optional
      // because most sources only carry the base four. jsonb column, so adding
      // these keys is a type-only change — no migration.
      sodiumMg?: number;
      totalSugarG?: number;
      addedSugarG?: number;
      saturatedFatG?: number;
      transFatG?: number;
      cholesterolMg?: number;
      // Serving basis the values are measured against (never show a macro
      // without the serving it belongs to — A4.1 denominator honesty).
      servingSize?: { amount: number; unit: string };
      servingInfo?: string;
    } | null>(),
    macrosAreEstimate: boolean("macros_are_estimate").notNull().default(true),
    rdVerified: boolean("rd_verified").notNull().default(false),
    rdNote: text("rd_note"),
    // Patient-safety review gate. Every CMS-managed dish starts as
    // `pending_review`; an RD must explicitly flip it to `reviewed`
    // before the public menu surfaces it or checkout will accept it.
    // `blocked` is a kill-switch state for dishes pulled by RD.
    allergenReviewState: varchar("allergen_review_state", { length: 32 })
      .notNull()
      .default("pending_review"),
    prepTime: varchar("prep_time", { length: 64 }),
    glycaemicIndex: varchar("glycaemic_index", { length: 16 }),
    sugarPerServing: varchar("sugar_per_serving", { length: 64 }),
    ingredients: jsonb("ingredients").$type<string[]>(),
    customizations: jsonb("customizations").$type<
      Array<{
        groupName: string;
        type: "single" | "multiple";
        options: Array<{
          name: string;
          priceModifier: number;
          default?: boolean;
        }>;
      }>
    >(),
    pairingSlug: varchar("pairing_slug", { length: 128 }),
    copyGeneratedAt: timestamp("copy_generated_at", { withTimezone: true }),
    copyGeneratedBy: varchar("copy_generated_by", { length: 64 }),
    unavailableReason: text("unavailable_reason"),
    unavailableUntil: timestamp("unavailable_until", { withTimezone: true }),
    fulfillmentType: varchar("fulfillment_type", { length: 16 })
      .$type<FulfillmentType>()
      .notNull()
      .default("MTO"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_menu_items_category_kitchen").on(
      table.category,
      table.kitchenLocation,
    ),
    index("idx_menu_items_available").on(table.isAvailable),
    // Patient-safety: refuse rows whose review state isn't one of the
    // three known values. Combined with the NOT NULL + default, this
    // means a corrupted/migrated row can never silently appear as
    // "reviewed" to the merged catalog.
    check(
      "menu_items_allergen_review_state_chk",
      sql`${table.allergenReviewState} in ('pending_review','reviewed','blocked')`,
    ),
  ],
);

export const insertMenuItemSchema = createInsertSchema(menuItemsTable, {
  fulfillmentType: z.enum(fulfillmentTypeValues).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItemsTable.$inferSelect;
