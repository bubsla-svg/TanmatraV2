"use client";
// Client: a compact free-text tag editor (add on Enter / comma / blur, remove
// via ×). The server lowercases + dedupes on save, so this only guards against
// an obvious same-session duplicate; casing is normalised on the round-trip.
import { useState } from "react";

export function ChipInput({
  label,
  values,
  placeholder,
  onChange,
}: {
  label: string;
  values: string[];
  placeholder?: string;
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
    <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
      {label}
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <li
              key={v}
              className="flex items-center gap-1 rounded-full bg-sage-soft px-2.5 py-1 text-xs font-medium text-sage-text"
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
