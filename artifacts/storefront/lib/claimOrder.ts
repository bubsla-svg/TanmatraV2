import { apiPost, ApiError, type FetchImpl } from "./apiClient";

/**
 * Attaching a guest order to an account (plan item 2.4).
 *
 * WHAT WAS BROKEN. Sign-in at checkout is optional, so a guest pays and the row
 * is written with `user_id = NULL`. `GET /orders/mine` filters strictly on
 * `user_id` and nothing backfilled it, so a customer who made an account
 * afterwards — with the very number they had just typed at checkout — never saw
 * that order again. Any "create an account to keep track of your orders" prompt
 * was therefore an offer the system could not honour, which is why 2.4 needed a
 * server endpoint before it could have a button.
 *
 * The copy lives HERE, not on the server, keyed on the verdict the server
 * sends as `code` (Architecture Invariant 18 — a server string is a developer
 * string; see `isCustomerReadable` in lib/orderErrors.ts). One home for the
 * sentence means it cannot drift from the screen that renders it.
 */

/** The server's verdict (api-server lib/orderClaim.ts). */
export type ClaimCode =
  | "claimable"
  | "already_yours"
  | "owned_by_other"
  | "unprovable"
  | "phone_mismatch"
  | "unknown_order";

export interface ClaimOutcome {
  /** True only when this call moved the row. `false` with `code:"already_yours"`
   *  is still a success — it is what a refresh or a second mount produces. */
  claimed: boolean;
  code: ClaimCode;
}

export function claimOrder(
  externalOrderId: string,
  fetchImpl?: FetchImpl,
): Promise<ClaimOutcome> {
  return apiPost(`/orders/${encodeURIComponent(externalOrderId)}/claim`, {}, fetchImpl);
}

/** Whether the order is now on the account, either way it got there. */
export function isOnAccount(code: ClaimCode): boolean {
  return code === "claimable" || code === "already_yours";
}

/**
 * Read the verdict off a failed claim.
 *
 * Every refusal is a 403 by design — the status code is deliberately not an
 * oracle for "does this order exist" — so the reason arrives only as `code`,
 * and an ApiError with anything else is a genuine transport failure rather than
 * a decision.
 */
export function claimCodeOf(e: unknown): ClaimCode | null {
  if (!(e instanceof ApiError)) return null;
  const known: ClaimCode[] = ["owned_by_other", "unprovable", "phone_mismatch", "unknown_order"];
  return known.find((c) => c === e.code) ?? null;
}

/**
 * What the customer reads for each refusal.
 *
 * Every one of these names the next step, because a refusal that only states a
 * fact is the dead end Law 9 exists to stop — and an error branch is the
 * easiest place in a codebase to leave one, since nobody looks at it while
 * building the happy path.
 *
 * None of them names the other account. "Already saved to +9198…3210" would
 * hand one customer another customer's number.
 */
export function claimRefusalCopy(code: ClaimCode): string {
  switch (code) {
    case "phone_mismatch":
      return "This order was placed with a different mobile number, so it can't be added to this account. Sign in with the number used at checkout and it'll be here.";
    case "owned_by_other":
      return "This order is already saved to another account. Sign in with the number used at checkout to see it.";
    case "unprovable":
      return "This order was placed without a contact number, so we can't match it to an account. Our support team can link it for you.";
    case "unknown_order":
      return "We can't find that order. Open it from the link in your confirmation message.";
    case "claimable":
    case "already_yours":
      return "";
  }
}

/** The line shown once it is on the account. */
export const CLAIM_SUCCESS_COPY =
  "Saved to your account — you'll find it under your orders, ready to reorder.";

/**
 * The offer itself, shown to a signed-out buyer.
 *
 * Phrased around what they get rather than what we want. It also promises only
 * what the claim actually delivers: the order in their history and a one-tap
 * reorder. It does not promise the order will follow them onto a DIFFERENT
 * number, because it will not.
 */
export const CLAIM_OFFER_COPY =
  "Keep this order — verify the number you just used and it stays in your account, ready to reorder in one tap.";
