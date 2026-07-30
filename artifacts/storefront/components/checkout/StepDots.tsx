/** Step indicator (02c — "step dots N/total" on every screen). Server-safe,
 *  fixed-height so it never shifts the sticky total below it. */
export function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex h-2.5 items-center gap-2" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`rounded-full transition-all ${
            i === current - 1
              ? "size-2.5 bg-gold shadow-[0_0_8px_color-mix(in_srgb,var(--gold)_45%,transparent)]"
              : i < current
                ? "size-1.5 bg-gold"
                : "size-1.5 bg-[var(--line-strong)]"
          }`}
        />
      ))}
    </div>
  );
}
