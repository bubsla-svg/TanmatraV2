// ─────────────────────────────────────────────────────────────────────────────
// Apply Stage-A prices (Agent Brief §2 A2) — MECHANICAL, byte-exact.
//
// Source of truth: scripts/data/tanmatra-stageA-prices.csv, column `stageA_paise`.
// Rules (from the brief):
//   • Match rows by `id`; fall back to exact name and REPORT any mismatch —
//     never fuzzy-match.
//   • Do NOT recompute, round, or "improve" any value. The CSV arithmetic is
//     authoritative; this script only transcribes it.
//   • Ragi Dates Eggless Brownie (id 100) is EXCLUDED — it ships in its own
//     commit after kitchen confirmation (it is not in the CSV; the script
//     asserts it is never touched).
//
// The DB `menu_items` overlay OVERRIDES the catalog price when a row exists
// (see PRICE-FLOW.md), so a Stage-A change must land in BOTH places. This
// script rewrites the catalog file AND emits scripts/data/stageA-prices.sql
// (UPDATE menu_items … WHERE slug=…) for the deploy step to apply to the DB in
// the same release. Run:
//   pnpm --filter @workspace/scripts exec tsx ./src/apply-stageA-prices.ts
//   pnpm --filter @workspace/scripts exec tsx ./src/apply-stageA-prices.ts --check   # dry run
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { DISHES } from "@workspace/menu-catalog";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(HERE, "../data/tanmatra-stageA-prices.csv");
const CATALOG_PATH = resolve(HERE, "../../lib/menu-catalog/src/index.ts");
const SQL_PATH = resolve(HERE, "../data/stageA-prices.sql");
const RAGI_ID = 100;
const DRY_RUN = process.argv.includes("--check");

interface CsvRow {
  id: number;
  name: string;
  currentRs: number;
  stageAPaise: number;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  const header = lines[0].split(",");
  const idx = (c: string) => header.indexOf(c);
  const iId = idx("id"), iName = idx("name"), iCur = idx("current_rs"), iPaise = idx("stageA_paise");
  return lines.slice(1).map((line) => {
    // name may contain no commas in this CSV, but split defensively on the
    // known column count from the left/right so a stray comma can't shift ids.
    const cols = line.split(",");
    return {
      id: Number(cols[iId]),
      name: cols[iName],
      currentRs: Number(cols[iCur]),
      stageAPaise: Number(cols[iPaise]),
    };
  });
}

const norm = (s: string) => s.toLowerCase().replace(/[\s\-–—]+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();

function main() {
  const rows = parseCsv(readFileSync(CSV_PATH, "utf8"));
  const catalogById = new Map(DISHES.map((d) => [d.id, d]));
  const csvIds = new Set(rows.map((r) => r.id));

  const errors: string[] = [];
  const warnings: string[] = [];

  // Ragi must never be in the Stage-A set.
  if (csvIds.has(RAGI_ID)) errors.push(`CSV contains Ragi (id ${RAGI_ID}); it must be excluded.`);

  // Catalog dishes with no Stage-A row keep their price — report them.
  for (const d of DISHES) {
    if (d.id === RAGI_ID) continue;
    if (!csvIds.has(d.id)) warnings.push(`catalog id ${d.id} "${d.name}" (${d.slug}) has no Stage-A row — price left unchanged.`);
  }

  let source = readFileSync(CATALOG_PATH, "utf8");
  const sql: string[] = [
    "-- Stage-A prices (Agent Brief A2). Apply in the same release as the catalog",
    "-- file change; the DB menu_items overlay overrides the catalog price.",
    "BEGIN;",
  ];
  const applied: { id: number; slug: string; from: number; to: number }[] = [];

  for (const r of rows) {
    const dish = catalogById.get(r.id);
    if (!dish) {
      errors.push(`CSV id ${r.id} "${r.name}" not found in catalog.`);
      continue;
    }
    if (norm(dish.name) !== norm(r.name)) {
      warnings.push(`id ${r.id} name differs — CSV "${r.name}" vs catalog "${dish.name}" (matched by id).`);
    }
    if (dish.price !== r.currentRs * 100) {
      warnings.push(`id ${r.id} "${dish.name}" current price drift — file ${dish.price}p vs CSV ${r.currentRs * 100}p (applying stageA regardless).`);
    }

    // Replace THIS dish's price: from its "id": <id>, to the first following
    // "price": <n>. Non-greedy keeps the match inside the one object.
    const re = new RegExp(`("id":\\s*${r.id},[\\s\\S]*?"price":\\s*)(\\d+)`);
    const matches = source.match(new RegExp(re, "g")) ?? [];
    if (matches.length !== 1) {
      errors.push(`id ${r.id}: expected exactly 1 price match in source, found ${matches.length}.`);
      continue;
    }
    source = source.replace(re, `$1${r.stageAPaise}`);
    applied.push({ id: r.id, slug: dish.slug, from: dish.price, to: r.stageAPaise });
    sql.push(`UPDATE menu_items SET price_paise = ${r.stageAPaise} WHERE slug = '${dish.slug.replace(/'/g, "''")}';`);
  }

  sql.push("COMMIT;");

  // Report.
  console.log(`\n=== Stage-A price application ${DRY_RUN ? "(DRY RUN)" : ""} ===`);
  console.log(`CSV rows: ${rows.length} · catalog dishes: ${DISHES.length} · applied: ${applied.length}`);
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  }
  if (errors.length) {
    console.error(`\n❌ ${errors.length} error(s) — NOTHING written:`);
    for (const e of errors) console.error(`  • ${e}`);
    process.exit(1);
  }

  // Safety: Ragi's price must be byte-identical afterwards.
  const ragi = catalogById.get(RAGI_ID);
  if (ragi && source.match(new RegExp(`"id":\\s*${RAGI_ID},[\\s\\S]*?"price":\\s*${ragi.price}`)) === null) {
    console.error(`\n❌ Ragi (id ${RAGI_ID}) price changed — aborting.`);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("\nDry run — no files written. Sample:");
    for (const a of applied.slice(0, 5)) console.log(`  id ${a.id} ${a.slug}: ${a.from} → ${a.to}`);
    return;
  }

  writeFileSync(CATALOG_PATH, source);
  writeFileSync(SQL_PATH, sql.join("\n") + "\n");
  console.log(`\n✅ Wrote ${applied.length} prices to lib/menu-catalog/src/index.ts`);
  console.log(`✅ Wrote ${applied.length} UPDATEs to scripts/data/stageA-prices.sql`);
  console.log(`   Ragi (id ${RAGI_ID}) left untouched, as required.`);
}

main();
