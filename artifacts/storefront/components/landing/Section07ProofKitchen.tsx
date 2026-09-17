import React from "react";
import { SafeImage } from "@/components/ui/SafeImage";

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
      {/* Real frames from the 15 Sep 2026 shoot at Sector 104 (Drive folder
          "tanmantra final", ads-24 and ads-11), served from public/brand at
          1200×900 / ~100 KB each. This section's claim is that OUR kitchen is
          auditable; until this shoot it deliberately carried no image rather
          than a stock one. Not decorative: `alt` names what is shown. */}
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-[.85fr_1.15fr] md:items-center">
        <div className="animate-rise-in">
          <span className="text-[11px] font-bold uppercase tracking-[.2em] text-primary-foreground/80">
            Our kitchen
          </span>
          <h3 className="mt-4 max-w-md font-display text-4xl leading-[.98] text-primary-foreground sm:text-5xl">Where your lunch is actually cooked</h3>
          <span className="mt-6 inline-block rounded-full border border-primary-foreground/20 px-3 py-1 text-xs font-bold text-primary-foreground">
            Sector 104, Noida
          </span>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <figure className="overflow-hidden rounded-2xl">
              <SafeImage
                src="/brand/kitchen.jpg"
                alt="The range and prep counter in the Tanmatra kitchen, Sector 104"
                className="aspect-[4/3] w-full object-cover"
              />
              <figcaption className="mt-2 text-xs text-primary-foreground/70">The kitchen</figcaption>
            </figure>
            <figure className="overflow-hidden rounded-2xl">
              <SafeImage
                src="/brand/cafe.jpg"
                alt="Tables and the counter inside the Tanmatra café"
                className="aspect-[4/3] w-full object-cover"
              />
              <figcaption className="mt-2 text-xs text-primary-foreground/70">Or eat in — the café at Sector 104</figcaption>
            </figure>
          </div>
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
