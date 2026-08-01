// Client-side hook (imported only by client components): the server quote that
// gates the pay CTA, net of any redeemable credit once signed in. Extracted
// from PlanCheckout to keep the component under the file cap as add-ons (and
// now credit) joined the quote.
import { useCallback, useEffect, useState } from "react";
import { quotePlan, type AddOnId, type DietTrack, type PlanCadence } from "./api";
import { addOnLineFromQuote } from "./addons";

export interface PlanQuoteState {
  mealsPerDelivery: number;
  totalPaise: number;
  /** Display line for the quote's billed add-ons ("Your dietitian · +₹499/mo"),
   *  or null when none — always the SERVER's priced items, never the spine's. */
  addOnLine: string | null;
  /** Total credit the SERVER will redeem against this first bill — the
   *  à-la-carte→trial bridge credit PLUS the general ledger balance, derived
   *  as totalPaise − payableTotalPaise so the displayed "credit applied" line
   *  always reconciles with the billed amount (never just the ledger slice).
   *  0 until signed in / when the account holds none. */
  creditAppliedPaise: number;
  /** What will actually be charged. Comes straight from the server
   *  (payableTotalPaise), computed in the create route's exact redemption
   *  order, so it can never drift from the amount create bills — no
   *  client-side redemption math. */
  payableTotalPaise: number;
}

/**
 * Server quote per (plan, track, add-ons) — the authoritative
 * meals-per-delivery + billed total (the same corpus quote the create route
 * bills from, so the displayed number matches the charge). No auth needed; runs
 * before and after sign-in. The quote clears on every input change, gating the
 * CTA until the fresh quote lands — a submit can never pair a new track with a
 * stale quote's meals-per-delivery.
 *
 * The credit preview is SERVER-computed: once `signedIn`, the quote (a
 * cookie-authed POST) comes back with the exact bridge + ledger credit the
 * create route will redeem and the net `payableTotalPaise`. The client never
 * replicates redemption order/precedence, so a trial buyer holding BOTH an
 * à-la-carte bridge credit and a ledger balance sees the true amount before
 * paying — not a client guess that missed the bridge step.
 */
export function usePlanQuote(
  planId: string,
  track: DietTrack,
  addOns?: AddOnId[],
  signedIn?: boolean,
  cadence?: PlanCadence,
): {
  quote: PlanQuoteState | null;
  quoteLoading: boolean;
  /** True when the LAST quote attempt failed. The CTA stays gated either way
   *  (quote === null), but the caller must tell the customer WHY and offer
   *  `retryQuote` — a swallowed failure here left the plan page with an
   *  ellipsis for a price and a permanently disabled button: a dead end on
   *  the purchase path with no message and no way out. */
  quoteError: boolean;
  /** Re-runs the quote with unchanged inputs (a failed fetch is not an input
   *  change, so nothing else re-triggers the effect). */
  retryQuote: () => void;
} {
  const [quote, setQuote] = useState<PlanQuoteState | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(false);
  // Bumped by retryQuote to re-fire the effect without an input change.
  const [attempt, setAttempt] = useState(0);
  // Keyed by value, not array identity — a parent re-render with an equal
  // array must not re-quote.
  const addOnsKey = (addOns ?? []).join(",");

  const retryQuote = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setQuote(null);
    setQuoteLoading(true);
    setQuoteError(false);
    const requested = addOnsKey ? (addOnsKey.split(",") as AddOnId[]) : [];
    // `signedIn` is a dep, not sent in the body: a re-quote after login carries
    // the session cookie (credentials:"include"), so the server folds in this
    // account's real credit; the pre-login quote shows the gross total.
    quotePlan({ planId, track, cadence: cadence ?? "monthly", addOns: requested })
      .then((q) => {
        if (!live) return;
        const payableTotalPaise = q.payableTotalPaise ?? q.totalPaise;
        setQuote({
          mealsPerDelivery: q.mealsPerDelivery,
          totalPaise: q.totalPaise,
          addOnLine: addOnLineFromQuote(q.addOns),
          // Full discount (bridge + ledger), always == what's taken off.
          creditAppliedPaise: q.totalPaise - payableTotalPaise,
          payableTotalPaise,
        });
      })
      .catch(() => {
        if (live) {
          setQuote(null);
          setQuoteError(true);
        }
      })
      .finally(() => {
        if (live) setQuoteLoading(false);
      });
    return () => {
      live = false;
    };
  }, [planId, track, addOnsKey, signedIn, cadence, attempt]);

  return { quote, quoteLoading, quoteError, retryQuote };
}
