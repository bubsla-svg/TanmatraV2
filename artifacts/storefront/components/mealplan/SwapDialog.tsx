"use client";
// Slot-swap picker. Fetches server-suggested alternatives (constraint-safe by
// construction — the server filters allergens / repetition / availability) for
// one (day, slot); picking one calls back to the island, which does the swap.
import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { formatPaise } from "@/lib/format";
import { getSwapSuggestions, type MealPlanSlot, type MealPlanSlotEntry } from "@/lib/mealPlanApi";

const SLOT_LABEL: Record<MealPlanSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

export function SwapDialog({ planId, target, onClose, onPick }: {
  planId: number;
  target: { dayIndex: number; slot: MealPlanSlot };
  onClose: () => void;
  onPick: (dishId: number) => void;
}) {
  const [items, setItems] = useState<MealPlanSlotEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getSwapSuggestions(planId, target.dayIndex, target.slot)
      .then((r) => { if (live) setItems(r.suggestions); })
      .catch(() => { if (live) setError("Couldn't load alternatives."); });
    return () => { live = false; };
  }, [planId, target.dayIndex, target.slot]);

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--ink)]/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-20 z-50 w-[92vw] max-w-md -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        >
          <Dialog.Title className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
            Swap {SLOT_LABEL[target.slot]}
          </Dialog.Title>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {error && <p className="p-3 text-sm text-ink-muted">{error}</p>}
            {!error && items === null && <p className="p-3 text-sm text-ink-muted">Finding alternatives…</p>}
            {items?.length === 0 && <p className="p-3 text-sm text-ink-muted">No safe alternatives match your constraints.</p>}
            {items?.map((it) => (
              <button
                key={it.dishId}
                type="button"
                onClick={() => onPick(it.dishId)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-bg"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{it.name}</span>
                  <span className="tabular block text-[11px] text-ink-muted">{it.calories} kcal · {it.protein}g protein</span>
                </span>
                <span className="tabular shrink-0 text-sm font-semibold text-ink">{formatPaise(it.pricePaise)}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-line p-2">
            <Dialog.Close className="w-full rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink">
              Cancel
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
