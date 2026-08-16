/**
 * BOM → food cost aggregation. PURE — no db import, so the unit test runs
 * without DATABASE_URL. menuEngineering.loadDynamicRecipeCosts does the two
 * SELECTs (it already reads inventory) and hands the rows here.
 *
 * WHY THE BOM WINS OVER THE FUZZY PATH. The recipe_ingredients route matches
 * free-text names to inventory by two-way substring (77 of 198 names resolve;
 * "whole wheat tortilla" resolved to TILL — sesame seeds — because torTILLa
 * contains "till") and parsed only gram-denominated quantities. A BOM row is
 * the opposite in both dimensions: an explicit inventory_item_id chosen by a
 * reviewed mapping, and a numeric quantity normalised to grams at authoring
 * time by scripts/src/bom-backfill.ts. Where a dish has one, it is strictly
 * better evidence.
 */

export interface BomRowInput {
  dishSlug: string;
  inventoryItemId: number;
  quantityNeeded: number;
  unit: string;
}

export interface InventoryPriceInput {
  id: number;
  perKgUnitPaise: number | null;
  buyingPricePaise: number | null;
}

export interface BomCost {
  costPaise: number;
  /** fraction (0–1) of the dish's BOM WEIGHT carried by priced items */
  coverage: number;
  unpricedItemIds: number[];
}

/** Grams per stored unit. The backfill writes grams only, but rows are data,
 *  not promises — an unknown unit poisons the dish rather than pricing wrong. */
const UNIT_TO_G: Record<string, number> = { g: 1, gm: 1, ml: 1, kg: 1000, l: 1000 };

/**
 * Per-slug cost from BOM rows. Contract mirrors FoodCostPaise's discipline:
 * a dish appears in the result ONLY when its whole BOM is usable — every row
 * in a convertible unit AND priced. A partial sum is a confident
 * understatement, which is precisely the defect the fuzzy path has (96 of
 * 116 sheet dishes silently under-costed), so it is not reproduced here.
 * Skipped dishes are reported so the caller can log them.
 */
export function aggregateBomCosts(
  bomRows: readonly BomRowInput[],
  inventory: readonly InventoryPriceInput[],
): { costs: Map<string, number>; skipped: Map<string, BomCost> } {
  const priceById = new Map(inventory.map((i) => [i.id, i.perKgUnitPaise ?? i.buyingPricePaise]));
  const byDish = new Map<string, BomRowInput[]>();
  for (const r of bomRows) {
    const list = byDish.get(r.dishSlug);
    if (list) list.push(r);
    else byDish.set(r.dishSlug, [r]);
  }

  const costs = new Map<string, number>();
  const skipped = new Map<string, BomCost>();
  for (const [slug, rows] of byDish) {
    let costPaise = 0;
    let pricedWeight = 0;
    let totalWeight = 0;
    const unpriced: number[] = [];
    let unusable = false;
    for (const r of rows) {
      const perG = UNIT_TO_G[r.unit.toLowerCase()];
      if (perG == null || !(r.quantityNeeded > 0)) {
        unusable = true;
        break;
      }
      const grams = r.quantityNeeded * perG;
      totalWeight += grams;
      const price = priceById.get(r.inventoryItemId);
      if (price == null || price <= 0) {
        unpriced.push(r.inventoryItemId);
        continue;
      }
      pricedWeight += grams;
      costPaise += Math.round((grams / 1000) * price);
    }
    const coverage = totalWeight > 0 ? pricedWeight / totalWeight : 0;
    if (!unusable && unpriced.length === 0 && costPaise > 0) {
      costs.set(slug, costPaise);
    } else {
      skipped.set(slug, { costPaise, coverage, unpricedItemIds: unpriced });
    }
  }
  return { costs, skipped };
}
