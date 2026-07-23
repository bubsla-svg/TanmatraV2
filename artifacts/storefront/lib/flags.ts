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
