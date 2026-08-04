import Link from "next/link";
import type { CareConfig } from "@/content/landing/care";
import { SafeImage } from "@/components/ui/SafeImage";

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

const figure = "tabular rounded-full border border-line bg-bg px-2.5 py-1 text-[10px] text-ink-muted";

/**
 * "Meal evidence" — real low-GI plates with their published numbers (Stitch
 * brief 20). The brief is firm that this section must stay visibly evidence and
 * never be dressed as marketing: the figures are the content, so they render as
 * discrete tabular chips rather than a prose line, and no persuasive copy is
 * added around them. The low-GI filter and per-condition sort mirror the legacy
 * page. Server component.
 */
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
    <section className="py-[var(--space-section)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Meal evidence</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Real plates, with their numbers</h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {picks.map((d) => (
          <Link
            key={d.slug}
            href={`/dish/${d.slug}`}
            className="flex flex-col overflow-hidden rounded-3xl border border-line bg-surface transition-colors hover:border-line-strong"
          >
            <div className="relative h-36 bg-surface-raised">
              <SafeImage src={d.image} className="h-full w-full" />
              <span className="absolute left-3 top-3 rounded-full bg-[var(--ink)]/70 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
                GI {d.gi}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <p className="text-sm font-semibold leading-snug text-ink">{d.name}</p>
              <div className="mt-auto flex flex-wrap gap-2">
                <span className={figure}>{Math.round(d.calories)} kcal</span>
                <span className={figure}>{Math.round(d.carbs)}g carbs</span>
                <span className={figure}>{Math.round(d.fiber)}g fibre</span>
                <span className={figure}>sugar {d.sugarPerServing}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
