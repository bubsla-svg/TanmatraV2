import assert from "node:assert";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  computeJournalEntryHash,
  verifyJournalEntryHash,
  verifyDoubleEntryMath,
  assertDoubleEntryBalanced,
  calculateDoubleEntryTotals,
  LEDGER_SEED_ACCOUNTS,
  GENESIS_PREVIOUS_HASH,
  ledgerJournalEntriesTable,
  ledgerLinesTable,
} from "@workspace/db";

function runTests() {
  console.log("=== Starting REM-V5-01 Ledger Verification Suite ===\n");
  let passed = 0;

  // Test 1: Balanced Double-Entry Creation across CGST, SGST, Customer Wallet, and Revenue
  console.log("[Test 1] Testing balanced journal entry creation (Order Sale with GST & Wallet)...");
  const entry1 = {
    id: "je_001",
    description: "Customer checkout #1001 with split payment (Bank + Wallet)",
    postedAt: "2026-07-03T20:00:00.000Z",
    referenceId: "ord_1001",
  };
  const lines1 = [
    {
      id: "line_101",
      accountId: LEDGER_SEED_ACCOUNTS.CASH_BANK_ASSET.code,
      entryType: "DEBIT" as const,
      amount: 10000,
      description: "Bank payment received",
    },
    {
      id: "line_102",
      accountId: LEDGER_SEED_ACCOUNTS.CUSTOMER_WALLET_LIABILITIES.code,
      entryType: "DEBIT" as const,
      amount: 500,
      description: "Customer wallet debit redemption",
    },
    {
      id: "line_103",
      accountId: LEDGER_SEED_ACCOUNTS.FOOD_SALES_REVENUE.code,
      entryType: "CREDIT" as const,
      amount: 10000,
      description: "Food sales revenue",
    },
    {
      id: "line_104",
      accountId: LEDGER_SEED_ACCOUNTS.CGST_LIABILITY.code,
      entryType: "CREDIT" as const,
      amount: 250,
      description: "CGST output liability 2.5%",
    },
    {
      id: "line_105",
      accountId: LEDGER_SEED_ACCOUNTS.SGST_LIABILITY.code,
      entryType: "CREDIT" as const,
      amount: 250,
      description: "SGST output liability 2.5%",
    },
  ];

  const totals1 = calculateDoubleEntryTotals(lines1);
  assert.strictEqual(totals1.totalDebits, 10500, "Total debits should match 10500");
  assert.strictEqual(totals1.totalCredits, 10500, "Total credits should match 10500");
  assert.strictEqual(totals1.isBalanced, true, "Entry should be balanced");
  assert.strictEqual(verifyDoubleEntryMath(lines1), true, "verifyDoubleEntryMath should return true");
  assertDoubleEntryBalanced(lines1);
  console.log("  ✔ Balanced journal entry created and verified successfully (Debits: 10500, Credits: 10500).\n");
  passed++;

  // Test 2: Promotional Subsidy Entry
  console.log("[Test 2] Testing promotional subsidy credit to customer wallet...");
  const entry2 = {
    id: "je_002",
    description: "Welcome campaign promo credit to user wallet",
    postedAt: "2026-07-03T20:05:00.000Z",
    referenceId: "promo_welcome_2026",
  };
  const lines2 = [
    {
      id: "line_201",
      accountId: LEDGER_SEED_ACCOUNTS.PROMOTIONAL_SUBSIDIES.code,
      entryType: "DEBIT" as const,
      amount: 2000,
      description: "Promotional subsidy expense",
    },
    {
      id: "line_202",
      accountId: LEDGER_SEED_ACCOUNTS.CUSTOMER_WALLET_LIABILITIES.code,
      entryType: "CREDIT" as const,
      amount: 2000,
      description: "Wallet balance credited",
    },
  ];
  assert.strictEqual(verifyDoubleEntryMath(lines2), true, "Promo subsidy entry should be balanced");
  console.log("  ✔ Promotional subsidy entry verified successfully.\n");
  passed++;

  // Test 3: Rejecting Unbalanced Entries
  console.log("[Test 3] Testing rejection of unbalanced journal entries where debits != credits...");
  const unbalancedLines = [
    {
      accountId: LEDGER_SEED_ACCOUNTS.CASH_BANK_ASSET.code,
      entryType: "DEBIT" as const,
      amount: 10500,
    },
    {
      accountId: LEDGER_SEED_ACCOUNTS.FOOD_SALES_REVENUE.code,
      entryType: "CREDIT" as const,
      amount: 10000,
    },
  ];
  assert.strictEqual(verifyDoubleEntryMath(unbalancedLines), false, "verifyDoubleEntryMath should return false for unbalanced lines");
  assert.throws(
    () => assertDoubleEntryBalanced(unbalancedLines),
    /Unbalanced journal entry/,
    "assertDoubleEntryBalanced should throw for unbalanced lines"
  );
  console.log("  ✔ Unbalanced entry correctly rejected (Debits: 10500 vs Credits: 10000).\n");
  passed++;

  // Test 4: Rejecting Invalid Line Amounts & Configurations (Negative, Zero, Fractional, Single-line)
  console.log("[Test 4] Testing rejection of negative amounts, zero amounts, fractional amounts, or single-line entries...");
  const negativeLines = [
    { accountId: "acc_1", entryType: "DEBIT" as const, amount: -100 },
    { accountId: "acc_2", entryType: "CREDIT" as const, amount: -100 },
  ];
  assert.strictEqual(verifyDoubleEntryMath(negativeLines), false, "Negative amounts must be rejected");
  assert.strictEqual(verifyDoubleEntryMath([{ accountId: "acc_1", entryType: "DEBIT" as const, amount: 100 }]), false, "Single line must be rejected");

  const zeroLines = [
    { accountId: "acc_1", entryType: "DEBIT" as const, amount: 100 },
    { accountId: "acc_2", entryType: "CREDIT" as const, amount: 100 },
    { accountId: "acc_3", entryType: "DEBIT" as const, amount: 0 },
  ];
  assert.strictEqual(verifyDoubleEntryMath(zeroLines), false, "Zero amounts must be rejected");
  assert.throws(
    () => assertDoubleEntryBalanced(zeroLines),
    /strictly positive integers/,
    "assertDoubleEntryBalanced should throw for zero amounts"
  );

  const fractionalLines = [
    { accountId: "acc_1", entryType: "DEBIT" as const, amount: 10.5 },
    { accountId: "acc_2", entryType: "CREDIT" as const, amount: 10.5 },
  ];
  assert.strictEqual(verifyDoubleEntryMath(fractionalLines), false, "Fractional amounts (10.5) must be rejected");
  assert.strictEqual(calculateDoubleEntryTotals(fractionalLines).isBalanced, false, "calculateDoubleEntryTotals reports isBalanced=false for fractional amounts");
  assert.throws(
    () => assertDoubleEntryBalanced(fractionalLines),
    /strictly positive integers/,
    "assertDoubleEntryBalanced should throw for fractional amounts"
  );
  console.log("  ✔ Negative amounts, zero amounts, fractional amounts (10.5), and single lines correctly rejected.\n");
  passed++;

  // Test 5: SHA-256 Hash Chaining across Sequential Journal Entries
  console.log("[Test 5] Testing SHA-256 hash chaining across sequential entries...");
  const hash1 = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, entry1, lines1);
  assert.strictEqual(typeof hash1, "string");
  assert.strictEqual(hash1.length, 64, "SHA-256 hash should be 64 hex characters");
  assert.strictEqual(verifyJournalEntryHash(GENESIS_PREVIOUS_HASH, entry1, lines1, hash1), true);

  const hash2 = computeJournalEntryHash(hash1, entry2, lines2);
  assert.strictEqual(hash2.length, 64);
  assert.strictEqual(verifyJournalEntryHash(hash1, entry2, lines2, hash2), true);
  assert.notStrictEqual(hash1, hash2, "Sequential hashes must differ");
  console.log(`  ✔ Genesis hash -> Entry 1 Hash: ${hash1}`);
  console.log(`  ✔ Entry 1 hash -> Entry 2 Hash: ${hash2}\n`);
  passed++;

  // Test 6: Tamper Detection (Modified amount or broken chain)
  console.log("[Test 6] Testing tamper detection on modified hash or line amount...");
  const tamperedLines1 = [
    ...lines1.slice(0, 2),
    { ...lines1[2], amount: 11000 }, // tampered credit amount
    ...lines1.slice(3),
  ];
  assert.strictEqual(
    verifyJournalEntryHash(GENESIS_PREVIOUS_HASH, entry1, tamperedLines1, hash1),
    false,
    "Tampered line amount must fail verification"
  );

  assert.strictEqual(
    verifyJournalEntryHash("1".repeat(64), entry2, lines2, hash2),
    false,
    "Tampered previousHash must fail verification"
  );

  // Line order invariance check
  const shuffledLines1 = [lines1[3], lines1[0], lines1[4], lines1[2], lines1[1]];
  const shuffledHash1 = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, entry1, shuffledLines1);
  assert.strictEqual(shuffledHash1, hash1, "Canonical sorting ensures hash invariance regardless of line array order");
  console.log("  ✔ Tamper detection verified: amount modification and broken chain detected immediately.\n");
  passed++;

  // Test 7: Sorting Invariance and Timestamp Normalization in Hash Chaining
  console.log("[Test 7] Testing sorting invariance across description/id permutations and timestamp normalization...");
  const sortEntry = { id: "je_sort_1", description: "Permutation test", postedAt: 1783195200000 };
  const lineAlpha = { accountId: "acc_same", entryType: "DEBIT" as const, amount: 500, description: "Batch Alpha" };
  const lineBeta = { accountId: "acc_same", entryType: "DEBIT" as const, amount: 500, description: "Batch Beta" };
  const lineGamma = { accountId: "acc_credit", entryType: "CREDIT" as const, amount: 1000, description: "Offset Credit" };

  const hashPerm1 = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, sortEntry, [lineAlpha, lineBeta, lineGamma]);
  const hashPerm2 = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, sortEntry, [lineBeta, lineAlpha, lineGamma]);
  const hashPerm3 = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, sortEntry, [lineGamma, lineBeta, lineAlpha]);
  assert.strictEqual(hashPerm1, hashPerm2, "Hash must be invariant when lines with same accountId/amount differ by description permutation");
  assert.strictEqual(hashPerm1, hashPerm3, "Hash must be invariant across all line permutations");

  const hashTsNumber = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, { ...sortEntry, postedAt: 1783195200000 }, [lineAlpha, lineGamma]);
  const hashTsDate = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, { ...sortEntry, postedAt: new Date(1783195200000) }, [lineAlpha, lineGamma]);
  const hashTsString = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, { ...sortEntry, postedAt: "1783195200000" }, [lineAlpha, lineGamma]);
  const hashTsIso = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, { ...sortEntry, postedAt: new Date(1783195200000).toISOString() }, [lineAlpha, lineGamma]);
  assert.strictEqual(hashTsNumber, hashTsDate, "Numeric timestamp must match Date timestamp hash");
  assert.strictEqual(hashTsNumber, hashTsString, "Numeric string timestamp must match numeric timestamp hash");
  assert.strictEqual(hashTsNumber, hashTsIso, "ISO string timestamp must match numeric timestamp hash");
  console.log("  ✔ Sorting invariance and timestamp normalization verified successfully.\n");
  passed++;

  // Test 8: Schema Hardening (Chain Forking Prevention & Immutable Line Preservation)
  console.log("[Test 8] Testing database schema constraints for chain forking prevention and immutable lines...");
  const jeConfig = getTableConfig(ledgerJournalEntriesTable);
  const prevHashIdx = jeConfig.indexes.find((idx) => idx.config.name === "idx_ledger_je_prev_hash");
  assert.ok(prevHashIdx, "idx_ledger_je_prev_hash index must exist on ledger_journal_entries");
  assert.strictEqual(prevHashIdx.config.isUnique, true, "idx_ledger_je_prev_hash must be a unique index to prevent chain forking");

  const linesConfig = getTableConfig(ledgerLinesTable);
  const jeFk = linesConfig.foreignKeys.find((fk) => {
    const ref = fk.reference();
    return ref.columns.some((col) => col.name === "journal_entry_id") || ref.foreignColumns.some((col) => col.name === "id");
  });
  assert.ok(jeFk, "Foreign key from ledger_lines to ledger_journal_entries must exist");
  const onDeleteRule = jeFk.onDelete ?? jeFk.reference().onDelete;
  assert.notStrictEqual(onDeleteRule, "cascade", "onDelete on journalEntryId foreign key must not be cascade");
  assert.strictEqual(onDeleteRule, "restrict", "onDelete on journalEntryId foreign key must be restrict to preserve historical lines");

  const amountChk = linesConfig.checks.find((chk) => chk.name === "ledger_lines_amount_chk");
  assert.ok(amountChk, "ledger_lines_amount_chk check constraint must exist");
  console.log("  ✔ Schema constraints (unique previousHash and restrict onDelete) verified successfully.\n");
  passed++;

  console.log(`=== All ${passed} Ledger Verification Tests PASSED! ===`);
}

runTests();
