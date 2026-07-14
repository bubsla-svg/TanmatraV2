// ─────────────────────────────────────────────────────────────────────────────
// Apply the curated menu-engineering catalog (execution-plan E1.1) to the live
// `menu_items` table.
//
//   pnpm --filter @workspace/scripts run apply-menu-engineering            # DRY RUN
//   pnpm --filter @workspace/scripts run apply-menu-engineering -- --apply # write availability
//   … --apply --sync-prices                                               # also sync prices
//
// SAFETY POSTURE
//   • DRY RUN by default — prints the full plan and writes nothing.
//   • CUT dishes are set is_available=false (NEVER deleted — order-history FK
//     integrity). Reversible.
//   • Price sync is OPT-IN (`--sync-prices`).
//   • Idempotent: only rows whose current state differs from target are touched.
//   • Matching is EXACT-normalized + audited overrides ONLY — no fuzzy auto-
//     apply. Ambiguous / conflicting / unmatched rows are REPORTED and never
//     written; substring near-misses are shown as suggestions to reconcile via
//     an override after checking the live DB.
//
// Requires DATABASE_URL (`@workspace/db` reads it). Off-brand SKUs that live only
// on another Petpooja menu won't exist here and show as unmatched — expected.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseCuratedCsv,
  buildPlan,
  diffAgainstCurrent,
  cutReason,
  type MenuCandidate,
  type CurrentState,
} from "./lib/menuEngineeringPlan";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(HERE, "..", "data", "curated_catalog.csv");

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const SYNC_PRICES = args.has("--sync-prices");

const OFF_BRAND_HINT = new Set([
  "WTC",
  "Cold Drinks",
  "Coolers",
  "Cheesy Quesadillas",
  "Juices",
  "Smoothies",
]);

// Show full rupee precision (2 dp) so a sub-rupee price change is never rendered
// as an identical "Rs X → Rs X" no-op in the review output.
function fmtRs(paise: number): string {
  return "Rs " + (paise / 100).toFixed(2);
}

async function main(): Promise<void> {
  if (!process.env["DATABASE_URL"]) {
    console.error(
      "DATABASE_URL is not set. This script mutates the live menu_items table and\n" +
        "must be run from an environment with database access. Aborting.",
    );
    process.exit(1);
  }

  const { db, menuItemsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");

  const dbRows = await db
    .select({
      slug: menuItemsTable.slug,
      name: menuItemsTable.name,
      isAvailable: menuItemsTable.isAvailable,
      pricePaise: menuItemsTable.pricePaise,
      category: menuItemsTable.category,
      unavailableUntil: menuItemsTable.unavailableUntil,
      unavailableReason: menuItemsTable.unavailableReason,
    })
    .from(menuItemsTable);

  const candidates: MenuCandidate[] = dbRows.map((r) => ({ name: r.name, slug: r.slug }));
  const current = new Map<string, CurrentState>(
    dbRows.map((r) => [
      r.slug,
      {
        isAvailable: r.isAvailable,
        pricePaise: r.pricePaise,
        unavailableUntil: r.unavailableUntil,
        unavailableReason: r.unavailableReason,
      },
    ]),
  );

  const { rows: csvRows, skipped } = parseCuratedCsv(readFileSync(CSV_PATH, "utf8"));
  const plan = buildPlan(csvRows, candidates);
  const { toDisable, priceSyncs } = diffAgainstCurrent(plan.changes, current);

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log("=== Menu-engineering plan (E1.1) ===");
  console.log(`live menu_items rows : ${dbRows.length}`);
  console.log(`curated CSV rows     : ${csvRows.length} parsed, ${skipped.length} skipped`);
  console.log(
    `matched              : ${plan.changes.length} ` +
      `(${plan.changes.filter((c) => c.matchKind === "exact").length} exact, ` +
      `${plan.changes.filter((c) => c.matchKind === "override").length} override)`,
  );
  console.log(
    `unmatched: ${plan.unmatched.length}   ambiguous: ${plan.ambiguous.length}   conflicts: ${plan.conflicts.length}`,
  );
  console.log("");
  console.log(`→ will DISABLE (CUT → unavailable): ${toDisable.length}`);
  for (const ch of toDisable) console.log(`    - ${ch.slug}  «${ch.reason}»`);
  console.log("");
  console.log(
    `→ price syncs (${SYNC_PRICES ? "ENABLED" : "opt-in, currently SKIPPED"}): ${priceSyncs.length}`,
  );
  for (const ps of priceSyncs) {
    console.log(`    - ${ps.change.slug}  ${fmtRs(ps.fromPaise)} → ${fmtRs(ps.toPaise)}`);
  }

  if (skipped.length > 0) {
    console.log("\n⚠ SKIPPED CSV rows (not planned — fix the sheet if unexpected):");
    for (const s of skipped) console.log(`    - line ${s.index} "${s.dish}" [${s.rawAction}]: ${s.why}`);
  }
  if (plan.ambiguous.length > 0) {
    console.log("\n⚠ AMBIGUOUS (matched >1 dish — never applied; add an override):");
    for (const a of plan.ambiguous) console.log(`    - "${a.row.dish}" → ${a.candidates.join(" | ")}`);
  }
  if (plan.conflicts.length > 0) {
    console.log("\n⚠ CONFLICTS (dish already claimed by an earlier row — not applied):");
    for (const c of plan.conflicts)
      console.log(`    - "${c.row.dish}" → ${c.slug} (already claimed by "${c.priorCsvDish}")`);
  }
  if (plan.suggestions.length > 0) {
    console.log("\nℹ SUGGESTIONS for unmatched rows (report-only — verify, then add an override):");
    for (const s of plan.suggestions)
      console.log(`    - "${s.row.dish}" [${s.row.action}] ≈ ${s.candidateSlug} ("${s.candidateName}")`);
  }
  const clinicalMisses = plan.unmatched.filter(
    (u) => !OFF_BRAND_HINT.has(u.category) && !plan.suggestions.some((s) => s.row === u),
  );
  if (clinicalMisses.length > 0) {
    console.log(`\nℹ ${clinicalMisses.length} unmatched CLINICAL rows with no suggestion — review vs DB:`);
    for (const u of clinicalMisses) console.log(`    - [${u.action}] ${u.dish} <${u.category}>`);
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply (add --sync-prices to update prices).");
    await maybeClose();
    return;
  }

  // ── Apply (transactional) ────────────────────────────────────────────────────
  let disabled = 0;
  let repriced = 0;
  await db.transaction(async (tx) => {
    for (const ch of toDisable) {
      const res = await tx
        .update(menuItemsTable)
        .set({ isAvailable: false, unavailableReason: cutReason(ch.reason), unavailableUntil: null })
        .where(eq(menuItemsTable.slug, ch.slug))
        .returning({ slug: menuItemsTable.slug });
      disabled += res.length;
    }
    if (SYNC_PRICES) {
      for (const ps of priceSyncs) {
        const res = await tx
          .update(menuItemsTable)
          .set({ pricePaise: ps.toPaise })
          .where(eq(menuItemsTable.slug, ps.change.slug))
          .returning({ slug: menuItemsTable.slug });
        repriced += res.length;
      }
    }
  });

  console.log(
    `\n✅ APPLIED — ${disabled} dish(es) set unavailable` +
      (SYNC_PRICES ? `, ${repriced} price(s) synced.` : " (prices left unchanged; pass --sync-prices to update)."),
  );
  await maybeClose();
}

async function maybeClose(): Promise<void> {
  try {
    const { pool } = await import("@workspace/db");
    await pool.end();
  } catch {
    /* pool may not be exported / already closed */
  }
}

main().catch((err) => {
  console.error("apply-menu-engineering failed:", err);
  process.exit(1);
});
