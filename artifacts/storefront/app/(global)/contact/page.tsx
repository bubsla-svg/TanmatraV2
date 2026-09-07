import type { Metadata } from "next";
import Link from "next/link";
import { getCompanyProfile } from "@/lib/legalApi";
import { COMPANY, SUPPORT_WHATSAPP_URL } from "@/content/legal/company";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Reach Tanmatra on WhatsApp for orders, refunds and complaints. Our Grievance Officer, registered office, FSSAI registration and delivery area.",
};

// Same ISR window as the footer and the /legal pages, which read the same
// `legal_company_profile` singleton. One source, so the contact details on this
// page cannot disagree with the ones in the footer or on /legal/grievance.
export const revalidate = 3600;

/**
 * The one page that answers "how do I reach a human".
 *
 * Everything here was already published — the footer carried the registered
 * office and FSSAI number, /legal/grievance carried the officer, email and
 * phone — but no route said "contact", so neither a customer scanning the nav
 * nor a crawler could find it. This adds the destination, not the data: every
 * value comes from getCompanyProfile(), the same singleton those two surfaces
 * read, so there is exactly one answer to "where is our registered office".
 *
 * No <main> here: app/(global)/layout.tsx already opens the landmark.
 */
export default async function ContactPage() {
  // The CMS singleton when it is seeded, the bundled content/legal/company.ts
  // otherwise — the same precedence getLegalDocument() uses, and the reason a
  // contact page can never render blank. A statutory contact surface that
  // disappears because a table is unseeded is worse than one that is slightly
  // stale.
  const c = (await getCompanyProfile()) ?? COMPANY;

  // Plain values, deliberately not mail links. WhatsApp is the support
  // channel (owner, 2026-09-06) and lib/supportChannel.test.ts holds every
  // .tsx surface to it — an inbox offered as the way to get help is exactly
  // what that decision replaced. The grievance address still appears, because
  // the DPDPA and the Consumer Protection (E-Commerce) Rules require it to be
  // published; it is printed the way /legal/grievance prints it, as a
  // statutory disclosure rather than a support CTA.
  const rows: { label: string; value: string }[] = [
    { label: "Phone", value: c.supportPhone },
    { label: "Grievance Officer", value: c.grievanceOfficer },
    { label: "Grievance & data-protection email", value: c.grievanceEmail },
    { label: "Registered office", value: c.registeredOffice },
    { label: "We deliver in", value: c.serviceAreas },
    { label: "FSSAI Reg. No.", value: c.fssaiLicenseNo },
  ];

  return (
    <div>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
          <h1 className="max-w-4xl font-display text-4xl font-semibold leading-[.94] tracking-[-.04em] text-primary-foreground sm:text-6xl">
            Contact us
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-primary-foreground/70 sm:text-lg">
            Message us on WhatsApp and a person who works on your order answers &mdash; not a ticket queue.
          </p>
          <a
            href={SUPPORT_WHATSAPP_URL}
            className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-gold px-5 text-sm font-bold text-gold-ink transition-[filter] hover:brightness-110"
          >
            Message us on WhatsApp
          </a>
        </div>
      </section>

      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <section className="py-16 sm:py-24">
          <h2 className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">How to reach us</h2>
          <dl className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.label} className="bg-surface p-5">
                <dt className="text-xs font-semibold uppercase tracking-[.12em] text-ink-muted">{r.label}</dt>
                <dd className="mt-2 text-sm leading-6 text-primary">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-sm leading-6 text-ink-muted">
            {c.legalName} operates {c.brand}. We answer complaints about orders, payments, the service and
            your personal data through the same channel &mdash; the timelines we are held to, and how to
            escalate if we miss them, are set out on the{" "}
            <Link href="/legal/grievance" className="font-semibold text-primary underline-offset-4 hover:underline">
              grievance redressal page
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
