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

/**
 * Dietitian / RD services — the directory at /rd, the booking flow, the partner
 * network, the paid RD add-on at plan review, and every "talk to a dietitian"
 * entry point.
 *
 * OFF by default (owner, 2026-09-06): the storefront makes no dietitian claim
 * until one is actually on board. This is not a copy problem — the RD bump is a
 * PAID add-on (+₹499/mo) and /rd/[slug] takes a real Razorpay booking, so the
 * surfaces sell a service nobody can deliver yet. The routes, components and
 * the priced `rd_bump` spine entry all stay in the tree; with the flag on,
 * behaviour is identical to before. Restoring the service is this env flip.
 */
export const RD_SERVICES_ENABLED = process.env.NEXT_PUBLIC_RD_SERVICES === "1";

/**
 * Plan / trial SUBSCRIPTION checkout — every CTA whose purchase ends at
 * POST /subscriptions. OFF by default (T1, CRO handoff 2026-09-17): that
 * route answers 503 in production (PLAN_CHECKOUT_DISABLED), so with the flag
 * off the storefront routes each of those CTAs to a surface that can take
 * money instead — the three-lunch trio becomes ordinary à-la-carte cart lines
 * at menu price (/trial, /start), plan cards open the goal-filtered menu, and
 * a stale `/checkout?plan=` or `/plan/<id>` link redirects the same way.
 * Turning plans back on is this env flip; nothing is deleted.
 */
export const PLAN_CHECKOUT_ENABLED = process.env.NEXT_PUBLIC_PLAN_CHECKOUT === "1";

/**
 * Magic Checkout 50/50 pilot on à-la-carte (T10, CRO handoff 2026-09-17).
 * With the flag on, half of sessions (sticky per session — lib/experiments)
 * open Razorpay's sheet with `one_click_checkout` and the gateway order
 * carries `line_items_total`; the other half get the standard sheet. Every
 * checkout funnel event carries `magic_checkout: control|treatment`, and the
 * server `purchase` event joins on the funnel session id. OFF by default:
 * Magic Checkout must be enabled on the Razorpay account first, or the
 * treatment arm silently gets the standard sheet and the test reads null.
 */
export const MAGIC_CHECKOUT_PILOT_ENABLED = process.env.NEXT_PUBLIC_MAGIC_CHECKOUT_PILOT === "1";
