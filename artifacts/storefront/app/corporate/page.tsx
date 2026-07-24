import type { Metadata } from "next";
import Link from "next/link";
import { CorporateLeadForm } from "@/components/corporate/CorporateLeadForm";
import { PARTNER_LINKS } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Meal programs for teams",
  description:
    "RD-designed lunches for offices, gyms, and fitness clubs across Delhi NCR. Tell us about your team and we'll put together a plan.",
};

/**
 * Corporate / partnerships landing (playbook Part 3.3). Public + indexable —
 * a real lead-capture surface that lands prospects in the sales pipeline
 * (POST /corporate-leads) instead of an off-platform WhatsApp handoff.
 */
export default function CorporatePage() {
  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Meal programs for teams</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        RD-designed lunches for offices, gyms, and fitness clubs across Delhi NCR. Tell us about your
        team and we&rsquo;ll put together a plan that fits.
      </p>
      <div className="mt-6">
        <CorporateLeadForm />
      </div>
      <div className="mt-8 border-t border-line pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Run a gym or club?</p>
        <ul className="mt-3 flex flex-col gap-2">
          {PARTNER_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-sm font-medium text-gold-text hover:underline">
                {l.label} &rarr;
              </Link>
              {l.desc && <span className="ml-2 text-xs text-ink-muted">{l.desc}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
