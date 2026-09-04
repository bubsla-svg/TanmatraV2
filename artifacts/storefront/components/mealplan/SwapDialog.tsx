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
import { useOverlayHistory } from "@/components/ui/useOverlayHistory";

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

  // Mounted only while "open" (see MealPlanner.tsx) — the back gesture closes
  // this dialog instead of leaving /meal-planner.
  useOverlayHistory(true, onClose);

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        {/* Scrim: --scrim, never data-stitch — see the invariant on
            components/ui/drawer.tsx's DrawerOverlay. */}
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-modal)] animate-fade-in bg-[var(--scrim)] backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-20 z-[var(--z-modal)] w-[92vw] max-w-md -translate-x-1/2 animate-dialog-in overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-raised)]"
        >
          <Dialog.Title className="border-b border-line px-5 py-4 font-display text-xl font-semibold leading-tight text-primary">
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
                <button type="button" onClick={() => void suggestionsQuery.refetch()} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-xs font-semibold text-ink transition-colors hover:border-line-strong">Try again</button>
              </div>
            )}
            {items?.length === 0 && <p className="p-3 text-sm leading-relaxed text-ink-muted">No safe alternatives match your constraints.</p>}
            {items?.map((it) => (
              <button
                key={it.dishId}
                type="button"
                onClick={() => onPick(it.dishId)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-secondary active:scale-[0.98]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-display text-lg font-semibold leading-tight text-primary">{it.name}</span>
                  <span className="font-data block text-xs text-ink-muted">{it.calories} kcal · {it.protein}g protein</span>
                </span>
                <span className="font-data shrink-0 text-sm font-bold text-primary">{formatPaise(it.pricePaise)}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-line p-2">
            <Dialog.Close className="flex min-h-11 w-full items-center justify-center rounded-full px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink">
              Cancel
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
