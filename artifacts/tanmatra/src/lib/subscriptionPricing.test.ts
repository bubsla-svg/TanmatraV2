// Unit tests for the subscription price-display helpers (revenue-math contract).
//
// tanmatra has no wired `test` script (this mirrors rdPlans.pricing.test.ts,
// the existing node:test convention in this package). Run with the api-server's
// tsx loader, which resolves this package's deps fine:
//
//   cd artifacts/api-server && \
//   node --test --import tsx ../tanmatra/src/lib/subscriptionPricing.test.ts
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  CADENCE_WEEKS,
  cadenceWeeks,
  weeklyEquivalentPaise,
  cadenceBilledLabel,
  formatCadencePriceLabel,
} from "./subscriptionPricing";

// Test formatter: paise → "₹" + rupees with en-IN grouping (mirrors data.ts F).
const F = (paise: number): string =>
  "₹" + Math.round(paise / 100).toLocaleString("en-IN");

describe("CADENCE_WEEKS", () => {
  it("maps each cadence to its billed-week count", () => {
    assert.deepEqual(CADENCE_WEEKS, { weekly: 1, fortnightly: 2, monthly: 6 });
  });
  it("cadenceWeeks defaults to 1 for a weekly cadence", () => {
    assert.equal(cadenceWeeks("weekly"), 1);
    assert.equal(cadenceWeeks("fortnightly"), 2);
    assert.equal(cadenceWeeks("monthly"), 6);
  });
});

describe("weeklyEquivalentPaise", () => {
  it("divides a full-cycle amount by the cadence weeks", () => {
    assert.equal(weeklyEquivalentPaise(354400, "fortnightly"), 177200);
    assert.equal(weeklyEquivalentPaise(252000, "monthly"), 42000);
  });
  it("is the identity for weekly cadence", () => {
    assert.equal(weeklyEquivalentPaise(88600, "weekly"), 88600);
  });
  it("rounds to the nearest paise", () => {
    // 355500 / 2 = 177750 exactly; 355501 / 2 = 177750.5 → 177751.
    assert.equal(weeklyEquivalentPaise(355501, "fortnightly"), 177751);
  });
});

describe("cadenceBilledLabel", () => {
  it("spells out the billed amount and cadence for multi-week plans", () => {
    assert.equal(
      cadenceBilledLabel(354400, "fortnightly", F),
      "Billed ₹3,544 every 2 weeks",
    );
    assert.equal(
      cadenceBilledLabel(252000, "monthly", F),
      "Billed ₹2,520 every 6 weeks",
    );
  });
  it("collapses to 'Billed weekly' when the cycle is one week", () => {
    assert.equal(cadenceBilledLabel(88600, "weekly", F), "Billed weekly");
  });
});

describe("formatCadencePriceLabel", () => {
  it("renders the mandate's standardized format for multi-week plans", () => {
    // The reported bug: a 2-week plan billed ₹3,544 must never read as a rate.
    assert.equal(
      formatCadencePriceLabel(354400, "fortnightly", F),
      "₹1,772 /week (Billed ₹3,544 every 2 weeks)",
    );
    assert.equal(
      formatCadencePriceLabel(252000, "monthly", F),
      "₹420 /week (Billed ₹2,520 every 6 weeks)",
    );
  });
  it("drops the redundant billed clause for weekly plans", () => {
    assert.equal(formatCadencePriceLabel(88600, "weekly", F), "₹886 /week");
  });
});
