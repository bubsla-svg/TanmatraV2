import {
  computeJournalEntryHash,
  verifyDoubleEntryMath,
  calculateDoubleEntryTotals,
  LEDGER_SEED_ACCOUNTS,
  GENESIS_PREVIOUS_HASH,
} from "@workspace/db";

/**
 * Adversarial Stress Test Harness for REM-V5-01 Double-Entry Ledger
 * Tests edge cases, floating point arithmetic, sorting invariance, and boundary conditions.
 */
function runStressTests() {
  console.log("=== Starting Adversarial Stress Tests for Ledger Schema ===\n");
  let failuresFound = 0;

  // 1. Zero-Dollar Lines in Multi-Line Entry
  console.log("[Stress Test 1] Zero-dollar lines inside multi-line balanced entry...");
  const zeroDollarLines = [
    { accountId: LEDGER_SEED_ACCOUNTS.CASH_BANK_ASSET.code, entryType: "DEBIT" as const, amount: 100 },
    { accountId: LEDGER_SEED_ACCOUNTS.FOOD_SALES_REVENUE.code, entryType: "CREDIT" as const, amount: 100 },
    { accountId: LEDGER_SEED_ACCOUNTS.PROMOTIONAL_SUBSIDIES.code, entryType: "DEBIT" as const, amount: 0 },
  ];
  const isBalancedZeroLine = verifyDoubleEntryMath(zeroDollarLines);
  console.log(`  Observation: verifyDoubleEntryMath with a 0-amount line returned: ${isBalancedZeroLine}`);
  if (isBalancedZeroLine) {
    console.log("  FINDING: verifyDoubleEntryMath allows 0-amount padding lines without failing validation.\n");
  }

  // 2. Floating-Point Precision & Rounding in Currency Units
  console.log("[Stress Test 2] Floating-point precision in calculateDoubleEntryTotals...");
  const floatLines = [
    { accountId: "acc_debit_1", entryType: "DEBIT" as const, amount: 0.1 },
    { accountId: "acc_debit_2", entryType: "DEBIT" as const, amount: 0.2 },
    { accountId: "acc_credit_1", entryType: "CREDIT" as const, amount: 0.3 },
  ];
  const floatTotals = calculateDoubleEntryTotals(floatLines);
  console.log(`  Debits (0.1 + 0.2): ${floatTotals.totalDebits}`);
  console.log(`  Credits (0.3):      ${floatTotals.totalCredits}`);
  console.log(`  Difference:         ${floatTotals.difference}`);
  console.log(`  isBalanced:         ${floatTotals.isBalanced}`);
  if (!floatTotals.isBalanced) {
    console.log("  FINDING (Vulnerability): IEEE 754 floating-point addition causes 0.1 + 0.2 !== 0.3 to fail balance check!");
    failuresFound++;
  }

  // Check non-integer acceptance against PostgreSQL bigint schema
  const nonIntegerLines = [
    { accountId: "acc_1", entryType: "DEBIT" as const, amount: 10.5 },
    { accountId: "acc_2", entryType: "CREDIT" as const, amount: 10.5 },
  ];
  const acceptsNonInteger = verifyDoubleEntryMath(nonIntegerLines);
  console.log(`  Accepts non-integer fractional amount (10.5): ${acceptsNonInteger}`);
  if (acceptsNonInteger) {
    console.log("  FINDING (Vulnerability): verifyDoubleEntryMath accepts fractional numbers (10.5) even though database schema uses bigint('amount').\n");
    failuresFound++;
  }

  // 3. Sorting Invariance in computeJournalEntryHash
  console.log("[Stress Test 3] Sorting invariance when lines share accountId, entryType, amount, and lack ID...");
  const entry = { id: "je_stress_1", description: "Batch promotion credit", postedAt: "2026-07-03T20:00:00.000Z" };
  const lineA = { accountId: "acc_promo", entryType: "DEBIT" as const, amount: 500, description: "Promo Batch Alpha" };
  const lineB = { accountId: "acc_promo", entryType: "DEBIT" as const, amount: 500, description: "Promo Batch Beta" };
  const lineC = { accountId: "acc_wallet", entryType: "CREDIT" as const, amount: 1000, description: "Total Credit" };

  const hashOrder1 = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, entry, [lineA, lineB, lineC]);
  const hashOrder2 = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, entry, [lineB, lineA, lineC]);
  console.log(`  Hash (Order: Alpha, Beta): ${hashOrder1}`);
  console.log(`  Hash (Order: Beta, Alpha): ${hashOrder2}`);
  if (hashOrder1 !== hashOrder2) {
    console.log("  FINDING (Vulnerability): computeJournalEntryHash produces different hashes for identical lines when input array order changes! Sorting comparator omits `description`.\n");
    failuresFound++;
  }

  // 4. Timestamp formatting discrepancy in computeJournalEntryHash
  console.log("[Stress Test 4] Timestamp formatting discrepancy (number vs Date)...");
  const epochMs = 1783195200000;
  const hashNumberTs = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, { description: "Test Entry", postedAt: epochMs }, [lineC, { ...lineC, entryType: "DEBIT" }]);
  const hashDateTs = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, { description: "Test Entry", postedAt: new Date(epochMs) }, [lineC, { ...lineC, entryType: "DEBIT" }]);
  console.log(`  Hash with postedAt as number (${epochMs}): ${hashNumberTs}`);
  console.log(`  Hash with postedAt as Date object:           ${hashDateTs}`);
  if (hashNumberTs !== hashDateTs) {
    console.log("  FINDING (Vulnerability): computeJournalEntryHash yields different hashes for the same point in time when passed as number vs Date.\n");
    failuresFound++;
  }

  console.log(`=== Stress Testing Complete. Total Vulnerabilities / Flaws Identified: ${failuresFound} ===`);
}

runStressTests();
