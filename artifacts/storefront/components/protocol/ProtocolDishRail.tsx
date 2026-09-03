import Link from "next/link";
import type { ProtocolKey } from "@/content/landing/protocol";
import { DishImage } from "@/components/menu/DishImage";
import { Rail } from "@/components/primitives/Rail";

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
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">{label}</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{sub}</p>
        </div>
        <Link href="/menu" className="inline-flex min-h-11 shrink-0 items-center text-sm font-bold text-primary hover:underline">
          Full menu &rarr;
        </Link>
      </div>
      {picks.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-secondary px-4 py-6 text-center text-sm leading-relaxed text-ink-muted">
          No qualifying dishes are live right now — check back soon.
        </p>
      ) : (
        <Rail className="mt-6 gap-4 pb-2">
          {picks.map((d) => (
            <Link
              key={d.slug}
              href={`/dish/${d.slug}`}
              className="group w-44 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-line-strong cv-auto sm:w-52"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-surface-raised">
                <DishImage
                  src={d.image}
                  name={d.name}
                  className="h-full w-full"
                  imgClassName="transition-transform duration-300 ease-out group-hover:scale-105"
                />
                <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
                  <span className="font-data rounded-full border border-line bg-surface/90 px-2.5 py-1 text-2xs font-bold text-primary backdrop-blur-sm">
                    {badge(d, filter)}
                  </span>
                  {d.rdVerified && (
                    <span className="rounded-full bg-sage-soft px-2.5 py-1 text-2xs font-bold text-sage-text backdrop-blur-sm">
                      RD-verified
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <p className="line-clamp-2 font-display text-base font-semibold leading-tight text-primary">{d.name}</p>
                <p className="font-data mt-1 text-xs font-bold text-primary">{Math.round(d.calories)} kcal</p>
              </div>
            </Link>
          ))}
        </Rail>
      )}
    </section>
  );
}
