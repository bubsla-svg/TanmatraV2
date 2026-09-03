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
      question: "How do you ensure the meals are actually healthy?",
      answer: "Every meal is designed by Registered Dietitians with precise ingredient measurements, full allergy information, and absolutely no hidden sugars or low-quality seed oils.",
    },
    {
      question: "What's the difference between your meal plans?",
      answer: "Our Wellness Plans (like Desk Fuel) are designed to keep you energized and focused during work. Our Clinical Plans (like Steady) are tailored for specific health needs like blood sugar management and include support from our dietitians.",
    },
    {
      question: "Can I change my plan or pause deliveries?",
      answer: "Yes, you can switch between Veg, Egg, and Non-Veg options or pause deliveries anytime before 9:00 PM the night before.",
    },
    {
      question: "Where do you deliver?",
      answer: "We deliver to homes and offices across Noida and parts of Greater Noida West, ensuring your food arrives fresh and at the right temperature.",
    },
    {
      question: "How do the expert consultations work?",
      answer: "You can book a chat with our Registered Dietitians who will help customize your meal plan based on your health goals or specific medical advice.",
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
          Helpful Answers
        </span>
        <h2 className="mt-2 text-2xl font-bold text-ink sm:text-4xl">
          Frequently Asked Questions
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Find answers to common questions about our meals, delivery, and plans.
        </p>
      </div>

      <div className="mt-10 divide-y divide-line border-y border-line">
        {faqItems.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div key={idx} className="py-2">
              {/* min-h-11 (T-22): the row measured 24px — the text's own
                  line-height was the whole hit area. */}
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(idx, item.question)}
                className="flex min-h-11 w-full items-center justify-between py-2 text-left text-base font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm transition-opacity hover:opacity-90"
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
      <div className="mt-12 rounded-card border border-line bg-surface-raised p-5 shadow-inner">
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
