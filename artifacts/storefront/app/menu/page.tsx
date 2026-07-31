import type { Metadata } from "next";
import { isAlaCarteEnabled } from "@workspace/menu-catalog";
import { fetchMenu, findDish } from "@/lib/catalog";
import { PersonalizedMenu } from "@/components/menu/PersonalizedMenu";
import { DishDrawer } from "@/components/menu/DishDrawer";

export const metadata: Metadata = {
  title: "Menu",
  description: "Order RD-designed, verified-macro dishes for delivery today.",
};

/**
 * Menu route. Server component — awaits the catalog on the server so the grid
 * is present in first HTML paint for SEO and user experience.
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
    <div className="min-h-dvh">
    <section className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">The menu</h1>
        {/* No ServiceabilityBar here — the Header's is the only instance
            allowed to exist. Its verdict/pincode is per-instance state read
            from localStorage once at mount with no `storage` listener, so a
            second copy on this route desynced permanently from the one sitting
            directly above it in the header. */}
        <p className="mt-1 text-sm text-ink-muted">
          {orderable.length} dishes · order today · verified macros · RD-reviewed kitchen
        </p>
      </div>
      <h2 className="sr-only">Dishes</h2>
      <PersonalizedMenu dishes={orderable} />
      {openDish && <DishDrawer dish={openDish} />}
    </section>
    </div>
  );
}
