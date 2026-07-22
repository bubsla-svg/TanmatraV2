/** Step indicator (02c — "step dots N/total" on every screen). Server-safe,
 *  fixed-height so it never shifts the sticky total below it. */
export function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-1.5 rounded-full transition-all"
          style={{
            width: i === current - 1 ? 20 : 8,
            background: i < current ? "var(--gold)" : "var(--line-strong)",
          }}
        />
      ))}
    </div>
  );
}
