import assert from "node:assert";
import {
  computeJournalEntryHash,
  verifyJournalEntryHash,
  verifyDoubleEntryMath,
  assertDoubleEntryBalanced,
  calculateDoubleEntryTotals,
  LEDGER_SEED_ACCOUNTS,
  GENESIS_PREVIOUS_HASH,
} from "@workspace/db";

function runChallengeSuite() {
  console.log("=== Starting Empirical Challenger Suite for REM-V5-01 Ledger ===\n");
  let vulnerabilitiesFound = 0;

  // Challenge 1: Canonical Sorting Failure when id is identical/empty and description differs
  console.log("[Challenge 1] Testing canonical line sorting order-dependence when id is identical/empty...");
  const entry1 = { description: "Checkout sale", postedAt: "2026-07-03T20:00:00.000Z" };
  const lineA = { id: "", accountId: "2010_CGST_LIAB", entryType: "CREDIT" as const, amount: 250, description: "CGST Output 2.5% Item A" };
  const lineB = { id: "", accountId: "2010_CGST_LIAB", entryType: "CREDIT" as const, amount: 250, description: "CGST Output 2.5% Item B" };
  
  const hashOrderAB = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, entry1, [lineA, lineB]);
  const hashOrderBA = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, entry1, [lineB, lineA]);
  
  if (hashOrderAB !== hashOrderBA) {
    console.log("  🚨 VULNERABILITY CONFIRMED: Hash chaining is ORDER-DEPENDENT when lines share accountId, entryType, amount, and id.");
    console.log(`     Hash(AB): ${hashOrderAB}`);
    console.log(`     Hash(BA): ${hashOrderBA}`);
    console.log("     Root Cause: sort() comparator in computeJournalEntryHash compares accountId -> entryType -> amount -> id, but omits description.");
    vulnerabilitiesFound++;
  } else {
    console.log("  ✔ Hash invariant across line order.");
  }
  console.log();

  // Challenge 2: Timestamp Representation Inconsistency in Hash Computation
  console.log("[Challenge 2] Testing hash consistency across Date vs String vs Epoch Number timestamp formats...");
  const dateObj = new Date("2026-07-03T20:00:00.000Z");
  const entryDate = { description: "Checkout sale", postedAt: dateObj };
  const entryStr = { description: "Checkout sale", postedAt: "2026-07-03T20:00:00.000Z" };
  const entryEpoch = { description: "Checkout sale", postedAt: dateObj.getTime() }; // numeric timestamp

  const hashDate = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, entryDate, [lineA]);
  const hashStr = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, entryStr, [lineA]);
  const hashEpoch = computeJournalEntryHash(GENESIS_PREVIOUS_HASH, entryEpoch, [lineA]);

  if (hashDate === hashStr && hashDate !== hashEpoch) {
    console.log("  🚨 VULNERABILITY CONFIRMED: Hash computation is inconsistent when postedAt is a numeric epoch timestamp.");
    console.log(`     Hash (Date / ISO string): ${hashDate}`);
    console.log(`     Hash (Epoch ms number):  ${hashEpoch}`);
    console.log("     Root Cause: normalizedEntry uses String(entry.postedAt) for numbers instead of converting numeric epoch to ISO string.");
    vulnerabilitiesFound++;
  } else {
    console.log("  ✔ Timestamps hash consistently.");
  }
  console.log();

  // Challenge 3: IEEE 754 Floating-Point Precision Failure in Double-Entry Math
  console.log("[Challenge 3] Testing IEEE 754 floating point precision on decimal amounts (0.1 + 0.2 vs 0.3)...");
  const floatLines = [
    { accountId: "1010_CASH_BANK", entryType: "DEBIT" as const, amount: 0.1 },
    { accountId: "1010_CASH_BANK", entryType: "DEBIT" as const, amount: 0.2 },
    { accountId: "4010_FOOD_SALES", entryType: "CREDIT" as const, amount: 0.3 },
  ];
  const floatTotals = calculateDoubleEntryTotals(floatLines);
  if (!floatTotals.isBalanced || !verifyDoubleEntryMath(floatLines)) {
    console.log("  🚨 VULNERABILITY CONFIRMED: Valid double-entry transaction (0.1 + 0.2 == 0.3) fails verification due to floating-point drift.");
    console.log(`     Total Debits Calculated:  ${floatTotals.totalDebits}`);
    console.log(`     Total Credits Calculated: ${floatTotals.totalCredits}`);
    console.log(`     Difference:               ${floatTotals.difference}`);
    console.log("     Root Cause: calculateDoubleEntryTotals sums JS numbers (IEEE 754 floats) and requires exact difference === 0 without epsilon or integer cents enforcement.");
    vulnerabilitiesFound++;
  } else {
    console.log("  ✔ Floating point transaction balanced.");
  }
  console.log();

  // Challenge 4: Zero-Dollar Line Pollution
  console.log("[Challenge 4] Testing zero-dollar line acceptance in journal entries...");
  const zeroLines = [
    { accountId: "1010_CASH_BANK", entryType: "DEBIT" as const, amount: 1000 },
    { accountId: "4010_FOOD_SALES", entryType: "CREDIT" as const, amount: 1000 },
    { accountId: "2010_CGST_LIAB", entryType: "DEBIT" as const, amount: 0 }, // Bogus 0 amount line
  ];
  if (verifyDoubleEntryMath(zeroLines)) {
    console.log("  🚨 VULNERABILITY CONFIRMED: Ledger accepts zero-amount ($0) lines without rejection.");
    console.log("     Root Cause: verifyDoubleEntryMath and assertDoubleEntryBalanced only check amount >= 0, permitting amount === 0 line pollution.");
    vulnerabilitiesFound++;
  } else {
    console.log("  ✔ Zero dollar lines rejected.");
  }
  console.log();

  // Challenge 5: Absence of Tax/Liability Segregation Rules in Ledger Verification
  console.log("[Challenge 5] Testing semantic validation of tax/liability account segregation...");
  const unsegregatedLines = [
    { accountId: LEDGER_SEED_ACCOUNTS.CASH_BANK_ASSET.code, entryType: "DEBIT" as const, amount: 11000 },
    { accountId: LEDGER_SEED_ACCOUNTS.FOOD_SALES_REVENUE.code, entryType: "CREDIT" as const, amount: 10000 },
    // Tax liabilities inverted as DEBIT on expense account or wrong account instead of CREDIT liability
    { accountId: LEDGER_SEED_ACCOUNTS.PROMOTIONAL_SUBSIDIES.code, entryType: "CREDIT" as const, amount: 1000 },
  ];
  if (verifyDoubleEntryMath(unsegregatedLines)) {
    console.log("  🚨 VULNERABILITY CONFIRMED: Double-entry math passes even when tax liabilities are omitted or mis-segregated into expense accounts.");
    console.log("     Root Cause: verifyDoubleEntryMath verifies purely numeric equilibrium (sum debits == sum credits) and enforces no account type or tax segregation invariants.");
    vulnerabilitiesFound++;
  } else {
    console.log("  ✔ Tax segregation enforced.");
  }
  console.log();

  console.log(`=== Empirical Challenge Summary: ${vulnerabilitiesFound} vulnerabilities empirically proven ===`);
  if (vulnerabilitiesFound > 0) {
    process.exit(1);
  }
}

runChallengeSuite();
