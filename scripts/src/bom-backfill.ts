/**
 * BOM backfill — plan-then-apply for `dish_bom_components`, the structured
 * ingredient model that has three production readers (bomEngine,
 * marginGuardrailEngine) and had no writer of any kind.
 *
 * SAFETY MODEL (menu-catalog-v2-apply.ts's, deliberately):
 *   1. Plan-only by default; `--apply` is explicit.
 *   2. The plan derives ONLY from reviewed inputs: the RD sheet + the
 *      bom-ingredient-map.csv rows a human flipped to `accepted`. A dish with
 *      any unresolved line contributes NOTHING (a partial BOM is a silently
 *      understated cost — the defect this work exists to fix).
 *   3. Slug fence: a dish joins the catalog by exact name, falling back to
 *      the seed's normalised join only when unambiguous. Unmatched AND
 *      ambiguous dishes are BLOCKED and reported. No slugify() here.
 *   4. Apply touches only the slugs this plan has an opinion about; foreign
 *      rows (other tools', other tests') are left alone. Rows on a planned
 *      slug that is no longer derivable are RETRACTED and listed separately
 *      from ordinary row churn. A pre-change backup of every touched row is
 *      always written.
 *   5. After applying, it re-plans and asserts convergence to zero actions.
 *
 * Modes:
 *   (default)            plan against the DB (needs DATABASE_URL)
 *   --offline            plan without a DB (derived state only, no diff)
 *   --report             read-only production report: BOM row count, distinct
 *                        slugs, unit vocabulary, plus recipes.calories_kcal
 *                        coverage — the two Phase 0 questions from
 *                        docs/TNM-MENU-01/PANTS-INTEGRATION-PLAN.md
 *   --assume-accepted    PREVIEW ONLY: treat `proposed` mapping rows as
 *                        accepted to show what full review would yield.
 *                        Refused in combination with --apply.
 *   --apply              write ready dishes' rows
 *   --md <path>          also write the plan as markdown
 *
 *   pnpm --filter @workspace/scripts run bom-backfill            # plan
 *   pnpm --filter @workspace/scripts run bom-backfill -- --apply
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { inArray, isNotNull, sql } from "drizzle-orm";
import {
  buildBomPlan,
  loadMapping,
  type BomPlan,
  type MappingRow,
  type SheetDishInput,
  type SheetInventoryInput,
} from "./lib/bomPlan";

const DATA_DIR = resolve(process.cwd(), "data");
const SHEET_PATH = resolve(DATA_DIR, "kitchen-data-collection.json");
const CSV_PATH = resolve(DATA_DIR, "bom-ingredient-map.csv");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const OFFLINE = args.includes("--offline");
const REPORT = args.includes("--report");
const ASSUME = args.includes("--assume-accepted");
const MD_PATH = args.includes("--md") ? args[args.indexOf("--md") + 1] : null;

if (APPLY && ASSUME) {
  console.error(
    "--assume-accepted is a preview device and can never reach --apply: " +
      "unreviewed rows must not write production state.",
  );
  process.exit(1);
}
if (APPLY && OFFLINE) {
  console.error("--apply needs the database; it cannot be combined with --offline.");
  process.exit(1);
}

interface SheetData {
  dishes: SheetDishInput[];
  inventory: SheetInventoryInput[];
}

/**
 * `@workspace/db` throws at import time without DATABASE_URL, which is
 * correct for every writer — but `--offline` exists precisely so the plan can
 * run in environments with no database (sandboxes, PR review). So the module
 * loads lazily, only on the paths that genuinely need a connection.
 */
async function loadDb() {
  return await import("@workspace/db");
}
type DbModule = Awaited<ReturnType<typeof loadDb>>;

function loadInputs(): {
  sheet: SheetData;
  inventoryByNo: Map<number, string>;
  mapping: Map<string, MappingRow>;
} {
  const sheet: SheetData = JSON.parse(readFileSync(SHEET_PATH, "utf8"));
  const inventoryByNo = new Map<number, string>();
  for (const r of sheet.inventory) {
    const no = Number(r.no);
    const product = (r.product || "").trim();
    if (Number.isFinite(no) && product) inventoryByNo.set(Math.trunc(no), product);
  }
  const loaded = loadMapping(readFileSync(CSV_PATH, "utf8"), inventoryByNo);
  if (loaded.errors.length > 0) {
    console.error(`mapping CSV has ${loaded.errors.length} structural error(s):`);
    for (const e of loaded.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  let mapping = loaded.rows;
  if (ASSUME) {
    mapping = new Map(
      [...mapping].map(([k, r]) => [k, { ...r, status: "accepted" as const }]),
    );
  }
  return { sheet, inventoryByNo, mapping };
}

function renderPlan(plan: BomPlan): string {
  const L: string[] = [];
  const s = plan.stats;
  L.push(`# BOM backfill plan${ASSUME ? " — PREVIEW (--assume-accepted, NOT applyable)" : ""}`);
  L.push("");
  L.push(`| | |`);
  L.push(`|---|---:|`);
  L.push(`| sheet dishes | ${s.sheetDishes} |`);
  L.push(`| ready (full BOM derivable) | ${s.ready} |`);
  L.push(`| incomplete (unresolved lines) | ${s.incomplete} |`);
  L.push(`| blocked — no catalog slug | ${s.blockedNoSlug} |`);
  L.push(`| blocked — AMBIGUOUS catalog slug | ${s.blockedAmbiguous} |`);
  L.push(`| no ingredients on sheet | ${s.noIngredients} |`);
  L.push(`| planned BOM rows | ${s.plannedRows} |`);
  L.push(`| distinct inventory items used | ${s.distinctItemsUsed} |`);
  L.push("");

  if (plan.ready.length > 0) {
    L.push(`## Ready dishes (${plan.ready.length})`);
    L.push("");
    L.push(`Serving basis: quantities are per ONE sellable unit — the sheet's`);
    L.push(`serving size, shown per dish so the kitchen can veto the assumption.`);
    L.push("");
    for (const d of plan.ready) {
      L.push(`### ${d.sheetName} → \`${d.slug}\` ${d.servingSize ? `(serves: ${d.servingSize})` : "(serving size unstated)"}`);
      for (const r of d.rows) L.push(`- #${r.itemNo} ${r.product}: **${r.grams} g** ← ${r.from.join(" + ")}`);
      if (d.noCost.length) L.push(`- _no-cost:_ ${d.noCost.join(" · ")}`);
      if (d.compoundAssumptions.length)
        for (const c of d.compoundAssumptions)
          L.push(`- ⚠ compound: took "${c.took}", dropped "${c.dropped}" (${c.raw})`);
      L.push("");
    }
  }

  const incomplete = plan.dishes.filter((d) => d.status === "incomplete");
  if (incomplete.length > 0) {
    L.push(`## Incomplete dishes (${incomplete.length}) — emit NO rows`);
    L.push("");
    const reasonCount = new Map<string, number>();
    for (const d of incomplete)
      for (const u of d.unresolved)
        reasonCount.set(u.key, (reasonCount.get(u.key) ?? 0) + 1);
    L.push(`Most-blocking ingredient keys:`);
    for (const [k, n] of [...reasonCount].sort((a, b) => b[1] - a[1]).slice(0, 25))
      L.push(`- ${k} (blocks ${n} dish${n === 1 ? "" : "es"})`);
    L.push("");
    for (const d of incomplete) {
      const why = [
        ...d.unresolved.map((u) => `${u.key}: ${u.reason}`),
        ...d.zeroGram.map((z) => `zero-gram: ${z}`),
      ];
      L.push(`- **${d.sheetName}** (${d.slug ?? "no slug"}): ${why.join("; ")}`);
    }
    L.push("");
  }

  const blocked = plan.dishes.filter((d) => d.status === "blocked-no-slug");
  if (blocked.length > 0) {
    L.push(`## Blocked — sheet name joins no catalog dish (${blocked.length})`);
    L.push("");
    L.push(`These get NO invented slug. Fix the sheet name or the catalog.`);
    for (const d of blocked) L.push(`- ${d.sheetName}`);
    L.push("");
  }

  const ambiguous = plan.dishes.filter((d) => d.status === "blocked-ambiguous-slug");
  if (ambiguous.length > 0) {
    L.push(`## Blocked — sheet name matches SEVERAL catalog dishes (${ambiguous.length})`);
    L.push("");
    L.push(
      `The normalised join drops parentheticals, which is what distinguishes` +
        ` these dish families. Guessing would hand one variant's ingredients to` +
        ` another's slug, so they are blocked until the sheet name matches a` +
        ` catalog name exactly.`,
    );
    for (const d of ambiguous) L.push(`- ${d.sheetName}`);
    L.push("");
  }
  return L.join("\n");
}

async function report(dbm: DbModule): Promise<void> {
  const { db, dishBomComponentsTable, inventoryItemsTable, recipesTable } = dbm;
  const [bomCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(dishBomComponentsTable);
  const [bomSlugs] = await db
    .select({ n: sql<number>`count(distinct dish_slug)::int` })
    .from(dishBomComponentsTable);
  const units = await db
    .select({ unit: dishBomComponentsTable.unit, n: sql<number>`count(*)::int` })
    .from(dishBomComponentsTable)
    .groupBy(dishBomComponentsTable.unit);
  const [zeroQty] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(dishBomComponentsTable)
    .where(sql`quantity_needed <= 0 or quantity_needed is null`);
  const [invCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(inventoryItemsTable);
  const [recipesWithKcal] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(recipesTable)
    .where(isNotNull(recipesTable.caloriesKcal));
  const [recipesTotal] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(recipesTable);

  console.log("=== dish_bom_components — production state (Phase 0, blocker 7) ===");
  console.log(`BOM rows                 : ${bomCount?.n ?? 0}`);
  console.log(`distinct dish slugs      : ${bomSlugs?.n ?? 0}`);
  console.log(`unit vocabulary          : ${units.map((u) => `${u.unit}×${u.n}`).join(" ") || "(none)"}`);
  console.log(`zero/null quantity rows  : ${zeroQty?.n ?? 0}`);
  console.log(`inventory_items rows     : ${invCount?.n ?? 0}`);
  console.log("");
  console.log("=== recipes nutrition columns (Phase 0, question 2) ===");
  console.log(`recipes rows             : ${recipesTotal?.n ?? 0}`);
  console.log(`with calories_kcal set   : ${recipesWithKcal?.n ?? 0}  ` +
    `(these inherited the F-1 catalog macros via seed-ops-data)`);
  if ((bomCount?.n ?? 0) === 0) {
    console.log(
      "\nBOM table is EMPTY: bomEngine depletion, the 4 AM prep brief, PO drafting " +
        "and marginGuardrailEngine spike tracing are all currently silent no-ops.",
    );
  }
}

interface DesiredRow {
  slug: string;
  itemNo: number;
  grams: number;
}

async function main(): Promise<void> {
  if (REPORT) {
    await report(await loadDb());
    return;
  }

  const { sheet, inventoryByNo, mapping } = loadInputs();
  const plan = buildBomPlan({ dishes: sheet.dishes, inventoryByNo, mapping });
  const rendered = renderPlan(plan);
  console.log(rendered);
  if (MD_PATH) writeFileSync(resolve(MD_PATH), rendered + "\n");

  if (OFFLINE) return;

  const { db, dishBomComponentsTable, inventoryItemsTable } = await loadDb();

  // Resolve item_no → inventory_items.id at plan time, against the LIVE
  // table — ids are serial and seed-ops-data reseeds by delete+insert, so a
  // stored id would rot. A duplicated item_no is a data defect we refuse to
  // guess through.
  const invRows = await db
    .select({
      id: inventoryItemsTable.id,
      itemNo: inventoryItemsTable.itemNo,
      product: inventoryItemsTable.product,
    })
    .from(inventoryItemsTable);
  const idByItemNo = new Map<number, number>();
  const productByItemNo = new Map<number, string>();
  const dupes = new Set<number>();
  for (const r of invRows) {
    if (idByItemNo.has(r.itemNo)) dupes.add(r.itemNo);
    idByItemNo.set(r.itemNo, r.id);
    productByItemNo.set(r.itemNo, r.product);
  }

  const desired: DesiredRow[] = plan.ready.flatMap((d) =>
    d.rows.map((r) => ({ slug: d.slug!, itemNo: r.itemNo, grams: r.grams })),
  );
  const usedDupes = desired.filter((r) => dupes.has(r.itemNo));
  if (usedDupes.length > 0) {
    console.error(
      `REFUSING: item_no values duplicated in inventory_items: ` +
        `${[...new Set(usedDupes.map((r) => r.itemNo))].join(", ")} — ` +
        `resolve the duplicate rows before applying.`,
    );
    process.exit(1);
  }
  const missing = desired.filter((r) => !idByItemNo.has(r.itemNo));
  if (missing.length > 0) {
    console.error(
      `REFUSING: mapped item_no values absent from inventory_items (reseed drift?): ` +
        `${[...new Set(missing.map((r) => r.itemNo))].join(", ")} — ` +
        `run seed-ops-data --apply first, then re-plan.`,
    );
    process.exit(1);
  }

  // MEANING DRIFT, not just id rot. The CSV's product column proves the
  // mapping still agrees with the SHEET; it says nothing about the
  // DATABASE. `item_no` is a row counter, so inserting or deleting a row
  // mid-sheet renumbers everything after it — and production keeps the OLD
  // numbering until seed-ops-data runs again. In that window every id
  // resolves (nothing is missing or duplicated) while pointing at the wrong
  // ingredient: paneer grams land on the olive-oil row, depletion and PO
  // drafting follow, and the convergence check happily agrees because it
  // compares the database against the same wrong plan. So compare the DB's
  // own product name for every item this plan intends to write. The rows
  // are already in hand from the SELECT above; not comparing them was the
  // whole gap.
  const productDrift = [
    ...new Set(desired.map((r) => r.itemNo)),
  ].flatMap((no) => {
    const dbProduct = productByItemNo.get(no);
    const sheetProduct = inventoryByNo.get(no);
    if (dbProduct == null || sheetProduct == null) return [];
    return dbProduct.trim().toLowerCase() === sheetProduct.trim().toLowerCase()
      ? []
      : [{ no, dbProduct, sheetProduct }];
  });
  if (productDrift.length > 0) {
    console.error(
      `REFUSING: ${productDrift.length} item_no value(s) name a DIFFERENT product in the database than on the sheet.\n` +
        `The sheet has been renumbered since the last seed, so applying now would write BOM rows against the wrong ingredients:`,
    );
    for (const d of productDrift)
      console.error(`  - item_no ${d.no}: database says "${d.dbProduct}", sheet says "${d.sheetProduct}"`);
    console.error(`Run seed-ops-data --apply to bring the database to the current sheet, then re-plan.`);
    process.exit(1);
  }

  // RETRACTION. The touched set is every slug this plan has an opinion
  // about, not just the ones it wants rows for. A dish that WAS ready on a
  // previous run and has since fallen out (an ingredient line edited into
  // ambiguity, a mapping row reverted to `proposed`) must have its stale
  // rows deleted — otherwise they persist invisibly and, because the BOM
  // overlay outranks the fuzzy path, keep authoritatively costing a dish
  // from a recipe that no longer describes it. Scoping deletes to `desired`
  // alone would make "no longer derivable" indistinguishable from "leave
  // production as it is".
  const plannedSlugs = new Set(
    plan.dishes.map((d) => d.slug).filter((s): s is string => s != null),
  );
  const touchedSlugs = [...plannedSlugs];
  const existing = touchedSlugs.length
    ? await db
        .select()
        .from(dishBomComponentsTable)
        .where(inArray(dishBomComponentsTable.dishSlug, touchedSlugs))
    : [];

  // Diff on the (slug, item id) unique key the table itself enforces.
  const desiredByKey = new Map(
    desired.map((r) => [`${r.slug}|${idByItemNo.get(r.itemNo)!}`, r]),
  );
  const existingByKey = new Map(
    existing.map((r) => [`${r.dishSlug}|${r.inventoryItemId}`, r]),
  );
  const creates = [...desiredByKey].filter(([k]) => !existingByKey.has(k));
  const updates = [...desiredByKey].filter(([k, r]) => {
    const e = existingByKey.get(k);
    return e && (e.quantityNeeded !== r.grams || e.unit !== "g");
  });
  const deletes = [...existingByKey].filter(([k]) => !desiredByKey.has(k));

  // Split the deletes so a RETRACTION is never mistaken for a tidy-up. Rows
  // on a slug this plan still considers ready are ordinary row-level churn;
  // rows on a planned-but-NOT-ready slug are the whole dish's BOM going
  // away, which is a much larger claim and deserves to be read before it is
  // approved. It also covers hand-authored rows: this tool owns every slug
  // it plans, so a manually-added row on a sheet dish WILL be removed here.
  // The backup written below is the recovery path, and this print is the
  // warning that you may need it.
  const readySlugs = new Set(plan.ready.map((d) => d.slug!));
  const retractions = deletes.filter(([, e]) => !readySlugs.has(e.dishSlug));
  const churnDeletes = deletes.filter(([, e]) => readySlugs.has(e.dishSlug));

  console.log(`\n=== diff vs database (touched slugs: ${touchedSlugs.length}) ===`);
  console.log(
    `creates: ${creates.length} · updates: ${updates.length} · ` +
      `deletes-within-ready-dishes: ${churnDeletes.length} · retractions: ${retractions.length}`,
  );
  if (retractions.length > 0) {
    const bySlug = new Map<string, number>();
    for (const [, e] of retractions) bySlug.set(e.dishSlug, (bySlug.get(e.dishSlug) ?? 0) + 1);
    console.log(
      `  RETRACTING the full BOM of ${bySlug.size} dish(es) that are no longer derivable ` +
        `(or whose rows were authored outside this tool):`,
    );
    for (const [slug, n] of bySlug) console.log(`    - ${slug} (${n} row(s))`);
  }

  if (!APPLY) {
    console.log("\nplan-only — pass --apply to write.");
    return;
  }
  if (ASSUME) throw new Error("unreachable"); // guarded at argv parse
  if (creates.length === 0 && updates.length === 0 && deletes.length === 0) {
    console.log("nothing to do — database already matches the plan.");
    return;
  }

  // Pre-change backup of every row on a touched slug — reversal source.
  const backupPath = resolve(`bom-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(backupPath, JSON.stringify(existing, null, 2));
  console.log(`backup of ${existing.length} existing row(s) → ${backupPath}`);

  await db.transaction(async (tx) => {
    if (deletes.length) {
      const ids = deletes.map(([, e]) => e.id);
      await tx.delete(dishBomComponentsTable).where(inArray(dishBomComponentsTable.id, ids));
    }
    for (const [, r] of [...creates, ...updates]) {
      await tx
        .insert(dishBomComponentsTable)
        .values({
          dishSlug: r.slug,
          inventoryItemId: idByItemNo.get(r.itemNo)!,
          quantityNeeded: r.grams,
          unit: "g",
        })
        .onConflictDoUpdate({
          target: [dishBomComponentsTable.dishSlug, dishBomComponentsTable.inventoryItemId],
          set: { quantityNeeded: r.grams, unit: "g" },
        });
    }
  });
  console.log(`applied: ${creates.length} created, ${updates.length} updated, ${deletes.length} deleted.`);

  // Convergence: the same plan against the new state must show zero actions.
  const after = await db
    .select()
    .from(dishBomComponentsTable)
    .where(inArray(dishBomComponentsTable.dishSlug, touchedSlugs));
  const afterByKey = new Map(after.map((r) => [`${r.dishSlug}|${r.inventoryItemId}`, r]));
  let diverged = 0;
  for (const [k, r] of desiredByKey) {
    const e = afterByKey.get(k);
    if (!e || e.quantityNeeded !== r.grams || e.unit !== "g") diverged += 1;
  }
  diverged += [...afterByKey.keys()].filter((k) => !desiredByKey.has(k)).length;
  if (diverged > 0) {
    console.error(`NON-CONVERGENT APPLY: ${diverged} key(s) still differ — investigate before trusting the table.`);
    process.exit(1);
  }
  console.log("convergence check passed: database matches the plan exactly.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
