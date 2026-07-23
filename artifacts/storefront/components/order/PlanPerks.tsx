"use client";
// Client: reads the post-checkout perks stash (sessionStorage) after the money
// event — server components can't see it.
import { useEffect, useState } from "react";
import { readCheckoutPerks, type CheckoutPerks } from "@/lib/postCheckout";
import { formatPaise } from "@/lib/format";

/**
 * Perks the money event just produced, rendered on the confirmation screen
 * (SF-08/09 tail): the server's verbatim UPI Autopay disclaimer from the verify
 * response (CUJ-03), and a paid trial's creditback terms (CUJ-04, spine-priced).
 * Reads in an effect so server render and hydration agree (the stash exists
 * only client-side); an order with nothing stashed (à-la-carte, shared link,
 * new tab) renders nothing — the confirmation stays honest without inventing
 * terms.
 */
export function PlanPerks({ orderId }: { orderId: string }) {
  const [perks, setPerks] = useState<CheckoutPerks | null>(null);

  useEffect(() => {
    setPerks(readCheckoutPerks(orderId));
  }, [orderId]);

  const creditback =
    typeof perks?.trialCreditbackPaise === "number" && perks.trialCreditbackPaise > 0
      ? perks.trialCreditbackPaise
      : null;

  if (!perks || (!perks.autopayDisclaimer && creditback === null)) return null;

  return (
    <div className="mt-6 flex flex-col gap-3">
      {creditback !== null && (
        <p className="rounded-xl bg-sage-soft px-4 py-3 text-sm leading-relaxed text-sage-text">
          Your {formatPaise(creditback)} comes back as credit — start any plan within 7 days
          and it comes off that first bill.
        </p>
      )}
      {perks.autopayDisclaimer && (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-ink-muted">
          {perks.autopayDisclaimer}
        </p>
      )}
    </div>
  );
}
