"use client"; // Interactive FAQ accordion state and event emission

import React, { useState } from "react";
import { emitLpEvent } from "@/lib/lpEvents";

/**
 * §10: FAQ Accordion with Mandatory Medical Treatment Disclaimer.
 * Provides clinical governance clarity and enforces required therapeutic disclosures. Strictly ≤ 150 lines.
 */
export function Section10FaqAccordion() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const faqItems = [
    {
      question: "How are meal macros and nutritional targets verified?",
      answer: "Every dish is formulated by certified clinical registered dietitians (RD) with weighed ingredient tolerances (±2g precision), complete allergen labeling, and zero industrial seed oils or hidden sugars.",
    },
    {
      question: "What is the difference between wellness meal plans and clinical protocols?",
      answer: "Wellness tracks like Desk Fuel provide clean workday cognitive sustenance. Clinical protocols like Steady and GLP-1 Companion involve targeted glycemic curve stabilization, low electrolyte density, and direct consultation oversight.",
    },
    {
      question: "Can I customize my subscription track or pause deliveries?",
      answer: "Yes, you can seamlessly switch between Veg, Egg, and Non-Veg tracks or pause/resume delivery dates up to 9:00 PM the previous evening with zero financial or credit loss.",
    },
    {
      question: "What areas and enterprise business parks in Noida do you currently serve?",
      answer: "We deliver across major commercial sectors and IT parks in Noida and select corridors of Greater Noida West using temperature-controlled insulated thermal packaging guaranteeing hot desk reception.",
    },
    {
      question: "How does the clinical RD consultation and GLP-1 companion track operate?",
      answer: "Patients undergo an initial clinical screening or submit a licensed physician recommendation. Our dietitians formulate lean protein preservation and GI profiles specifically optimized for incretin agonist therapies.",
    },
  ];

  const toggle = (idx: number, question: string) => {
    const next = openIdx === idx ? null : idx;
    setOpenIdx(next);
    if (next === idx) {
      emitLpEvent("faq_open", { page: "/", question });
    }
  };

  return (
    <section id="faq" className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
          Clear Clinical Governance
        </span>
        <h2 className="mt-2 text-2xl font-bold text-ink sm:text-4xl">
          Frequently Asked Questions
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Authoritative answers regarding nutritional verification, delivery mechanics, and medical oversight.
        </p>
      </div>

      <div className="mt-10 divide-y divide-line border-y border-line">
        {faqItems.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div key={idx} className="py-4">
              <button
                type="button"
                onClick={() => toggle(idx, item.question)}
                className="flex w-full items-center justify-between text-left text-base font-semibold text-ink focus:outline-none transition-opacity hover:opacity-90"
              >
                <span>{item.question}</span>
                <span className="ml-4 shrink-0 text-xs font-bold text-ink-faint">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && (
                <div className="mt-3 pr-8 text-sm leading-relaxed text-ink-muted">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mandatory Medical Treatment Disclaimer */}
      <div className="mt-12 rounded-xl border border-line bg-surface-raised p-5 shadow-inner">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
          ⚠️ Mandatory Medical Treatment &amp; Dietary Disclaimer
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          Tanmatra nutritional meal protocols are designed by certified registered dietitians (RD) to support metabolic wellness, performance recovery, and general dietary alignment. Our services and therapeutic meal tracks do not constitute emergency medical treatment, professional medical diagnosis, or a replacement for pharmaceutical interventions prescribed by your licensed physician. Patients undergoing active medical treatment, including GLP-1 hormone receptor agonist therapy or renal management, must consult their qualified healthcare provider prior to initiating dietary adjustments.
        </p>
      </div>
    </section>
  );
}
