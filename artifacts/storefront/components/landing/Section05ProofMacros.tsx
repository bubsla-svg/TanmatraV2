import React from "react";

/**
 * §5: Verification Proofs - Macros.
 * Demonstrates lab-verified macronutrient tolerances and transparent ingredient reporting.
 */
export function Section05ProofMacros() {
  const macroPillars = [
    { label: "Calorie Envelope", value: "450–550 kcal", note: "Optimized workday metabolic energy without excess density." },
    { label: "Verified Protein", value: "28g–42g", note: "High biological value amino acids with zero soy fillers." },
    { label: "Dietary Fiber", value: "8g–14g", note: "Prebiotic complex carbohydrates for stable insulin curves." },
    { label: "Refined Seed Oils", value: "0.0g", note: "Prepared strictly in cold-pressed extra virgin olive oil & pure ghee." },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-10 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-line pb-6 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
              Triple Verification Pillar 1
            </span>
            <h3 className="text-2xl font-bold text-ink">Lab-Verified Macronutrient Precision</h3>
          </div>
          <p className="text-xs font-medium text-ink-muted max-w-md">
            Every ingredient is weighed to ±2g precision tolerances before preparation. No unverified estimates, no hidden sauces.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {macroPillars.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col rounded-xl border border-line bg-surface-subtle p-5 shadow-sm"
            >
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-faint">
                {item.label}
              </span>
              <span className="mt-2 text-2xl font-extrabold text-ink tabular">
                {item.value}
              </span>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                {item.note}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
