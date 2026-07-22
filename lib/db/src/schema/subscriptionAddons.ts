import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { subscriptionsTable } from "./subscriptions";

export type SubscriptionAddOnId = "rd_bump" | "evening_add";
export type SubscriptionAddOnCadence = "monthly" | "weekly";

/**
 * Add-ons attached to a subscription (02 §5 / 02a §4). Distinct from the
 * order-scoped `addons`/`order_addons` tables — these recur with the
 * subscription:
 *   • rd_bump      — +₹499/mo, attached at plan review, before payment.
 *   • evening_add  — +₹599/week, attached post-purchase, one-tap; must never
 *     block confirmation, so it is its own row toggled independently of the
 *     plan's own billing.
 *
 * `pricePaise`/`cadence` are snapshotted at attach time (server-quoted from the
 * canonical ADD_ONS config) so a later price change never silently reprices an
 * already-attached add-on. `active=false` is a soft-detach that preserves the
 * audit trail. The recurring charge sums the plan cycle total plus every active
 * add-on — that inclusion in the charge path is roadmap slice S6b.
 */
export const subscriptionAddonsTable = pgTable(
  "subscription_addons",
  {
    id: serial("id").primaryKey(),
    subscriptionId: integer("subscription_id")
      .notNull()
      .references(() => subscriptionsTable.id, { onDelete: "cascade" }),
    addonId: varchar("addon_id", { length: 32 })
      .notNull()
      .$type<SubscriptionAddOnId>(),
    pricePaise: integer("price_paise").notNull(),
    cadence: varchar("cadence", { length: 16 })
      .notNull()
      .$type<SubscriptionAddOnCadence>(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_subscription_addons_sub").on(table.subscriptionId),
  ],
);
