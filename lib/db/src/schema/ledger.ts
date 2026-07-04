import crypto from "crypto";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export type LedgerAccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type LedgerAccountStatus = "active" | "frozen" | "closed";
export type LedgerEntryType = "DEBIT" | "CREDIT";
export type LedgerJournalStatus = "draft" | "posted" | "voided";

export const LEDGER_SEED_ACCOUNTS = {
  CGST_LIABILITY: {
    code: "2010_CGST_LIAB",
    name: "CGST Output Liability",
    type: "liability" as LedgerAccountType,
    currency: "INR",
  },
  SGST_LIABILITY: {
    code: "2020_SGST_LIAB",
    name: "SGST Output Liability",
    type: "liability" as LedgerAccountType,
    currency: "INR",
  },
  IGST_LIABILITY: {
    code: "2030_IGST_LIAB",
    name: "IGST Output Liability",
    type: "liability" as LedgerAccountType,
    currency: "INR",
  },
  PROMOTIONAL_SUBSIDIES: {
    code: "5010_PROMO_SUBSIDY",
    name: "Promotional Subsidies & Discounts",
    type: "expense" as LedgerAccountType,
    currency: "INR",
  },
  CUSTOMER_WALLET_LIABILITIES: {
    code: "2100_CUST_WALLET_LIAB",
    name: "Customer Wallet Liabilities",
    type: "liability" as LedgerAccountType,
    currency: "INR",
  },
  FOOD_SALES_REVENUE: {
    code: "4010_FOOD_SALES",
    name: "Food & Beverage Sales Revenue",
    type: "revenue" as LedgerAccountType,
    currency: "INR",
  },
  CASH_BANK_ASSET: {
    code: "1010_CASH_BANK",
    name: "Cash and Bank Clearing Asset",
    type: "asset" as LedgerAccountType,
    currency: "INR",
  },
} as const;

export const GENESIS_PREVIOUS_HASH = "0".repeat(64);

export const ledgerAccountsTable = pgTable(
  "ledger_accounts",
  {
    id: varchar("id", { length: 64 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 256 }).notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    type: varchar("type", { length: 32 }).$type<LedgerAccountType>().notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("INR"),
    status: varchar("status", { length: 32 })
      .$type<LedgerAccountStatus>()
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("uniq_ledger_accounts_code").on(table.code),
    index("idx_ledger_accounts_type_status").on(table.type, table.status),
  ],
);

export const ledgerJournalEntriesTable = pgTable(
  "ledger_journal_entries",
  {
    id: varchar("id", { length: 64 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    description: varchar("description", { length: 512 }).notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    referenceId: varchar("reference_id", { length: 128 }),
    previousHash: varchar("previous_hash", { length: 64 }).notNull(),
    hash: varchar("hash", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 })
      .$type<LedgerJournalStatus>()
      .notNull()
      .default("posted"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_ledger_journal_entries_hash").on(table.hash),
    uniqueIndex("idx_ledger_je_prev_hash").on(table.previousHash),
    index("idx_ledger_journal_entries_posted_at").on(table.postedAt),
    index("idx_ledger_journal_entries_reference_id").on(table.referenceId),
  ],
);

export const ledgerLinesTable = pgTable(
  "ledger_lines",
  {
    id: varchar("id", { length: 64 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    journalEntryId: varchar("journal_entry_id", { length: 64 })
      .notNull()
      .references(() => ledgerJournalEntriesTable.id, { onDelete: "restrict" }),
    accountId: varchar("account_id", { length: 64 })
      .notNull()
      .references(() => ledgerAccountsTable.id, { onDelete: "restrict" }),
    entryType: varchar("entry_type", { length: 16 })
      .$type<LedgerEntryType>()
      .notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    description: varchar("description", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_ledger_lines_journal_entry").on(table.journalEntryId),
    index("idx_ledger_lines_account").on(table.accountId),
    index("idx_ledger_lines_entry_type").on(table.entryType),
    check(
      "ledger_lines_entry_type_chk",
      sql`${table.entryType} in ('DEBIT', 'CREDIT')`,
    ),
    check("ledger_lines_amount_chk", sql`${table.amount} > 0`),
  ],
);

export type LedgerAccount = typeof ledgerAccountsTable.$inferSelect;
export type InsertLedgerAccount = typeof ledgerAccountsTable.$inferInsert;

export type LedgerJournalEntry = typeof ledgerJournalEntriesTable.$inferSelect;
export type InsertLedgerJournalEntry = typeof ledgerJournalEntriesTable.$inferInsert;

export type LedgerLine = typeof ledgerLinesTable.$inferSelect;
export type InsertLedgerLine = typeof ledgerLinesTable.$inferInsert;

export interface JournalEntryHashInput {
  id?: string;
  description: string;
  postedAt?: Date | string | number;
  referenceId?: string | null;
}

export interface JournalLineHashInput {
  id?: string;
  accountId: string;
  entryType: LedgerEntryType | string;
  amount: number;
  description?: string | null;
}

function normalizePostedAt(postedAt?: Date | string | number): string {
  if (postedAt === undefined || postedAt === null || postedAt === "") {
    return "";
  }
  if (postedAt instanceof Date) {
    return postedAt.toISOString();
  }
  if (typeof postedAt === "number") {
    return new Date(postedAt).toISOString();
  }
  if (typeof postedAt === "string") {
    const trimmed = postedAt.trim();
    if (trimmed === "") return "";
    if (/^-?\d+$/.test(trimmed)) {
      return new Date(Number(trimmed)).toISOString();
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
  }
  return String(postedAt);
}

/**
 * Computes a deterministic SHA-256 hash for a journal entry and its associated lines.
 * Lines are sorted canonically by accountId, entryType, amount, description, and id before hashing
 * to ensure that line array ordering differences do not alter the cryptographic hash.
 */
export function computeJournalEntryHash(
  previousHash: string,
  entry: JournalEntryHashInput,
  lines: JournalLineHashInput[],
): string {
  const normalizedEntry = {
    id: entry.id ?? "",
    description: entry.description.trim(),
    postedAt: normalizePostedAt(entry.postedAt),
    referenceId: entry.referenceId ?? "",
  };

  const normalizedLines = [...lines]
    .map((line) => ({
      id: line.id ?? "",
      accountId: line.accountId,
      entryType: line.entryType,
      amount: Number(line.amount),
      description: (line.description ?? "").trim(),
    }))
    .sort((a, b) => {
      const cmpAcc = a.accountId.localeCompare(b.accountId);
      if (cmpAcc !== 0) return cmpAcc;
      const cmpType = a.entryType.localeCompare(b.entryType);
      if (cmpType !== 0) return cmpType;
      const cmpAmt = a.amount - b.amount;
      if (cmpAmt !== 0) return cmpAmt;
      const cmpDesc = a.description.localeCompare(b.description);
      if (cmpDesc !== 0) return cmpDesc;
      return a.id.localeCompare(b.id);
    });

  const payload = JSON.stringify({
    previousHash,
    entry: normalizedEntry,
    lines: normalizedLines,
  });

  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Verifies if the provided expectedHash matches the computed SHA-256 hash for the given entry and lines.
 */
export function verifyJournalEntryHash(
  previousHash: string,
  entry: JournalEntryHashInput,
  lines: JournalLineHashInput[],
  expectedHash: string,
): boolean {
  const computed = computeJournalEntryHash(previousHash, entry, lines);
  return computed === expectedHash;
}

export interface DoubleEntryTotals {
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  difference: number;
}

/**
 * Computes aggregate debit and credit totals for a set of ledger lines.
 * Enforces strict positive integer amounts (> 0 and Number.isInteger).
 */
export function calculateDoubleEntryTotals(
  lines: Array<{ entryType: LedgerEntryType | string; amount: number }>,
): DoubleEntryTotals {
  let totalDebits = 0;
  let totalCredits = 0;
  let hasInvalidAmount = false;

  for (const line of lines) {
    const amount = Number(line.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      hasInvalidAmount = true;
    }
    if (line.entryType === "DEBIT") {
      totalDebits += amount || 0;
    } else if (line.entryType === "CREDIT") {
      totalCredits += amount || 0;
    }
  }

  const difference = Math.abs(totalDebits - totalCredits);
  const isBalanced =
    !hasInvalidAmount &&
    lines.length >= 2 &&
    difference === 0 &&
    totalDebits > 0;

  return {
    totalDebits,
    totalCredits,
    isBalanced,
    difference,
  };
}

/**
 * Verifies that the given ledger lines form a valid, balanced double-entry transaction:
 * - At least 2 lines exist
 * - SUM(debits) === SUM(credits)
 * - SUM(debits) > 0 (no zero-dollar entries)
 * - All line amounts are strictly positive integer values (> 0)
 */
export function verifyDoubleEntryMath(
  lines: Array<{ entryType: LedgerEntryType | string; amount: number }>,
): boolean {
  if (!lines || lines.length < 2) return false;
  for (const line of lines) {
    const amount = Number(line.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      return false;
    }
    if (line.entryType !== "DEBIT" && line.entryType !== "CREDIT") {
      return false;
    }
  }
  const totals = calculateDoubleEntryTotals(lines);
  return totals.isBalanced;
}

/**
 * Asserts that the lines are balanced, throwing an Error with descriptive details if not.
 */
export function assertDoubleEntryBalanced(
  lines: Array<{ entryType: LedgerEntryType | string; amount: number }>,
): void {
  if (!lines || lines.length < 2) {
    throw new Error(
      "Invalid journal entry: must contain at least 2 lines (debit and credit).",
    );
  }
  for (const line of lines) {
    const amount = Number(line.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error(
        `Invalid journal line amount: ${line.amount}. Line amounts must be strictly positive integers (> 0).`,
      );
    }
    if (line.entryType !== "DEBIT" && line.entryType !== "CREDIT") {
      throw new Error(
        `Invalid entry type: ${line.entryType}. Must be DEBIT or CREDIT.`,
      );
    }
  }
  const totals = calculateDoubleEntryTotals(lines);
  if (!totals.isBalanced) {
    throw new Error(
      `Unbalanced journal entry: Total DEBIT (${totals.totalDebits}) !== Total CREDIT (${totals.totalCredits}). Difference: ${totals.difference}`,
    );
  }
}
