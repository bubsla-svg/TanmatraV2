import React from "react";
import { ScrubbingText } from "./ScrubbingText";

/**
 * §3: "The 'healthy' bowl problem" Dark Agitation Panel.
 * Contrasts typical commercial cloud-kitchen health bowls with Tanmatra's certified
 * clinical nutrition protocol using semantic surface and border tokens.
 */
export function Section03AgitationPanel() {
  const commercialFlaws = [
    "Hidden sugars in dressings and sauces",
    "Cheap, low-quality oils used in bulk cooking",
    "Inconsistent portion sizes and nutrition estimates",
    "Heavy carbs that leave you tired and sluggish by afternoon",
  ];

  const clinicalAdvantages = [
    "Precisely measured ingredients for accurate nutrition",
    "Zero low-quality oils — cooked with premium olive oil & pure desi ghee",
    "Meals designed and approved by Registered Dietitians",
    "Balanced energy to keep you focused and full all day",
  ];

  return (
    <section className="bg-surface-raised py-section-py">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
            The Tanmatra Difference
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-4xl">
            The Truth About &ldquo;Healthy&rdquo; Takeout
          </h2>
          <ScrubbingText 
            className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base"
            text="Not all health bowls are created equal. Hidden sugars and low-quality oils can derail your goals and leave you tired. Here is how we are different." 
          />
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 md:gap-8">
          <div className="flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <div className="border-b border-line pb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Standard Takeout
              </span>
              <h3 className="mt-1 text-lg font-bold text-ink">Commercial &ldquo;Healthy&rdquo; Bowls</h3>
            </div>
            <ul className="mt-6 flex flex-col gap-4 text-sm text-ink-muted">
              {commercialFlaws.map((flaw, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line text-xs font-bold text-ink-faint">
                    ✕
                  </span>
                  <span className="leading-relaxed">{flaw}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col rounded-2xl border-2 border-line-strong bg-surface p-6 shadow-md sm:p-8">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
                  The Tanmatra Standard
                </span>
                <h3 className="mt-1 text-lg font-bold text-ink">Our Healthy Meal Plans</h3>
              </div>
              <span className="rounded-full bg-surface-raised px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink">
                Verified
              </span>
            </div>
            <ul className="mt-6 flex flex-col gap-4 text-sm text-ink-muted">
              {clinicalAdvantages.map((adv, idx) => (
                <li key={idx} className="flex items-start gap-3 text-ink">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-surface-subtle text-xs font-bold text-ink">
                    ✓
                  </span>
                  <span className="leading-relaxed font-medium">{adv}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
