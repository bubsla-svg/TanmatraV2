// Progress ring — value toward a daily target, as an SVG arc. Presentational.
// route-10 brief: each ring is its own raised card, 96px arc, gold percentage
// centred, caps label and a "value / target unit" readout beneath.
const R = 40;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function NutritionRing({ label, value, target, unit, done }: {
  label: string;
  value: number;
  target: number;
  unit: string;
  done: number; // 0–100
}) {
  const offset = CIRCUMFERENCE * (1 - done / 100);
  const readout = `${Math.round(value).toLocaleString("en-IN")} / ${Math.round(target).toLocaleString("en-IN")}${unit ? ` ${unit}` : ""}`;
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-line bg-surface p-6">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90" aria-hidden>
          <circle cx="48" cy="48" r={R} fill="none" stroke="var(--line)" strokeWidth="6" />
          <circle
            cx="48"
            cy="48"
            r={R}
            fill="none"
            stroke="var(--gold)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="tabular absolute inset-0 flex items-center justify-center text-xl text-gold-text">
          {done}%
        </span>
      </div>
      <div className="text-center">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
        <p className="tabular text-sm text-ink">{readout}</p>
      </div>
    </div>
  );
}
