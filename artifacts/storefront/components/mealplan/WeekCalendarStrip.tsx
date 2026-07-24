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
      <div className="flex gap-1.5">
        {DAYS.map((d, i) => {
          const kind = calendar[i] ?? "normal";
          const on = kind !== "normal";
          return (
            <button
              key={d}
              type="button"
              onClick={() => onCycle(i)}
              className={`flex-1 rounded-lg border px-1 py-1.5 text-center text-[11px] font-medium ${
                on ? "border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] text-gold-text" : "border-line text-ink-muted hover:text-ink"
              }`}
            >
              <span className="block">{d}</span>
              <span className="block text-[9px] text-ink-faint">{LABEL[kind]}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-ink-faint">Tap a day to mark gym / travel / WFH — applied next time you regenerate.</p>
    </div>
  );
}
