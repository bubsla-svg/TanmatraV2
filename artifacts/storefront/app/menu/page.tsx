import type { Metadata } from "next";
import { fetchMenu } from "@/lib/catalog";
import { MenuGrid } from "@/components/MenuGrid";

export const metadata: Metadata = {
  title: "Menu",
  description: "Browse RD-designed, verified-macro dishes.",
};

/**
 * Menu route. Server component — it awaits the catalog on the server, so the
 * grid is in the first HTML paint (no client fetch, no loading spinner, no
 * layout shift). Deep-linkable and back/forward-safe by App Router default.
 */
export default async function MenuPage() {
  const { dishes } = await fetchMenu();

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">The menu</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {dishes.length} dishes · verified macros · RD-reviewed kitchen
        </p>
      </div>
      <MenuGrid dishes={dishes} />
    </section>
  );
}
