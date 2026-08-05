import { memo, useCallback } from "react";
import { formatPaise } from "@/lib/format";
import { MEAL_SLOTS, type MealPlanDay, type MealPlanSlot, type MealPlanSlotEntry, formatPlanDay } from "@/lib/mealPlanApi";
import { SafeImage } from "@/components/ui/SafeImage";

const SLOT_LABEL: Record<MealPlanSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

/**
 * One day of the week — three slots, each with its dish + macros/price and,
 * while the plan is a draft, a Swap control.
 *
 * `memo`'d: MealPlanner renders one of these per day of the week (7 up),
 * and `mp` (useMealPlan) re-renders the whole planner on every write
 * (busy toggling, an unrelated day's regen resolving, etc). `onSwap`/
 * `onRegen` are dayIndex-parametrised and defined ONCE in MealPlanner
 * (not recreated per item in the .map()), so their identity is stable —
 * which is what lets memo actually skip the 6 days that didn't change.
 */
export const DayCard = memo(function DayCard({ day, dayIndex, editable, onSwap, onRegen }: {
  day: MealPlanDay;
  dayIndex: number;
  editable: boolean;
  onSwap: (dayIndex: number, slot: MealPlanSlot) => void;
  onRegen?: (dayIndex: number) => void;
}) {
  const handleRegen = useCallback(() => onRegen?.(dayIndex), [onRegen, dayIndex]);

  return (
    <div className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-ink">{formatPlanDay(day.date)}</p>
        {editable && onRegen && (
          <button type="button" onClick={handleRegen} className="rounded-full border border-line px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted hover:border-line-strong hover:text-ink active:scale-[0.98]">Regen</button>
        )}
      </div>
      <ul className="mt-4 flex flex-col gap-4">
        {MEAL_SLOTS.map((slot) => {
          const entry = day[slot];
          return (
            <li key={slot} className="flex items-center gap-4">
              {entry ? (
                <SafeImage src={entry.image} className="h-16 w-16 shrink-0 rounded-2xl" />
              ) : (
                <div aria-hidden className="h-16 w-16 shrink-0 rounded-2xl border border-dashed border-line bg-surface-raised" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">{SLOT_LABEL[slot]}</p>
                {entry ? <SlotLine entry={entry} /> : <p className="mt-0.5 text-sm italic text-ink-muted">No dish picked</p>}
              </div>
              {editable && (
                <button
                  type="button"
                  onClick={() => onSwap(dayIndex, slot)}
                  aria-label={`Swap ${SLOT_LABEL[slot]}`}
                  className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-muted hover:border-line-strong hover:text-ink active:scale-[0.98]"
                >
                  Swap
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
});

function SlotLine({ entry }: { entry: MealPlanSlotEntry }) {
  return (
    <>
      <p className="mt-0.5 truncate text-sm font-medium text-ink">{entry.name}</p>
      <p className="tabular mt-1 text-[11px] text-ink-muted">
        {entry.calories} kcal · {entry.protein}g · {formatPaise(entry.pricePaise)}
      </p>
    </>
  );
}
