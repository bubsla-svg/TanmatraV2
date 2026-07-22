import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

/**
 * Durable one-trial-per-phone-EVER ledger (02b eligibility, 02e §6).
 *
 * The 3-Day Taste Test is once per phone number, forever — enforced server-side
 * on the OTP identity. A row is written when a trial is PAID (not merely
 * created), keyed by a salted hash of the E.164 phone so the raw number is
 * never stored here. Crucially this SURVIVES account deletion: a user can
 * soft-delete their account and their subscriptions cascade away, but this
 * record persists, so the same phone cannot farm a second free-value trial.
 *
 * `phoneHash` is UNIQUE — the insert itself is the enforcement (a second paid
 * trial for the same phone hits the unique constraint). `userId` is nullable
 * and set null on user delete so the record outlives the account.
 */
export const trialRedemptionsTable = pgTable(
  "trial_redemptions",
  {
    id: serial("id").primaryKey(),
    /** Salted SHA-256 of the normalized E.164 phone (hex). Never the raw number. */
    phoneHash: varchar("phone_hash", { length: 64 }).notNull(),
    /** The account that redeemed; nulled if the account is later deleted. */
    userId: varchar("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    /** The trial subscription this record was written for (audit trail). */
    subscriptionId: integer("subscription_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("uniq_trial_redemptions_phone").on(table.phoneHash)],
);
