/**
 * Stock-sync tests — everything up to (but not including) the DB write.
 *
 * `on_hand_qty` is the input `lib/reorder.ts` thresholds against, in the row's
 * OWN unit, so a conversion or matching mistake here does not show up as a bad
 * report — it shows up as the kitchen either running out or buying the pantry
 * twice. These cover the refusals as carefully as the successes.
 *
 * `applyStockSync` needs Postgres and is exercised in CI's DB job, not here.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PetpoojaStockLine } from "./petpoojaInventory";

// Set before importing: @workspace/db throws at import time without it.
process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const { convertQty, istDay, planStockSync, runStockSync, DEFAULT_MAX_ZERO_RATIO, PLANNED_LOG_LIMIT } =
  await import("./stockSync");

type StockRow = {
  id: number;
  inventoryItemId: number;
  zone: string;
  onHandQty: number;
  unit: string;
};

function sline(over: Partial<PetpoojaStockLine> = {}): PetpoojaStockLine {
  return { product: "Paneer", qty: 5, unit: "kg", asOfDate: null, ...over };
}

function srow(over: Partial<StockRow> = {}): StockRow {
  return { id: 1, inventoryItemId: 1, zone: "default", onHandQty: 0, unit: "kg", ...over };
}

describe("convertQty", () => {
  it("converts within the mass family in both directions", () => {
    assert.equal(convertQty(2, "kg", "kg"), 2);
    assert.equal(convertQty(500, "gm", "kg"), 0.5);
    assert.equal(convertQty(1.5, "Kilograms", "grams"), 1500);
  });

  it("converts within the volume family", () => {
    assert.equal(convertQty(2, "ltr", "ml"), 2000);
    assert.equal(convertQty(250, "ml", "L"), 0.25);
  });

  it("passes count units through unchanged when they canonicalise the same", () => {
    assert.equal(convertQty(30, "pcs", "nos"), 30);
    assert.equal(convertQty(4, "packet", "pkt"), 4);
  });

  it("refuses to cross unit families — density and pack size are per-ingredient", () => {
    assert.equal(convertQty(1, "ltr", "kg"), null);
    assert.equal(convertQty(1, "kg", "ltr"), null);
    assert.equal(convertQty(10, "pcs", "kg"), null);
  });

  it("refuses dozen→pcs: vendors use it as a pack label, not a count of 12", () => {
    assert.equal(convertQty(2, "dozen", "pcs"), null);
    // …but dozen→dozen is a same-unit passthrough, which is safe.
    assert.equal(convertQty(2, "dozen", "dz"), 2);
  });

  it("refuses a blank vendor unit against a real one, rather than assuming", () => {
    assert.equal(convertQty(500, "", "kg"), null);
    assert.equal(convertQty(500, "kg", ""), null);
    // Blank on both sides is at least self-consistent.
    assert.equal(convertQty(5, "", ""), 5);
  });

  it("rejects a non-finite quantity", () => {
    assert.equal(convertQty(Number.NaN, "kg", "kg"), null);
    assert.equal(convertQty(Number.POSITIVE_INFINITY, "kg", "kg"), null);
  });
});

describe("istDay", () => {
  it("uses the outlet's calendar day, not UTC's", () => {
    // 01:30 IST on the 24th — UTC still says the 23rd.
    assert.equal(istDay(new Date("2026-07-23T20:00:00Z")), "2026-07-24");
    assert.equal(istDay(new Date("2026-07-23T18:30:00Z")), "2026-07-24");
    assert.equal(istDay(new Date("2026-07-23T18:29:00Z")), "2026-07-23");
  });
});

describe("planStockSync", () => {
  const inventory = [
    { id: 1, product: "Paneer" },
    { id: 2, product: "Sunflower Oil" },
    { id: 3, product: "Mustard Oil" },
  ];

  it("writes the vendor balance onto the single matching stock row", () => {
    const plan = planStockSync(
      [sline({ qty: 12.5 })],
      inventory,
      [srow({ id: 9, onHandQty: 3 })],
    );
    assert.equal(plan.updates.length, 1);
    assert.deepEqual(plan.updates[0], {
      stockId: 9,
      inventoryItemId: 1,
      vendorProduct: "Paneer",
      zone: "default",
      unit: "kg",
      previousQty: 3,
      newQty: 12.5,
    });
  });

  it("converts into the row's unit instead of writing the vendor's number", () => {
    const plan = planStockSync(
      [sline({ qty: 750, unit: "gm" })],
      inventory,
      [srow({ onHandQty: 2 })],
    );
    // 750 gm into a kg row is 0.75 — writing 750 would tell reorder.ts we hold
    // 750 kg of paneer and it would never restock.
    assert.equal(plan.updates[0].newQty, 0.75);
    assert.equal(plan.updates[0].unit, "kg");
  });

  it("issues no write when the row already holds that balance", () => {
    const plan = planStockSync([sline({ qty: 4 })], inventory, [srow({ onHandQty: 4 })]);
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.unchanged, 1);
  });

  it("treats float noise as unchanged", () => {
    const plan = planStockSync(
      [sline({ qty: 300, unit: "gm" })],
      inventory,
      [srow({ onHandQty: 0.3 })],
    );
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.unchanged, 1);
  });

  it("sums several vendor rows that resolve to one SKU", () => {
    const plan = planStockSync(
      [
        sline({ product: "Paneer (Fresh)", qty: 2 }),
        sline({ product: "PANEER", qty: 500, unit: "gm" }),
      ],
      inventory,
      [srow({ onHandQty: 0 })],
    );
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0].newQty, 2.5);
    assert.equal(plan.updates[0].vendorProduct, "Paneer (Fresh) + PANEER");
  });

  it("refuses the whole SKU when any contributing row will not convert", () => {
    const plan = planStockSync(
      [sline({ qty: 2 }), sline({ qty: 3, unit: "ltr" })],
      inventory,
      [srow({ onHandQty: 9 })],
    );
    // Writing just the 2 kg would understate on-hand, which is precisely what
    // makes the reorder engine buy something we already have.
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.unitMismatch.length, 1);
    assert.deepEqual(plan.unitMismatch[0], {
      vendorProduct: "Paneer",
      vendorUnit: "ltr",
      rowUnit: "kg",
      qty: 3,
    });
  });

  it("reports products we do not stock instead of creating SKUs", () => {
    const plan = planStockSync(
      [sline({ product: "Truffle Oil", qty: 1 })],
      inventory,
      [srow()],
    );
    assert.equal(plan.updates.length, 0);
    assert.deepEqual(plan.unmatched.map((u) => u.vendorProduct), ["Truffle Oil"]);
  });

  it("refuses an ambiguous vendor name rather than guessing a SKU", () => {
    const plan = planStockSync([sline({ product: "Oil", qty: 5, unit: "ltr" })], inventory, []);
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.ambiguous.length, 1);
    assert.equal(plan.ambiguous[0].reason, "name");
    assert.deepEqual(plan.ambiguous[0].detail.sort(), ["Mustard Oil", "Sunflower Oil"]);
  });

  it("refuses a SKU stocked in several zones — one outlet number cannot fill both", () => {
    const plan = planStockSync(
      [sline({ qty: 8 })],
      inventory,
      [
        srow({ id: 1, zone: "north" }),
        srow({ id: 2, zone: "south" }),
      ],
    );
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.ambiguous.length, 1);
    assert.equal(plan.ambiguous[0].reason, "zone");
    assert.deepEqual(plan.ambiguous[0].detail, ["north", "south"]);
  });

  it("never inserts a kitchen_stock row for a SKU that has none", () => {
    const plan = planStockSync([sline({ qty: 8 })], inventory, []);
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.noStockRow.length, 1);
    assert.equal(plan.noStockRow[0].inventoryItemId, 1);
  });

  it("allows a genuine zero write when it is not part of a flood", () => {
    const plan = planStockSync([sline({ qty: 0 })], inventory, [srow({ onHandQty: 6 })]);
    assert.equal(plan.updates.length, 1);
    assert.equal(plan.updates[0].newQty, 0);
    assert.equal(plan.aborted, undefined);
  });
});

describe("planStockSync zero-flood breaker", () => {
  // Enough SKUs to get past MIN_SAMPLE.
  const inventory = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, product: `Item${i + 1}` }));
  const rows = inventory.map((i) => srow({ id: i.id, inventoryItemId: i.id, onHandQty: 10 }));

  /** `zeros` SKUs reported as 0; the rest reported as a real, changed number. */
  function feed(zeros: number, nonZeros: number): PetpoojaStockLine[] {
    const out: PetpoojaStockLine[] = [];
    for (let i = 0; i < zeros; i += 1) out.push(sline({ product: `Item${i + 1}`, qty: 0 }));
    for (let i = 0; i < nonZeros; i += 1) {
      out.push(sline({ product: `Item${zeros + i + 1}`, qty: 4 }));
    }
    return out;
  }

  it("refuses the batch when most writes would zero out a real balance", () => {
    const plan = planStockSync(feed(5, 2), inventory, rows);
    assert.deepEqual(plan.aborted, { reason: "zero_flood", zeroWrites: 5, plannedWrites: 7 });
    // Nothing is written at all — a partial apply is the same bad PO, smaller.
    assert.deepEqual(plan.updates, []);
  });

  it("lets a batch through at exactly the threshold", () => {
    const plan = planStockSync(feed(3, 3), inventory, rows);
    assert.equal(plan.aborted, undefined);
    assert.equal(plan.updates.length, 6);
  });

  it("stays out of the way below the minimum sample", () => {
    const plan = planStockSync(feed(4, 0), inventory, rows);
    assert.equal(plan.aborted, undefined);
    assert.equal(plan.updates.length, 4);
  });

  it("does not count rows that were already zero", () => {
    // Six SKUs reported zero, but five of them are already zero on our side, so
    // only one is an actual zeroing write.
    const alreadyZero = inventory.map((i) =>
      srow({ id: i.id, inventoryItemId: i.id, onHandQty: i.id <= 5 ? 0 : 10 }),
    );
    const plan = planStockSync(feed(6, 2), inventory, alreadyZero);
    assert.equal(plan.unchanged, 5);
    assert.equal(plan.aborted, undefined);
    assert.equal(plan.updates.length, 3);
  });

  it("honours a caller-supplied ratio", () => {
    assert.equal(DEFAULT_MAX_ZERO_RATIO, 0.5);
    const plan = planStockSync(feed(3, 3), inventory, rows, { maxZeroRatio: 0.4 });
    assert.equal(plan.aborted?.reason, "zero_flood");
  });

  it("keeps the refused writes so the trip can be diagnosed, not just counted", () => {
    const plan = planStockSync(feed(5, 2), inventory, rows);
    // Whoever reads the alert has to decide "broken feed" vs "the kitchen really
    // did run down", and a bare count of 5 supports neither. Without the list the
    // only lever left is raising the ratio, which is always the wrong answer.
    assert.equal(plan.refused?.length, 7);
    assert.deepEqual(
      plan.refused?.filter((u) => u.newQty === 0).map((u) => u.vendorProduct),
      ["Item1", "Item2", "Item3", "Item4", "Item5"],
    );
    // Still nothing appliable: applyStockSync only ever reads `updates`.
    assert.deepEqual(plan.updates, []);
  });

  it("leaves `refused` absent when the breaker did not trip", () => {
    const plan = planStockSync(feed(3, 3), inventory, rows);
    assert.equal(plan.refused, undefined);
  });
});

describe("runStockSync summary", () => {
  it("reports an empty plan rather than omitting the field when unconfigured", async () => {
    // No PETPOOJA_INVENTORY_RID in the test env, so this returns before it can
    // reach the database — which is what makes it safe to assert on here.
    const summary = await runStockSync({});
    assert.equal(summary.skipped, true);
    assert.deepEqual(summary.planned, []);
    assert.equal(summary.plannedTotal, 0);
  });

  it("caps the logged sample high enough that a real dry run is readable", () => {
    // The number itself is a judgement call; that it is well above a kitchen's
    // daily movement and below "whole catalogue" is the property that matters.
    assert.equal(PLANNED_LOG_LIMIT, 100);
  });
});
