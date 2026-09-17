/**
 * Where a plan CTA lands while plan checkout is dark (T1 dead-funnel
 * containment). One answer for every surface — the /plans cards, the goal
 * router, `/plan/<id>`, and a stale `/checkout?plan=` link — so no plan link
 * can end at a route that answers 503.
 *
 *  - the trial lands on /trial, which sells the trio as cart lines;
 *  - a goal-mapped plan lands on the menu already filtered to its dishes;
 *  - anything else lands on the plain menu.
 *
 * Incoming query params are carried through so acquisition context
 * (`acquisitionContextId`, `goal`, `condition`, `src`) survives the redirect.
 *
 * NO "@/" ALIAS IMPORTS (storefront lib rule).
 */
import { menuHrefForPlan } from "./planGoalFilter";

export function planLandingHref(
  planId: string,
  params: Record<string, string | undefined> = {},
): string {
  const base = planId === "trial_3day" ? "/trial" : (menuHrefForPlan(planId) ?? "/menu");
  const [path, baseQuery = ""] = base.split("?");
  const q = new URLSearchParams(baseQuery);
  for (const [k, v] of Object.entries(params)) {
    // The plan's own goal filter is the more specific answer, so a param the
    // base already carries is never overwritten by the incoming one.
    if (v !== undefined && v !== "" && k !== "plan" && k !== "waitlist" && !q.has(k)) q.set(k, v);
  }
  const query = q.toString();
  return query ? `${path}?${query}` : path!;
}
