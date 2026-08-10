import {
  pgTable,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

// ─────────────────────────────────────────────────────────────────────────────
// PlanDraft (PR A2.1 — Journey 2 / Journey 4 plan-origination domain).
//
// A PlanDraft is the pre-purchase, in-progress configuration of a meal-
// subscription plan a customer builds up over Journey 2 (Recommended Plan
// configuration) or Journey 4 (Custom Build). It is DISTINCT from — and must
// never be confused with — an active subscription, a confirmed order, a
// QuoteSnapshot, or a PaymentAttempt (docs/journey-2-4-contract-gaps.md §3).
// Generation, delivery-schedule, quote, and subscription-origination
// endpoints are later PRs (A2.2-A2.4); this file only establishes the
// domain schema, ownership, and versioning A2.1 scopes.
//
// Day-level lineup data is stored as a JSONB column on the draft row, NOT as
// separate child tables — this matches the two existing precedents for this
// exact shape of data in this codebase: subscriptionsTable.dayPlan
// (SubscriptionDayPlanEntry[]) and mealPlansTable.days (MealPlanDay[]). Both
// keep day/slot structure nested on the parent row rather than normalized,
// so a draft's entire configuration (including its lineup and its one
// Undo snapshot) moves as a single row under a single version counter.
// ─────────────────────────────────────────────────────────────────────────────

export type PlanDraftJourney = "recommended" | "custom";

/** Where this draft's intent originates — shown back to the customer and
 *  used for attribution; never affects pricing or eligibility on its own. */
export type PlanDraftAcquisitionContext =
  | "recommended"
  | "custom"
  | "trial"
  | "corporate_sponsored"
  | "partner_discounted"
  | "rd_referred"
  | "challenge_support";

export type PlanDraftStatus =
  | "collecting_preferences"
  | "ready_to_generate"
  | "generating"
  | "generation_failed"
  | "lineup_ready"
  | "schedule_required"
  | "ready_for_quote"
  | "quoted"
  | "superseded"
  | "converted"
  | "abandoned";

export type PlanDraftMealPeriod = "breakfast" | "lunch" | "dinner" | "snack";

/** Journey 2's single mealtime question ("Mealtime Preference Sheet"). */
export interface PlanDraftMealtime {
  periods: PlanDraftMealPeriod[];
}

/** Journey 4 Step 2 — the richer routine capture Custom Build needs beyond
 *  Journey 2's single mealtime question. */
export interface PlanDraftRoutine {
  mealPeriods: PlanDraftMealPeriod[];
  daysPerWeek: number;
  deliveryContext: string;
}

/** Journey 4 Step 4. Deliberately models only decisions a generation engine
 *  can actually enforce (contract-gaps doc §3/§4) — no free-text priorities
 *  beyond a capped list of named priority ids. */
export interface PlanDraftIntensity {
  portionProfile: "light" | "standard" | "hearty";
  proteinDirection: "lower" | "standard" | "higher";
  carbDirection: "lower" | "standard" | "higher";
  /** Capped to 3 per the rebuild spec ("up to three nutrition priorities"); enforced in the route schema, not here. */
  priorities: string[];
}

export type PlanDraftRenewalChoice = "auto_renew" | "end_after" | "decide_later";

/** One configured meal within a day. Carries its own dish-identity and
 *  nutrition SNAPSHOT (name/image/macros as of generation time) rather than
 *  a live FK into the mutable dish catalog — matching MealPlanSlotEntry's
 *  precedent and the contract-gap doc's "each phase preserves a snapshot
 *  appropriate to its authority" principle. Field names mirror
 *  MealPlanSlotEntry (mealPlans.ts) so downstream conversion doesn't need a
 *  field-renaming layer. */
export interface PlanDraftMealSlot {
  mealPeriod: PlanDraftMealPeriod;
  dishId: number;
  /** Reserved for a future catalog-versioning concept the live DISHES
   *  catalog doesn't have today — left nullable so adding real dish
   *  versioning later doesn't force a PlanDraft migration. */
  dishVersionId: string | null;
  slug: string;
  name: string;
  image: string;
  portionId: string | null;
  accompanimentSelections: string[];
  addOns: string[];
  /** Keep-protected: Shuffle must not replace a locked slot (contract-gap
   *  doc's Keep/Shuffle/Undo invariants). */
  locked: boolean;
  /** Why this dish was chosen / why it fits — surfaced to the customer,
   *  never fabricated client-side. Null until the generator (A2.2) sets it. */
  compatibilityExplanation: string | null;
  /** Delta vs. the plan's base per-meal price, paise. SERVER-COMPUTED ONLY —
   *  the frontend must never invent this figure (rebuild spec §"Change Dish"). */
  priceAdjustmentPaise: number;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface PlanDraftDay {
  deliveryDate: string;
  deliveryWindow: string | null;
  addressId: number | null;
  slots: PlanDraftMealSlot[];
}

export interface PlanDraftDuration {
  cycle: "weekly" | "monthly" | "quarterly";
  renewal: PlanDraftRenewalChoice;
}

export interface PlanDraftDeliverySchedule {
  addressId: number;
  deliveryWindow: string;
  /** Paise. Server-computed at schedule-selection time (A2.3) — never
   *  authored by the client. */
  deliveryFeePaise: number;
}

export const planDraftsTable = pgTable(
  "plan_drafts",
  {
    /** Opaque, server-generated (crypto.randomBytes(32).toString("hex")) —
     *  mirrors sessionsTable.sid's shape exactly. This IS the guest
     *  ownership credential while userId is null (unguessable, stored in an
     *  httpOnly cookie, never exposed to page JS) — see
     *  lib/planDraftAuth.ts. */
    id: varchar("id").primaryKey(),
    /** Null while guest-owned. Set once by POST /plan-drafts/:id/claim;
     *  never cleared back to null (a claimed draft stays claimed). */
    userId: varchar("user_id").references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    journey: varchar("journey", { length: 16 })
      .$type<PlanDraftJourney>()
      .notNull(),
    acquisitionContext: varchar("acquisition_context", { length: 32 })
      .$type<PlanDraftAcquisitionContext>(),
    status: varchar("status", { length: 24 })
      .$type<PlanDraftStatus>()
      .notNull()
      .default("collecting_preferences"),
    /** Bumped on every PATCH. Callers must send the version they read;
     *  a stale write 409s rather than silently overwriting a concurrent
     *  edit — this is a new pattern for the codebase (no prior table uses
     *  a version column; existing tables guard updates on a status-CAS
     *  instead), introduced because PlanDraft edits can span many
     *  independent screens/steps over a long-lived draft in a way the
     *  status-CAS pattern doesn't fit. */
    version: integer("version").notNull().default(1),

    /** Journey 2 only — which PLAN_CATALOG plan this draft configures.
     *  Null for Journey 4 (custom, generated fresh — no catalog plan). */
    planId: varchar("plan_id", { length: 32 }),

    goal: varchar("goal", { length: 64 }),
    mealtime: jsonb("mealtime").$type<PlanDraftMealtime | null>(),
    routine: jsonb("routine").$type<PlanDraftRoutine | null>(),
    dietaryPattern: varchar("dietary_pattern", { length: 32 }),
    hardAllergens: jsonb("hard_allergens").$type<string[]>().notNull().default([]),
    hardExclusions: jsonb("hard_exclusions").$type<string[]>().notNull().default([]),
    softDislikes: jsonb("soft_dislikes").$type<string[]>().notNull().default([]),
    spicePreference: varchar("spice_preference", { length: 16 }),
    varietyPreference: varchar("variety_preference", { length: 16 }),
    intensity: jsonb("intensity").$type<PlanDraftIntensity | null>(),
    duration: jsonb("duration").$type<PlanDraftDuration | null>(),

    /** Null until the generator (A2.2) produces one. */
    lineup: jsonb("lineup").$type<PlanDraftDay[] | null>(),
    /** Keep-protected slot keys, formatted "<deliveryDate>:<mealPeriod>".
     *  Survives Shuffle by construction (A2.2 filters these out of the
     *  shuffle candidate set). */
    lockedSlotKeys: jsonb("locked_slot_keys").$type<string[]>().notNull().default([]),
    /** One validated Undo snapshot after a Shuffle — cleared (set back to
     *  null) the moment a manual Change-Dish replace happens, per the
     *  rebuild spec's "Manual replacement clears Undo" invariant. */
    previousLineup: jsonb("previous_lineup").$type<PlanDraftDay[] | null>(),

    deliverySchedule: jsonb("delivery_schedule").$type<PlanDraftDeliverySchedule | null>(),

    /** Guest drafts expire and become eligible for cleanup; refreshed on
     *  every PATCH. Claiming a draft does not change this — a claimed
     *  draft is still subject to normal abandonment after inactivity. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_plan_drafts_user").on(table.userId),
    index("idx_plan_drafts_expires").on(table.expiresAt),
  ],
);

export type PlanDraft = typeof planDraftsTable.$inferSelect;
export type InsertPlanDraft = typeof planDraftsTable.$inferInsert;
