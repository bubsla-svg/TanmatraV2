"use client";
// Interactive FAQ accordion — one row open at a time. Content is server-
// provided; only the open/close toggle needs the client.
import { useState } from "react";
import type { FaqItem } from "@/content/faq";

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mt-8 border-t border-line">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className="border-b border-line">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 py-4 text-left"
            >
              <span className="text-sm font-medium text-ink">{item.q}</span>
              <svg
                className={`h-4 w-4 shrink-0 text-ink-faint transition-transform ${isOpen ? "rotate-180" : ""}`}
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
              <p className="pb-4 pr-7 text-sm leading-relaxed text-ink-muted">{item.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
