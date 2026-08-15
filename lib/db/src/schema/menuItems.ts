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
    // TNM-MENU-01 M-2 — curated taxonomy columns. All five are curated under
    // ruling R-1 and may never join the petpooja push-menu upsert's set;
    // petpooja.menuFence.test.ts's full-row allowlist diff enforces that
    // without naming them. NULL section/rank/class/badge = "not yet curated"
    // (rows that predate the Menu v2 apply).
    //
    // section_order/sort_rank: the payload-authoritative base order the
    // ranked endpoint consumes — 13 fixed customer sections, rank within the
    // section. Personalization may re-rank on top but never hides.
    sectionOrder: integer("section_order"),
    sortRank: integer("sort_rank"),
    // Tri-state customer veg mark. `isVeg` stays as the legacy boolean the
    // existing render/read paths use (veg_class === 'veg' ⇔ isVeg true);
    // 'egg' gets its own mark on surfaces that understand it.
    vegClass: varchar("veg_class", { length: 16 }).$type<
      "veg" | "non-veg" | "egg"
    >(),
    // Card badge, payload-authoritative ("Bestseller", "New", "Trending").
    badge: varchar("badge", { length: 48 }),
    // The curated master switch: a soft-disabled row (CUT / MERGE / DELIST in
    // the rationalization set). Never deleted — order-history FKs and
    // maps_from continuity — and never revivable by POS stock signals, which
    // only ever touch is_available.
    archived: boolean("archived").notNull().default(false),
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
    // POS webhooks (petpooja.ts) filter tags with jsonb containment
    // (`tags @> '["petpooja:<id>"]'`) inside a per-item loop, so an
    // unindexed lookup here is multiplied by webhook payload size.
    index("idx_menu_items_tags_gin").using("gin", table.tags),
    // Patient-safety: refuse rows whose review state isn't one of the
    // three known values. Combined with the NOT NULL + default, this
    // means a corrupted/migrated row can never silently appear as
    // "reviewed" to the merged catalog.
    check(
      "menu_items_allergen_review_state_chk",
      sql`${table.allergenReviewState} in ('pending_review','reviewed','blocked')`,
    ),
    // Same defense-in-depth posture as the review-state check: a veg mark is
    // a dietary-safety claim, so an unknown value must be impossible at the
    // DB layer, not merely unlikely at the app layer. NULL stays legal —
    // it means "not yet curated", and readers fall back to `is_veg`.
    check(
      "menu_items_veg_class_chk",
      sql`${table.vegClass} is null or ${table.vegClass} in ('veg','non-veg','egg')`,
    ),
  ],
);

export const insertMenuItemSchema = createInsertSchema(menuItemsTable, {
  fulfillmentType: z.enum(fulfillmentTypeValues).optional(),
  // drizzle-zod widens a $type'd varchar back to z.string(); re-narrow so
  // InsertMenuItem stays assignable to the column's literal union.
  vegClass: z.enum(["veg", "non-veg", "egg"]).nullable().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItemsTable.$inferSelect;
