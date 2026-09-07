// Server-safe (no "use client"): pure presentation, shared by every checkout
// mode so a pantry item, a membership and a consult all state the ask the same
// way the meal legs do — what you are buying, what it costs, above the CTA.
import type { ReactNode } from "react";

export interface SummaryLine {
  label: string;
  /** The SERVER's figure, already formatted. Omit for a plain caption line. */
  value?: string;
}

export function PurchaseSummary({
  title,
  lines,
  note,
  children,
}: {
  title: string;
  lines: SummaryLine[];
  note?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-line bg-surface p-5">
      <h1 className="font-display text-2xl font-semibold leading-tight tracking-[-.02em] text-primary">
        {title}
      </h1>
      <dl className="mt-4 flex flex-col gap-2">
        {lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-ink-muted">{line.label}</dt>
            {line.value && (
              <dd className="font-data text-sm font-semibold text-ink">{line.value}</dd>
            )}
          </div>
        ))}
      </dl>
      {note && <p className="mt-4 text-xs leading-relaxed text-ink-faint">{note}</p>}
      {children}
    </div>
  );
}
