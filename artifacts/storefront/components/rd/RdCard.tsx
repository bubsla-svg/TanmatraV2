import Link from "next/link";
import { formatPaise } from "@/lib/format";
import { hasFreeIntro, fromPricePaise, type RdProfile } from "@/lib/rdApi";

/** Initials for the avatar (first + last word). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

/** RD directory card (route-parity Wave D). Non-interactive card; the only
 *  interactive element is the "View profile" link. Pricing shown for info. */
export function RdCard({ rd }: { rd: RdProfile }) {
  const from = fromPricePaise(rd.pricing);
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--gold)_14%,transparent)] text-sm font-semibold text-gold-text"
        >
          {initials(rd.name)}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink">{rd.name}</h3>
          <p className="truncate text-xs text-ink-muted">{rd.title}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {rd.specialties.slice(0, 4).map((s) => (
          <span key={s} className="rounded bg-surface-raised px-2 py-0.5 text-[11px] text-ink-muted">
            {s}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        {rd.yearsExperience} yrs · {rd.languages.join(", ")}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-xs text-ink-muted">
          {hasFreeIntro(rd.pricing) && <span className="font-semibold text-sage-text">Free 15-min intro</span>}
          {hasFreeIntro(rd.pricing) && from != null && " · "}
          {from != null && <span className="tabular">from {formatPaise(from)}</span>}
        </p>
        <Link href={`/rd/${rd.slug}`} className="shrink-0 text-sm font-semibold text-gold-text hover:underline">
          View profile &rarr;
        </Link>
      </div>
    </div>
  );
}
