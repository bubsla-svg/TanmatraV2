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
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd(c)) }} />
      <Link href="/challenges" className="text-sm font-medium text-ink-muted transition-colors hover:text-ink">
        &larr; Challenges
      </Link>
      {c.image && (
        <div className="mt-6 aspect-video w-full overflow-hidden rounded-2xl bg-surface-raised">
          {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config */}
          <img src={c.image} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${status === "live" ? "bg-gold text-[var(--gold-ink)]" : "bg-surface-raised text-ink-muted"}`}
        >
          {STATUS_LABEL[status]}
        </span>
        {c.featured > 0 && (
          <span className="rounded-full border border-line px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Featured
          </span>
        )}
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{c.title}</h1>
      <p className="mt-2 text-lg leading-relaxed text-ink-muted">{c.tagline}</p>
      <p className="tabular mt-4 text-xs text-ink-faint">
        {c.durationDays} days · {c.memberCount} joined · Led by {c.rdName}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {c.goalTags.map((t) => (
          <span key={t} className="rounded-full border border-line bg-surface-raised px-3 py-1 text-xs text-ink-muted">
            {t}
          </span>
        ))}
      </div>
      {c.description && (
        <p className="mt-6 max-w-prose text-sm leading-relaxed text-ink-muted">{c.description}</p>
      )}
      {c.bundleSlug && (
        <Link
          href="/menu"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-gold-text transition-colors hover:border-line-strong"
        >
          Shop the challenge menu <span aria-hidden>&rarr;</span>
        </Link>
      )}

      <ChallengeRoom slug={c.slug} />
    </article>
  );
}
