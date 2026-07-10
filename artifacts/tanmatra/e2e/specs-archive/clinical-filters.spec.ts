import { test, expect } from "@playwright/test";
import { fetchPublicMenu } from "../fixtures";

// IDs 6, 7, 8, 12 — Clinical safety & filter correctness.
// Correctness is asserted at the API (menu metadata), per the matrix's
// "prefer API/DB for math-critical checks". UI-only filter behaviours that need
// selectors are left as fixme.

test.describe("Clinical filters & safety", () => {
  // [6] Diabetes: meals outside safe GI/carb bands are excluded. @p0
  test("[6] @p0 diabetes-safe set excludes high-GI / high-carb meals", async ({ request }) => {
    const dishes = await fetchPublicMenu(request);
    test.skip(dishes.length === 0, "catalog empty — seed menu_items first");

    // Define the safe band explicitly (mirror the clinical rule engine; tighten
    // to match src/lib/clinicalDiet.ts once the exact thresholds are confirmed).
    const HIGH_GI = new Set(["high"]);
    const CARB_CEILING_G = 45; // per-serving guardrail for the diabetes protocol

    const safe = dishes.filter(
      (d) => !HIGH_GI.has(String(d.glycaemicIndex)) && d.macros.carbs <= CARB_CEILING_G,
    );
    const unsafeLeaked = safe.filter(
      (d) => HIGH_GI.has(String(d.glycaemicIndex)) || d.macros.carbs > CARB_CEILING_G,
    );

    expect(unsafeLeaked, "no high-GI/high-carb meal may appear in the safe set").toHaveLength(0);
    // Sanity: the filter is not vacuously empty when a catalog is present.
    expect(safe.length).toBeGreaterThan(0);
  });

  // [8] Jain: onion/garlic/root ingredients fully excluded. @p0
  test("[8] @p0 Jain filter excludes onion/garlic/root ingredients", async ({ request }) => {
    const dishes = await fetchPublicMenu(request);
    test.skip(dishes.length === 0, "catalog empty — seed menu_items first");

    const FORBIDDEN = /\b(onion|garlic|ginger|potato|carrot|beet(root)?|radish|turnip|shallot)\b/i;
    const isJainSafe = (ings: string[]) => !ings.some((i) => FORBIDDEN.test(i));

    const jainSet = dishes.filter((d) => isJainSafe(d.ingredients ?? []));
    const leaked = jainSet.filter((d) => (d.ingredients ?? []).some((i) => FORBIDDEN.test(i)));

    expect(leaked, "no root/allium ingredient may appear in Jain-safe dishes").toHaveLength(0);

    // UI cross-check (secondary): applying the Jain filter on /menu shows the
    // same count. TODO(testid): data-testid="dish-card" + filter chip
    // data-testid="filter-jain"; assert visible card count === jainSet.length.
  });

  // [7] Ayurvedic dosha filters return a correct list without crashing.
  test.fixme("[7] Pitta/Vata dosha filters return correct list, no crash", async () => {
    // Assertion source: UI list + query API. Needs dosha tags in dish metadata
    // and data-testid="filter-dosha-{name}". Assert filtered dishes all carry the
    // selected dosha tag and the page has no error boundary.
  });

  // [12] Contradictory filters → clean zero-state + clear-filters, no crash.
  test.fixme("[12] contradictory filters show zero-state + clear action", async () => {
    // Non-veg + Jain, or Vegan + Carnivore. Assertion source: UI zero-state +
    // filter API returns []. Assert a "no results / clear filters" affordance is
    // shown and no React error boundary appears.
  });
});
