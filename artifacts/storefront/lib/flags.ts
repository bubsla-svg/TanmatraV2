/**
 * Surface + payment-rail flags. Client-readable (NEXT_PUBLIC_*), inlined at
 * build time.
 *
 * The meal-card rail (Pluxee / Sodexo) stays OFF until merchant onboarding
 * completes — master-index blocker #2 gates the ₹199 meal-card story and this
 * rail. Plumbed now so it lights up on config, never shipped half-live.
 */
export const MEALCARD_RAIL_ENABLED = process.env.NEXT_PUBLIC_MEALCARD_RAIL === "1";

/**
 * Live checkout — routes the OTP / create / pay seams at the api-server instead
 * of the skeleton stubs. OFF by default: the live path needs the api-server
 * reachable (CORS + `SESSION_SAMESITE=none`), `FLAG_PLAN_V2=1`, the Firebase
 * phone-auth + Razorpay browser SDKs, and `RAZORPAY_*` secrets — none present in
 * a bare build. See docs/LIVE-CUTOVER.md.
 */
export const LIVE_CHECKOUT_ENABLED = process.env.NEXT_PUBLIC_LIVE_CHECKOUT === "1";

/**
 * The /care "by condition" surface — the condition rail, the assessment entry
 * and the clinical-support link. OFF by default (consumer copy deck,
 * 2026-09-06): the storefront names no medical condition while the claim
 * behind one is unreviewed. The components and the /care/[condition] route
 * stay in the tree and keep working, so restoring the surface is this env
 * flip, not a rebuild. /care still renders its goal rail and both commerce
 * entries with the flag off.
 */
export const CARE_BY_CONDITION_ENABLED = process.env.NEXT_PUBLIC_CARE_BY_CONDITION === "1";
