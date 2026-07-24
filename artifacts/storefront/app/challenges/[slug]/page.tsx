import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getChallenge, challengeStatus, type Challenge } from "@/lib/challengesApi";
import { ChallengeRoom } from "@/components/challenges/ChallengeRoom";

type Params = { params: Promise<{ slug: string }> };
export const revalidate = 3600;

const STATUS_LABEL: Record<string, string> = { live: "Live now", soon: "Starts soon", ended: "Ended" };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getChallenge(slug);
  if (!data) return { title: "Challenge not found" };
  return { title: data.challenge.title, description: data.challenge.tagline };
}

function eventJsonLd(c: Challenge) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: c.title,
    description: c.description,
    startDate: c.startsAt,
    endDate: c.endsAt,
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    ...(c.image ? { image: [c.image] } : {}),
  };
}

/** Challenge detail. Public info is server-rendered (SEO); the interactive
 *  membership + cohort feed is the ChallengeRoom client island. */
export default async function ChallengePage({ params }: Params) {
  const { slug } = await params;
  const data = await getChallenge(slug);
  if (!data) notFound();
  const c = data.challenge;
  const status = challengeStatus(c.startsAt, c.endsAt);

  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd(c)) }} />
      <Link href="/challenges" className="text-sm text-ink-muted hover:text-ink">
        &larr; Challenges
      </Link>
      {c.image && (
        <div className="mt-4 aspect-[16/9] overflow-hidden rounded-xl border border-line bg-surface-raised">
          {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config */}
          <img src={c.image} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${status === "live" ? "bg-gold text-[var(--gold-ink)]" : "bg-surface-raised text-ink-muted"}`}>
          {STATUS_LABEL[status]}
        </span>
        {c.featured > 0 && <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-ink-muted">Featured</span>}
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{c.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">{c.tagline}</p>
      <p className="tabular mt-3 text-xs text-ink-faint">
        {c.durationDays} days · {c.memberCount} joined · Led by {c.rdName}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.goalTags.map((t) => (
          <span key={t} className="rounded bg-surface-raised px-2 py-0.5 text-[11px] text-ink-muted">{t}</span>
        ))}
      </div>
      {c.description && <p className="mt-5 text-sm leading-relaxed text-ink-muted">{c.description}</p>}
      {c.bundleSlug && (
        <Link href="/menu" className="mt-4 inline-block rounded-lg border border-line px-4 py-2 text-sm font-semibold text-gold-text hover:underline">
          Shop the challenge menu &rarr;
        </Link>
      )}

      <ChallengeRoom slug={c.slug} />
    </article>
  );
}
