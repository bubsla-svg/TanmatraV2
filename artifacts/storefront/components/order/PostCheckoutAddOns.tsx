"use client";

import { useState } from "react";
import { formatPaise } from "@/lib/format";
import { attachAddOn } from "@/lib/addonsApi";
import type { AddOnId } from "@/lib/api";

interface AddOnItem {
  addOnId: AddOnId;
  title: string;
  description: string;
  pricePaise: number;
}

const AVAILABLE_ADDONS: AddOnItem[] = [
  {
    addOnId: "evening_add" as AddOnId,
    title: "Evening Companion Drop",
    description: "Light soup & salad delivered at 6:30 PM",
    pricePaise: 19900,
  },
];

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
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <h3 className="text-sm font-bold text-ink">Enhance Your Subscription</h3>
      <p className="mt-1 text-xs text-ink-muted">
        Attach instant dietary boosts to your active plan before the first wave ships.
      </p>

      {error && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{error}</p>}

      <div className="mt-3 flex flex-col gap-3">
        {AVAILABLE_ADDONS.map((item) => {
          const isAttached = !!attached[item.addOnId];
          const isLoading = !!loading[item.addOnId];

          return (
            <div
              key={item.addOnId}
              className="flex items-center justify-between gap-3 rounded-lg border border-line p-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink">{item.title}</p>
                <p className="text-[11px] text-ink-muted">{item.description}</p>
                <p className="tabular mt-0.5 text-xs font-semibold text-gold-text">
                  +{formatPaise(item.pricePaise)} / delivery
                </p>
              </div>

              <button
                type="button"
                disabled={isLoading || isAttached}
                onClick={() => handleToggle(item.addOnId)}
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
