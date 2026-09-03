"use client";
// Client: a compact free-text tag editor (add on Enter / comma / blur, remove
// via ×). The server lowercases + dedupes on save, so this only guards against
// an obvious same-session duplicate; casing is normalised on the round-trip.
import { useState } from "react";

/** route-11 brief distinguishes the two chip kinds: allergens carry a clinical
 *  signal tint, plain taste lists stay neutral. */
const TONE_CHIP = {
  signal: "border-transparent bg-sage-soft text-sage-text",
  neutral: "border-gold bg-primary/10 text-primary",
} as const;

export function ChipInput({
  label,
  values,
  placeholder,
  tone = "neutral",
  onChange,
}: {
  label: string;
  values: string[];
  placeholder?: string;
  tone?: keyof typeof TONE_CHIP;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      onChange([...values, v]);
    }
    setDraft("");
  }

  return (
    <label className="flex flex-col gap-3 text-sm font-medium text-ink">
      <span className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">{label}</span>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((v) => (
            <li
              key={v}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium ${TONE_CHIP[tone]}`}
            >
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="-mr-1 inline-flex size-6 items-center justify-center rounded-full leading-none text-ink-muted hover:text-ink"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        className="w-full min-h-[50px] rounded-2xl border border-line bg-bg px-4 py-3 text-base font-normal text-ink outline-none placeholder:text-ink-faint focus-visible:border-primary"
      />
    </label>
  );
}
