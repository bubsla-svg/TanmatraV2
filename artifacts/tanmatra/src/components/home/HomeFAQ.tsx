import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: "Is Tanmatra suitable for managing diabetes?",
    a: "Yes. Our diabetes and PCOS meals are designed by registered dietitians to keep blood sugar steady — we favour slow-release carbohydrates, keep fast-digesting carbs low, and use plenty of fibre. Our meals support your health but are not a substitute for medical advice or treatment from your doctor.",
  },
  {
    q: "How do I pause or skip deliveries?",
    a: "You have complete control over your schedule. You can pause your entire subscription or skip individual days directly from your billing portal with a single tap. To allow our kitchen to manage ingredients without waste, skips and pauses must be submitted at least 24 hours before the scheduled delivery window.",
  },
  {
    q: "Can I swap dishes in my weekly plan?",
    a: "Absolutely. When your weekly menu is generated, you can review it and swap any dish for other options in our active catalog. If a swap changes the nutrition or price, the differences are itemized clearly for your review before confirmation.",
  },
  {
    q: "Is there a minimum commitment or auto-renewal?",
    a: "Our Weekly and Bi-weekly plans use secure UPI Autopay. You will receive a notification 24 hours before any charge occurs, and you can cancel or pause the subscription anytime in a single tap without penalties. The 3-Day Trial Pack is a one-time payment that does not auto-renew.",
  },
  {
    q: "How do you handle dietary restrictions and allergens?",
    a: "We flag common allergens (dairy, gluten, nuts, soy, eggs, shellfish) on every dish page. When you tell us your allergens, we screen them against each dish and block anything that conflicts before you order. However, all meals are prepared in a kitchen that handles these ingredients, so cross-contact is possible.",
  },
];

export default function HomeFAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section className="padx mt-12 mb-16">
      <div className="secrow px-0 mb-6 flex flex-col items-start gap-2">
        <span className="sh text-base font-bold text-white/95">Common questions</span>
        <h3 className="text-xl font-bold text-white/90">Frequently Asked Questions</h3>
      </div>

      <div className="flex flex-col gap-3">
        {FAQS.map((item, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className="card overflow-hidden border border-white/5"
              style={{ background: "var(--tnm-surface-ink-2)", padding: 0 }}
            >
              <button
                type="button"
                className="w-full flex items-center justify-between text-left px-4 py-4 text-xs font-bold text-white/90 hover:text-[var(--tnm-action)] transition-colors"
                onClick={() => toggle(idx)}
                aria-expanded={isOpen}
              >
                <span>{item.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-white/50 shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-185" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-xs text-white/60 leading-relaxed border-t border-white/5 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
