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
      <h2 className="text-xl font-medium text-ink">Last 7 days</h2>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {METRICS.map((m) => {
          const target = targets[m.tKey];
          return (
            <div key={m.key} className="rounded-3xl border border-line bg-surface p-5">
              <p className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
                {m.label}
                <span className="tabular font-normal normal-case tracking-normal text-ink-faint"> · target {target}{m.unit}</span>
              </p>
              <div className="mt-4 flex items-end gap-1">
                {week.days.map((d) => {
                  const value = d[m.key];
                  return (
                    <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-12 w-full items-end overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]" title={`${dow(d.date)} — ${Math.round(value)}${m.unit}`}>
                        <div className="w-full rounded-full bg-gold" style={{ height: `${pctOf(value, target)}%` }} />
                      </div>
                      <span className="tabular text-3xs text-ink-faint">{dow(d.date)}</span>
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
