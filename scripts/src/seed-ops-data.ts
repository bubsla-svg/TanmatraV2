/**
 * Seed the kitchen/ops reference tables from the RD-verified master sheet.
 *
 * Source of truth: scripts/data/kitchen-data-collection.json — the parsed
 * "Tanmatra Kitchen Data Collection Sheet" (all tabs). This replaces the older
 * one-off pasted-text snapshots under attached_assets/, so the ops tables track
 * the live sheet instead of a stale copy.
 *
 * Populates (truncate-and-reseed — these are sheet-derived reference tables):
 *   - inventory_items   ← INVENTORY tab (product, buying qty/price, per-kg, per-100g)
 *   - packaging_items   ← PACKAGING tab (SKU + price per piece)
 *   - recipes           ← Dishes tab + MENU food cost + RECIPE method, with the
 *                          nutrition label taken from the corrected calculator
 *                          (menu-catalog macros)
 *   - recipe_ingredients← each dish's RD-verified ingredient list
 *
 * Dry-run by default (prints row counts + samples and never touches the DB).
 * Pass --apply to write. Run where DATABASE_URL egress is available:
 *   pnpm --filter @workspace/scripts exec tsx ./src/seed-ops-data.ts            # dry-run
 *   pnpm --filter @workspace/scripts exec tsx ./src/seed-ops-data.ts --apply    # write
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import {
  db,
  dishBomComponentsTable,
  inventoryItemsTable,
  packagingItemsTable,
  recipeIngredientsTable,
  recipesTable,
} from "@workspace/db";
import { DISHES } from "@workspace/menu-catalog";

const DATA_PATH = resolve(process.cwd(), "data", "kitchen-data-collection.json");
const APPLY = process.argv.includes("--apply");

interface SheetDish {
  name: string;
  servingSize: string;
  ingredients: string[];
  allergens: string[];
}
interface SheetInventory {
  no: string;
  product: string;
  qty: string;
  buyingPrice: string;
  perKgUnit: string;
  per100gPcs: string;
  extra: string;
}
interface SheetPackaging {
  no: string;
  item: string;
  pricePcs: string;
}
interface SheetData {
  dishes: SheetDish[];
  inventory: SheetInventory[];
  packaging: SheetPackaging[];
  menuFoodCostRaw: string[][];
  recipeProse: string[];
}

const sheet: SheetData = JSON.parse(readFileSync(DATA_PATH, "utf8"));

/** First number in a string ("420.0", "6 PER PCS", "₹12") → paise, else null. */
function toPaise(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const m = String(raw).match(/[\d.]+/);
  if (!m) return null;
  const v = Number(m[0]);
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

function intNo(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Normalized dish-name key for cross-tab matching (drops "(o)", parens, etc.). */
function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(o\)/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 240);
}

const catByName = new Map(DISHES.map((d) => [normName(d.name), d]));

// ── inventory_items ──────────────────────────────────────────────────────────
function inventoryRows(): Array<typeof inventoryItemsTable.$inferInsert> {
  const out: Array<typeof inventoryItemsTable.$inferInsert> = [];
  for (const r of sheet.inventory) {
    const itemNo = intNo(r.no);
    const product = (r.product || "").trim();
    if (itemNo == null || !product) continue; // skip blank spacer rows
    out.push({
      itemNo,
      product,
      buyingQty: r.qty || null,
      buyingPricePaise: toPaise(r.buyingPrice),
      perKgUnitPaise: toPaise(r.perKgUnit),
      pricePer100GmPcsLabel: r.per100gPcs || null,
      pricePer10GmLabel: r.extra || null,
    });
  }
  return out;
}

// ── packaging_items ──────────────────────────────────────────────────────────
function packagingRows(): Array<typeof packagingItemsTable.$inferInsert> {
  const out: Array<typeof packagingItemsTable.$inferInsert> = [];
  for (const r of sheet.packaging) {
    const itemNo = intNo(r.no);
    const name = (r.item || "").trim();
    if (itemNo == null || !name) continue;
    out.push({ itemNo, name, pricePerPiecePaise: toPaise(r.pricePcs) });
  }
  return out;
}

// ── recipe method (from the RECIPE prose tab) keyed by normalized name ────────
function methodsByName(): Map<string, string> {
  const map = new Map<string, string>();
  const headerRe = /^(\d+)\.\s+(.+?)\s*$/;
  const methodRe = /^Method\s*:?\s*$/i;
  const stepRe = /^\d+\.\s*(.+)$/;
  let name: string | null = null;
  let inMethod = false;
  let buf: string[] = [];
  const flush = () => {
    if (name && buf.length) map.set(normName(name), buf.join("\n"));
    buf = [];
  };
  for (const raw of sheet.recipeProse) {
    const line = raw.replace(/^·\s*/, "").trim();
    if (!line) continue;
    const h = headerRe.exec(line);
    // A header is "N. Title" with no trailing sentence punctuation.
    if (h && !/[.,;:]$/.test(h[2]) && !inMethod) {
      flush();
      name = h[2].trim();
      continue;
    }
    if (methodRe.test(line)) {
      inMethod = true;
      continue;
    }
    if (h && !/[.,;:]$/.test(h[2]) && inMethod) {
      // next dish header ends the current method block
      flush();
      name = h[2].trim();
      inMethod = false;
      continue;
    }
    if (inMethod) {
      const step = stepRe.exec(line);
      if (step) buf.push(step[1].trim());
      else if (buf.length) buf[buf.length - 1] += " " + line;
    }
  }
  flush();
  return map;
}

// ── food cost (from the MENU tab) keyed by normalized name ────────────────────
function foodCostByName(): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of sheet.menuFoodCostRaw.slice(1)) {
    const name = (row[0] || "").trim();
    if (!name || /^menu/i.test(name)) continue;
    for (let i = 1; i < row.length; i++) {
      const v = Number(row[i]);
      if (Number.isFinite(v) && v > 0) {
        map.set(normName(name), Math.round(v * 100));
        break;
      }
    }
  }
  return map;
}

interface BuiltRecipe {
  recipe: typeof recipesTable.$inferInsert;
  ingredients: Array<Omit<typeof recipeIngredientsTable.$inferInsert, "recipeId">>;
  matchedCatalog: boolean;
  hasMethod: boolean;
  hasCost: boolean;
}

function recipeRows(): BuiltRecipe[] {
  const methods = methodsByName();
  const costs = foodCostByName();
  const seen = new Set<string>();
  return sheet.dishes.map((dish, i) => {
    const key = normName(dish.name);
    const cat = catByName.get(key);
    let slug = cat?.slug ?? slugify(dish.name);
    while (seen.has(slug)) slug = `${slug}-x`;
    seen.add(slug);
    const m = cat?.macros;
    const method = methods.get(key) ?? "";
    const cost = costs.get(key) ?? null;
    return {
      recipe: {
        recipeNo: i + 1,
        name: dish.name,
        slug,
        servingSize: dish.servingSize || null,
        method,
        foodCostPaise: cost,
        caloriesKcal: m?.calories ?? null,
        proteinG: m?.protein ?? null,
        carbsG: m?.carbs ?? null,
        fatG: m?.fat ?? null,
        fiberG: m?.fiber ?? null,
        glycaemicIndex: cat?.glycaemicIndex ?? null,
        allergens: dish.allergens ?? [],
      },
      ingredients: (dish.ingredients ?? []).map((rawText, idx) => {
        const parts = rawText.split(/\s[–—-]\s/);
        return {
          position: idx,
          rawText: rawText.slice(0, 256),
          ingredient: (parts[0] ?? rawText).trim().slice(0, 128),
          quantityText:
            parts.length >= 2 ? parts.slice(1).join(" - ").trim().slice(0, 64) : null,
        };
      }),
      matchedCatalog: Boolean(cat),
      hasMethod: method.length > 0,
      hasCost: cost != null,
    };
  });
}

async function main() {
  const inventory = inventoryRows();
  const packaging = packagingRows();
  const recipes = recipeRows();

  console.log("=== Kitchen master-sheet → ops reference tables ===\n");
  console.log(`inventory_items : ${inventory.length} rows`);
  console.log(`packaging_items : ${packaging.length} rows`);
  console.log(`recipes         : ${recipes.length} rows`);
  console.log(
    `  ├─ matched to catalog (macros/GI): ${recipes.filter((r) => r.matchedCatalog).length}`,
  );
  console.log(`  ├─ with cooking method: ${recipes.filter((r) => r.hasMethod).length}`);
  console.log(`  └─ with food cost:      ${recipes.filter((r) => r.hasCost).length}`);

  const sampleInv = inventory[0];
  const samplePack = packaging[0];
  const sampleRec = recipes.find((r) => r.recipe.slug === "quinoa-upma") ?? recipes[0];
  console.log("\nsample inventory  :", JSON.stringify(sampleInv));
  console.log("sample packaging  :", JSON.stringify(samplePack));
  console.log(
    "sample recipe     :",
    JSON.stringify({
      ...sampleRec.recipe,
      method: sampleRec.recipe.method ? `${sampleRec.recipe.method.slice(0, 48)}…` : "",
    }),
  );
  console.log(`sample recipe ings: ${sampleRec.ingredients.length} lines`);

  if (!APPLY) {
    console.log("\n(dry-run — no rows written. Pass --apply to seed the database.)");
    return;
  }

  // CASCADE TRAP (docs/TNM-MENU-01/BOM-ADOPTION.md, blocker 8): deleting
  // inventory_items cascades into dish_bom_components (its FK is ON DELETE
  // CASCADE), so this truncate-and-reseed silently wipes the entire BOM —
  // and with it real-time depletion, the prep brief, PO drafting and the
  // margin guardrail, all of which no-op on an empty table rather than fail.
  // The reseed itself is fine (the BOM is re-derivable); going quiet about
  // it is not. Count first, warn loudly, and say what to run afterwards.
  const [bomRows] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(dishBomComponentsTable);
  const bomCount = bomRows?.n ?? 0;
  if (bomCount > 0) {
    console.log(
      `\n*** WARNING: deleting inventory_items will CASCADE-DELETE all ` +
        `${bomCount} dish_bom_components rows. ***\n` +
        `*** After this seed completes, re-run the "BOM backfill" workflow ` +
        `with apply=true to restore them. ***`,
    );
  }

  console.log("\nApplying: clearing existing ops reference data…");
  await db.delete(recipeIngredientsTable);
  await db.delete(recipesTable);
  await db.delete(inventoryItemsTable);
  await db.delete(packagingItemsTable);

  if (packaging.length) await db.insert(packagingItemsTable).values(packaging);
  if (inventory.length) await db.insert(inventoryItemsTable).values(inventory);
  for (const r of recipes) {
    const [row] = await db
      .insert(recipesTable)
      .values(r.recipe)
      .returning({ id: recipesTable.id });
    if (r.ingredients.length && row) {
      await db
        .insert(recipeIngredientsTable)
        .values(r.ingredients.map((ing) => ({ ...ing, recipeId: row.id })));
    }
  }
  console.log(
    `Done. Seeded ${packaging.length} packaging, ${inventory.length} inventory, ${recipes.length} recipes.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
