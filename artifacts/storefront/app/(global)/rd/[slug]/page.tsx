import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRds, getRdOrReason, type RdProfile } from "@/lib/rdApi";
import { RD_SERVICES_ENABLED } from "@/lib/flags";
import { formatPaise } from "@/lib/format";
import { RdBooking } from "@/components/rd/RdBooking";

type Params = { params: Promise<{ slug: string }> };
export const revalidate = 3600;

export async function generateStaticParams() {
  // Nothing to prerender while the service is off — the page 404s anyway.
  if (!RD_SERVICES_ENABLED) return [];
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
  // RD services are off until a dietitian is on board (lib/flags.ts). The
  // route stays in the tree; with the flag off it is simply not a page.
  if (!RD_SERVICES_ENABLED) notFound();
  const { slug } = await params;
  const lookup = await getRdOrReason(slug);
  if (!lookup.ok && lookup.reason === "not_found") notFound();
  if (!lookup.ok) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-16">
        <Link href="/rd" className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold uppercase tracking-[.16em] text-ink-muted transition-colors hover:text-primary">
          <span aria-hidden="true">&larr;</span> Our dietitians
        </Link>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-5 text-center">
          <p className="font-display text-lg font-semibold leading-tight text-primary">This profile is briefly unavailable</p>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            We couldn&rsquo;t reach the dietitian directory just now — please check back shortly.
          </p>
        </div>
      </section>
    );
  }
  const rd = lookup.rd;

  return (
    <article className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd(rd)) }} />
      <Link href="/rd" className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold uppercase tracking-[.16em] text-ink-muted transition-colors hover:text-primary">
        <span aria-hidden="true">&larr;</span> Our dietitians
      </Link>

      <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-start">
        <span
          aria-hidden="true"
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-2xl font-semibold text-primary"
        >
          {initials(rd.name)}
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-.02em] text-primary">{rd.name}</h1>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[.18em] text-accent">{rd.title}</p>
          <p className="font-data mt-2 text-xs text-ink-muted">
            {rd.yearsExperience} years&rsquo; experience · {rd.languages.join(", ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {rd.credentials.map((c) => (
              <span key={c} className="rounded-full border border-line bg-surface px-3 py-1 text-2xs font-medium text-ink-muted">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-8 text-base leading-7 text-ink-muted">{rd.bio}</p>

      <h2 className="mt-10 font-display text-2xl font-semibold leading-tight text-primary">Specialties</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {rd.specialties.map((s) => (
          <span key={s} className="rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-muted">{s}</span>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg font-semibold leading-tight text-primary">Consultations</h2>
        <ul className="mt-3 flex flex-col divide-y divide-line">
          {SESSIONS.map(({ key, label }) => {
            const paise = rd.pricing[key];
            return (
              <li key={key} className="flex items-center justify-between gap-3 py-3.5 text-sm">
                <span className="text-ink-muted">{label}</span>
                {paise === 0 ? (
                  <span className="rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-sage-text">Free</span>
                ) : (
                  <span className="font-data font-bold text-primary">{formatPaise(paise)}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-5">
        <RdBooking rd={{ slug: rd.slug, name: rd.name, pricing: rd.pricing, bookable: rd.bookable }} />
      </div>
    </article>
  );
}
