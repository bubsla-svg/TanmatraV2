import React from "react";
import Link from "next/link";

/**
 * §12: Footer.
 * Comprehensive navigation and regulatory compliance footer respecting all geography and copyright lint gates.
 */
export function Section12Footer() {
  return (
    <footer className="border-t border-line bg-surface py-12 text-xs text-ink-muted sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <span className="text-base font-bold text-ink">Tanmatra</span>
            <p className="mt-1 font-semibold uppercase tracking-wider text-[11px] text-ink-faint">
              Clinical Nutrition
            </p>
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              Medical-grade nutritional formulations cooked fresh and delivered across Noida commercial sectors. Verified macro precision, real food first.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-ink uppercase tracking-wider text-[11px]">Protocols &amp; Plans</h4>
            <ul className="mt-3 flex flex-col gap-2 font-medium">
              <li><Link href="/menu" className="hover:text-ink">À-La-Carte &amp; Menu Catalog</Link></li>
              <li><Link href="/plans?plan=desk_fuel&track=veg" className="hover:text-ink">Desk Fuel Workday Track</Link></li>
              <li><Link href="/plans?plan=protein_build&track=veg" className="hover:text-ink">Protein Build Recovery Track</Link></li>
              <li><Link href="/rd" className="hover:text-ink">Steady &amp; GLP-1 Clinical Care</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-ink uppercase tracking-wider text-[11px]">Partner Network</h4>
            <ul className="mt-3 flex flex-col gap-2 font-medium">
              <li><Link href="/rd-partners/apply" className="hover:text-ink">Dietitian Practice Network</Link></li>
              <li><Link href="/partners/gyms" className="hover:text-ink">Fitness Club &amp; Trainer Affiliated</Link></li>
              <li><Link href="/corporate" className="hover:text-ink">Corporate Wellness Subsidies</Link></li>
              <li><Link href="/qa" className="hover:text-ink">Clinical QA Forum</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-ink uppercase tracking-wider text-[11px]">Compliance &amp; Legal</h4>
            <ul className="mt-3 flex flex-col gap-2 font-medium">
              <li><span>FSSAI Medical Kitchen Charter</span></li>
              <li><span>ISO Sanitization Governance</span></li>
              <li><Link href="/menu" className="hover:text-ink">Allergen &amp; Thermal Traceability</Link></li>
              <li><span className="text-ink-faint">Terms of Service &amp; Privacy</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-line pt-6 flex flex-col items-center justify-between gap-4 text-[11px] text-ink-faint sm:flex-row">
          <p>
            &copy; Tanmatra Wellness Foods Pvt. Ltd. All rights reserved. Serving Noida enterprise parks and residences.
          </p>
          <div className="flex gap-6">
            <span>Verified Clinical Macro Spine</span>
            <span>Zero Industrial Seed Oils</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
