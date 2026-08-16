/**
 * Push the ingredient-derived macro estimates into `menu_items`.
 *
 * WHY THIS EXISTS. `getMergedCatalog` lets a DB row's `macros` override the
 * static catalog's. The repo's static catalog is clean — 116 dishes, 116
 * distinct macro tuples, 104 of them computed from RD-verified ingredient
 * lists (coverage ≥ 0.85, energy reconciled with Atwater to ±15%). The DB
 * still carries the old seed values, where 93 dishes share only 32 distinct
 * tuples. So the good numbers exist and are simply not the ones being served.
 *
 * The resolver fix (src/lib/macroProvenance.ts) makes the CLAIM honest — a
 * DB-supplied number can no longer wear the static catalog's "this is fact"
 * flag. This script makes the NUMBER right, which is the part that actually
 * helps a customer counting protein.
 *
 * SAFETY MODEL — menu-catalog-v2-apply.ts's, deliberately:
 *   1. Plan-only by default; `--apply` is explicit.
 *   2. Only slugs present in BOTH `ESTIMATED_MACROS` and `menu_items` are
 *      touched. No inserts, no slug invention, no deletes.
 *   3. R-3 — THE PAYLOAD IS PRICE LAW. This writes `macros` and
 *      `macros_are_estimate` and nothing else. It never reads or writes
 *      `price_paise`.
 *   4. A pre-change backup of every touched row is written before any write.
 *   5. After applying it re-reads and asserts convergence.
 *
 *   pnpm --filter @workspace/scripts run backfill-catalog-macros
 *   pnpm --filter @workspace/scripts run backfill-catalog-macros -- --apply
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { inArray } from "drizzle-orm";
import { DISHES, ESTIMATED_MACROS } from "@workspace/menu-catalog";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const MD_PATH = args.includes("--md") ? args[args.indexOf("--md") + 1] : null;

/** The jsonb shape `menu_items.macros` stores (kcal/proteinG/… naming). */
interface StoredMacros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
}

function sameMacros(a: StoredMacros | null, b: StoredMacros): boolean {
  if (!a) return false;
  return (
    a.kcal === b.kcal &&
    a.proteinG === b.proteinG &&
    a.carbsG === b.carbsG &&
    a.fatG === b.fatG &&
    (a.fiberG ?? 0) === (b.fiberG ?? 0)
  );
}

async function main(): Promise<void> {
  const { db, menuItemsTable } = await import("@workspace/db");

  const desired = new Map<string, StoredMacros>();
  for (const [slug, m] of Object.entries(ESTIMATED_MACROS)) {
    desired.set(slug, {
      kcal: m.calories,
      proteinG: m.protein,
      carbsG: m.carbs,
      fatG: m.fat,
      fiberG: m.fiber ?? 0,
    });
  }

  const rows = await db
    .select({
      id: menuItemsTable.id,
      slug: menuItemsTable.slug,
      macros: menuItemsTable.macros,
      macrosAreEstimate: menuItemsTable.macrosAreEstimate,
    })
    .from(menuItemsTable);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const updates: Array<{
    slug: string;
    from: StoredMacros | null;
    to: StoredMacros;
    flagFrom: boolean;
  }> = [];
  const alreadyCorrect: string[] = [];
  const noDbRow: string[] = [];

  for (const [slug, to] of desired) {
    const row = bySlug.get(slug);
    if (!row) {
      // The estimate exists but this dish has no menu_items row, so the
      // static value is already what the resolver serves — nothing to do.
      noDbRow.push(slug);
      continue;
    }
    const from = row.macros as StoredMacros | null;
    if (sameMacros(from, to) && row.macrosAreEstimate) {
      alreadyCorrect.push(slug);
      continue;
    }
    updates.push({ slug, from, to, flagFrom: row.macrosAreEstimate });
  }

  // Duplicate-tuple census on what the DB is serving TODAY, so the plan shows
  // the defect it is closing rather than asserting it.
  const liveKey = (m: StoredMacros | null) =>
    m ? `${m.kcal}|${m.proteinG}|${m.carbsG}|${m.fatG}` : null;
  const liveCounts = new Map<string, number>();
  for (const r of rows) {
    const k = liveKey(r.macros as StoredMacros | null);
    if (k) liveCounts.set(k, (liveCounts.get(k) ?? 0) + 1);
  }
  const sharedTuples = [...liveCounts.values()].filter((n) => n > 1);
  const dishesOnSharedTuples = sharedTuples.reduce((a, b) => a + b, 0);

  const L: string[] = [];
  L.push("# Catalog macro backfill plan");
  L.push("");
  L.push("| | |");
  L.push("|---|---:|");
  L.push(`| menu_items rows | ${rows.length} |`);
  L.push(`| ingredient-derived estimates available | ${desired.size} |`);
  L.push(`| **rows to update** | **${updates.length}** |`);
  L.push(`| already correct | ${alreadyCorrect.length} |`);
  L.push(`| estimate exists but no DB row (static already serves it) | ${noDbRow.length} |`);
  L.push("");
  L.push("## The defect this closes, measured on the live table");
  L.push("");
  L.push(`| | |`);
  L.push(`|---|---:|`);
  L.push(`| distinct macro tuples in menu_items | ${liveCounts.size} |`);
  L.push(`| tuples shared by >1 dish | ${sharedTuples.length} |`);
  L.push(`| **dishes carrying a shared tuple** | **${dishesOnSharedTuples}** |`);
  L.push("");
  L.push("Every one of those dishes currently renders no numbers at all —");
  L.push("the storefront's shared-tuple gate withholds them (flipbook F-1).");
  L.push("");
  if (updates.length > 0) {
    L.push("## Updates");
    L.push("");
    L.push("| slug | from | to |");
    L.push("|---|---|---|");
    for (const u of updates) {
      const f = u.from
        ? `${u.from.kcal} kcal · ${u.from.proteinG}P · ${u.from.carbsG}C · ${u.from.fatG}F`
        : "_(none)_";
      L.push(
        `| ${u.slug} | ${f} | ${u.to.kcal} kcal · ${u.to.proteinG}P · ${u.to.carbsG}C · ${u.to.fatG}F |`,
      );
    }
    L.push("");
  }
  L.push("All written values are flagged `macros_are_estimate = true`: these are");
  L.push("computed from recipes, not RD-verified lab numbers, and the card must");
  L.push("keep saying so with the ≈ marker.");

  const rendered = L.join("\n");
  console.log(rendered);
  if (MD_PATH) writeFileSync(resolve(MD_PATH), rendered + "\n");

  if (!APPLY) {
    console.log("\nplan-only — pass --apply to write.");
    return;
  }
  if (updates.length === 0) {
    console.log("\nnothing to apply.");
    return;
  }

  const touched = updates.map((u) => u.slug);
  const backup = rows.filter((r) => touched.includes(r.slug));
  const backupPath = resolve(
    `macro-backfill-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nbackup of ${backup.length} row(s) → ${backupPath}`);

  await db.transaction(async (tx) => {
    for (const u of updates) {
      // Only these two columns. Never price (R-3).
      await tx
        .update(menuItemsTable)
        .set({ macros: u.to, macrosAreEstimate: true })
        .where(inArray(menuItemsTable.slug, [u.slug]));
    }
  });
  console.log(`applied: ${updates.length} row(s) updated.`);

  const after = await db
    .select({
      slug: menuItemsTable.slug,
      macros: menuItemsTable.macros,
      macrosAreEstimate: menuItemsTable.macrosAreEstimate,
    })
    .from(menuItemsTable)
    .where(inArray(menuItemsTable.slug, touched));
  const afterBySlug = new Map(after.map((r) => [r.slug, r]));
  let diverged = 0;
  for (const u of updates) {
    const a = afterBySlug.get(u.slug);
    if (!a || !sameMacros(a.macros as StoredMacros | null, u.to) || !a.macrosAreEstimate) {
      diverged += 1;
    }
  }
  if (diverged > 0) {
    console.error(`NON-CONVERGENT APPLY: ${diverged} row(s) still differ.`);
    process.exit(1);
  }
  console.log("convergence check passed.");

  // Report the duplicate census again so the run's own log shows the effect.
  const post = await db.select({ macros: menuItemsTable.macros }).from(menuItemsTable);
  const postCounts = new Map<string, number>();
  for (const r of post) {
    const k = liveKey(r.macros as StoredMacros | null);
    if (k) postCounts.set(k, (postCounts.get(k) ?? 0) + 1);
  }
  const postShared = [...postCounts.values()].filter((n) => n > 1).reduce((a, b) => a + b, 0);
  console.log(
    `dishes on a shared macro tuple: ${dishesOnSharedTuples} → ${postShared}`,
  );
}

// Referenced so the static catalog stays a declared dependency of this
// script's contract: ESTIMATED_MACROS is keyed by the same slugs DISHES uses.
void DISHES;

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
