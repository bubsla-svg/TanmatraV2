// Last-7-days bars: four metrics × seven days vs the daily target. Single-hue
// gold fill on a neutral track (the brand accent for data), value in each bar's
// title for screen readers. Presentational; the server pads missing days.
import { pctOf, type WellnessWeek, type DayTotals, type WeekTargets } from "@/lib/wellnessApi";

const METRICS: { key: keyof DayTotals; tKey: keyof WeekTargets; label: string; unit: string }[] = [
  { key: "calories", tKey: "calorieTarget", label: "Calories", unit: "" },
  { key: "proteinGrams", tKey: "proteinTargetGrams", label: "Protein", unit: "g" },
  { key: "fiberGrams", tKey: "fiberTargetGrams", label: "Fibre", unit: "g" },
  { key: "waterMl", tKey: "waterTargetMl", label: "Water", unit: "ml" },
];

const dow = (iso: string) => new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-IN", { weekday: "narrow", timeZone: "UTC" });

export function WeekBars({ week }: { week: WellnessWeek }) {
  if (!week.targets || week.days.length === 0) return null;
  const targets = week.targets;
  return (
    <div>
      <h2 className="text-sm font-semibold text-ink">Last 7 days</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {METRICS.map((m) => {
          const target = targets[m.tKey];
          return (
            <div key={m.key} className="rounded-2xl border border-line bg-surface p-3">
              <p className="text-[11px] font-medium text-ink">{m.label}<span className="text-ink-faint"> · target {target}{m.unit}</span></p>
              <div className="mt-2 flex items-end gap-1">
                {week.days.map((d) => {
                  const value = d[m.key];
                  return (
                    <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-12 w-full items-end rounded-sm bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]" title={`${dow(d.date)} — ${Math.round(value)}${m.unit}`}>
                        <div className="w-full rounded-sm bg-gold" style={{ height: `${pctOf(value, target)}%` }} />
                      </div>
                      <span className="text-[9px] text-ink-faint">{dow(d.date)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
