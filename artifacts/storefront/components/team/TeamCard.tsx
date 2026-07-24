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
    <div className="flex flex-col rounded-xl border border-line bg-surface p-5">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full font-mono text-sm font-bold ${accent}`}>
        {p.initials}
      </div>
      <div className="flex items-center gap-2">
        <h3 className="text-[15px] font-semibold text-ink">{p.name}</h3>
        {p.role === "rd" && (
          <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">RD</span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-ink-muted">{p.title}</p>
      {p.signatureLine && (
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">{p.signatureLine}</p>
      )}
      <p className="mt-3 text-[11px] text-ink-faint">{p.yearsExperience} yrs experience</p>
      <Link href={`/team/${p.slug}`} className="mt-3 text-xs font-semibold text-gold-text hover:underline">
        View profile &rarr;
      </Link>
    </div>
  );
}
