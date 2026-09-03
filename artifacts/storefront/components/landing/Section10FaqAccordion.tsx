"use client"; // Hands the Disclosure primitive its faq_open analytics callback

import { emitLpEvent } from "@/lib/lpEvents";
import { Disclosure } from "@/components/primitives/Disclosure";

/**
 * §10: FAQ Accordion with Mandatory Medical Treatment Disclaimer.
 * Provides clinical governance clarity and enforces required therapeutic disclosures. Strictly ≤ 150 lines.
 */
export function Section10FaqAccordion() {
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

      {/* PR-11b: the shared Disclosure (48px rows — T-22's min-h-11 floor
          and then some; the text's own line-height used to be the whole hit
          area). Content unchanged. */}
      <Disclosure
        className="mt-10"
        items={faqItems.map((item) => ({ key: item.question, summary: item.question, body: item.answer }))}
        onOpen={(i) => {
          const question = faqItems[i]?.question;
          if (question) emitLpEvent("faq_open", { page: "/", question });
        }}
      />

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
