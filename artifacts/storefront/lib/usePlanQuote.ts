// Client-side hook (imported only by client components): the server quote that
// gates the pay CTA, net of any redeemable credit-ledger balance once signed
// in. Extracted from PlanCheckout to keep the component under the file cap as
// add-ons (and now credit) joined the quote.
import { useEffect, useState } from "react";
import { quotePlan, getCreditBalance, type AddOnId, type DietTrack } from "./api";
import { addOnLineFromQuote } from "./addons";

interface RawQuote {
  mealsPerDelivery: number;
  totalPaise: number;
  addOnLine: string | null;
}

export interface PlanQuoteState extends RawQuote {
  /** Redeemable credit-ledger balance applied against totalPaise (0 until
   *  signed in, or when the account holds no balance). Computed the same way
   *  subscriptions.ts's create route itself redeems — min(balance, total) —
   *  so this is never a promise the server might not honor. */
  creditAppliedPaise: number;
  /** What will actually be charged: totalPaise - creditAppliedPaise. */
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
 * Once `signedIn`, the account's real credit-ledger balance (GET
 * /credit-ledger — auth required) is fetched once and folded into
 * `creditAppliedPaise`/`payableTotalPaise`, so a returning post-trial buyer
 * (or anyone else holding a balance) sees the discounted total BEFORE paying,
 * never a surprise on the confirmation screen.
 */
export function usePlanQuote(
  planId: string,
  track: DietTrack,
  addOns?: AddOnId[],
  signedIn?: boolean,
): { quote: PlanQuoteState | null; quoteLoading: boolean } {
  const [raw, setRaw] = useState<RawQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  // Keyed by value, not array identity — a parent re-render with an equal
  // array must not re-quote.
  const addOnsKey = (addOns ?? []).join(",");

  useEffect(() => {
    let live = true;
    setRaw(null);
    setQuoteLoading(true);
    const requested = addOnsKey ? (addOnsKey.split(",") as AddOnId[]) : [];
    quotePlan({ planId, track, cadence: "monthly", addOns: requested })
      .then((q) => {
        if (!live) return;
        setRaw({
          mealsPerDelivery: q.mealsPerDelivery,
          totalPaise: q.totalPaise,
          addOnLine: addOnLineFromQuote(q.addOns),
        });
      })
      .catch(() => {
        if (live) setRaw(null);
      })
      .finally(() => {
        if (live) setQuoteLoading(false);
      });
    return () => {
      live = false;
    };
  }, [planId, track, addOnsKey]);

  // Runs once per sign-in (not per track/add-on change) — the balance is an
  // account fact, not a quote input.
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    getCreditBalance()
      .then(({ balancePaise }) => {
        if (live) setCreditBalance(balancePaise);
      })
      .catch(() => {
        if (live) setCreditBalance(0);
      });
    return () => {
      live = false;
    };
  }, [signedIn]);

  if (!raw) return { quote: null, quoteLoading };
  const creditAppliedPaise = Math.max(0, Math.min(creditBalance ?? 0, raw.totalPaise));
  return {
    quote: { ...raw, creditAppliedPaise, payableTotalPaise: raw.totalPaise - creditAppliedPaise },
    quoteLoading,
  };
}
