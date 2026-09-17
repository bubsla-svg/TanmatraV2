"use client";
// Client: a controlled checkbox in the guest money path.
import type { RefObject } from "react";
import { DPDP_CONSENT_COPY, DPDP_CONSENT_SHORT, DPDP_SCOPE_NOTE } from "@/lib/consent";

/**
 * The DPDP consent row (T6): ONE line beside a 24px box, the whole 48px row
 * the tap target (T-10), and the full scope statement one tap away in a
 * disclosure beneath — not a paragraph of legalese between the address and
 * the pay bar. The disclosure sits outside the <label> on purpose: a second
 * interactive control inside a label makes the checkbox toggle on every tap
 * meant for the summary.
 */
export function ConsentControl({
  checked,
  onCheckedChange,
  invalid,
  inputRef,
  errorClassName,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** True once a submit was attempted with the box unticked. */
  invalid: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  errorClassName: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex min-h-12 w-full cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-3 text-sm text-ink-muted">
        <input
          ref={inputRef}
          type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)}
          aria-invalid={invalid} aria-describedby={invalid ? "alc-consent-err" : undefined}
          className="mt-0.5 size-6 shrink-0 cursor-pointer accent-[var(--gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        />
        <span>
          {DPDP_CONSENT_SHORT}
          {invalid && <span id="alc-consent-err" role="alert" className={errorClassName}>Tick this to continue — we can&rsquo;t cook without it.</span>}
        </span>
      </label>
      <details className="group px-3 text-xs text-ink-faint">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-medium text-ink-muted underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
          What this covers
          <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <p>{DPDP_CONSENT_COPY}</p>
        <p className="mt-1">{DPDP_SCOPE_NOTE}</p>
      </details>
    </div>
  );
}
