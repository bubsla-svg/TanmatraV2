"use client"; // Hands the Disclosure primitive its faq_open analytics callback

// The cutoff is a business rule, not copy: this FAQ used to promise "before
// 9:00 PM the night before", a clock time the system never enforced.
import { SKIP_SWAP_CUTOFF_HOURS } from "@/lib/planDecisionFacts";
import { emitLpEvent } from "@/lib/lpEvents";
import { Disclosure } from "@/components/primitives/Disclosure";

/**
 * §10: FAQ accordion plus a short nutrition disclaimer.
 * Plain answers about food, plans and delivery, and a line making clear the
 * food is not medical advice. Strictly ≤ 150 lines.
 */
export function Section10FaqAccordion() {
  const faqItems = [
    {
      question: "Is the food actually healthy?",
      answer: "Every plate is cooked fresh after you order, with calories and protein on the label. Cold-pressed oils and desi ghee, no refined sugar, no artificial additives.",
    },
    {
      question: "What's the difference between the plans?",
      answer: "Desk Fuel keeps you full and focused through the workday. Steady is built on low-GI plates for level blood sugar. Protein Build packs more protein for training days.",
    },
    {
      question: "Can I change my plan or pause deliveries?",
      answer: `Yes — switch between Veg, Egg and Non-Veg, or pause a delivery up to ${SKIP_SWAP_CUTOFF_HOURS} hours before it arrives.`,
    },
    {
      question: "Where do you deliver?",
      answer: "We deliver to homes and offices across Noida and parts of Greater Noida West, so your food arrives fresh and at the right temperature.",
    },
    {
      question: "Do plans lock me in?",
      answer: "No. Skip or swap any lunch up to a day before, and cancel before the next charge. There's no lock-in.",
    },
  ];

  return (
    <section id="faq" className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="animate-rise-in">
        <span className="text-[11px] font-bold uppercase tracking-[.2em] text-accent">
          Helpful Answers
        </span>
        <h2 className="mt-3 font-display text-4xl font-semibold leading-none text-primary sm:text-5xl">
          Frequently asked questions
        </h2>
        <p className="mt-5 max-w-md text-base leading-7 text-ink-muted">
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

      {/* Nutrition disclaimer — legal wording pending sign-off (copy deck [legal]). */}
      <div className="mt-12 rounded-card border border-line bg-surface-raised p-5 shadow-inner">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
          Nutrition disclaimer
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          Tanmatra meals are everyday food, not medical advice or treatment. We label calories and protein on every dish, but if you&rsquo;re managing a health condition or taking medication — including a GLP-1 — check with your doctor before changing your diet.
        </p>
      </div>
    </section>
  );
}
