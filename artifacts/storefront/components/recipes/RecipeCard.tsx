import Link from "next/link";
import type { Recipe } from "@/lib/recipesApi";

/** A recipe list card. Presentational; rendered inside the client browser. */
export function RecipeCard({ recipe: r }: { recipe: Recipe }) {
  return (
    <Link
      href={`/recipes/${r.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong"
    >
      <div className="aspect-[16/10] w-full bg-surface-raised">
        {r.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config
          <img src={r.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wide text-ink-faint">
            Recipe
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <span className="mb-1 self-start rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
          {r.authorRole}
        </span>
        <h3 className="text-sm font-semibold text-ink">{r.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">{r.summary}</p>
        <dl className="tabular mt-3 flex gap-3 text-[11px] text-ink-faint">
          <span>{r.timeMinutes} min</span>
          {r.calories != null && <span>{r.calories} kcal</span>}
          {r.proteinGrams != null && <span>{r.proteinGrams}g protein</span>}
        </dl>
        <p className="mt-2 text-[11px] text-ink-faint">By {r.authorName}</p>
      </div>
    </Link>
  );
}
