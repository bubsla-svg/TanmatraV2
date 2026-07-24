import type { Metadata } from "next";
import { getRecipes } from "@/lib/recipesApi";
import { RecipesBrowser } from "@/components/recipes/RecipesBrowser";

export const metadata: Metadata = {
  title: "Recipes",
  description:
    "Dietitian-designed recipes with verified macros — filter by goal, diet, and time. Real food you can cook at home.",
};

export const revalidate = 3600;

/** Recipes list (Community). Server-fetches the full list; a client island
 *  filters it in-memory so the grid is in the SSR HTML (SEO-safe). */
export default async function RecipesPage() {
  const recipes = await getRecipes();
  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Community</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Recipes</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
        Dietitian-designed recipes with verified macros. Filter by your goal, your diet, and the
        time you have.
      </p>
      <div className="mt-6">
        <RecipesBrowser recipes={recipes} />
      </div>
    </section>
  );
}
