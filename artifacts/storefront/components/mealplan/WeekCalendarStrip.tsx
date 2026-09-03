"use client";
// Per-weekday context (gym/travel/wfh) that tunes the NEXT generate — gym days
// scale the calorie target up, travel down. Applied on regenerate, not live.
import type { WeekDayCalendarKind } from "@/lib/mealPlanApi";
import { Rail } from "@/components/primitives/Rail";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LABEL: Record<WeekDayCalendarKind, string> = { normal: "Normal", gym: "Gym", travel: "Travel", wfh: "WFH" };

export function WeekCalendarStrip({ calendar, onCycle }: {
  calendar: WeekDayCalendarKind[];
  onCycle: (dayIndex: number) => void;
}) {
  return (
    <div>
      <Rail as="ul" snap="none" bleed="gutter" className="gap-2 pb-1">
        {DAYS.map((d, i) => {
          const kind = calendar[i] ?? "normal";
          const on = kind !== "normal";
          return (
            <li key={d} className="shrink-0">
              <button
                type="button"
                onClick={() => onCycle(i)}
                className={`flex h-20 w-14 flex-col items-center justify-center gap-1.5 rounded-full border transition-colors active:scale-[0.98] ${
                  on
                    ? "border-gold bg-primary/10 text-primary"
                    : "border-transparent bg-secondary text-ink-muted hover:text-ink"
                }`}
              >
                <span className="font-data block text-sm font-bold tracking-wide">{d}</span>
                <span className={`block text-[10px] font-bold uppercase tracking-[.16em] ${on ? "" : "text-ink-faint"}`}>
                  {LABEL[kind]}
                </span>
              </button>
            </li>
          );
        })}
      </Rail>
      <p className="mt-2 text-xs leading-relaxed text-ink-faint">Tap a day to mark gym / travel / WFH — applied next time you regenerate.</p>
    </div>
  );
}
