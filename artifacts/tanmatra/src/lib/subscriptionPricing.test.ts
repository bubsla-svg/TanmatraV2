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
import {
  computeDeliveryPricePaise,
  type SubscriptionCadence,
} from "@workspace/subscription-rules";

// Test formatter: paise → "₹" + rupees with en-IN grouping (mirrors data.ts F).
const F = (paise: number): string =>
  "₹" + Math.round(paise / 100).toLocaleString("en-IN");

describe("CADENCE_WEEKS", () => {
  it("maps each cadence to its billed-week count", () => {
    assert.deepEqual(CADENCE_WEEKS, { weekly: 1, fortnightly: 2, monthly: 6, quarterly: 18 });
  });
  it("cadenceWeeks defaults to 1 for a weekly cadence", () => {
    assert.equal(cadenceWeeks("weekly"), 1);
    assert.equal(cadenceWeeks("fortnightly"), 2);
    assert.equal(cadenceWeeks("monthly"), 6);
    // 126 days / 7 — three 6-week protocol cycles, matching CADENCE_DAYS.quarterly
    // on the server. The two maps are separate declarations in separate packages,
    // so this assertion is the only thing keeping the SPA's billed-week count
    // from drifting away from what the server actually charges for.
    assert.equal(cadenceWeeks("quarterly"), 18);
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

// A7 — plan-chooser duration math (register the 2026-07-22 recording bug).
// The chooser must price each option for ITS OWN commitment length: a plan's
// meal count scales with the weeks billed (weekMeals × weeks), so the
// full-cycle total STRICTLY ASCENDS with duration and BEST VALUE (the lowest
// per-week rate) always lands on the longest plan. The old code priced every
// option at one cadence's meal count, inverting the totals (1-Week ₹7,481 vs
// 6-Week ₹6,694).
describe("A7 plan-chooser duration invariants", () => {
  const CADENCES: SubscriptionCadence[] = ["weekly", "fortnightly", "monthly"];
  // The chooser total for one option = price of (weekMeals × that option's weeks).
  const optionTotal = (weekMeals: number, cad: SubscriptionCadence): number =>
    computeDeliveryPricePaise(cad, weekMeals * cadenceWeeks(cad));

  it("full-cycle totals strictly ascend with duration (weekMeals = 5)", () => {
    const totals = CADENCES.map((c) => optionTotal(5, c));
    // ₹3,800 < ₹7,410 < ₹21,660 — the Checklist canonical prices.
    assert.deepEqual(totals, [380000, 741000, 2166000]);
    for (let i = 1; i < totals.length; i++) {
      assert.ok(totals[i] > totals[i - 1], `total must ascend at ${CADENCES[i]}`);
    }
  });

  it("totals strictly ascend for every weekMeals in 3..14", () => {
    for (let m = 3; m <= 14; m++) {
      const totals = CADENCES.map((c) => optionTotal(m, c));
      for (let i = 1; i < totals.length; i++) {
        assert.ok(
          totals[i] > totals[i - 1],
          `weekMeals=${m}: total at ${CADENCES[i]} must exceed ${CADENCES[i - 1]}`,
        );
      }
    }
  });

  it("BEST VALUE is the lowest per-week rate — always the longest plan", () => {
    for (let m = 3; m <= 14; m++) {
      const perWeek = CADENCES.map((c) =>
        weeklyEquivalentPaise(optionTotal(m, c), c),
      );
      const min = Math.min(...perWeek);
      // Monthly (6-week) has the biggest commitment discount → lowest /week.
      assert.equal(perWeek[perWeek.length - 1], min, `weekMeals=${m}: monthly is cheapest /week`);
      // Strictly lower than the shorter plans (no tie that could mis-badge).
      assert.ok(perWeek[2] < perWeek[1] && perWeek[1] < perWeek[0], `weekMeals=${m}: /week descends`);
    }
  });
});
