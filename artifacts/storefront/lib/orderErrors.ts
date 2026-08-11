/**
 * Customer copy for quote/order failures (Architecture Invariant 18: say what
 * is unavailable, why, and what to do next — never the raw server string).
 *
 * Extracted from AlacarteCheckout so the mapping is unit-testable under
 * `node --test` (lib/ stays "@/"-free per CLAUDE.md's no-alias rule), and
 * because the "Safety block" 422 was reaching customers verbatim: the server
 * body is `{error: "Safety block", code: "safety_block", reasons: [...]}` and
 * the old mapping had no case for it, so checkout rendered the literal string
 * "Safety block" over a Retry button that could never succeed.
 */
import { ApiError } from "./apiClient";

/** The wire shape of a checkout safety-block reason. The server sends
 *  discriminated objects (lib/preferences-match's BlockReason); other routes
 *  send plain strings — accept both, and anything else degrades to generic
 *  copy rather than "[object Object]". */
type WireBlockReason = string | { code?: string; allergens?: string[] };

function describeBlockReason(reason: WireBlockReason): string | null {
  if (typeof reason === "string") return reason;
  switch (reason?.code) {
    case "unchecked_allergens":
      return "a dish's allergen information hasn't been verified by our dietitian team yet, so we can't safely sell it";
    case "unreviewed_dish":
      return "a dish is still awaiting dietitian review";
    case "allergen_block":
      return reason.allergens && reason.allergens.length > 0
        ? `a dish contains ${reason.allergens.join(", ")} — an allergen on your profile`
        : "a dish conflicts with an allergen on your profile";
    case "contraindication_block":
    case "diet_block":
    case "ingredient_block":
    case "keto_block":
      return "a dish conflicts with your saved dietary profile";
    case "macros_pending":
      return "a dish's nutrition data is still being verified";
    default:
      return null;
  }
}

/** Turn a quote/create failure into copy a customer can act on. */
export function humanizeOrderError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "dish_unavailable") {
      const name = e.message.replace(/^dish unavailable:\s*/i, "");
      return `${name} isn't available right now — the kitchen has paused it. Use the − control below to remove it, then continue.`;
    }
    if (e.code === "unserviceable_pincode") {
      return "We don't deliver to this PIN code yet — we currently serve Noida sectors only. Change the PIN to continue.";
    }
    if (e.code === "premium_required") {
      return "One of these dishes is premium-members-only. Remove it below to continue as a guest.";
    }
    if (e.code === "safety_block") {
      const reasons = (e.reasons as WireBlockReason[] | undefined) ?? [];
      const described = reasons
        .map(describeBlockReason)
        .filter((r): r is string => r !== null);
      const why =
        described.length > 0
          ? described.join("; ")
          : "a dish conflicts with a dietary-safety check";
      return `We can't sell this order as-is: ${why}. Remove the affected dish below to continue.`;
    }
    if (e.code === "alc_checkout_disabled") {
      return "Single-order checkout is temporarily paused — plans are still available. Please try again shortly.";
    }
    return e.message;
  }
  return "Something went wrong. Please try again.";
}

/** True when retrying the identical request could plausibly succeed (network
 *  blip, cold API, expired quote) — false for deterministic 4xx refusals,
 *  where the only fix is changing the cart. The checkout UI uses this to
 *  decide between a "Retry pricing" button and plain guidance, so customers
 *  are never handed a retry loop that cannot converge. */
export function isRetryableQuoteError(e: unknown): boolean {
  if (!(e instanceof ApiError)) return true;
  if (e.status >= 500 || e.status === 429) return true;
  return !["safety_block", "dish_unavailable", "premium_required", "invalid_customization", "alc_checkout_disabled"].includes(e.code);
}
