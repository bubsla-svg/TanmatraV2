import Link from "next/link";
import type { CareConfig } from "@/content/landing/care";

/** Slim projection of a catalog dish for the evidence rail. */
export interface CareDish {
  slug: string;
  name: string;
  image: string;
  gi: "low" | "medium" | "high";
  calories: number;
  carbs: number;
  fiber: number;
  sugarPerServing: string;
}

/** "Meal evidence" — real low-GI plates with their published numbers. The
 *  low-GI filter + per-condition sort mirror the legacy page; server component. */
export function CareEvidence({ dishes, sort }: { dishes: CareDish[]; sort: CareConfig["dishSort"] }) {
  const low = dishes.filter((d) => d.gi === "low");
  low.sort((a, b) =>
    sort === "sugar_asc"
      ? (parseFloat(a.sugarPerServing) || 0) - (parseFloat(b.sugarPerServing) || 0)
      : b.fiber - a.fiber,
  );
  const picks = low.slice(0, 3);
  if (picks.length === 0) return null;

  return (
    <section className="py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Meal evidence</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Real plates, with their numbers</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {picks.map((d) => (
          <Link key={d.slug} href={`/dish/${d.slug}`} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="relative h-36 bg-surface-raised">
              {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config */}
              <img src={d.image} alt="" loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute left-2 top-2 rounded-full bg-[var(--ink)]/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                GI {d.gi}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <p className="text-sm font-semibold text-ink">{d.name}</p>
              <p className="tabular mt-1 text-[11px] text-ink-muted">
                {Math.round(d.calories)} kcal · {Math.round(d.carbs)}g carbs · sugar {d.sugarPerServing}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
