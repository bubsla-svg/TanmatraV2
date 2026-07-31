import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRecipeOrReason, type Recipe } from "@/lib/recipesApi";

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
  const lookup = await getRecipeOrReason(slug);
  if (!lookup.ok) return { title: lookup.reason === "not_found" ? "Recipe not found" : "Recipe" };
  return { title: lookup.recipe.title, description: lookup.recipe.summary };
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
  const lookup = await getRecipeOrReason(slug);
  if (!lookup.ok && lookup.reason === "not_found") notFound();
  if (!lookup.ok) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-10">
        <Link href="/recipes" className="text-sm text-ink-muted hover:text-ink">
          &larr; Recipes
        </Link>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-sm font-semibold text-ink">This recipe is briefly unavailable</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            We couldn&rsquo;t reach the recipe just now — please check back shortly.
          </p>
        </div>
      </section>
    );
  }
  const r = lookup.recipe;

  const stats: [string, string][] = [["Time", `${r.timeMinutes} min`]];
  if (r.calories != null) stats.push(["Calories", `${r.calories} kcal`]);
  if (r.proteinGrams != null) stats.push(["Protein", `${r.proteinGrams} g`]);
  const pills = [r.authorRole, GOAL_LABELS[r.goal] ?? r.goal, r.diet];

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(recipeJsonLd(r)) }} />
      <Link href="/recipes" className="text-sm text-ink-muted hover:text-ink">
        &larr; Recipes
      </Link>

      {r.image && (
        <div className="mt-6 aspect-[16/9] overflow-hidden rounded-2xl border border-line bg-surface-raised">
          {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized <img>, see next.config */}
          <img src={r.image} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {pills.map((p) => (
          <span
            key={p}
            className="rounded-full bg-surface-raised px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted"
          >
            {p}
          </span>
        ))}
      </div>

      <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
        {r.title}
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-muted">{r.summary}</p>
      <p className="mt-4 text-sm text-ink-faint">
        By {r.authorName} &middot; {r.authorRole}
      </p>

      <dl className="tabular mt-6 grid grid-cols-3 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-surface px-3 py-4 text-center">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{k}</dt>
            <dd className="mt-1.5 text-base font-semibold text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {r.body && <p className="mt-8 text-base leading-relaxed text-ink-muted">{r.body}</p>}

      <h2 className="mt-10 border-b border-line pb-3 text-xl font-semibold tracking-tight text-ink">
        Ingredients
      </h2>
      <ul className="mt-4 flex flex-col gap-2.5">
        {r.ingredients.map((i, idx) => (
          <li key={idx} className="flex gap-3 text-base leading-relaxed text-ink-muted">
            <span aria-hidden className="text-ink-faint">&bull;</span>
            {i}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 border-b border-line pb-3 text-xl font-semibold tracking-tight text-ink">
        Method
      </h2>
      <ol className="mt-5 flex flex-col gap-6">
        {r.steps.map((s, idx) => (
          <li key={idx} className="flex gap-4">
            <span className="tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-base font-semibold text-gold-text">
              {idx + 1}
            </span>
            <p className="pt-1 text-base leading-relaxed text-ink">{s}</p>
          </li>
        ))}
      </ol>

      <p className="mt-12 rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-faint">
        Recipes are general nutrition guidance, not medical advice. See our{" "}
        <Link href="/legal/disclaimer" className="font-medium text-gold-text hover:underline">
          disclaimer
        </Link>
        .
      </p>
    </article>
  );
}
