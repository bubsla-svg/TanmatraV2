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
    <section className="bg-primary text-primary-foreground">
      {/* No ambient kitchen photo here, deliberately. This section's whole
          claim is that OUR kitchen is auditable — FSSAI, ISO 22000, daily swab
          checks — and it was illustrated with a random stock kitchen at 10%
          opacity: a stranger's worktop, behind the sentence promising ours.
          Nothing beats a real frame from the Noida kitchen; until that shoot
          happens, no image is the honest state. It also cost every visitor a
          1920x1080 download to render almost nothing. */}
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-[.85fr_1.15fr] md:items-center">
        <div className="animate-rise-in">
          <span className="text-[11px] font-bold uppercase tracking-[.2em] text-primary-foreground/80">
            Our kitchen
          </span>
          <h3 className="mt-4 max-w-md font-display text-4xl leading-[.98] sm:text-5xl">Where your lunch is actually cooked</h3>
          <span className="mt-6 inline-block rounded-full border border-primary-foreground/20 px-3 py-1 text-xs font-bold text-primary-foreground">
            Noida Sectors Active
          </span>
        </div>

        <div className="grid gap-7 sm:grid-cols-3 animate-rise-in stagger-1">
          {safetyProtocols.map((proto, idx) => (
            <div key={idx} className="flex flex-col justify-between border-l border-primary-foreground/20 pl-5">
              <div>
                <span className="font-data text-xs text-primary-foreground/80">
                  Standard 0{idx + 1}
                </span>
                <h4 className="mt-4 font-display text-xl">{proto.title}</h4>
                <p className="mt-2 text-sm leading-5 text-primary-foreground/65">{proto.desc}</p>
              </div>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[.14em] text-primary-foreground/65">
                Verified Compliance
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
