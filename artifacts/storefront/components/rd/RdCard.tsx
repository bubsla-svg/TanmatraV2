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
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-base font-semibold text-primary"
        >
          {initials(rd.name)}
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold leading-tight text-primary">{rd.name}</h3>
          <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">{rd.title}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {rd.specialties.slice(0, 4).map((s) => (
          <span key={s} className="rounded-full border border-line px-2.5 py-1 text-2xs text-ink-muted">
            {s}
          </span>
        ))}
      </div>

      <p className="font-data mt-3 text-xs text-ink-muted">
        {rd.yearsExperience} yrs · {rd.languages.join(", ")}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-ink-muted">
          {!rd.bookable ? (
            <span className="text-ink-faint">Not currently accepting bookings</span>
          ) : (
            <>
              {hasFreeIntro(rd.pricing) && (
                <span className="rounded-full bg-sage-soft px-2.5 py-0.5 text-xs font-medium text-sage-text">
                  Free 15-min intro
                </span>
              )}
              {hasFreeIntro(rd.pricing) && from != null && " · "}
              {from != null && <span className="font-data">from {formatPaise(from)}</span>}
            </>
          )}
        </div>
        <Link href={`/rd/${rd.slug}`} className="inline-flex min-h-11 shrink-0 items-center text-sm font-bold text-primary hover:underline">
          View profile &rarr;
        </Link>
      </div>
    </div>
  );
}
