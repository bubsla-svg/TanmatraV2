/**
 * Route sets for the ghost-UI sweep.
 *
 * SCOPE BOUND, STATED EXPLICITLY — the same discipline `playwright.config.ts`
 * applies to its VIEWPORT_SPECS / CROSS_BROWSER_SPECS bounds, for the same
 * reason: a check whose coverage is narrower than its name implies is worse
 * than no check, because it reads as a guarantee.
 *
 * The storefront has 52 static routes (`find app -name page.tsx | grep -v '\['`).
 * The sweep covers the CONVERSION FUNNEL ONLY — the surfaces TNM-REALIGN-02
 * names in D4 (Home → Menu/Plans → Cart/Checkout) plus the account hub the
 * funnel hands off to. Six routes, because the button half of the probe costs
 * one page load per button: at ~12 buttons/route that is ~72 navigations, which
 * fits the PR gate. Fifty-two routes would not.
 *
 * WIDENING IS ONE LINE — add to FUNNEL_ROUTES. Do it with the CI wall-clock
 * budget in hand, not casually; the storefront e2e job already runs 14 specs.
 *
 * Deliberately NOT swept, and why:
 *   • Parameterised routes (`/dish/[slug]`, `/track/[orderId]`) — need a live
 *     id, so they belong to the CUJ specs that already build that state.
 *   • Auth-gated account children (`/account/orders`, …) — signed out they
 *     render the sign-in island, so the sweep would grade the island, not the
 *     screen. They need the authenticated session the suite cannot drive
 *     headlessly (see the CUJ spec headers).
 *   • PARK-candidate surfaces — WO-1's kill list decides those, and it is not
 *     in the repo yet (PR #496). Sweeping a route that is about to be deleted
 *     spends gate time on nothing.
 *   • BARE `/checkout` — it is a redirect stub, not a screen.
 *     `app/(focus)/checkout/page.tsx` is `if (!id) redirect("/checkout?mode=alacarte")`,
 *     and Next serves that as a streamed 200 followed by a CLIENT navigation
 *     after hydration (curl sees 200 at `/checkout`; the browser ends up on
 *     `/checkout?mode=alacarte`). Probing it therefore raced the bounce and
 *     died with "Execution context was destroyed" — the harness's own first
 *     run caught this. The real checkout screen needs a plan param, so that
 *     is what is swept below.
 */
export const FUNNEL_ROUTES: readonly string[] = [
  "/",
  "/menu",
  "/plans",
  "/trial",
  // The trial is a checkout, not a separate funnel (TrialStart's own comment),
  // and it is the one plan checkout reachable with no session — so it is the
  // deepest point of the money path this sweep can honestly reach.
  "/checkout?plan=trial_3day&track=veg",
  "/account",
];
