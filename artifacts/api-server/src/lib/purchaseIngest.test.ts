/**
 * Purchase-ingest tests — everything up to (but not including) the DB write.
 *
 * These cover the parts that decide what a plate actually costs, so they are
 * where a unit-conversion or name-matching mistake would otherwise reach
 * `menuEngineering`'s margins and `reorder`'s PO totals unnoticed.
 *
 * `applyPurchaseIngest` needs Postgres and is exercised in CI's DB job, not here.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PetpoojaPurchaseLine } from "./petpoojaInventory";

// Set before importing: @workspace/db throws at import time without it.
process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const {
  aggregatePurchaseLines,
  canonicalUnit,
  matchInventoryItem,
  normalizeProductName,
  planPurchaseIngest,
  purchaseWindow,
  PRICE_SANITY_FACTOR,
} = await import("./purchaseIngest");

function line(over: Partial<PetpoojaPurchaseLine> = {}): PetpoojaPurchaseLine {
  const base: PetpoojaPurchaseLine = {
    product: "Paneer",
    qty: 1,
    unit: "kg",
    unitPricePaise: 32000,
    lineTotalPaise: 32000,
    supplierName: null,
    invoiceNo: null,
    invoiceDate: null,
  };
  return { ...base, ...over };
}

describe("canonicalUnit", () => {
  it("folds the mass family onto kilograms", () => {
    assert.deepEqual(canonicalUnit("KG"), { canonical: "kg", kgPerUnit: 1 });
    assert.deepEqual(canonicalUnit("Kilograms"), { canonical: "kg", kgPerUnit: 1 });
    assert.deepEqual(canonicalUnit("gm"), { canonical: "kg", kgPerUnit: 0.001 });
    assert.deepEqual(canonicalUnit("grams"), { canonical: "kg", kgPerUnit: 0.001 });
  });

  it("refuses to convert volume to mass (density varies by ingredient)", () => {
    assert.deepEqual(canonicalUnit("Ltr"), { canonical: "ltr", kgPerUnit: null });
    assert.deepEqual(canonicalUnit("L"), { canonical: "ltr", kgPerUnit: null });
    assert.deepEqual(canonicalUnit("ml"), { canonical: "ml", kgPerUnit: null });
  });

  it("canonicalises count units and tolerates a blank unit", () => {
    assert.equal(canonicalUnit("PCS").canonical, "pcs");
    assert.equal(canonicalUnit("nos").canonical, "pcs");
    assert.equal(canonicalUnit("packet").canonical, "pkt");
    assert.deepEqual(canonicalUnit(""), { canonical: "unit", kgPerUnit: null });
  });
});

describe("normalizeProductName", () => {
  it("drops bracketed qualifiers and punctuation", () => {
    assert.equal(normalizeProductName("Paneer (Fresh)"), "paneer");
    assert.equal(normalizeProductName("Tomato - Hybrid"), "tomato hybrid");
    assert.equal(normalizeProductName("Salt & Pepper"), "salt and pepper");
  });
});

describe("matchInventoryItem", () => {
  const inventory = [
    { id: 1, product: "Paneer" },
    { id: 2, product: "Sunflower Oil" },
    { id: 3, product: "Mustard Oil" },
    { id: 4, product: "Tomato Puree" },
  ];

  it("matches on an exact normalized name", () => {
    const r = matchInventoryItem("PANEER", inventory);
    assert.equal(r.kind, "matched");
    assert.equal(r.kind === "matched" && r.item.id, 1);
  });

  it("matches when the vendor name merely qualifies ours", () => {
    const r = matchInventoryItem("Fresh Paneer", inventory);
    assert.equal(r.kind, "matched");
    assert.equal(r.kind === "matched" && r.item.id, 1);
  });

  it("refuses an ambiguous generic name rather than guessing a SKU", () => {
    const r = matchInventoryItem("Oil", inventory);
    assert.equal(r.kind, "ambiguous");
    assert.deepEqual(
      r.kind === "ambiguous" ? r.candidates.sort() : [],
      ["Mustard Oil", "Sunflower Oil"],
    );
  });

  it("does not match on a shared word fragment", () => {
    assert.equal(matchInventoryItem("Tomatoes", inventory).kind, "unmatched");
    assert.equal(matchInventoryItem("Chicken Breast", inventory).kind, "unmatched");
  });

  it("treats an empty name as unmatched", () => {
    assert.equal(matchInventoryItem("   ", inventory).kind, "unmatched");
  });
});

describe("aggregatePurchaseLines", () => {
  it("weights the average by quantity, not by line count", () => {
    const [agg] = aggregatePurchaseLines([
      line({ qty: 1, unitPricePaise: 10000, lineTotalPaise: 10000 }),
      line({ qty: 99, unitPricePaise: 5000, lineTotalPaise: 495000 }),
    ]);
    // 505000 paise over 100 kg → ₹50.50/kg, not the ₹75 a naive mean gives.
    assert.equal(agg.perKgPaise, 5050);
    assert.equal(agg.unitPricePaise, 5050);
    assert.equal(agg.unit, "kg");
    assert.equal(agg.lineCount, 2);
    assert.equal(agg.totalPaise, 505000);
  });

  it("folds grams into the same per-kg price", () => {
    const [agg] = aggregatePurchaseLines([
      line({ qty: 1, unit: "kg", unitPricePaise: 10000, lineTotalPaise: 10000 }),
      line({ qty: 500, unit: "gm", unitPricePaise: 12, lineTotalPaise: 6000 }),
    ]);
    // 16000 paise over 1.5 kg
    assert.equal(agg.perKgPaise, 10667);
  });

  it("prices count units without inventing a per-kg figure", () => {
    const [agg] = aggregatePurchaseLines([
      line({ product: "Egg Tray", qty: 10, unit: "pcs", unitPricePaise: 6000, lineTotalPaise: 60000 }),
    ]);
    assert.equal(agg.perKgPaise, null);
    assert.equal(agg.unit, "pcs");
    assert.equal(agg.unitPricePaise, 6000);
  });

  it("groups variant spellings and picks the dominant supplier by spend", () => {
    const aggs = aggregatePurchaseLines([
      line({ product: "Paneer (Fresh)", qty: 1, lineTotalPaise: 30000, supplierName: "Small Co", invoiceDate: "2026-07-01" }),
      line({ product: "PANEER", qty: 9, lineTotalPaise: 270000, supplierName: "Ambika Dairy", invoiceDate: "2026-07-05" }),
    ]);
    assert.equal(aggs.length, 1);
    assert.equal(aggs[0].supplierName, "Ambika Dairy");
    assert.equal(aggs[0].lastInvoiceDate, "2026-07-05");
    assert.equal(aggs[0].perKgPaise, 30000);
  });

  it("orders by spend so the biggest cost lines are handled first", () => {
    const aggs = aggregatePurchaseLines([
      line({ product: "Salt", qty: 1, lineTotalPaise: 2000 }),
      line({ product: "Ghee", qty: 1, lineTotalPaise: 900000 }),
    ]);
    assert.deepEqual(aggs.map((a) => a.product), ["Ghee", "Salt"]);
  });
});

describe("planPurchaseIngest", () => {
  const inventory = [
    { id: 1, product: "Paneer", buyingPricePaise: 30000 },
    { id: 2, product: "Egg Tray", buyingPricePaise: 5500 },
    { id: 3, product: "Cinnamon", buyingPricePaise: 100 },
  ];

  it("writes per-kg price, unit label and both display labels for mass items", () => {
    const plan = planPurchaseIngest(
      aggregatePurchaseLines([line({ qty: 2, lineTotalPaise: 64000 })]),
      inventory,
    );
    assert.equal(plan.updates.length, 1);
    const u = plan.updates[0];
    assert.equal(u.inventoryItemId, 1);
    assert.equal(u.buyingPricePaise, 32000);
    assert.equal(u.perKgUnitPaise, 32000);
    assert.equal(u.buyingQty, "1 kg");
    assert.equal(u.pricePer100GmPcsLabel, "₹32.00 / 100 gm");
    assert.equal(u.pricePer10GmLabel, "₹3.20 / 10 gm");
    assert.equal(u.previousBuyingPricePaise, 30000);
    assert.equal(u.changePct, 7);
  });

  it("labels count items per unit and leaves the per-10g label empty", () => {
    const plan = planPurchaseIngest(
      aggregatePurchaseLines([
        line({ product: "Egg Tray", qty: 10, unit: "pcs", lineTotalPaise: 60000 }),
      ]),
      inventory,
    );
    const u = plan.updates[0];
    assert.equal(u.perKgUnitPaise, null);
    assert.equal(u.buyingQty, "1 pcs");
    assert.equal(u.pricePer100GmPcsLabel, "₹60.00 / pcs");
    assert.equal(u.pricePer10GmLabel, null);
  });

  it("refuses an order-of-magnitude price jump (probable unit mismatch)", () => {
    // Cinnamon recorded at ₹1; an invoice priced per kg instead of per gram.
    const plan = planPurchaseIngest(
      aggregatePurchaseLines([
        line({ product: "Cinnamon", qty: 1, lineTotalPaise: 100 * PRICE_SANITY_FACTOR * 100 }),
      ]),
      inventory,
    );
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.suspicious.length, 1);
    assert.equal(plan.suspicious[0].product, "Cinnamon");
    assert.equal(plan.suspicious[0].previousPaise, 100);
  });

  it("accepts a large-but-plausible move inside the sanity band", () => {
    const plan = planPurchaseIngest(
      aggregatePurchaseLines([line({ qty: 1, lineTotalPaise: 60000 })]),
      inventory,
    );
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0].changePct, 100);
  });

  it("reports products we do not stock instead of creating SKUs", () => {
    const plan = planPurchaseIngest(
      aggregatePurchaseLines([line({ product: "Truffle Oil", qty: 1, lineTotalPaise: 500000 })]),
      inventory,
    );
    assert.equal(plan.updates.length, 0);
    assert.deepEqual(plan.unmatched.map((u) => u.vendorProduct), ["Truffle Oil"]);
  });

  it("gives one SKU to the highest-spend vendor name and surfaces the loser", () => {
    const plan = planPurchaseIngest(
      aggregatePurchaseLines([
        line({ product: "Paneer Malai", qty: 1, lineTotalPaise: 40000 }),
        line({ product: "Paneer Fresh", qty: 10, lineTotalPaise: 300000 }),
      ]),
      inventory,
    );
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0].vendorProduct, "Paneer Fresh");
    assert.deepEqual(plan.ambiguous.map((a) => a.vendorProduct), ["Paneer Malai"]);
  });

  it("has no previous-price baseline when the SKU price was never set", () => {
    const plan = planPurchaseIngest(
      aggregatePurchaseLines([line({ qty: 1, lineTotalPaise: 32000 })]),
      [{ id: 1, product: "Paneer", buyingPricePaise: null }],
    );
    assert.equal(plan.updates[0].previousBuyingPricePaise, null);
    assert.equal(plan.updates[0].changePct, null);
  });
});

describe("purchaseWindow", () => {
  it("is an inclusive lookback ending today", () => {
    const w = purchaseWindow(new Date("2026-07-24T05:00:00Z"), 7);
    assert.deepEqual(w, { startDate: "2026-07-17", endDate: "2026-07-24" });
  });

  it("clamps a negative lookback to today", () => {
    const w = purchaseWindow(new Date("2026-07-24T05:00:00Z"), -3);
    assert.deepEqual(w, { startDate: "2026-07-24", endDate: "2026-07-24" });
  });
});
