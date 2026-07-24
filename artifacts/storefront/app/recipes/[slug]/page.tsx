import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRecipe, type Recipe } from "@/lib/recipesApi";

type Params = { params: Promise<{ slug: string }> };
export const revalidate = 3600;

const GOAL_LABELS: Record<string, string> = {
  general_wellness: "Wellness",
  lose_weight: "Lose weight",
  gain_muscle: "Gain muscle",
  maintain: "Maintain",
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const r = await getRecipe(slug);
  if (!r) return { title: "Recipe not found" };
  return { title: r.title, description: r.summary };
}

/** schema.org/Recipe for rich results, built from the recipe's real fields. */
function recipeJsonLd(r: Recipe) {
  const nutrition =
    r.calories != null || r.proteinGrams != null
      ? {
          nutrition: {
            "@type": "NutritionInformation",
            ...(r.calories != null ? { calories: `${r.calories} kcal` } : {}),
            ...(r.proteinGrams != null ? { proteinContent: `${r.proteinGrams} g` } : {}),
          },
        }
      : {};
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: r.title,
    description: r.summary,
    ...(r.image ? { image: [r.image] } : {}),
    author: { "@type": "Person", name: r.authorName },
    totalTime: `PT${r.timeMinutes}M`,
    recipeIngredient: r.ingredients,
    recipeInstructions: r.steps.map((s) => ({ "@type": "HowToStep", text: s })),
    keywords: r.tags.join(", "),
    ...nutrition,
  };
}

export default async function RecipePage({ params }: Params) {
  const { slug } = await params;
  const r = await getRecipe(slug);
  if (!r) notFound();

  const stats: [string, string][] = [["Time", `${r.timeMinutes} min`]];
  if (r.calories != null) stats.push(["Calories", `${r.calories} kcal`]);
  if (r.proteinGrams != null) stats.push(["Protein", `${r.proteinGrams} g`]);
  const pills = [r.authorRole, GOAL_LABELS[r.goal] ?? r.goal, r.diet];

  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(recipeJsonLd(r)) }} />
      <Link href="/recipes" className="text-sm text-ink-muted hover:text-ink">
        &larr; Recipes
      </Link>
      {r.image && (
        <div className="mt-4 aspect-[16/9] overflow-hidden rounded-xl border border-line bg-surface-raised">
          {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config */}
          <img src={r.image} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {pills.map((p) => (
          <span key={p} className="rounded bg-surface-raised px-2 py-0.5 text-[11px] text-ink-muted">{p}</span>
        ))}
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{r.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{r.summary}</p>
      <p className="mt-1 text-xs text-ink-faint">By {r.authorName} · {r.authorRole}</p>

      <dl className="tabular mt-5 grid grid-cols-3 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-surface p-3">
            <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{k}</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {r.body && <p className="mt-6 text-sm leading-relaxed text-ink-muted">{r.body}</p>}

      <h2 className="mt-8 text-base font-semibold text-ink">Ingredients</h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {r.ingredients.map((i, idx) => (
          <li key={idx} className="flex gap-2 text-sm text-ink-muted">
            <span aria-hidden className="text-ink-faint">&bull;</span>
            {i}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-base font-semibold text-ink">Method</h2>
      <ol className="mt-2 flex flex-col gap-3">
        {r.steps.map((s, idx) => (
          <li key={idx} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
            <span className="tabular shrink-0 font-semibold text-gold-text">{idx + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <p className="mt-10 rounded-lg border border-line bg-surface p-4 text-xs text-ink-faint">
        Recipes are general nutrition guidance, not medical advice. See our{" "}
        <Link href="/legal/disclaimer" className="text-gold-text hover:underline">disclaimer</Link>.
      </p>
    </article>
  );
}
