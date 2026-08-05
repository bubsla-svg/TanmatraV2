import Link from "next/link";
import type { TeamProfile } from "@/lib/teamApi";

/** accent → avatar colour. Kept off the interactive element (the card is a div;
 *  only "View profile" is a link) so the sage signal never lands on a control. */
const ACCENT: Record<string, string> = {
  gold: "bg-gold text-[var(--gold-ink)]",
  sage: "bg-sage text-sage-foreground",
  blue: "bg-blue text-white",
};

/** Team roster card. Presentational; the whole card is NOT a link. */
export function TeamCard({ profile: p }: { profile: TeamProfile }) {
  const accent = ACCENT[p.accent] ?? ACCENT.gold;
  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6">
      <div className="mb-6 flex items-start justify-between">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-mono text-base font-bold ${accent}`}
        >
          {p.initials}
        </div>
        {p.role === "rd" && (
          <span className="rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--gold-ink)]">
            RD
          </span>
        )}
      </div>
      <div className="mb-auto">
        <h3 className="text-[15px] font-semibold text-ink">{p.name}</h3>
        <p className="mt-0.5 text-xs text-ink-muted">{p.title}</p>
        {p.signatureLine && (
          <p className="mt-4 border-l-2 border-line pl-3 text-xs italic leading-relaxed text-ink-faint">
            {p.signatureLine}
          </p>
        )}
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <span className="tabular rounded-md bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-ink-muted">
          {p.yearsExperience} yrs experience
        </span>
        <Link href={`/team/${p.slug}`} className="text-xs font-semibold text-gold-text hover:underline">
          View profile &rarr;
        </Link>
      </div>
    </div>
  );
}
