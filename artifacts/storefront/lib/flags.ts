/**
 * Surface + payment-rail flags. Client-readable (NEXT_PUBLIC_*), inlined at
 * build time.
 *
 * The meal-card rail (Pluxee / Sodexo) stays OFF until merchant onboarding
 * completes — master-index blocker #2 gates the ₹199 meal-card story and this
 * rail. Plumbed now so it lights up on config, never shipped half-live.
 */
export const MEALCARD_RAIL_ENABLED = process.env.NEXT_PUBLIC_MEALCARD_RAIL === "1";
