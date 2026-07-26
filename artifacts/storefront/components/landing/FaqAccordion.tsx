"use client"; // Justification: interactive open/close accordion state and client event tracking.

import React, { useState } from "react";
import { emitLpEvent } from "@/lib/lpEvents";
import { LandingIcon } from "./LandingIcon";

export interface FaqItem {
  question: string;
  answer: string | React.ReactNode;
}

export interface FaqAccordionProps {
  pageSlug: string;
  items: FaqItem[];
  title?: string;
  subtitle?: string;
}

/**
 * Accessible FAQ accordion (L-1). Emits faq_open analytics events on expansion
 * and complies with component line budget (≤150 lines) and token rules.
 */
export function FaqAccordion({
  pageSlug,
  items,
  title = "Frequently Asked Questions",
  subtitle,
}: FaqAccordionProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggle = (idx: number, question: string) => {
    const nextState = openIdx === idx ? null : idx;
    setOpenIdx(nextState);
    if (nextState === idx) {
      emitLpEvent("faq_open", { page: pageSlug, question });
    }
  };

  return (
    <section className="py-12 border-b border-line bg-surface">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl text-center">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-center text-sm text-ink-muted">{subtitle}</p>
        )}
        <div className="mt-8 divide-y divide-line border-y border-line">
          {items.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div key={idx} className="py-4">
                <button
                  type="button"
                  onClick={() => toggle(idx, item.question)}
                  className="flex w-full items-center justify-between text-left text-base font-semibold text-ink focus:outline-none"
                >
                  <span>{item.question}</span>
                  <span className="ml-4 shrink-0 text-sage">
                    <LandingIcon
                      name={isOpen ? "arrow-right" : "arrow-right"}
                      className={`h-5 w-5 transform transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                  </span>
                </button>
                {isOpen && (
                  <div className="mt-3 text-sm leading-relaxed text-ink-muted pr-8">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
