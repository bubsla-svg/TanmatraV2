import React from "react";

/**
 * §7: Verification Proofs - Kitchen Credentials.
 * Showcases Noida medical-grade central kitchen infrastructure, strict sanitation logs,
 * and unbroken temperature-controlled thermal delivery.
 */
export function Section07ProofKitchen() {
  const safetyProtocols = [
    {
      title: "Noida Central Medical Kitchen",
      desc: "Operating within Noida enterprise sector with strict sanitary zone separation and stainless-steel preparatory surfaces.",
    },
    {
      title: "100% Thermal Insulated Delivery",
      desc: "Dispatched in high-density insulated thermal containment boxes guaranteeing hot reception at office desks.",
    },
    {
      title: "FSSAI & ISO Quality Audits",
      desc: "Fully compliant with FSSAI hygiene guidelines, daily microbiological swab checks, and traceable cold chain ingredients.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-10 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-line pb-6 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gold-text">
              Triple Verification Pillar 3
            </span>
            <h3 className="text-2xl font-bold text-ink">Noida Kitchen Credentials &amp; Thermal Dispatch</h3>
          </div>
          <span className="rounded-md border border-line bg-surface-subtle px-3 py-1 text-xs font-bold text-ink">
            Noida Sectors Active
          </span>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {safetyProtocols.map((proto, idx) => (
            <div key={idx} className="flex flex-col justify-between rounded-xl border border-line bg-surface-subtle p-5">
              <div>
                <span className="inline-block rounded-full border border-line bg-surface px-2.5 py-0.5 text-[10px] font-bold text-ink">
                  Standard 0{idx + 1}
                </span>
                <h4 className="mt-3 text-base font-bold text-ink">{proto.title}</h4>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{proto.desc}</p>
              </div>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                Verified Compliance
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
