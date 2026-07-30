import type { Metadata } from "next";
// Stitch dark scope (route-scoped) — see lib/themes/stitch.css.
import "@/lib/themes/stitch.css";
import { isAlaCarteEnabled } from "@workspace/menu-catalog";
import { fetchMenu, findDish } from "@/lib/catalog";
import { PersonalizedMenu } from "@/components/menu/PersonalizedMenu";
import { DishDrawer } from "@/components/menu/DishDrawer";
import { ServiceabilityBar } from "@/components/onboarding/ServiceabilityBar";

export const metadata: Metadata = {
  title: "Menu",
  description: "Order RD-designed, verified-macro dishes for delivery today.",
};

/**
 * Menu route. Server component — awaits the catalog on the server so the grid
 * is present in first HTML paint for SEO and user experience.
 * Incorporates OB-2 ServiceabilityBar additively at page top without wrapping or walling content.
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
  const orderable = dishes.filter(isAlaCarteEnabled);
  const openDish = dishSlug ? findDish(dishSlug, dishes) : undefined;

  return (
    <div data-stitch="dark" className="min-h-screen bg-[var(--bg)] text-ink">
    <section className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">The menu</h1>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          {orderable.length} dishes · order today · verified macros · RD-reviewed kitchen
        </p>
        <ServiceabilityBar placement="menu" />
      </div>
      <h2 className="sr-only">Dishes</h2>
      <PersonalizedMenu dishes={orderable} />
      {openDish && <DishDrawer dish={openDish} />}
    </section>
    </div>
  );
}
