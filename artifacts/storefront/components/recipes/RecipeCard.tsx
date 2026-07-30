import Link from "next/link";
import type { Recipe } from "@/lib/recipesApi";

/** A recipe list card. Presentational; rendered inside the client browser.
 *  Image-led treatment (Stitch route-49, "Recipe Directory"): photo leads on
 *  its own row on mobile and slides to a 2/5 rail on desktop, content fills
 *  the rest, and the stats line sits below a hairline divider. */
export function RecipeCard({ recipe: r }: { recipe: Recipe }) {
  const stats = [`${r.timeMinutes} min`];
  if (r.calories != null) stats.push(`${r.calories} kcal`);
  if (r.proteinGrams != null) stats.push(`${r.proteinGrams}g protein`);

  return (
    <Link
      href={`/recipes/${r.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-md md:flex-row"
    >
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-surface-raised md:aspect-auto md:w-2/5">
        {r.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config
          <img
            src={r.image}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wide text-ink-faint">
            Recipe
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-5 md:w-3/5">
        <div className="flex flex-col gap-2">
          <span className="self-start rounded bg-surface-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            {r.authorRole}
          </span>
          <h3 className="text-base font-semibold text-ink transition-colors group-hover:text-gold-text">
            {r.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-relaxed text-ink-muted">{r.summary}</p>
        </div>
        <div className="flex flex-col gap-1 border-t border-line pt-3">
          <p className="tabular text-xs text-ink-muted">{stats.join(" · ")}</p>
          <p className="text-xs text-ink-faint">By {r.authorName}</p>
        </div>
      </div>
    </Link>
  );
}
