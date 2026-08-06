/** Step indicator (02c — "step dots N/total" on every screen). Server-safe,
 *  fixed-height so it never shifts the sticky total below it. */
export function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex h-2.5 items-center gap-2" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        // Fixed size-2.5 box always; the "current" dot grows via `scale`
        // (transform), never by changing `size-*` — a width/height
        // transition runs on the main thread, `transform` runs on the
        // compositor.
        <span
          key={i}
          className={`size-2.5 rounded-full transition-transform duration-200 ${
            i === current - 1
              ? "scale-100 bg-gold shadow-[0_0_8px_color-mix(in_srgb,var(--gold)_45%,transparent)]"
              : i < current
                ? "scale-[0.6] bg-gold"
                : "scale-[0.6] bg-[var(--line-strong)]"
          }`}
        />
      ))}
    </div>
  );
}
