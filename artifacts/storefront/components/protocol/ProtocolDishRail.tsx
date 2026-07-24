import Link from "next/link";
import type { ProtocolKey } from "@/content/landing/protocol";

/** Slim projection of a catalog dish for the protocol rail. */
export interface ProtocolDish {
  slug: string;
  name: string;
  image: string;
  protein: number;
  calories: number;
  gi: "low" | "medium" | "high";
  sugar: number;
  sugarPerServing: string;
  rdVerified: boolean;
}

/** The protocol qualification predicate (shared with the stat strip). */
export function matchesProtocolDish(d: ProtocolDish, filter: ProtocolKey): boolean {
  return filter === "performance" ? d.protein >= 18 : d.rdVerified && d.gi === "low" && d.sugar <= 10;
}

function selected(dishes: ProtocolDish[], filter: ProtocolKey): ProtocolDish[] {
  const q = dishes.filter((d) => matchesProtocolDish(d, filter));
  return filter === "performance"
    ? q.sort((a, b) => b.protein - a.protein).slice(0, 6)
    : q.sort((a, b) => a.sugar - b.sugar).slice(0, 6);
}

function badge(d: ProtocolDish, filter: ProtocolKey): string {
  return filter === "performance" ? `${Math.round(d.protein)}g protein` : `GI ${d.gi}`;
}

/** "Featured dishes" rail for a protocol page — the live catalog filtered to the
 *  protocol's criteria. Server component. */
export function ProtocolDishRail({
  dishes,
  filter,
  label,
  sub,
}: {
  dishes: ProtocolDish[];
  filter: ProtocolKey;
  label: string;
  sub: string;
}) {
  const picks = selected(dishes, filter);
  return (
    <section className="py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">{label}</p>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">{sub}</p>
        </div>
        <Link href="/menu" className="shrink-0 text-sm font-semibold text-gold-text hover:underline">
          Full menu &rarr;
        </Link>
      </div>
      {picks.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">No qualifying dishes are live right now — check back soon.</p>
      ) : (
        <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
          {picks.map((d) => (
            <Link key={d.slug} href={`/dish/${d.slug}`} className="w-44 shrink-0 overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="h-28 bg-surface-raised">
                {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config */}
                <img src={d.image} alt="" loading="lazy" className="h-full w-full object-cover" />
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-semibold text-ink">{d.name}</p>
                <p className="tabular mt-0.5 text-[10px] text-ink-muted">
                  {Math.round(d.calories)} kcal · {badge(d, filter)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
