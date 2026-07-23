"use client";
// Client: reads the post-checkout perks stash (sessionStorage) after the money
// event — server components can't see it.
import { useEffect, useState } from "react";
import { readCheckoutPerks, type CheckoutPerks } from "@/lib/postCheckout";

/**
 * Perks the money event just produced, rendered on the confirmation screen
 * (SF-08 tail). Today: the server's verbatim UPI Autopay disclaimer from the
 * verify response (CUJ-03 — "surface autopayDisclaimer"). Reads in an effect so
 * server render and hydration agree (the stash exists only client-side); an
 * order with nothing stashed (à-la-carte, shared link, new tab) renders
 * nothing — the confirmation stays honest without inventing terms.
 */
export function PlanPerks({ orderId }: { orderId: string }) {
  const [perks, setPerks] = useState<CheckoutPerks | null>(null);

  useEffect(() => {
    setPerks(readCheckoutPerks(orderId));
  }, [orderId]);

  if (!perks?.autopayDisclaimer) return null;

  return (
    <div className="mt-6 flex flex-col gap-3">
      <p className="rounded-xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-ink-muted">
        {perks.autopayDisclaimer}
      </p>
    </div>
  );
}
