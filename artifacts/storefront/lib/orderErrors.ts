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

/**
 * The next action to offer when a failure has no bespoke copy.
 *
 * Derived from the same predicate that decides whether the UI shows a "Retry
 * pricing" button, so sentence and button can never disagree — telling someone
 * to try again beside a screen offering no retry is its own dead end (Law 9).
 */
function fallbackNextStep(e: ApiError): string {
  return isRetryableQuoteError(e)
    ? "Try again in a moment."
    : "Adjust the items below to continue.";
}

/**
 * Whether a server message can be shown to a customer as-is.
 *
 * Server strings are written for developers unless proven otherwise. A bare
 * code (`safety_block`), a two-word internal label ("Safety block"), or
 * anything carrying snake_case is machine vocabulary. Showing it is the Law 6
 * failure this module was created to stop, and it names no next action — the
 * Law 9 half of the same bug. Prose with real sentence punctuation is assumed
 * deliberate and kept, because some routes do write customer copy.
 */
function isCustomerReadable(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length === 0) return false;
  if (/_/.test(trimmed)) return false; // snake_case anywhere ⇒ machine string
  if (!/[.!?]$/.test(trimmed)) return false; // no sentence punctuation ⇒ a label
  return trimmed.split(/\s+/).length >= 4; // "Safety block." is still a label
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
      return "Single-order checkout is temporarily paused — plans are still available. Try again shortly, or switch to a plan below.";
    }
    // No bespoke case. The old behaviour returned e.message verbatim, which is
    // exactly the defect this module's header describes — "Safety block" reached
    // customers that way — just narrowed to whichever code nobody has mapped
    // yet. Keep genuine server prose, drop machine strings, and end with an
    // action either way so no failure is a dead end (Law 9).
    const detail = isCustomerReadable(e.message)
      ? e.message.trim()
      : "We couldn't price this order just now.";
    return `${detail} ${fallbackNextStep(e)}`;
  }
  // Not an ApiError: a network drop or a thrown non-Error. The cart survives —
  // say so, because "something went wrong" on a payment screen reads as "did I
  // just get charged?".
  return "Something went wrong on our side — your order was not placed and your cart is safe. Try again in a moment.";
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
