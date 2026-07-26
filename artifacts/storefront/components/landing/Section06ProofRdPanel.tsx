import React from "react";
import Link from "next/link";

/**
 * §6: Verification Proofs - RD Panel.
 * Emphasizes clinical dietetic oversight, therapeutic diet prescription support,
 * and seamless consultative onboarding.
 */
export function Section06ProofRdPanel() {
  const credentials = [
    { title: "IDA Registered Dietitians", desc: "Formulations supervised by licensed Indian Dietetic Association clinical practitioners." },
    { title: "Therapeutic Adaptations", desc: "Specialized meal customization for T2D, PCOS, CKD stage 1-2, and cardiac rehabilitation." },
    { title: "Continuous Glucose Tracking", desc: "Meals calibrated against empirical continuous glucose monitor (CGM) postprandial curves." },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="rounded-2xl border border-line bg-surface-raised p-6 sm:p-10 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
              Triple Verification Pillar 2
            </span>
            <h3 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
              Certified Clinical Dietitian (RD) Governance
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              We operate at the intersection of medical nutrition therapy and fresh culinary science. Every protocol order undergoes clinical compatibility screening.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/rd"
                className="inline-flex items-center rounded-xl border border-line bg-surface px-5 py-2.5 text-xs font-semibold text-ink shadow-sm transition-colors hover:border-line-strong active:scale-95"
              >
                Book Free 15-min RD Consultation &rarr;
              </Link>
              <Link
                href="/rd-partners/apply"
                className="inline-flex items-center text-xs font-semibold text-ink transition-colors hover:text-ink-muted"
              >
                For Dietitians: Partner Practice Network
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 lg:max-w-md">
            {credentials.map((cred, idx) => (
              <div key={idx} className="rounded-xl border border-line bg-surface p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                  ✓ {cred.title}
                </h4>
                <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                  {cred.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
