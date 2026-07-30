import type { Metadata } from "next";
import Link from "next/link";
import { CorporateLeadForm } from "@/components/corporate/CorporateLeadForm";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { StickyCtaBar } from "@/components/landing/StickyCtaBar";
import { PARTNER_LINKS } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Meal programs for teams",
  description:
    "RD-designed lunches for offices, gyms, and fitness clubs across Delhi NCR. Tell us about your team and we'll put together a plan.",
};

const PROOF_ITEMS = [
  { icon: "buildings" as const, value: "10-500+ Seats", label: "Volume Subsidies Available" },
  { icon: "lightning" as const, value: "₹189/meal", label: "Tax-Free Voucher Compliant" },
  { icon: "shield-check" as const, value: "100%", label: "Clinical & FSSAI Certified" },
  { icon: "timer" as const, value: "Daily 1:00 PM", label: "Punctual Desk Delivery" },
];

/**
 * Corporate / partnerships landing (L-3). Public + indexable — real lead-capture surface
 * that sends seats_band and posts to /corporate-leads pipeline.
 */
export default function CorporatePage() {
  return (
    <div className="pb-24">
      <section className="mx-auto max-w-3xl px-4 py-[var(--space-section)]">
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Meal programs for teams</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
          RD-designed lunches for offices, gyms, and fitness clubs across Delhi NCR. Tell us about your
          team and we&rsquo;ll put together a plan that fits.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/corporate-wellness" className="font-medium text-gold-text hover:underline underline-offset-4">
            See the full corporate-wellness pitch — subsidy calculator &amp; FAQ &rarr;
          </Link>
        </p>
      </section>

      <ProofStrip heading="Enterprise lunch program credentials" items={PROOF_ITEMS} />

      <section id="lead-capture" className="scroll-mt-20 mx-auto max-w-md px-4 py-[var(--space-section)]">
        <h2 className="text-2xl font-semibold tracking-tight text-ink mb-6">Request your team pilot</h2>
        <CorporateLeadForm source="web:/corporate" />
      </section>

      <section className="mx-auto max-w-md border-t border-line px-4 pb-[var(--space-section)] pt-8">
        <h2 className="text-xl font-semibold tracking-tight text-ink">Run a gym or club?</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {PARTNER_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-sm font-medium text-gold-text hover:underline underline-offset-4"
              >
                {l.label} &rarr;
              </Link>
              {l.desc && <span className="ml-2 text-xs text-ink-muted">{l.desc}</span>}
            </li>
          ))}
        </ul>
      </section>

      <StickyCtaBar
        pageSlug="/corporate"
        title="Meal Programs for Teams"
        subtitle="Tax-free voucher compliant from ₹189/meal."
        ctaLabel="Request Pilot"
        ctaHref="#lead-capture"
      />
    </div>
  );
}

