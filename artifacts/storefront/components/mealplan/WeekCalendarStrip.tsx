"use client";
// Per-weekday context (gym/travel/wfh) that tunes the NEXT generate — gym days
// scale the calorie target up, travel down. Applied on regenerate, not live.
import type { WeekDayCalendarKind } from "@/lib/mealPlanApi";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LABEL: Record<WeekDayCalendarKind, string> = { normal: "Normal", gym: "Gym", travel: "Travel", wfh: "WFH" };

export function WeekCalendarStrip({ calendar, onCycle }: {
  calendar: WeekDayCalendarKind[];
  onCycle: (dayIndex: number) => void;
}) {
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map((d, i) => {
          const kind = calendar[i] ?? "normal";
          const on = kind !== "normal";
          return (
            <button
              key={d}
              type="button"
              onClick={() => onCycle(i)}
              className={`flex h-20 w-12 shrink-0 flex-col items-center justify-center gap-1.5 rounded-full active:scale-[0.98] ${
                on
                  ? "bg-gold text-[var(--gold-ink)]"
                  : "border border-line text-ink-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              <span className="block font-mono text-sm font-semibold tracking-wide">{d}</span>
              <span className={`block font-mono text-3xs uppercase tracking-widest ${on ? "" : "text-ink-faint"}`}>
                {LABEL[kind]}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-2xs text-ink-faint">Tap a day to mark gym / travel / WFH — applied next time you regenerate.</p>
    </div>
  );
}
