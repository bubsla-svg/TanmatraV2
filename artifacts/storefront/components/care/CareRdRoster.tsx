import Link from "next/link";
import type { RdProfile } from "@/lib/rdApi";

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

/**
 * Credibility block for /care/:condition (Stitch brief 20) — the named RDs who
 * sign the menu, read from the /rd directory (rdApi). The brief asks for a
 * face-first rail linking to RD detail, so every RD is an avatar-led card that
 * links to its own profile; the lead RD keeps the wider card because their
 * credentials and bio are the substance of the claim. Server component.
 */
export function CareRdRoster({ rds }: { rds: RdProfile[] }) {
  const lead = rds.find((r) => r.slug === "rd-anjali-nair") ?? rds[0];
  const others = rds.filter((r) => r.slug !== lead?.slug).slice(0, 3);
  if (!lead) return null;

  return (
    <section className="py-[var(--space-section)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Who signs this menu</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Named RDs. Real registrations.</h2>

      <Link
        href={`/rd/${lead.slug}`}
        className="mt-8 flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 transition-colors hover:border-line-strong sm:flex-row sm:items-start"
      >
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-sage-soft text-lg font-semibold text-sage-text"
        >
          {initials(lead.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-ink">{lead.name}</p>
          <p className="text-xs text-ink-muted">{lead.title}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {lead.credentials.map((c) => (
              <li
                key={c}
                className="rounded-full border border-line px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sage-text"
              >
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink-muted">{lead.bio}</p>
        </div>
      </Link>

      {others.length > 0 && (
        <div className="mt-4 -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          {others.map((rd) => (
            <Link
              key={rd.slug}
              href={`/rd/${rd.slug}`}
              className="flex w-64 shrink-0 snap-center flex-col items-center gap-3 rounded-3xl border border-line bg-surface p-5 text-center transition-colors hover:border-line-strong sm:w-auto"
            >
              <span
                aria-hidden="true"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--gold)_14%,transparent)] text-base font-semibold text-gold-text"
              >
                {initials(rd.name)}
              </span>
              <p className="text-sm font-semibold leading-snug text-ink">{rd.name}</p>
              <p className="text-[11px] leading-relaxed text-ink-muted">
                {rd.specialties.slice(0, 3).join(" · ")}
              </p>
              <span className="mt-auto text-[11px] font-semibold text-gold-text">View profile &rarr;</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-3xl border border-line bg-surface-subtle p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
          Process, on the record
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Every plate is signed off for sodium and blood-sugar impact before it leaves the kitchen.
          ISO 22000:2018 processes · FSSAI Lic. 22725926001018.
        </p>
      </div>
    </section>
  );
}
