// ─────────────────────────────────────────────────────────────────────────────
// The Breeze checkout (roadmap slice S9, spec 02c) — the 3-screen
// Identity/Address/Pay flow with no coupon field, no COD, and no slot picker,
// on server-quoted totals. Presentational screens + a pure model.
//
// Not yet mounted as routes (the live single-scroll checkout keeps serving
// until the FLAG_PLAN_V2 cut-over, so the SSR/prerender money-path gates stay
// green). Wiring these to OTP/address/Razorpay is the cut-over step.
// ─────────────────────────────────────────────────────────────────────────────

export { CheckoutIdentity } from "./CheckoutIdentity";
export { CheckoutAddress, type SavedAddress } from "./CheckoutAddress";
export { CheckoutPay } from "./CheckoutPay";
export {
  CHECKOUT_SCREENS,
  DECISIONS_EVICTED,
  CHECKOUT_LOAD_BUDGET,
  HAS_COUPON_FIELD,
  OFFERS_COD,
  screensForUser,
  typedFieldCount,
  type CheckoutScreen,
  type CheckoutScreenDef,
  type CheckoutUser,
} from "./checkout02c";
