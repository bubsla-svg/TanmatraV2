import { cn } from "@/lib/utils";
import { shouldShowMacroNumerals } from "./logic";

export interface MacroValues {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

interface MacroReadoutProps {
  macros: MacroValues;
  /** Verified per the A5 gate. false → labels without numerals (a dish whose
   *  macros are estimated/provisional never shows numbers here). */
  verified: boolean;
  className?: string;
}

const ROWS: Array<{ key: keyof MacroValues; label: string; token: string; unit: string }> = [
  { key: "calories", label: "Calories", token: "var(--color-ink-500)", unit: "kcal" },
  { key: "protein", label: "Protein", token: "var(--color-macro-protein)", unit: "g" },
  { key: "carbs", label: "Carbs", token: "var(--color-macro-carbs)", unit: "g" },
  { key: "fat", label: "Fat", token: "var(--color-macro-fat)", unit: "g" },
];

/**
 * `<MacroReadout>` — 02f §1 component 5. Renders the four macro rows. When
 * `verified` is false the numerals are suppressed and a single "being verified"
 * note is shown instead (Brief A5 display gate) — safety copy is never gated,
 * but unverified *numbers* are never asserted as fact.
 */
export function MacroReadout({ macros, verified, className }: MacroReadoutProps) {
  const showNumbers = shouldShowMacroNumerals(verified);
  return (
    <div className={cn("flex flex-col gap-1", className)} role="group" aria-label="Nutrition">
      {ROWS.map((row) => (
        <div key={row.key} className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: 9999,
                backgroundColor: row.token,
                display: "inline-block",
              }}
            />
            {row.label}
          </span>
          {showNumbers ? (
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {macros[row.key]}
              {row.unit}
            </span>
          ) : null}
        </div>
      ))}
      {!showNumbers && (
        <p className="text-xs" style={{ color: "var(--color-ink-500)" }}>
          Macros are being verified — numbers appear once RD-checked.
        </p>
      )}
    </div>
  );
}
