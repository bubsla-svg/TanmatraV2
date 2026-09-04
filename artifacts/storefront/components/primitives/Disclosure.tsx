"use client";
// Justification: open/close state for the rows.
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one accordion (PR-11b — brief CUJ 2 §3, matrix #8). One row open at a
 * time, `aria-expanded` + `aria-controls` on the trigger, a labelled region
 * for the panel, and the panel mounted/unmounted rather than height-animated
 * (it never drops frames — the note carried over from the FAQ accordion this
 * replaces). The two bespoke FAQ accordions now render through it; the
 * macro / ingredient / allergen disclosures the brief names adopt it in
 * their own screen PRs.
 *
 * Content and analytics stay with the caller: `onOpen` fires only when a row
 * opens (not on close), which is exactly when the FAQ callers emit
 * `faq_open`.
 */
export interface DisclosureItem {
  key: string;
  summary: ReactNode;
  body: ReactNode;
}

export interface DisclosureProps {
  items: DisclosureItem[];
  /** Row open on mount; `null` renders fully collapsed. */
  defaultOpen?: number | null;
  onOpen?: (index: number, item: DisclosureItem) => void;
  className?: string;
}

export function Disclosure({ items, defaultOpen = null, onOpen, className }: DisclosureProps) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  const baseId = useId();
  const toggle = (i: number, item: DisclosureItem) => {
    const next = open === i ? null : i;
    setOpen(next);
    if (next === i) onOpen?.(i, item);
  };
  return (
    <div className={cn("flex flex-col border-t border-line", className)}>
      {items.map((item, i) => {
        const isOpen = open === i;
        const triggerId = `${baseId}-t-${i}`;
        const panelId = `${baseId}-p-${i}`;
        return (
          <div
            key={item.key}
            className={cn(
              "transition-colors",
              // The open row lifts as a filled card (a perceivable boundary,
              // per the README — fill, not hairline); closed rows keep the
              // decorative hairline between them.
              isOpen ? "my-2 rounded-card bg-surface-raised px-4 shadow-[var(--shadow-card)]" : "border-b border-line",
            )}
          >
            <button
              type="button"
              id={triggerId}
              aria-expanded={isOpen}
              aria-controls={isOpen ? panelId : undefined}
              onClick={() => toggle(i, item)}
              className="group flex min-h-12 w-full items-center justify-between gap-4 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-sm font-semibold text-ink">{item.summary}</span>
              <svg
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-300",
                  isOpen ? "rotate-180 text-gold-text" : "text-ink-faint group-hover:text-gold-text",
                )}
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
            </button>
            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className="animate-disclosure-in pb-5 pr-7 text-sm leading-relaxed text-ink-muted"
              >
                {item.body}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
