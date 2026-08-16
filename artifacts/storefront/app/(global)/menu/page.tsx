import type { Metadata } from "next";
import { isAlaCarteEnabled } from "@workspace/menu-catalog";
import type { DishForMatch } from "@workspace/preferences-match";
import { fetchMenu, findDish } from "@/lib/catalog";
import { DishCard } from "@/components/DishCard";
import type { MenuGridRow } from "@/components/MenuGrid";
import { PersonalizedMenu } from "@/components/menu/PersonalizedMenu";
import { DishDrawer } from "@/components/menu/DishDrawer";
import { FallbackMenuBanner } from "@/components/menu/FallbackMenuBanner";
import { MacroLegend, MenuTrustStrip } from "@/components/menu/MenuTrustStrip";

/**
 * The only fields PersonalizedMenu's client-side ranking/diet-filter actually
 * reads (see DishForMatch) — everything else on a dish (description,
 * longDescription, the 4 photo variants, customizations, price, …) is
 * rendering data that DishCard already turned into markup server-side via
 * `rows` below, so sending the full DishData a second time as the `dishes`
 * prop would just double it into the client bundle for no reason.
 */
function forMatch(dish: DishForMatch): DishForMatch {
  return {
    id: dish.id,
    name: dish.name,
    allergens: dish.allergens,
    ingredients: dish.ingredients,
    isVeg: dish.isVeg,
    kitchen: dish.kitchen,
    macros: dish.macros,
    contraindications: dish.contraindications,
    glycaemicIndex: dish.glycaemicIndex,
    sugarPerServing: dish.sugarPerServing,
    rdReviewState: dish.rdReviewState,
    allergensReviewed: dish.allergensReviewed,
    macrosProvisional: dish.macrosProvisional,
  };
}

export const metadata: Metadata = {
  title: "Menu",
  description: "Order RD-designed, verified-macro dishes for delivery today.",
};

/**
 * Menu route. Server component — awaits the catalog on the server so the grid
 * is present in first HTML paint for SEO and user experience.
 *
 * `DishCard` is rendered HERE, not inside PersonalizedMenu/MenuGrid — those
 * are client components (diet-chip state, personalised ranking from
 * client-fetched preferences), and importing DishCard from either would pull
 * its entire markup into the client bundle under RSC's "anything statically
 * imported from a client file compiles into client JS" rule. Rendering the
 * rows here and handing the resulting nodes down as data (`rows`) keeps
 * DishCard a true Server Component. See DishCard.tsx / MenuGrid.tsx for the
 * rest of that split.
 */
export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ dish?: string }>;
}) {
  const [{ dishes, source }, { dish: dishSlug }] = await Promise.all([
    fetchMenu(),
    searchParams,
  ]);
  // TNM-MENU-01 §5: base layout order is the fixed 13-section taxonomy,
  // sort_rank within a section. Dishes with no section_order (not yet
  // governed by the M-3 payload) sort last, by name — MenuGrid sinks them
  // into a trailing "More dishes" bucket rather than dropping them.
  const orderable = dishes.filter(isAlaCarteEnabled).sort((a, b) => {
    const sa = a.sectionOrder ?? Number.MAX_SAFE_INTEGER;
    const sb = b.sectionOrder ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    const ra = a.sortRank ?? Number.MAX_SAFE_INTEGER;
    const rb = b.sortRank ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
  const openDish = dishSlug ? findDish(dishSlug, dishes) : undefined;
  const rows: MenuGridRow[] = orderable.map((dish) => ({
    dishId: dish.id,
    node: <DishCard key={dish.id} dish={dish} />,
    sectionOrder: dish.sectionOrder,
  }));

  return (
    <div data-ui-generation="stitch-74" data-screen-id="5.2" data-screen-state="default" className="min-h-dvh">
    {/* pt-5 / mb-4, not py-8 / mb-6 (owner feedback 2026-08-16): the title
        block sat on ~100px of the first viewport before any control or card.
        The heading stays; the air above and below it was the cost. */}
    <section className="mx-auto max-w-screen-xl px-4 pb-8 pt-5">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">The menu</h1>
        {/* No ServiceabilityBar here — the Header's is the only instance
            allowed to exist. Its verdict/pincode is per-instance state read
            from localStorage once at mount with no `storage` listener, so a
            second copy on this route desynced permanently from the one sitting
            directly above it in the header. */}
        {/* §3.7: every clause is earned from the payload actually rendering —
            see MenuTrustStrip for why the two claims are gated. */}
        <MenuTrustStrip dishes={orderable} />
        <MacroLegend dishes={orderable} />
      </div>
      {source === "fallback" && <FallbackMenuBanner />}
      <h2 className="sr-only">Dishes</h2>
      <PersonalizedMenu dishes={orderable.map(forMatch)} rows={rows} />
      {openDish && <DishDrawer dish={openDish} />}
    </section>
    </div>
  );
}
