"use client";
// Client: a controlled day/window choice — native date input and select.
import { useMemo, useState } from "react";
import {
  cutoffNotice,
  dayLabel,
  defaultDayChoice,
  groupSlots,
  slotWindowLabel,
  type DayChoice,
  type DeliverySlot,
} from "@/lib/deliverySlots";

const segmentCls = (on: boolean) =>
  `min-h-11 flex-1 rounded-full px-3 text-sm font-medium transition-colors active:scale-[0.98] disabled:opacity-40 ${
    on ? "bg-primary/10 font-semibold text-primary" : "text-ink-muted hover:text-ink"
  }`;

const fieldCls =
  "w-full min-h-[50px] rounded-2xl border border-line bg-surface px-4 text-base text-ink outline-none focus-visible:border-primary";

/**
 * "When" step for the à-la-carte checkout (T-08). Today / Tomorrow / Pick a
 * day as a 44px segmented control, then a NATIVE date input (bounded by the
 * server's window) and a NATIVE select of that day's windows — no custom
 * calendar. Every option is a row the server returned; a closed or full
 * window is simply absent, and the cut-off is stated as system status.
 */
export function DeliverySlotPicker({
  slots,
  value,
  onChange,
  now = new Date(),
}: {
  slots: DeliverySlot[];
  value: DeliverySlot | null;
  onChange: (slot: DeliverySlot | null) => void;
  now?: Date;
}) {
  const groups = useMemo(() => groupSlots(slots, now), [slots, now]);
  const [day, setDay] = useState<DayChoice | null>(() => defaultDayChoice(groups));
  const [laterDate, setLaterDate] = useState<string>(() => groups.later[0]?.date ?? "");
  const notice = cutoffNotice(groups, now);

  const dayChoice = day ?? defaultDayChoice(groups);
  const laterDay = groups.later.find((d) => d.date === laterDate) ?? groups.later[0];
  const options =
    dayChoice === "today" ? groups.today : dayChoice === "tomorrow" ? groups.tomorrow : laterDay?.slots ?? [];

  function pickDay(next: DayChoice) {
    setDay(next);
    const first =
      next === "today" ? groups.today[0] : next === "tomorrow" ? groups.tomorrow[0] : laterDay?.slots[0];
    onChange(first ?? null);
  }

  if (dayChoice === null) {
    return (
      <p role="status" className="text-xs font-medium text-ink-muted">
        No delivery windows are open right now — we&rsquo;ll deliver in the next window the kitchen opens.
      </p>
    );
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="font-display text-xl font-semibold leading-tight text-primary">When should it arrive?</legend>
      <div role="group" aria-label="Delivery day" className="flex gap-1 rounded-full border border-line bg-surface p-1">
        <button type="button" aria-pressed={dayChoice === "today"} disabled={groups.today.length === 0} onClick={() => pickDay("today")} className={segmentCls(dayChoice === "today")}>
          Today
        </button>
        <button type="button" aria-pressed={dayChoice === "tomorrow"} disabled={groups.tomorrow.length === 0} onClick={() => pickDay("tomorrow")} className={segmentCls(dayChoice === "tomorrow")}>
          Tomorrow
        </button>
        <button type="button" aria-pressed={dayChoice === "later"} disabled={groups.later.length === 0} onClick={() => pickDay("later")} className={segmentCls(dayChoice === "later")}>
          Pick a day
        </button>
      </div>

      {notice && (
        <p role="status" className="text-xs font-medium text-ink-muted">
          {notice}
        </p>
      )}

      {dayChoice === "later" && groups.later.length > 0 && (
        <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">
          Day
          <input
            type="date"
            value={laterDay?.date ?? ""}
            min={groups.later[0]?.date}
            max={groups.later[groups.later.length - 1]?.date}
            onChange={(e) => {
              const next = groups.later.find((d) => d.date === e.target.value);
              // A date the server offers nothing for stays on the last valid day.
              if (!next) return;
              setLaterDate(next.date);
              onChange(next.slots[0] ?? null);
            }}
            className={fieldCls}
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">
        Window · {dayChoice === "later" && laterDay ? dayLabel(laterDay.date, now) : dayChoice === "today" ? "Today" : "Tomorrow"}
        <select
          value={value && options.some((s) => s.id === value.id) ? String(value.id) : ""}
          onChange={(e) => onChange(options.find((s) => String(s.id) === e.target.value) ?? null)}
          data-testid="alc-slot"
          className={fieldCls}
        >
          <option value="" disabled>
            Choose a window
          </option>
          {options.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {slotWindowLabel(s)}
              {s.remaining <= 3 ? ` · ${s.remaining} left` : ""}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
