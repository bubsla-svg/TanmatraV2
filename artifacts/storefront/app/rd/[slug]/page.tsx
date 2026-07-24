import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRds, getRd, type RdProfile } from "@/lib/rdApi";
import { formatPaise } from "@/lib/format";

type Params = { params: Promise<{ slug: string }> };
export const revalidate = 3600;

export async function generateStaticParams() {
  const rds = await getRds();
  return rds.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const rd = await getRd(slug);
  if (!rd) return { title: "Dietitian not found" };
  return { title: `${rd.name} — ${rd.title}`, description: rd.bio };
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
  const rd = await getRd(slug);
  if (!rd) notFound();

  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd(rd)) }} />
      <Link href="/rd" className="text-sm text-ink-muted hover:text-ink">
        &larr; Our dietitians
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{rd.name}</h1>
      <p className="mt-1 text-sm text-gold-text">{rd.title}</p>
      <p className="tabular mt-1 text-xs text-ink-faint">
        {rd.yearsExperience} years&rsquo; experience · {rd.languages.join(", ")}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {rd.credentials.map((c) => (
          <span key={c} className="rounded bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-ink-muted">
            {c}
          </span>
        ))}
      </div>

      <p className="mt-5 text-sm leading-relaxed text-ink-muted">{rd.bio}</p>

      <h2 className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">Specialties</h2>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {rd.specialties.map((s) => (
          <span key={s} className="rounded-full bg-surface-raised px-3 py-1 text-xs text-ink-muted">{s}</span>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Consultations</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {SESSIONS.map(({ key, label }) => {
            const paise = rd.pricing[key];
            return (
              <li key={key} className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{label}</span>
                <span className={`tabular font-semibold ${paise === 0 ? "text-sage-text" : "text-ink"}`}>
                  {paise === 0 ? "Free" : formatPaise(paise)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          1:1 RD booking is rolling out shortly. In the meantime, get personalised guidance from our
          nutrition coach — it can route you to the right dietitian.
        </p>
        <Link
          href="/coach"
          className="mt-3 inline-block rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-[var(--gold-ink)]"
        >
          Chat with our nutrition coach &rarr;
        </Link>
      </div>
    </article>
  );
}
