import { Grid } from "@astryxdesign/core/Grid";
import type { DishData } from "@workspace/menu-catalog";
import { DishCard } from "@/components/DishCard";
import type { DishFit } from "@/lib/menuFit";

/**
 * Responsive dish grid on Astryx Grid, per the product-gallery template's
 * `columns={{minWidth}}` pattern — reflows 4 → 3 → 2 columns as the viewport
 * narrows, with no breakpoint list to maintain. minWidth 160 keeps two columns
 * on a 375px phone, matching the old grid-cols-2 mobile layout.
 *
 * Astryx Grid renders a <div> with no `as` prop, so the previous <ul>/<li>
 * semantics are recreated with ARIA list roles — screen readers still announce
 * "list, N items". Server component: Grid is a client primitive, but rendering
 * it from here ships only the primitive, not the catalog data path.
 */
export function MenuGrid({
  dishes,
  fits,
}: {
  dishes: DishData[];
  fits?: Map<number, DishFit>;
}) {
  return (
    <Grid columns={{ minWidth: 160 }} gap={3} role="list">
      {dishes.map((dish) => (
        <div key={dish.id} role="listitem" className="flex">
          <DishCard dish={dish} fit={fits?.get(dish.id)} />
        </div>
      ))}
    </Grid>
  );
}
