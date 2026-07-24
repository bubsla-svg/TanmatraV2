import Link from "next/link";
import { challengeStatus, type Challenge } from "@/lib/challengesApi";

const STATUS_LABEL: Record<string, string> = {
  live: "Live now",
  soon: "Starts soon",
  ended: "Ended",
};

function fmtRange(startsAt: string, endsAt: string): string {
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "Asia/Kolkata" };
  return `${new Date(startsAt).toLocaleDateString("en-IN", o)} – ${new Date(endsAt).toLocaleDateString("en-IN", o)}`;
}

/** Challenge list card. Status is time-derived (gold "Live now" pill). */
export function ChallengeCard({ challenge: c }: { challenge: Challenge }) {
  const status = challengeStatus(c.startsAt, c.endsAt);
  return (
    <Link
      href={`/challenges/${c.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong"
    >
      <div className="relative aspect-[16/9] w-full bg-surface-raised">
        {c.image && (
          // eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config
          <img src={c.image} alt="" className="h-full w-full object-cover" />
        )}
        {c.featured > 0 && (
          <span className="absolute left-2 top-2 rounded bg-gold px-1.5 py-0.5 text-[10px] font-semibold text-[var(--gold-ink)]">
            Featured
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <span
          className={`self-start rounded px-1.5 py-0.5 text-[10px] font-semibold ${status === "live" ? "bg-gold text-[var(--gold-ink)]" : "bg-surface-raised text-ink-muted"}`}
        >
          {STATUS_LABEL[status]}
        </span>
        <h3 className="mt-2 text-sm font-semibold text-ink">{c.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">{c.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {c.goalTags.slice(0, 3).map((t) => (
            <span key={t} className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-ink-faint">{t}</span>
          ))}
        </div>
        <dl className="tabular mt-3 flex gap-3 text-[11px] text-ink-faint">
          <span>{c.durationDays} days</span>
          <span>{c.memberCount} joined</span>
        </dl>
        <p className="mt-2 text-[11px] text-ink-faint">Led by {c.rdName} · {fmtRange(c.startsAt, c.endsAt)}</p>
      </div>
    </Link>
  );
}
