"use client";
// Client: a compact free-text tag editor (add on Enter / comma / blur, remove
// via ×). The server lowercases + dedupes on save, so this only guards against
// an obvious same-session duplicate; casing is normalised on the round-trip.
import { useState } from "react";

/** route-11 brief distinguishes the two chip kinds: allergens carry a clinical
 *  signal tint, plain taste lists stay neutral. */
const TONE_CHIP = {
  signal: "bg-sage-soft text-sage-text",
  neutral: "bg-surface-raised text-ink",
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
      <span className="text-xs font-bold uppercase tracking-wider text-gold-text">{label}</span>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((v) => (
            <li
              key={v}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-medium uppercase tracking-wider ${TONE_CHIP[tone]}`}
            >
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="leading-none text-ink-muted hover:text-ink"
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
        className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm font-normal text-ink"
      />
    </label>
  );
}
