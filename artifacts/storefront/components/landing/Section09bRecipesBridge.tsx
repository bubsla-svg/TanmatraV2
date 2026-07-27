import React from "react";
import Link from "next/link";

/**
 * Section 9b: Recipes Bridge (DIY vs Done-for-You).
 * Captures users not ready to subscribe by offering free recipes.
 */
export function Section09bRecipesBridge() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-8 text-center">
      <div className="rounded-2xl bg-surface-raised p-8 border border-line shadow-sm">
        <h2 className="text-xl font-bold text-ink sm:text-2xl">Not Ready to Subscribe?</h2>
        <p className="mt-2 text-sm text-ink-muted max-w-prose mx-auto sm:text-base">
          Love cooking? Browse our <Link href="/recipes" className="font-bold text-gold-text underline">Free Dietitian-Approved Recipes</Link> with full macro breakdowns. 
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          Want the results without the dishes? Explore our Meal Plans above.
        </p>
      </div>
    </section>
  );
}
