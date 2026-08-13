import Link from "next/link";
import { challengeStatus, type Challenge } from "@/lib/challengesApi";
import { SafeImage } from "@/components/ui/SafeImage";

const STATUS_LABEL: Record<string, string> = {
  live: "Live now",
  soon: "Starts soon",
  ended: "Ended",
};

/** Status pill treatment — sage marks the positive/active state; upcoming and
 *  ended are neutral so they never compete visually with the gold Featured badge. */
const STATUS_PILL_CLASS: Record<string, string> = {
  live: "bg-sage-soft text-sage-text",
  soon: "border border-line bg-surface text-ink-muted",
  ended: "bg-surface-raised text-ink-faint",
};

function fmtRange(startsAt: string, endsAt: string): string {
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "Asia/Kolkata" };
  return `${new Date(startsAt).toLocaleDateString("en-IN", o)} – ${new Date(endsAt).toLocaleDateString("en-IN", o)}`;
}

/** Challenge list card. Status is time-derived; image-led with the status pill
 *  and the Featured badge overlaid on opposite corners of the image so the two
 *  signals never read as the same thing. */
export function ChallengeCard({ challenge: c }: { challenge: Challenge }) {
  const status = challengeStatus(c.startsAt, c.endsAt);
  const isEnded = status === "ended";
  return (
    <Link
      href={`/challenges/${c.slug}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all hover:-translate-y-0.5 hover:border-line-strong ${isEnded ? "opacity-80 hover:opacity-100" : ""}`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-raised">
        {c.image && (
          <SafeImage
            src={c.image}
            className="h-full w-full"
            imgClassName="transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-3xs font-bold uppercase tracking-wide ${STATUS_PILL_CLASS[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
        {c.featured > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-gold px-2.5 py-1 text-3xs font-bold uppercase tracking-wide text-[var(--gold-ink)]">
            Featured
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold leading-snug text-ink">{c.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{c.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.goalTags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-surface-raised px-2.5 py-1 text-3xs font-medium text-ink-muted">{t}</span>
          ))}
        </div>
        <dl className="tabular mt-4 flex gap-3 border-t border-line pt-3 text-2xs font-medium text-ink-faint">
          <span>{c.durationDays} days</span>
          <span>{c.memberCount} joined</span>
        </dl>
        <p className="mt-1.5 text-2xs text-ink-faint">Led by {c.rdName} · {fmtRange(c.startsAt, c.endsAt)}</p>
      </div>
    </Link>
  );
}
