"use client";
// Field primitives for the RD partner wizard (Stitch brief 16). Presentational
// only — every control is fully controlled by PartnerWizard, which owns the
// draft. Nothing here holds state, so a step can unmount without losing input.

import type { ReactNode } from "react";

const controlCls =
  "w-full rounded-xl border bg-bg px-4 py-4 text-base text-ink outline-none transition-colors focus:border-[var(--gold)]";

/** Caps label + optional inline error, wrapped around any control. */
export function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  error?: string | undefined;
  /** Right-aligned counter or helper, e.g. "0 / 2000". */
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className={`text-3xs font-semibold uppercase tracking-widest ${
            error ? "text-[var(--danger)]" : "text-ink-faint"
          }`}
        >
          {label}
        </label>
        {hint && <span className="tabular text-3xs text-ink-faint">{hint}</span>}
      </div>
      {children}
      {error && (
        <p role="alert" className="text-2xs font-medium text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

/** type="email"/"tel" imply their own autoComplete hint unless the caller
 *  overrides it — a plain "text" field (name, company, free text) has none. */
const DEFAULT_AUTOCOMPLETE: Partial<Record<"text" | "email" | "tel" | "number", string>> = {
  email: "email",
  tel: "tel",
};

export function TextField({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  invalid = false,
  inputMode,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "number";
  invalid?: boolean;
  inputMode?: "numeric";
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete ?? DEFAULT_AUTOCOMPLETE[type]}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      className={`${controlCls} ${invalid ? "border-[var(--danger)]" : "border-line"} ${
        type === "number" || inputMode === "numeric" ? "tabular" : ""
      }`}
    />
  );
}

export function TextAreaField({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  invalid = false,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  invalid?: boolean;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={`${controlCls} resize-none ${invalid ? "border-[var(--danger)]" : "border-line"}`}
    />
  );
}

export function SelectField({
  id,
  value,
  onChange,
  options,
  placeholder,
  invalid = false,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={`${controlCls} appearance-none pr-10 ${invalid ? "border-[var(--danger)]" : "border-line"}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

/** Multi-select chip cloud. Gold border + gold ink marks a chosen chip. */
export function ChipCloud({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(o)}
              className={`rounded-full border px-4 py-2 text-xs transition-colors ${
                on
                  ? "border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] text-gold-text"
                  : "border-line text-ink-muted hover:border-line-strong"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Single-choice segmented control in a tray. */
export function Segmented({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="flex gap-1 rounded-xl border border-line bg-bg p-1">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={`flex-1 rounded-lg px-3 py-3 text-xs font-medium transition-colors ${
                on ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
