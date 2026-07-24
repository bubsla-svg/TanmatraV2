// Progress ring — value toward a daily target, as an SVG arc. Presentational.
export function NutritionRing({ label, value, target, unit, done }: {
  label: string;
  value: number;
  target: number;
  unit: string;
  done: number; // 0–100
}) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - done / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--gold)" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
        </svg>
        <span className="tabular absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-ink">{done}%</span>
      </div>
      <p className="text-[11px] font-medium text-ink">{label}</p>
      <p className="tabular text-[10px] text-ink-faint">{Math.round(value)}/{Math.round(target)}{unit}</p>
    </div>
  );
}
