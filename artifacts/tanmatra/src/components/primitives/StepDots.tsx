import { cn } from "@/lib/utils";
import { stepDotIndices, clampStep } from "./logic";

interface StepDotsProps {
  current: number;
  total: number;
  className?: string;
}

/**
 * `<StepDots>` — 02f §1 component 12. Non-interactive checkout progress
 * (1/3 → 3/3). Announces position to assistive tech; dots themselves are
 * decorative. Never a navigation control — a step is reached by completing
 * the prior one, never by tapping a dot.
 */
export function StepDots({ current, total, className }: StepDotsProps) {
  const active = clampStep(current, total);
  return (
    <div
      className={cn("inline-flex items-center gap-1.5", className)}
      role="img"
      aria-label={`Step ${active} of ${Math.max(0, Math.floor(total))}`}
    >
      {stepDotIndices(total).map((i) => {
        const done = i + 1 <= active;
        return (
          <span
            key={i}
            aria-hidden="true"
            style={{
              width: done ? 18 : 7,
              height: 7,
              borderRadius: 9999,
              backgroundColor: done
                ? "var(--color-saffron-500)"
                : "var(--color-ink-600)",
              transition: "width 180ms ease",
            }}
          />
        );
      })}
    </div>
  );
}
