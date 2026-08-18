import type { Metadata } from "next";
import { isAlaCarteEnabled } from "@workspace/menu-catalog";
import type { DishForMatch } from "@workspace/preferences-match";
import { fetchMenu, findDish } from "@/lib/catalog";
import { DishCard } from "@/components/DishCard";
import type { MenuGridRow } from "@/components/MenuGrid";
import { PersonalizedMenu } from "@/components/menu/PersonalizedMenu";
import { DishDrawer } from "@/components/menu/DishDrawer";
import { FallbackMenuBanner } from "@/components/menu/FallbackMenuBanner";
import { MacroLegend } from "@/components/menu/MacroLegend";
import { buildSharedMacroKeys } from "@/lib/dishTrust";

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
  description: "Browse today's dishes — ingredients, allergens and macros on every card.",
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
  // F-1: computed over the WHOLE served catalog, not just `orderable`. A dish
  // hidden from à-la-carte still proves a tuple was copied, and the copy is
  // what disqualifies the claim — narrowing the input here would let a shared
  // pair survive whenever one of the two is not orderable today.
  const sharedMacroKeys = buildSharedMacroKeys(dishes);
  const rows: MenuGridRow[] = orderable.map((dish) => ({
    dishId: dish.id,
    node: <DishCard key={dish.id} dish={dish} sharedMacroKeys={sharedMacroKeys} />,
    sectionOrder: dish.sectionOrder,
  }));

  return (
    <div data-ui-generation="stitch-74" data-screen-id="5.2" data-screen-state="default" className="min-h-dvh">
    {/* No visible title block at all (owner feedback 2026-08-16, second
        pass). "The menu" and the dish-count trust strip under it were the
        last ~90px of chrome standing between the top of the first viewport
        and the first product, and neither did any work the customer needed:
        the route is reached from a nav item already labelled "Menu", and the
        count is restated by the section headings. The H1 STAYS in the
        document, screen-reader-only — a route with no top-level heading
        breaks the heading outline and the page's own SEO title. pt-3, not
        pt-5, because there is no longer a heading for that air to sit above.

        MacroLegend is deliberately NOT chrome and survives visibly: it
        explains the ≈ prefix printed on most of the cards below, and an
        undecodable qualifier next to a clinical number is worse than none
        (S-6). It renders nothing when no visible dish carries the mark. */}
    <section className="mx-auto max-w-screen-xl px-4 pb-8 pt-3">
      <h1 className="sr-only">The menu</h1>
      {/* No ServiceabilityBar here — the Header's is the only instance
          allowed to exist. Its verdict/pincode is per-instance state read
          from localStorage once at mount with no `storage` listener, so a
          second copy on this route desynced permanently from the one sitting
          directly above it in the header. */}
      <MacroLegend dishes={orderable} sharedMacroKeys={sharedMacroKeys} />
      {source === "fallback" && <FallbackMenuBanner />}
      <h2 className="sr-only">Dishes</h2>
      <PersonalizedMenu dishes={orderable.map(forMatch)} rows={rows} />
      {openDish && <DishDrawer dish={openDish} />}
    </section>
    </div>
  );
}
