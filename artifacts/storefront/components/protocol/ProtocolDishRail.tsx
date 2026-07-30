import Link from "next/link";
import type { ProtocolKey } from "@/content/landing/protocol";

/** Slim projection of a catalog dish for the protocol rail. */
export interface ProtocolDish {
  slug: string;
  name: string;
  image: string;
  protein: number;
  calories: number;
  fiber: number;
  gi: "low" | "medium" | "high";
  sugar: number;
  sugarPerServing: string;
  rdVerified: boolean;
}

/** The protocol qualification predicate (shared with the stat strip). */
export function matchesProtocolDish(d: ProtocolDish, filter: ProtocolKey): boolean {
  if (filter === "performance") return d.protein >= 18;
  if (filter === "wellness") return d.gi !== "high" && d.fiber >= 4 && d.sugar <= 12;
  return d.rdVerified && d.gi === "low" && d.sugar <= 10; // clinical
}

function selected(dishes: ProtocolDish[], filter: ProtocolKey): ProtocolDish[] {
  const q = dishes.filter((d) => matchesProtocolDish(d, filter));
  if (filter === "performance") return q.sort((a, b) => b.protein - a.protein).slice(0, 6);
  if (filter === "wellness") return q.sort((a, b) => b.fiber - a.fiber).slice(0, 6);
  return q.sort((a, b) => a.sugar - b.sugar).slice(0, 6); // clinical
}

function badge(d: ProtocolDish, filter: ProtocolKey): string {
  if (filter === "performance") return `${Math.round(d.protein)}g protein`;
  if (filter === "wellness") return `${Math.round(d.fiber)}g fibre`;
  return `GI ${d.gi}`; // clinical
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
    <section className="py-[var(--space-section)]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">{label}</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{sub}</p>
        </div>
        <Link href="/menu" className="shrink-0 text-sm font-semibold text-gold-text hover:underline">
          Full menu &rarr;
        </Link>
      </div>
      {picks.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-muted">
          No qualifying dishes are live right now — check back soon.
        </p>
      ) : (
        <div className="mt-8 flex gap-4 overflow-x-auto pb-2">
          {picks.map((d) => (
            <Link
              key={d.slug}
              href={`/dish/${d.slug}`}
              className="group w-44 shrink-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-md sm:w-52"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-surface-raised">
                {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config */}
                <img
                  src={d.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                />
                <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
                  <span className="tabular rounded-full border border-line bg-surface/90 px-2.5 py-1 text-[10px] font-semibold text-ink backdrop-blur-sm">
                    {badge(d, filter)}
                  </span>
                  {d.rdVerified && (
                    <span className="rounded-full bg-sage-soft px-2.5 py-1 text-[10px] font-semibold text-sage-text backdrop-blur-sm">
                      RD-verified
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3">
                <p className="truncate text-xs font-semibold text-ink">{d.name}</p>
                <p className="tabular mt-1 text-[10px] text-ink-muted">{Math.round(d.calories)} kcal</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
