// Unit tests for the pure checkout ledger (Zero-Tolerance revenue math).
//
// Run with the api-server's tsx loader (this package has no wired `test`
// script — mirrors rdPlans.pricing.test.ts):
//
//   cd artifacts/api-server && \
//   node --test --import tsx ../tanmatra/src/lib/checkoutLedger.test.ts
import { describe, it } from "node:test";
import assert from "node:assert";
import { GST_RATE_FOOD, GST_RATE_DELIVERY } from "./cartMath";
import {
  computeCheckoutLedger,
  type CheckoutLedgerInput,
} from "./checkoutLedger";

// Faithful reimplementation of the ORIGINAL inline Checkout.tsx arithmetic
// (lines 935, 949–967 pre-extraction). The equivalence sweep below asserts the
// extracted utility matches it operation-for-operation — the money-path safety
// proof that this refactor changed no number.
function referenceLedger(i: CheckoutLedgerInput) {
  const discountedSubtotal = Math.max(0, i.preFirstOrderSubtotal - i.firstOrderDiscount);
  const gst =
    Math.round(discountedSubtotal * GST_RATE_FOOD) +
    Math.round(i.deliveryFee * GST_RATE_DELIVERY);
  const grossTotal = discountedSubtotal + gst + i.deliveryFee + i.tip;
  const creditApplied = i.creditBalance > 0 ? Math.min(i.creditBalance, discountedSubtotal) : 0;
  const remainingAfterCredit = Math.max(0, grossTotal - creditApplied);
  const subsidyApplied = i.subsidyPaise > 0 ? Math.min(i.subsidyPaise, remainingAfterCredit) : 0;
  const payable = Math.max(0, remainingAfterCredit - subsidyApplied);
  return { discountedSubtotal, gst, grossTotal, creditApplied, remainingAfterCredit, subsidyApplied, payable };
}

describe("computeCheckoutLedger — worked examples", () => {
  it("base + exclusive GST + delivery, no discounts/credits", () => {
    // ₹1,000 meal + ₹50 delivery. GST = 5% food + 18% delivery.
    const l = computeCheckoutLedger({
      preFirstOrderSubtotal: 100000,
      firstOrderDiscount: 0,
      deliveryFee: 5000,
      tip: 0,
      creditBalance: 0,
      subsidyPaise: 0,
    });
    assert.equal(l.foodGst, 5000); // round(100000 * 0.05)
    assert.equal(l.deliveryGst, 900); // round(5000 * 0.18)
    assert.equal(l.gst, 5900);
    assert.equal(l.payable, 110900); // 100000 + 5900 + 5000
  });

  it("applies a first-order discount before GST (GST on the discounted base)", () => {
    const l = computeCheckoutLedger({
      preFirstOrderSubtotal: 100000,
      firstOrderDiscount: 25000,
      deliveryFee: 5000,
      tip: 0,
      creditBalance: 0,
      subsidyPaise: 0,
    });
    assert.equal(l.discountedSubtotal, 75000);
    assert.equal(l.foodGst, 3750); // round(75000 * 0.05)
    assert.equal(l.payable, 84650); // 75000 + 3750 + 900 + 5000
  });

  it("caps credit at the discounted subtotal and subsidy at the remainder", () => {
    const l = computeCheckoutLedger({
      preFirstOrderSubtotal: 80000,
      firstOrderDiscount: 0,
      deliveryFee: 0,
      tip: 0,
      creditBalance: 999999, // more than the bill
      subsidyPaise: 999999,
    });
    assert.equal(l.creditApplied, 80000); // capped at discountedSubtotal
    assert.equal(l.payable, 0); // credit + subsidy cover everything
  });
});

describe("computeCheckoutLedger — penny reconciliation (zero-tolerance)", () => {
  const cases: CheckoutLedgerInput[] = [
    { preFirstOrderSubtotal: 100000, firstOrderDiscount: 0, deliveryFee: 5000, tip: 0, creditBalance: 0, subsidyPaise: 0 },
    { preFirstOrderSubtotal: 63700, firstOrderDiscount: 12740, deliveryFee: 5000, tip: 2000, creditBalance: 3000, subsidyPaise: 0 },
    { preFirstOrderSubtotal: 250000, firstOrderDiscount: 8000, deliveryFee: 0, tip: 1500, creditBalance: 0, subsidyPaise: 4000 },
  ];
  it("Base − Discount + GST + Delivery + Tip − Credit − Subsidy === Payable to the paise", () => {
    for (const c of cases) {
      const l = computeCheckoutLedger(c);
      // payable > 0 for these cases → no zero-floor truncation, so the ledger
      // must reconcile exactly.
      assert.ok(l.payable > 0, `expected positive payable for ${JSON.stringify(c)}`);
      const reconstructed =
        l.discountedSubtotal + l.gst + c.deliveryFee + c.tip - l.creditApplied - l.subsidyApplied;
      assert.equal(l.payable, reconstructed);
      assert.equal(l.gst, l.foodGst + l.deliveryGst);
    }
  });
});

describe("computeCheckoutLedger — equivalence with the original inline math", () => {
  it("matches the pre-extraction arithmetic over a wide grid", () => {
    const subs = [0, 1, 45000, 63700, 100000, 250001];
    const discounts = [0, 8000, 25000, 999999];
    const deliveries = [0, 5000];
    const tips = [0, 2000];
    const credits = [0, 3000, 999999];
    const subsidies = [0, 4000, 999999];
    for (const preFirstOrderSubtotal of subs)
      for (const firstOrderDiscount of discounts)
        for (const deliveryFee of deliveries)
          for (const tip of tips)
            for (const creditBalance of credits)
              for (const subsidyPaise of subsidies) {
                const input = { preFirstOrderSubtotal, firstOrderDiscount, deliveryFee, tip, creditBalance, subsidyPaise };
                const got = computeCheckoutLedger(input);
                const ref = referenceLedger(input);
                assert.deepEqual(
                  {
                    discountedSubtotal: got.discountedSubtotal,
                    gst: got.gst,
                    grossTotal: got.grossTotal,
                    creditApplied: got.creditApplied,
                    remainingAfterCredit: got.remainingAfterCredit,
                    subsidyApplied: got.subsidyApplied,
                    payable: got.payable,
                  },
                  ref,
                  `mismatch for ${JSON.stringify(input)}`,
                );
              }
  });
});
