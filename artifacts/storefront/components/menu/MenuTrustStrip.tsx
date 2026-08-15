import { type DishData } from "@workspace/menu-catalog";
import { macroTrust } from "@/lib/dishTrust";

/**
 * The line under "The menu" (TNM-MENU-01 M-5 §3.7, defect S-7).
 *
 * Every clause here is EARNED from the payload that is actually rendering.
 * It used to read, unconditionally:
 *
 *   "{n} dishes · order today · verified macros · RD-reviewed kitchen"
 *
 * The count was already computed — that part was fine. The two claims were
 * not. "Verified macros" sat directly above cards whose macros are a
 * placeholder bucket copied across unrelated dishes (finding F8), and
 * "RD-reviewed kitchen" rests on `rdVerified`, which finding F5 showed is
 * blanket-true across all 145 live dishes including the dead SKUs — seed
 * data, not a dietitian's sign-off. A claim the data cannot support is a
 * compliance problem on a clinical surface, not a copy nit.
 *
 * So each clause now has a gate, and the strip degrades to what remains
 * true rather than asserting the whole sentence:
 *
 *  - "verified macros" renders only when EVERY rendered dish has
 *    trustworthy macros. One placeholder row removes the claim for all.
 *    (Currently 17 of 145 fail, so it does not render.)
 *  - "RD-reviewed kitchen" does not render at all, and cannot be switched
 *    on by any field check — see RD_REVIEW_STATE_IS_TRUSTWORTHY below.
 *
 * The strip never becomes empty: dish count and "order today" are always
 * true, so the customer still gets an orienting line (Law 10 — no voids).
 */

/**
 * There is NO field in today's payload that can back an RD-review claim.
 *
 * The first cut of this component gated on `rdReviewState === "reviewed"`,
 * reasoning that it was the RD's explicit per-dish verdict while
 * `rdVerified` was the blanket seed flag F5 called out. Rendering it
 * against production disproved that: `rdReviewState` is "reviewed" on all
 * 145 live dishes, exactly as uniformly as `rdVerified` is true on all 145.
 * F5 contaminates both — POS imports are written in pre-reviewed
 * (`lib/petpooja.ts` sets `allergenReviewState: "reviewed"` on every
 * import), which is the same defect wearing a different field name.
 *
 * So this is a deliberate constant, not a predicate. A predicate over
 * contaminated data is worse than an honest `false`: it looks like
 * evidence, passes review, and still ships the unearned claim. It flips
 * only when F5 is resolved data-side and a genuine signal exists to read.
 */
const RD_REVIEW_STATE_IS_TRUSTWORTHY = false;
export function MenuTrustStrip({ dishes }: { dishes: DishData[] }) {
  const clauses: string[] = [
    `${dishes.length} ${dishes.length === 1 ? "dish" : "dishes"}`,
    "order today",
  ];

  const everyMacroTrustworthy =
    dishes.length > 0 && dishes.every((d) => macroTrust(d) !== "unverified");
  if (everyMacroTrustworthy) clauses.push("verified macros");

  // §3.7 specifies the fallback copy "macros on every dish" while the RD
  // claim is withheld. That is NOT adopted here: every dish does carry a
  // macros object, so the sentence is literally true — but 17 of them are
  // the placeholder bucket, so it would re-assert at the strip exactly the
  // confidence the cards below just withdrew. Silence is the honest
  // fallback; the count and "order today" already orient the customer.
  if (RD_REVIEW_STATE_IS_TRUSTWORTHY) clauses.push("RD-reviewed kitchen");

  return (
    <p className="mt-1 text-sm text-ink-muted" data-testid="menu-trust-strip">
      {clauses.join(" · ")}
    </p>
  );
}

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
 * screen is its own kind of noise.
 */
export function MacroLegend({ dishes }: { dishes: DishData[] }) {
  const anyEstimated = dishes.some((d) => macroTrust(d) === "estimated");
  if (!anyEstimated) return null;
  return (
    <p className="mt-2 text-xs text-ink-faint" data-testid="macro-legend">
      <span aria-hidden>≈</span> = estimated from the recipe; RD verification in progress.
    </p>
  );
}
