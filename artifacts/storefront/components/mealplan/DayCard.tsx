import { memo, useCallback } from "react";
import { formatPaise } from "@/lib/format";
import { MEAL_SLOTS, type MealPlanDay, type MealPlanSlot, type MealPlanSlotEntry, formatPlanDay } from "@/lib/mealPlanApi";
import { DishImage } from "@/components/menu/DishImage";

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
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">{formatPlanDay(day.date)}</p>
        {editable && onRegen && (
          <button type="button" onClick={handleRegen} className="-my-2 inline-flex min-h-11 items-center rounded-full border border-line px-4 text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted transition-colors hover:border-line-strong hover:text-ink active:scale-[0.98]">Regen</button>
        )}
      </div>
      <ul className="mt-4 flex flex-col gap-4">
        {MEAL_SLOTS.map((slot) => {
          const entry = day[slot];
          return (
            <li key={slot} className="flex items-center gap-4">
              {entry ? (
                <DishImage src={entry.image} name={entry.name} sizes="64px" className="h-16 w-16 shrink-0 rounded-xl" />
              ) : (
                <div aria-hidden className="h-16 w-16 shrink-0 rounded-xl border border-dashed border-line bg-surface-raised" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">{SLOT_LABEL[slot]}</p>
                {entry ? <SlotLine entry={entry} /> : <p className="mt-0.5 text-sm italic text-ink-muted">No dish picked</p>}
              </div>
              {editable && (
                <button
                  type="button"
                  onClick={() => onSwap(dayIndex, slot)}
                  aria-label={`Swap ${SLOT_LABEL[slot]}`}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line px-4 text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted transition-colors hover:border-line-strong hover:text-ink active:scale-[0.98]"
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
      <p className="mt-0.5 truncate font-display text-lg font-semibold leading-tight text-primary">{entry.name}</p>
      <p className="font-data mt-1 text-xs text-ink-muted">
        {entry.calories} kcal · {entry.protein}g · {formatPaise(entry.pricePaise)}
      </p>
    </>
  );
}
