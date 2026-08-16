// ─────────────────────────────────────────────────────────────────────────────
// Guest-order claim — who is allowed to take ownership of an order placed
// without an account (plan item 2.4).
//
// WHY THIS EXISTS AT ALL
// ----------------------
// Sign-in at checkout is optional by design (PhoneAuth: "Have an account? Sign
// in for faster checkout"), so a guest can pay end to end and the row is
// written with `user_id = NULL` (routes/checkout.ts). `GET /orders/mine`
// filters strictly on `user_id = req.user.id` and nothing anywhere backfills.
//
// The consequence is the whole reason 2.4 is a defect rather than a feature: a
// customer who creates an account after ordering — even with the SAME phone
// number they just typed at checkout — never sees that order again. Any
// "create an account to keep track of your orders" nudge is therefore a lie
// until an order can actually be claimed. Building the nudge without this
// module would have been worse than shipping nothing: it converts someone into
// an account and hands them an empty history.
//
// THE AUTHORISATION QUESTION
// --------------------------
// `external_order_id` reaches this route from the URL, and a claim MOVES
// OWNERSHIP of a paid order — the strongest thing an unauthenticated-origin
// identifier could be made to do. Resolving the row and trusting the caller
// would be a straight IDOR: anyone holding (or guessing) an order id could
// pull a stranger's order, address and total into their own history.
//
// So the id is treated as a lookup key only, and the actual authority is the
// one fact both sides can prove independently: the phone. The order carries
// the number the buyer typed at checkout; the session carries a number Twilio/
// Firebase actually verified. A claim is allowed only when those match.
//
// Kept pure and DB-free so every branch — especially the refusals — is a unit
// test rather than a fixture. The route does the read and the guarded UPDATE.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeE164 } from "./trialEligibility";

export interface ClaimableOrder {
  /** `null` for a guest order — the only kind that can be claimed. */
  userId: string | null;
  /** Whatever the buyer typed at checkout; never normalized on the way in. */
  phone: string | null;
}

export interface ClaimCaller {
  userId: string;
  /** The session user's verified number, as stored (`+919876543210`). */
  phoneE164: string | null;
}

export type ClaimVerdict =
  /** No row for that id. Not produced by `claimVerdict` — the route's answer
   *  when the lookup misses, kept in this union so its status and its sentence
   *  are decided and tested in the same place as every other refusal. */
  | "unknown_order"
  /** Unowned, and the caller proved the same phone. Take it. */
  | "claimable"
  /** Already this caller's — a re-issued claim is a success, not an error. */
  | "already_yours"
  /** Owned by somebody else. Never say who. */
  | "owned_by_other"
  /** The order carries no usable number, so nothing can prove it is theirs. */
  | "unprovable"
  /** Both sides have a number and they are different people. */
  | "phone_mismatch";

/**
 * Decide a claim. Order of the checks is deliberate: ownership first, because
 * "already yours" and "someone else's" must be answered before we go anywhere
 * near comparing phone numbers — an owned order is not claimable even by
 * someone who happens to share the number on it.
 */
export function claimVerdict(order: ClaimableOrder, caller: ClaimCaller): ClaimVerdict {
  if (order.userId !== null) {
    return order.userId === caller.userId ? "already_yours" : "owned_by_other";
  }

  const onOrder = normalizeE164(order.phone);
  const onSession = normalizeE164(caller.phoneE164);

  // Both emptiness checks are load-bearing and NOT redundant with the equality
  // below. `normalizeE164` returns "" for anything it cannot read — a null, a
  // blank, a number too short to be one. Comparing the results directly would
  // make "" === "" true, so an order with no phone would be claimable by an
  // account with no verified phone: two unknowns matching each other into a
  // transfer of ownership. That is the exact shape of bug this route cannot
  // afford, so the unknowns are rejected explicitly before any comparison.
  if (!onOrder) return "unprovable";
  if (!onSession) return "phone_mismatch";

  return onOrder === onSession ? "claimable" : "phone_mismatch";
}

/**
 * HTTP status for a verdict.
 *
 * Every refusal is 403 and none of them distinguishes itself in the status
 * code. That is on purpose: a 404-vs-403 split would turn this endpoint into an
 * oracle for "does this order id exist" and "is it still unclaimed", which is
 * reconnaissance for the attack the phone check exists to stop. The client gets
 * the reason in the body so it can write an honest sentence; the status code
 * says only "no".
 */
export function claimStatus(verdict: ClaimVerdict): number {
  return verdict === "claimable" || verdict === "already_yours" ? 200 : 403;
}

// NO CUSTOMER COPY LIVES HERE. The verdict goes over the wire as `code` and the
// storefront writes the sentence (lib/claimOrder.ts), per Architecture
// Invariant 18 and the `isCustomerReadable` guard in lib/orderErrors.ts: server
// strings are developer strings unless proven otherwise. Returning a polished
// sentence from here would create a second place the copy can be written and a
// first place it can drift from the screen that renders it.
