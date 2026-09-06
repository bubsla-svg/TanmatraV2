"use client";

import { useState } from "react";
import { formatPaise } from "@/lib/format";
import { attachAddOn } from "@/lib/addonsApi";
import { addOnView, type AddOnView } from "@/lib/addons";
import type { AddOnId } from "@/lib/api";

/**
 * Price and cadence come from the SPINE (lib/addons → @workspace/
 * subscription-rules ADD_ONS), never from a literal here. This component
 * used to hardcode `pricePaise: 19900` rendered as "+₹199 / delivery" while
 * the server's attach route snapshots the spine price — ₹599/week — so every
 * customer on the confirmation screen was shown a price 3× lower than what
 * they'd be billed. Only the display COPY (title/description) lives here.
 */
interface AddOnItem {
  view: AddOnView;
  title: string;
  description: string;
}

const AVAILABLE_ADDONS: AddOnItem[] = [
  {
    view: addOnView("evening_add"),
    title: "Evening Companion Drop",
    description: "Light soup & salad, delivered in the evening",
  },
];

/** "+₹599/week", "+₹499/month" — the spine's cadence, spelled out. A vague
 *  "/ delivery" let the wrong number above go unquestioned. */
function priceLine(v: AddOnView): string {
  return `+${formatPaise(v.pricePaise)}/${v.cadence === "weekly" ? "week" : "month"}`;
}

export function PostCheckoutAddOns({ subscriptionId }: { subscriptionId: number }) {
  const [attached, setAttached] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(addOnId: AddOnId) {
    setLoading((prev) => ({ ...prev, [addOnId]: true }));
    setError(null);
    try {
      await attachAddOn(subscriptionId, addOnId);
      setAttached((prev) => ({ ...prev, [addOnId]: true }));
    } catch {
      setError("Unable to update add-on. Please try again.");
    } finally {
      setLoading((prev) => ({ ...prev, [addOnId]: false }));
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-display text-lg font-semibold leading-tight text-primary">Enhance Your Subscription</h3>
      <p className="mt-1 text-xs text-ink-muted">
        Attach instant dietary boosts to your active plan before the first wave ships.
      </p>

      {error && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{error}</p>}

      <div className="mt-3 flex flex-col gap-3">
        {AVAILABLE_ADDONS.map((item) => {
          const isAttached = !!attached[item.view.id];
          const isLoading = !!loading[item.view.id];

          return (
            <div
              key={item.view.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink">{item.title}</p>
                <p className="text-2xs text-ink-muted">{item.description}</p>
                <p className="font-data mt-0.5 text-xs font-bold text-primary">
                  {priceLine(item.view)}
                </p>
              </div>

              <button
                type="button"
                disabled={isLoading || isAttached}
                onClick={() => handleToggle(item.view.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  isAttached
                    ? "bg-sage-soft text-sage-text cursor-default"
                    : "bg-gold text-[var(--gold-ink)] hover:opacity-90 active:scale-95"
                }`}
              >
                {isLoading ? "Updating..." : isAttached ? "✓ Attached" : "+ Attach Add-on"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
