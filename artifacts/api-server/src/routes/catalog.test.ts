import { describe, it } from "node:test";
import assert from "node:assert";
import { CATALOG_SKUS, computeWeeklyEquivalentRate } from "./catalog";

describe("Catalog Tier & Pricing Safety Validation", () => {
  it("computes weekly equivalent rate accurately according to P_weekly = T_commitment / N_weeks", () => {
    // 6-Week Reset formula assertion: 22743 / 6 = 3790.5 => ₹3,791/wk
    const ratePaise = computeWeeklyEquivalentRate(2274300, 6);
    const rateRupees = Math.round(ratePaise / 100);
    assert.strictEqual(ratePaise, 379050);
    assert.strictEqual(rateRupees, 3791);
  });

  it("ensures trial plans have autoRenew set to false", () => {
    const trialSku = CATALOG_SKUS.find((s) => s.id === "3-day-trial-pack");
    assert.ok(trialSku);
    assert.strictEqual(trialSku.pricePaise, 236300); // ₹2,363
    assert.strictEqual(trialSku.autoRenew, false); // Does not trigger auto-renewal state machines
  });

  it("verifies catalog SKUs match expected tiers and promotional combos", () => {
    const skusById = new Map(CATALOG_SKUS.map((s) => [s.id, s]));

    // Weight-Loss Jumpstart (₹3,990/wk)
    const wl = skusById.get("weight-loss-jumpstart");
    assert.strictEqual(wl?.pricePaise, 399000);

    // Lean Muscle Builder (₹7,855/wk)
    const lm = skusById.get("lean-muscle-builder");
    assert.strictEqual(lm?.pricePaise, 785500);

    // PCOS Hormone Balance (₹3,990/wk)
    const pcos = skusById.get("pcos-hormone-balance");
    assert.strictEqual(pcos?.pricePaise, 399000);

    // 6-Week Reset (₹22,743 total, ₹3,791/wk equivalent)
    const reset = skusById.get("six-week-reset");
    assert.strictEqual(reset?.commitmentTotalPaise, 2274300);
    assert.strictEqual(reset?.weeklyEquivalentRatePaise, 379050);
    assert.strictEqual(Math.round((reset?.weeklyEquivalentRatePaise ?? 0) / 100), 3791);

    // Promotional Combos (Lunch Balance Combo & Performance Stack @ ₹235, saving ₹25)
    const lunchCombo = skusById.get("lunch-balance-combo");
    assert.strictEqual(lunchCombo?.pricePaise, 23500);
    assert.strictEqual(lunchCombo?.savingsPaise, 2500);

    const perfStack = skusById.get("performance-stack");
    assert.strictEqual(perfStack?.pricePaise, 23500);
    assert.strictEqual(perfStack?.savingsPaise, 2500);
  });
});
