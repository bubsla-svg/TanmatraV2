import type { Metadata } from "next";
import Link from "next/link";
import { getRecipes } from "@/lib/recipesApi";
import { SafeImage } from "@/components/ui/SafeImage";

export const metadata: Metadata = {
  title: "Recipes",
};

export default async function RecipesPage() {
  const recipes = await getRecipes();

  return (
    <div data-ui-generation="stitch-74" data-screen-id="5.12" data-screen-state="default" className="min-h-dvh flex flex-col bg-bg pb-24">
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur-md pt-4 pb-4 px-gutter border-b border-line">
        <h1 className="font-bold text-3xl text-ink">Recipes</h1>
        <p className="text-sm text-ink-muted">Recipes matched to your goals</p>
      </div>

      <div className="px-gutter pt-6">
        <div className="flex flex-col gap-4">
          {recipes.map((recipe) => (
            <Link key={recipe.id} href={`/recipes/${recipe.slug}`} className="group flex flex-col rounded-2xl border border-line bg-surface p-3 transition-transform active:scale-[0.98]">
              <div className="relative mb-3 overflow-hidden rounded-xl bg-surface-raised border border-line">
                <SafeImage src={recipe.image || ""} alt={recipe.title} className="aspect-video w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-bold text-lg text-ink">{recipe.title}</h3>
                <span className="font-mono text-2xs text-ink-muted">
                  {recipe.calories ?? 0} kcal · {recipe.proteinGrams ?? 0}g P
                </span>
                <p className="text-ink-muted text-sm mt-1">{recipe.summary}</p>
              </div>
            </Link>
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
