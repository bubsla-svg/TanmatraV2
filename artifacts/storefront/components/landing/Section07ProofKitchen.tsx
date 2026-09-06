import React from "react";

/**
 * §7: Kitchen — where your lunch is cooked, and what stands behind it.
 * Plain claims the site can back: cooked to order in the Sector 104 kitchen,
 * delivered hot in insulated boxes, FSSAI-registered and ISO 22000.
 */
export function Section07ProofKitchen() {
  const kitchenStandards = [
    {
      title: "Cooked to order in Sector 104, Noida",
      desc: "Fresh plates, cooked after you order — never reheated from a tray.",
    },
    {
      title: "Arrives hot",
      desc: "Insulated boxes, so lunch is hot when it reaches your desk.",
    },
    {
      title: "FSSAI-registered · ISO 22000",
      desc: "Our kitchen follows FSSAI hygiene standards and ISO 22000 food-safety management.",
    },
  ];

  return (
    // Headings inside this inverted section MUST name their colour. They do
    // not inherit it: lib/themes/tanmatra.css (generated) carries
    // `:where(h1,h2,h3,h4,h5,h6){color:var(--color-text-primary)}`, and a
    // zero-specificity rule that MATCHES the element still beats a colour
    // inherited from an ancestor. So the h3/h4 below rendered cream ink on
    // the gold fill — 2.53:1, measured 2026-09-06 — while every span in the
    // same block, carrying text-primary-foreground itself, was correct.
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
          <h3 className="mt-4 max-w-md font-display text-4xl leading-[.98] text-primary-foreground sm:text-5xl">Where your lunch is actually cooked</h3>
          <span className="mt-6 inline-block rounded-full border border-primary-foreground/20 px-3 py-1 text-xs font-bold text-primary-foreground">
            Sector 104, Noida
          </span>
        </div>

        <div className="grid gap-7 sm:grid-cols-3 animate-rise-in stagger-1">
          {kitchenStandards.map((item, idx) => (
            <div key={idx} className="flex flex-col justify-between border-l border-primary-foreground/20 pl-5">
              <div>
                <span className="font-data text-xs text-primary-foreground/80">
                  0{idx + 1}
                </span>
                <h4 className="mt-4 font-display text-xl text-primary-foreground">{item.title}</h4>
                <p className="mt-2 text-sm leading-5 text-primary-foreground/65">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
