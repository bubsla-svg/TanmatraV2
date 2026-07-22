"use client";
// Client: the post-purchase attach is a stubbed live seam with a local
// confirmed state (the real attach POST lands with the api-server wiring).

import { useState } from "react";
import { formatPaise } from "@/lib/format";

/**
 * Evening Add — the post-purchase upsell on the confirmation screen (02d stage
 * 8, +₹599/week). Skippable by construction: doing nothing leaves it
 * unattached, so there is no decline button. The attach itself is a live-env
 * seam — stubbed to a confirmed line here, the same way pay is stubbed upstream.
 */
export function EveningAddOffer({ pricePaise }: { pricePaise: number }) {
  const [added, setAdded] = useState(false);

  if (added) {
    return (
      <div className="rounded-xl border border-sage/40 bg-[color-mix(in_srgb,var(--sage)_12%,transparent)] px-4 py-3 text-sm font-medium text-ink">
        Evening meals added — we&rsquo;ll set it up before your first dinner.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Add dinner to your plan?</h3>
        <span className="tabular text-sm font-semibold text-ink">{formatPaise(pricePaise)}/wk</span>
      </div>
      <p className="text-sm text-ink-muted">An evening meal each weekday. Cancel anytime.</p>
      <button
        type="button"
        onClick={() => {
          // TODO(live): POST the post-purchase add-on attach to the api-server.
          setAdded(true);
        }}
        className="mt-1 self-start rounded-xl border border-sage/50 px-4 py-2 text-sm font-semibold text-sage transition-colors hover:bg-[color-mix(in_srgb,var(--sage)_10%,transparent)]"
      >
        Add evening meals
      </button>
    </div>
  );
}
