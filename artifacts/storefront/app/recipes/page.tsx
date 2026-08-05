import type { Metadata } from "next";
import { getRecipes } from "@/lib/recipesApi";
import { SafeImage } from "@/components/primitives/SafeImage";

export const metadata: Metadata = {
  title: "Recipes | Tanmatra",
};

export default async function RecipesPage() {
  const recipes = await getRecipes();

  return (
    <div className="min-h-dvh flex flex-col bg-surface-canvas pb-24">
      <div className="sticky top-0 z-20 bg-surface-canvas/95 backdrop-blur-md pt-4 pb-4 px-gutter border-b border-line">
        <h1 className="font-headline-md text-headline-md text-ink-primary">Clinical Recipes</h1>
        <p className="text-sm text-ink-secondary">RD-approved recipes for your goals</p>
      </div>

      <div className="px-gutter pt-6">
        <div className="flex flex-col gap-4">
          {recipes.map((recipe) => (
            <a key={recipe.id} href={`/recipes/${recipe.slug}`} className="group flex flex-col rounded-2xl border border-line bg-surface p-3 transition-transform active:scale-[0.98]">
              <div className="relative mb-3 overflow-hidden rounded-xl bg-surface-raised border border-line">
                <SafeImage src={recipe.image || ""} alt={recipe.title} aspectRatio="16/9" className="w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-bold text-lg text-ink-primary">{recipe.title}</h3>
                <span className="font-mono text-[11px] text-ink-muted">
                  {recipe.calories ?? 0} kcal · {recipe.proteinGrams ?? 0}g P
                </span>
                <p className="text-ink-secondary text-sm mt-1">{recipe.summary}</p>
              </div>
            </a>
          ))}
          {recipes.length === 0 && (
            <div className="py-10 text-center text-ink-muted">
              No recipes available at the moment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
