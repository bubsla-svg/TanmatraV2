import { formatPaise } from "@/lib/format";
import { MEAL_SLOTS, type MealPlanDay, type MealPlanSlot, type MealPlanSlotEntry, formatPlanDay } from "@/lib/mealPlanApi";

const SLOT_LABEL: Record<MealPlanSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

/** One day of the week — three slots, each with its dish + macros/price and,
 *  while the plan is a draft, a Swap control. */
export function DayCard({ day, editable, onSwap }: {
  day: MealPlanDay;
  editable: boolean;
  onSwap: (slot: MealPlanSlot) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-ink">{formatPlanDay(day.date)}</p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {MEAL_SLOTS.map((slot) => {
          const entry = day[slot];
          return (
            <li key={slot} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{SLOT_LABEL[slot]}</p>
                {entry ? <SlotLine entry={entry} /> : <p className="text-sm italic text-ink-muted">No dish picked</p>}
              </div>
              {editable && (
                <button
                  type="button"
                  onClick={() => onSwap(slot)}
                  aria-label={`Swap ${SLOT_LABEL[slot]}`}
                  className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-muted hover:border-[var(--gold)] hover:text-ink"
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
}

function SlotLine({ entry }: { entry: MealPlanSlotEntry }) {
  return (
    <>
      <p className="truncate text-sm font-medium text-ink">{entry.name}</p>
      <p className="tabular text-[11px] text-ink-muted">
        {entry.calories} kcal · {entry.protein}g · {formatPaise(entry.pricePaise)}
      </p>
    </>
  );
}
