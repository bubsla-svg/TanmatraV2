import { type DishData } from "@workspace/menu-catalog";
import { macroTrust } from "@/lib/dishTrust";

/**
 * WHAT USED TO BE HERE, and why it must not come back unchanged.
 *
 * This file was `MenuTrustStrip.tsx`. It exported a strip that sat under the
 * "The menu" heading and read:
 *
 *   "{n} dishes · order today [· verified macros] [· RD-reviewed kitchen]"
 *
 * The owner removed the heading and the strip on 2026-08-16 — they were
 * ~90px of chrome above the first product, and the count is restated by the
 * section headings below. That is a layout decision, not a licence to
 * reinstate the claims elsewhere, so the compliance record travels with the
 * surviving component:
 *
 *  - "verified macros" was gated on EVERY rendered dish having trustworthy
 *    macros (17 of 145 fail, so it never rendered). Any future surface that
 *    wants the claim owes the same gate — see `macroTrust` in lib/dishTrust.
 *  - "RD-reviewed kitchen" was a hard `false`, not a predicate. `rdVerified`
 *    AND `rdReviewState` are both uniformly positive across all 145 live
 *    dishes (finding F5 — `lib/petpooja.ts` writes POS imports in
 *    pre-reviewed), so neither field can back the claim. A predicate over
 *    contaminated data is worse than an honest `false`: it looks like
 *    evidence, passes review, and still ships the unearned claim. The same
 *    reasoning removed the site-wide "RD-Reviewed" chip from the Header.
 *
 * Both claims return only when F5 is resolved data-side.
 */

/**
 * The one shared explanation of the ≈ prefix (§3.4 / defect S-6).
 *
 * 104 of the 145 live dishes are `macrosEstimated`, so the marker is on most
 * of the menu — and before this it appeared with nothing anywhere on the
 * page (or the PDP, or the cart) saying what it meant. A qualifier the
 * customer cannot decode is worse than no qualifier, because it reads as a
 * typo next to a clinical number.
 *
 * Rendered once, at the top, and only when at least one visible dish
 * actually carries the mark — an explanation for a symbol that is not on
 * screen is its own kind of noise. Since the trust strip came out this is
 * the only text above the control cluster, which is exactly the bar it has
 * to clear to be there at all.
 *
 * `sharedMacroKeys` is passed in rather than derived from `dishes` (F-1).
 * `dishes` here is the ORDERABLE subset, while the cards are gated against
 * duplicates across the whole served catalog. Re-deriving from the narrower
 * list would find fewer duplicates, so the legend could go missing above
 * cards that are in fact marked.
 */
export function MacroLegend({
  dishes,
  sharedMacroKeys,
}: {
  dishes: DishData[];
  sharedMacroKeys: ReadonlySet<string>;
}) {
  const anyEstimated = dishes.some((d) => macroTrust(d, sharedMacroKeys) === "estimated");
  if (dishes.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col gap-0.5">
      {anyEstimated && (
        <p className="text-xs text-ink-faint" data-testid="macro-legend">
          <span aria-hidden>≈</span> = estimated from the recipe; RD verification in progress.
        </p>
      )}
      {/* The FSSAI menu-labelling reference statement. Gated only on kcal
          figures being on screen at all (any dish rendered), not on the ≈
          mark — it contextualises every calorie number, estimated or not.
          Wording per the Labelling & Display Regulations, 2020. */}
      <p className="text-xs text-ink-faint" data-testid="kcal-reference">
        An average active adult requires 2,000 kcal energy per day; individual
        calorie needs may vary.
      </p>
    </div>
  );
}
