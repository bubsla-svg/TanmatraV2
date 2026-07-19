import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  jsonb,
  text,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export type SubscriptionCadence = "weekly" | "fortnightly" | "monthly";
// "halted" mirrors a real Razorpay native subscription's `subscription.halted`
// terminal state: billing gave up after MAX_CONSECUTIVE_CHARGE_FAILURES
// consecutive failed debits (see chargeMandate.ts's failCharge) and will not
// retry again until the customer reactivates via
// POST /subscriptions/:id/reactivate-billing. Deliberately distinct from
// "paused" (customer-initiated, no billing implication) so ops/customer UI
// can tell "you paused this" from "we stopped trying to charge your card".
// Plain varchar(16) column below, no DB-level CHECK/enum constraint — adding
// this value is TypeScript-only, not a schema migration.
export type SubscriptionStatus = "active" | "paused" | "cancelled" | "halted";
export type DeliveryStatus =
  | "upcoming"
  | "skipped"
  | "delivered"
  | "cancelled"
  | "paused";
export type CreditReason =
  | "skipped_delivery"
  | "redemption"
  | "manual_grant"
  // Phase C2 — earned on a customer's first à la carte order, redeemable once
  // against a trial purchase (one free meal). See lib/bridgeCredit.ts.
  | "alacarte_bridge";

export type TrialState = "trial_purchased" | "trial_active" | "trial_bridge_eligible" | "trial_ended_undecided" | "converted" | "ended_abandoned";

export interface SubscriptionItem {
  slug: string;
  name: string;
  image: string;
  quantity: number;
  unitPricePaise: number;
  memberId?: number | null;
}

// One entry per delivery day within a billing cycle. `dayOffset` is days
// from the cycle start; the week pattern is expanded client-side across
// fortnightly/monthly cycles so offsets are explicit, never inferred.
export interface SubscriptionDayPlanEntry {
  dayOffset: number;
  items: SubscriptionItem[];
}

export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    cadence: varchar("cadence", { length: 16 })
      .$type<SubscriptionCadence>()
      .notNull(),
    mealsPerDelivery: integer("meals_per_delivery").notNull(),
    deliveryWindow: varchar("delivery_window", { length: 32 }).notNull(),
    preferredSlotId: integer("preferred_slot_id"),
    status: varchar("status", { length: 16 })
      .$type<SubscriptionStatus>()
      .notNull()
      .default("active"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    nextDeliveryAt: timestamp("next_delivery_at", {
      withTimezone: true,
    }).notNull(),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    addressLabel: varchar("address_label", { length: 64 }),
    addressLine: varchar("address_line", { length: 256 }),
    city: varchar("city", { length: 64 }),
    pincode: varchar("pincode", { length: 16 }),
    phone: varchar("phone", { length: 32 }),
    pricePerDeliveryPaise: integer("price_per_delivery_paise")
      .notNull()
      .default(0),
    dayPlan: jsonb("day_plan").$type<SubscriptionDayPlanEntry[] | null>(),
    notes: varchar("notes", { length: 512 }),
    trialState: varchar("trial_state", { length: 32 }).$type<TrialState>(),
    // ── Plan-change (cadence / mealsPerDelivery) — applied at next cycle ──
    // A requested cadence/meals change is never applied mid-cycle (the
    // customer already committed to the deliveries already generated for
    // this cycle, and pricePerDeliveryPaise is what the live autopay mandate
    // was authorised against). It is stored here and applied the next time
    // this subscription's deliveries are generated for a new cycle (see
    // POST /subscriptions/:id/generate-next). When the recomputed price is
    // higher than the current pricePerDeliveryPaise, `pendingChangeReauthRequired`
    // stays true until the customer completes a fresh Razorpay OTP
    // authorisation (POST .../change-plan/confirm) — the cycle-rollover
    // application step skips any pending change still awaiting reauth.
    pendingCadence: varchar("pending_cadence", { length: 16 }).$type<SubscriptionCadence>(),
    pendingMealsPerDelivery: integer("pending_meals_per_delivery"),
    pendingPricePerDeliveryPaise: integer("pending_price_per_delivery_paise"),
    pendingChangeRequestedAt: timestamp("pending_change_requested_at", {
      withTimezone: true,
    }),
    pendingChangeReauthRequired: boolean("pending_change_reauth_required")
      .notNull()
      .default(false),
    // The Razorpay order id created for the re-authorisation charge, so the
    // confirm step can bind the verified payment to exactly this request
    // (never trust a payment id the client could point at a different order).
    pendingChangeRazorpayOrderId: varchar("pending_change_razorpay_order_id", {
      length: 64,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("idx_subscriptions_user").on(table.userId)],
);

export const subscriptionMembersTable = pgTable(
  "subscription_members",
  {
    id: serial("id").primaryKey(),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 64 }).notNull(),
    diet: varchar("diet", { length: 16 }).notNull().default("any"),
    allergens: jsonb("allergens").$type<string[]>().notNull().default([]),
    medicalConditions: text("medical_conditions").array().notNull().default([]),
    dislikedIngredients: text("disliked_ingredients").array().notNull().default([]),
    lifestyle: varchar("lifestyle", { length: 32 }),
    spiceLevel: varchar("spice_level", { length: 16 }).default("medium"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_sub_members_sub").on(table.subscriptionId)],
);

export const subscriptionDeliveriesTable = pgTable(
  "subscription_deliveries",
  {
    id: serial("id").primaryKey(),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: "cascade" }),
    scheduledFor: timestamp("scheduled_for", {
      withTimezone: true,
    }).notNull(),
    deliveryWindow: varchar("delivery_window", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 })
      .$type<DeliveryStatus>()
      .notNull()
      .default("upcoming"),
    items: jsonb("items").$type<SubscriptionItem[]>().notNull().default([]),
    orderId: integer("order_id"),
    notes: varchar("notes", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_sub_deliveries_sub").on(table.subscriptionId),
    index("idx_sub_deliveries_scheduled").on(table.scheduledFor),
  ],
);

export const mealCreditsTable = pgTable(
  "meal_credits",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    subscriptionId: integer("subscription_id").references(
      () => subscriptionsTable.id,
      { onDelete: "set null" },
    ),
    deliveryId: integer("delivery_id").references(
      () => subscriptionDeliveriesTable.id,
      { onDelete: "set null" },
    ),
    amount: integer("amount").notNull(),
    reason: varchar("reason", { length: 32 })
      .$type<CreditReason>()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_meal_credits_user").on(table.userId)],
);

export const insertSubscriptionSchema = createInsertSchema(
  subscriptionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;

export const insertSubscriptionMemberSchema = createInsertSchema(
  subscriptionMembersTable,
).omit({ id: true, createdAt: true });
export type InsertSubscriptionMember = z.infer<
  typeof insertSubscriptionMemberSchema
>;
export type SubscriptionMember =
  typeof subscriptionMembersTable.$inferSelect;

export const insertSubscriptionDeliverySchema = createInsertSchema(
  subscriptionDeliveriesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscriptionDelivery = z.infer<
  typeof insertSubscriptionDeliverySchema
>;
export type SubscriptionDelivery =
  typeof subscriptionDeliveriesTable.$inferSelect;

export type MealCredit = typeof mealCreditsTable.$inferSelect;

export type MandateChargeStatus = "succeeded" | "failed";

export const subscriptionMandatesTable = pgTable(
  "subscription_mandates",
  {
    id: serial("id").primaryKey(),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: "cascade" }),
    razorpayCustomerId: varchar("razorpay_customer_id", { length: 64 }).notNull(),
    razorpayTokenId: varchar("razorpay_token_id", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    nextChargeAt: timestamp("next_charge_at", { withTimezone: true }),
    // Minimal charge-attempt bookkeeping (recurring-billing driver). Full
    // dunning/backoff policy is an explicit follow-up — these four columns
    // only need to answer "was an attempt made, did it work, and how many
    // times in a row has it failed", and double as the claim/lock token that
    // stops the same due mandate being charged twice by an overlapping
    // scheduler tick and an ops-triggered HTTP call.
    lastChargeAttemptAt: timestamp("last_charge_attempt_at", { withTimezone: true }),
    lastChargeStatus: varchar("last_charge_status", { length: 16 }).$type<MandateChargeStatus>(),
    lastChargeError: varchar("last_charge_error", { length: 256 }),
    chargeFailureCount: integer("charge_failure_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_subscription_mandates_sub").on(table.subscriptionId)],
);

export const preDebitNotificationsTable = pgTable(
  "pre_debit_notifications",
  {
    id: serial("id").primaryKey(),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: "cascade" }),
    scheduledChargeAt: timestamp("scheduled_charge_at", {
      withTimezone: true,
    }).notNull(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_pre_debit_notifications_sub").on(table.subscriptionId),
  ],
);

export const insertSubscriptionMandateSchema = createInsertSchema(
  subscriptionMandatesTable,
).omit({ id: true, createdAt: true });
export type InsertSubscriptionMandate = z.infer<
  typeof insertSubscriptionMandateSchema
>;
export type SubscriptionMandate = typeof subscriptionMandatesTable.$inferSelect;

export const insertPreDebitNotificationSchema = createInsertSchema(
  preDebitNotificationsTable,
).omit({ id: true, createdAt: true });
export type InsertPreDebitNotification = z.infer<
  typeof insertPreDebitNotificationSchema
>;
export type PreDebitNotification = typeof preDebitNotificationsTable.$inferSelect;
