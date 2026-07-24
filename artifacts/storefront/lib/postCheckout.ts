/**
 * Post-checkout perks handoff (SF-08 tail / CUJ-03). The verify response
 * carries facts the confirmation screen must state — today the UPI Autopay
 * mandate disclaimer the server returns verbatim from
 * `POST /payments/razorpay/verify` — but the confirmed page is a server
 * component rendered from the guest status endpoint, which knows none of them.
 * This seam hands them across the client-side navigation: the checkout stashes
 * under the order id right before `router.push`, and the confirmed screen's
 * client island reads them back.
 *
 * sessionStorage by design: same-tab, survives the push, dies with the tab —
 * and every stored string is the SERVER's verbatim text, never client-authored
 * compliance copy. Storage is injectable so the behavior is node-testable, and
 * every call swallows storage failures (private-mode Safari throws on access) —
 * a missing perk renders nothing; it never breaks the confirmation (UIF §6).
 */

export interface CheckoutPerks {
  /** Verbatim from the verify response — present only when the payment
   *  registered a UPI Autopay mandate (never for trials; the server skips
   *  mandate registration on a live trial). */
  autopayDisclaimer?: string;
  /** The paid trial's creditback, in paise — spine-priced (TRIAL_CREDITBACK_
   *  PAISE), the same ₹399 the server's paid-time grant writes. The verify
   *  response carries no creditback field, so the spine is the single source
   *  the confirmation may state (lib/trial.ts owns the display facts). */
  trialCreditbackPaise?: number;
  /** The plan just purchased — lets the confirmation gate plan-scoped offers
   *  (the evening_add allow-list) without re-deriving server state. */
  planId?: string;
  /** The created subscription — the id post-purchase attach calls need
   *  (POST /subscriptions/:id/add-ons). */
  subscriptionId?: number;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

const KEY_PREFIX = "tnm:perks:";

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // accessing sessionStorage itself can throw (privacy modes)
  }
}

/** Stash the perks for `orderId`. Never throws — the money path must not be
 *  breakable by a storage quirk. */
export function stashCheckoutPerks(
  orderId: string,
  perks: CheckoutPerks,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(KEY_PREFIX + orderId, JSON.stringify(perks));
  } catch {
    // Quota or privacy failures — the confirmation simply shows no perks.
  }
}

/** Read the perks stashed for `orderId`; null when absent or unreadable.
 *  Reads are non-destructive so an in-tab refresh keeps the disclaimer. */
export function readCheckoutPerks(
  orderId: string,
  storage: StorageLike | null = defaultStorage(),
): CheckoutPerks | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY_PREFIX + orderId);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as CheckoutPerks;
  } catch {
    return null;
  }
}
