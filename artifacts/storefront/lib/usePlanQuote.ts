// Client-side hook (imported only by client components): the server quote that
// gates the pay CTA. Extracted from PlanCheckout to keep the component under
// the file cap as add-ons joined the quote.
import { useEffect, useState } from "react";
import { quotePlan, type AddOnId, type DietTrack } from "./api";
import { addOnLineFromQuote } from "./addons";

export interface PlanQuoteState {
  mealsPerDelivery: number;
  totalPaise: number;
  /** Display line for the quote's billed add-ons ("Your dietitian · +₹499/mo"),
   *  or null when none — always the SERVER's priced items, never the spine's. */
  addOnLine: string | null;
}

/**
 * Server quote per (plan, track, add-ons) — the authoritative
 * meals-per-delivery + billed total (the same corpus quote the create route
 * bills from, so the displayed number matches the charge). No auth needed; runs
 * before and after sign-in. The quote clears on every input change, gating the
 * CTA until the fresh quote lands — a submit can never pair a new track with a
 * stale quote's meals-per-delivery.
 */
export function usePlanQuote(
  planId: string,
  track: DietTrack,
  addOns?: AddOnId[],
): { quote: PlanQuoteState | null; quoteLoading: boolean } {
  const [quote, setQuote] = useState<PlanQuoteState | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  // Keyed by value, not array identity — a parent re-render with an equal
  // array must not re-quote.
  const addOnsKey = (addOns ?? []).join(",");

  useEffect(() => {
    let live = true;
    setQuote(null);
    setQuoteLoading(true);
    const requested = addOnsKey ? (addOnsKey.split(",") as AddOnId[]) : [];
    quotePlan({ planId, track, cadence: "monthly", addOns: requested })
      .then((q) => {
        if (!live) return;
        setQuote({
          mealsPerDelivery: q.mealsPerDelivery,
          totalPaise: q.totalPaise,
          addOnLine: addOnLineFromQuote(q.addOns),
        });
      })
      .catch(() => {
        if (live) setQuote(null);
      })
      .finally(() => {
        if (live) setQuoteLoading(false);
      });
    return () => {
      live = false;
    };
  }, [planId, track, addOnsKey]);

  return { quote, quoteLoading };
}
