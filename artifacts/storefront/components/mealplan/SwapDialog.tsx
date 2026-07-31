"use client";
// Slot-swap picker. Fetches server-suggested alternatives (constraint-safe by
// construction — the server filters allergens / repetition / availability) for
// one (day, slot); picking one calls back to the island, which does the swap.
// Only rendered from /meal-planner (a Stitch dark route, lib/stitchRoutes.ts).
// Radix portals the panel to document.body, but data-stitch lives on <html>
// (a DOM ancestor of body), so color-scheme inherits through the portal with
// no scope attribute needed here.
import { Dialog } from "radix-ui";
import { useQuery } from "@tanstack/react-query";
import { formatPaise } from "@/lib/format";
import { getSwapSuggestions, type MealPlanSlot } from "@/lib/mealPlanApi";

const SLOT_LABEL: Record<MealPlanSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

export function SwapDialog({ planId, target, onClose, onPick }: {
  planId: number;
  target: { dayIndex: number; slot: MealPlanSlot };
  onClose: () => void;
  onPick: (dishId: number) => void;
}) {
  const suggestionsQuery = useQuery({
    queryKey: ["mealplan", "swap-options", planId, target.dayIndex, target.slot],
    queryFn: () => getSwapSuggestions(planId, target.dayIndex, target.slot),
  });
  const items = suggestionsQuery.data?.suggestions ?? null;

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        {/* Scrim: --scrim, never data-stitch — see the invariant on
            components/ui/drawer.tsx's DrawerOverlay. */}
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-[var(--scrim)] backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-20 z-[var(--z-modal)] w-[92vw] max-w-md -translate-x-1/2 overflow-hidden rounded-3xl border border-line bg-surface shadow-lg"
        >
          <Dialog.Title className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
            Swap {SLOT_LABEL[target.slot]}
          </Dialog.Title>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {suggestionsQuery.isPending && (
              <div aria-hidden className="flex flex-col gap-2 p-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-raised" />
                ))}
              </div>
            )}
            {suggestionsQuery.isError && (
              <div className="flex flex-col items-center gap-2 p-4 text-center">
                <p className="text-sm font-semibold text-[var(--danger)]">Couldn&rsquo;t load alternatives</p>
                <button type="button" onClick={() => void suggestionsQuery.refetch()} className="rounded-lg border border-line px-4 py-1.5 text-xs font-semibold text-gold-text transition-opacity hover:opacity-80">Try again</button>
              </div>
            )}
            {items?.length === 0 && <p className="p-3 text-sm text-ink-muted">No safe alternatives match your constraints.</p>}
            {items?.map((it) => (
              <button
                key={it.dishId}
                type="button"
                onClick={() => onPick(it.dishId)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-bg active:scale-[0.98]"
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
            <Dialog.Close className="w-full rounded-full px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink">
              Cancel
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
