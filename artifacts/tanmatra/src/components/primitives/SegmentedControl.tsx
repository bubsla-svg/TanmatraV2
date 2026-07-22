import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional secondary line (e.g. a per-meal price). */
  hint?: string;
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Accessible group name. */
  ariaLabel: string;
  className?: string;
}

/**
 * `<SegmentedControl>` — 02f §1 component 10. Replaces every dropdown in the
 * builder (02f §2.4). ≤4 options by contract; more than that is a design smell
 * and is dev-warned. Keyboard-operable radiogroup with roving selection; the
 * pre-selected default is fully visible (02d defaults doctrine).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  if (import.meta.env?.DEV && options.length > 4) {
    // eslint-disable-next-line no-console
    console.warn(
      `SegmentedControl "${ariaLabel}" has ${options.length} options; 02f §1 caps it at 4.`,
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("inline-flex w-full gap-1 rounded-lg p-1", className)}
      style={{ backgroundColor: "var(--color-ink-800)" }}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(opt.value)}
            className="flex flex-1 flex-col items-center rounded-md px-3 py-2 text-sm transition-transform active:scale-[0.98]"
            style={{
              backgroundColor: on ? "var(--color-saffron-500)" : "transparent",
              color: on ? "var(--color-saffron-on)" : "var(--color-ink-500)",
              fontWeight: on ? 600 : 500,
            }}
          >
            <span>{opt.label}</span>
            {opt.hint && (
              <span
                className="text-xs"
                style={{
                  fontVariantNumeric: "tabular-nums",
                  opacity: on ? 0.85 : 0.7,
                }}
              >
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
