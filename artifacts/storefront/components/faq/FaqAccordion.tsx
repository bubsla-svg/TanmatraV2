"use client";
// Interactive FAQ accordion — one row open at a time. Content is server-
// provided; only the open/close toggle needs the client. The single FAQ
// accordion for the storefront (the landing variant folded into this one —
// pass `pageSlug` on acquisition routes to keep its faq_open analytics).
import { useState } from "react";
import type { FaqItem } from "@/content/faq";
import { emitLpEvent } from "@/lib/lpEvents";

export function FaqAccordion({
  items,
  pageSlug,
  defaultOpen = 0,
}: {
  items: FaqItem[];
  /** When set, expanding a row emits a `faq_open` landing-page event. */
  pageSlug?: string;
  /** Row open on mount; `null` renders fully collapsed (landers). */
  defaultOpen?: number | null;
}) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  const toggle = (i: number, question: string) => {
    const next = open === i ? null : i;
    setOpen(next);
    if (next === i && pageSlug) emitLpEvent("faq_open", { page: pageSlug, question });
  };
  return (
    <div className="mt-8 flex flex-col border-t border-line">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={item.q}
            className={`transition-colors ${
              isOpen
                ? "my-2 rounded-2xl border border-line bg-surface-raised px-4 shadow-sm"
                : "border-b border-line"
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(i, item.q)}
              aria-expanded={isOpen}
              className="group flex w-full items-center justify-between gap-4 py-5 text-left"
            >
              <span className="text-sm font-semibold text-ink">{item.q}</span>
              <svg
                className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                  isOpen ? "rotate-180 text-gold-text" : "text-ink-faint group-hover:text-gold-text"
                }`}
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
              <p className="pb-5 pr-7 text-sm leading-relaxed text-ink-muted">{item.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
