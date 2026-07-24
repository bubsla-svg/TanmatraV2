import Link from "next/link";
import type { RdProfile } from "@/lib/rdApi";

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

/** Credibility block for /care/:condition — the named RDs who sign the menu,
 *  read from the /rd directory (rdApi). Lead RD is Anjali Nair (clinical desk);
 *  two more clinical RDs link to their profiles. Server component. */
export function CareRdRoster({ rds }: { rds: RdProfile[] }) {
  const lead = rds.find((r) => r.slug === "rd-anjali-nair") ?? rds[0];
  const others = rds.filter((r) => r.slug !== lead?.slug).slice(0, 2);
  if (!lead) return null;

  return (
    <section className="py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Who signs this menu</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Named RDs. Real registrations.</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--sage)_16%,transparent)] text-sm font-semibold text-sage">
              {initials(lead.name)}
            </span>
            <div>
              <p className="text-base font-semibold text-ink">{lead.name}</p>
              <p className="text-xs text-ink-muted">{lead.title}</p>
            </div>
          </div>
          <ul className="mt-3 flex flex-col gap-1">
            {lead.credentials.map((c) => (
              <li key={c} className="flex items-start gap-2 text-xs text-ink-muted">
                <span aria-hidden="true" className="text-sage">✓</span>
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">{lead.bio}</p>
        </div>

        <div className="flex flex-col gap-3">
          {others.map((rd) => (
            <div key={rd.slug} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--gold)_14%,transparent)] text-sm font-semibold text-gold-text">
                {initials(rd.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{rd.name}</p>
                <p className="truncate text-[11px] text-ink-muted">{rd.specialties.slice(0, 3).join(" · ")}</p>
              </div>
              <Link href={`/rd/${rd.slug}`} className="shrink-0 text-[11px] font-semibold text-gold-text hover:underline">
                Profile
              </Link>
            </div>
          ))}
          <div className="rounded-2xl border border-line bg-surface-raised p-4 text-xs leading-relaxed text-ink-muted">
            <p className="font-semibold text-ink">Process, on the record</p>
            <p className="mt-1">
              Every plate is signed off for sodium and blood-sugar impact before it leaves the kitchen.
              ISO 22000:2018 processes · FSSAI Lic. 22725926001018.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
