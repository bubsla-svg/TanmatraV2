/**
 * Pure checkout-ledger arithmetic (Zero-Tolerance revenue math).
 *
 * The pre-checkout "Payable Today" figure is derived from the meal base, its
 * discounts, exclusive GST, delivery, tip, store credit and any corporate
 * subsidy. Keeping that arithmetic inline in the checkout view made it
 * impossible to assert — and easy to drift — so it lives here as one pure,
 * penny-reconciling function.
 *
 * GST is EXCLUSIVE: it is added on top of the discounted base, never folded in.
 * The invariant this guarantees (and `checkoutLedger.test.ts` asserts):
 *
 *   discountedSubtotal + GST + deliveryFee + tip − creditApplied − subsidy
 *     === payable         (whenever payable > 0, i.e. no zero-floor truncates)
 *
 * so "Base − Discount + GST + Delivery + Tip − Credits − Subsidy" sums to the
 * exact paise the card is charged. All amounts are integer paise.
 *
 * The offer-eligibility / cap and free-delivery-threshold rules stay in the
 * view (they need offer + fulfillment state); this function takes their already
 * -resolved outputs (`firstOrderDiscount`, `deliveryFee`) as inputs so it can
 * remain pure and view-agnostic.
 */
import { GST_RATE_FOOD, GST_RATE_DELIVERY } from "./cartMath";

export interface CheckoutLedgerInput {
  /** Meal subtotal after preorder + pickup discounts (paise, ≥ 0). */
  preFirstOrderSubtotal: number;
  /** First-order offer discount already resolved against its cap (paise). */
  firstOrderDiscount: number;
  /** Delivery fee for this fulfillment (0 for pickup / free-delivery). */
  deliveryFee: number;
  /** Tip added to the charge (paise). */
  tip: number;
  /** Store credit available to redeem — pass 0 when the toggle is off. */
  creditBalance: number;
  /** Corporate subsidy available — pass 0 when the toggle is off/inactive. */
  subsidyPaise: number;
}

export interface CheckoutLedger {
  /** Base after every discount — the amount GST is charged on. */
  discountedSubtotal: number;
  foodGst: number;
  deliveryGst: number;
  gst: number;
  grossTotal: number;
  creditApplied: number;
  remainingAfterCredit: number;
  subsidyApplied: number;
  /** The exact paise the customer is charged today. */
  payable: number;
}

export function computeCheckoutLedger(input: CheckoutLedgerInput): CheckoutLedger {
  const discountedSubtotal = Math.max(0, input.preFirstOrderSubtotal - input.firstOrderDiscount);
  // Exclusive GST: statutory 5% on prepared food, 18% on the delivery service,
  // each rounded independently — the same split cartMath.ts and the server's
  // computeChargePaise use.
  const foodGst = Math.round(discountedSubtotal * GST_RATE_FOOD);
  const deliveryGst = Math.round(input.deliveryFee * GST_RATE_DELIVERY);
  const gst = foodGst + deliveryGst;
  const grossTotal = discountedSubtotal + gst + input.deliveryFee + input.tip;
  // Credit only ever redeems against the (discounted) meal subtotal, never the
  // tax/delivery — mirrors the server so the preview matches the final charge.
  const creditApplied = Math.min(Math.max(0, input.creditBalance), discountedSubtotal);
  const remainingAfterCredit = Math.max(0, grossTotal - creditApplied);
  const subsidyApplied = Math.min(Math.max(0, input.subsidyPaise), remainingAfterCredit);
  const payable = Math.max(0, remainingAfterCredit - subsidyApplied);
  return {
    discountedSubtotal,
    foodGst,
    deliveryGst,
    gst,
    grossTotal,
    creditApplied,
    remainingAfterCredit,
    subsidyApplied,
    payable,
  };
}
