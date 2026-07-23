import type { Metadata } from "next";
import { fetchMenu, findDish } from "@/lib/catalog";
import { MenuGrid } from "@/components/MenuGrid";
import { DishDrawer } from "@/components/menu/DishDrawer";

export const metadata: Metadata = {
  title: "Menu",
  description: "Browse RD-designed, verified-macro dishes.",
};

/**
 * Menu route. Server component — it awaits the catalog on the server, so the
 * grid is in the first HTML paint (no client fetch, no loading spinner, no
 * layout shift). Deep-linkable and back/forward-safe by App Router default.
 *
 * ?dish=<slug> opens the PDP bottom sheet (§4.2) over the grid — the drawer
 * is the only client island; the grid stays fully server-rendered. An unknown
 * slug simply renders the grid (no dead end, no crash).
 */
export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ dish?: string }>;
}) {
  const [{ dishes }, { dish: dishSlug }] = await Promise.all([
    fetchMenu(),
    searchParams,
  ]);
  const openDish = dishSlug ? findDish(dishSlug, dishes) : undefined;

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">The menu</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {dishes.length} dishes · verified macros · RD-reviewed kitchen
        </p>
      </div>
      <h2 className="sr-only">Dishes</h2>
      <MenuGrid dishes={dishes} />
      {openDish && <DishDrawer dish={openDish} />}
    </section>
  );
}
