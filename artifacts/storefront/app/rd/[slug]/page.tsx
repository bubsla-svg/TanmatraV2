import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRds, getRdOrReason, type RdProfile } from "@/lib/rdApi";
import { formatPaise } from "@/lib/format";
import { RdBooking } from "@/components/rd/RdBooking";

type Params = { params: Promise<{ slug: string }> };
export const revalidate = 3600;

export async function generateStaticParams() {
  const rds = await getRds();
  return rds.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const lookup = await getRdOrReason(slug);
  if (!lookup.ok) return { title: lookup.reason === "not_found" ? "Dietitian not found" : "Dietitian profile" };
  return { title: `${lookup.rd.name} — ${lookup.rd.title}`, description: lookup.rd.bio };
}

function personJsonLd(rd: RdProfile) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: rd.name,
    jobTitle: rd.title,
    description: rd.bio,
    knowsAbout: rd.specialties,
    knowsLanguage: rd.languages,
  };
}

/** Initials for the header avatar chip (mirrors RdCard's directory-card avatar). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

const SESSIONS: { key: keyof RdProfile["pricing"]; label: string }[] = [
  { key: "intro_15m", label: "15-min intro consult" },
  { key: "follow_up_30m", label: "30-min consult" },
  { key: "follow_up_45m", label: "45-min consult" },
];

/** `/rd/[slug]` — RD profile (route-parity Wave D, read-only). Public info +
 *  server-owned consult pricing. Booking + payment is the checkpoint-gated
 *  slice; the CTA points to the live nutrition coach in the meantime. */
export default async function RdProfilePage({ params }: Params) {
  const { slug } = await params;
  const lookup = await getRdOrReason(slug);
  if (!lookup.ok && lookup.reason === "not_found") notFound();
  if (!lookup.ok) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-10">
        <Link href="/rd" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink">
          <span aria-hidden="true">&larr;</span> Our dietitians
        </Link>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-ink">This profile is briefly unavailable</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            We couldn&rsquo;t reach the dietitian directory just now — please check back shortly.
          </p>
        </div>
      </section>
    );
  }
  const rd = lookup.rd;

  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd(rd)) }} />
      <Link href="/rd" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink">
        <span aria-hidden="true">&larr;</span> Our dietitians
      </Link>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
        <span
          aria-hidden="true"
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--gold)_14%,transparent)] text-2xl font-semibold text-gold-text"
        >
          {initials(rd.name)}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{rd.name}</h1>
          <p className="mt-1 text-sm font-medium text-gold-text">{rd.title}</p>
          <p className="tabular mt-1.5 text-xs text-ink-faint">
            {rd.yearsExperience} years&rsquo; experience · {rd.languages.join(", ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {rd.credentials.map((c) => (
              <span key={c} className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-medium text-ink-muted">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-ink-muted">{rd.bio}</p>

      <h2 className="mt-8 text-base font-semibold text-ink">Specialties</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {rd.specialties.map((s) => (
          <span key={s} className="rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-muted">{s}</span>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-base font-semibold text-ink">Consultations</h2>
        <ul className="mt-3 flex flex-col divide-y divide-line">
          {SESSIONS.map(({ key, label }) => {
            const paise = rd.pricing[key];
            return (
              <li key={key} className="flex items-center justify-between gap-3 py-3.5 text-sm">
                <span className="text-ink-muted">{label}</span>
                {paise === 0 ? (
                  <span className="rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-sage-text">Free</span>
                ) : (
                  <span className="tabular font-semibold text-ink">{formatPaise(paise)}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-6">
        <RdBooking rd={{ slug: rd.slug, name: rd.name, pricing: rd.pricing, bookable: rd.bookable }} />
      </div>
    </article>
  );
}
