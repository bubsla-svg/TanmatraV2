"use client";
// "use client" justification: the PDP drawer is a URL-driven interactive
// island (§4.2) — open state syncs to ?dish=<slug> so shares and back-button
// behave; closing rewrites the URL. Everything around it stays RSC.
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAlaCarteEnabled, type DishData } from "@workspace/menu-catalog";
import { formatPaise } from "@/lib/format";
import { AddToCart } from "@/components/cart/AddToCart";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { DishRationale } from "./DishRationale";
import { DishSpec } from "./DishSpec";
import { DishAllergens } from "./DishAllergens";
import { SafeImage } from "@/components/ui/SafeImage";

/**
 * Dish detail as a bottom sheet over the menu (§4.2): users triage dishes in
 * rapid succession — a route push per dish kills the rhythm. The full
 * /dish/[slug] route stays canonical for shares and SEO; this drawer is the
 * in-flow view, deep-linked via /menu?dish=<slug>.
 */
export function DishDrawer({ dish }: { dish: DishData }) {
  const router = useRouter();
  const est = dish.macrosEstimated ? "~" : "";
  const macros: Array<[string, string]> = [
    ["kcal", `${est}${dish.macros.calories}`],
    ["P", `${est}${dish.macros.protein} g`],
    ["C", `${est}${dish.macros.carbs} g`],
    ["F", `${est}${dish.macros.fat} g`],
  ];

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) router.replace("/menu", { scroll: false });
      }}
    >
      <DrawerContent aria-describedby={undefined} data-ui-generation="stitch-74" data-screen-id="5.4" data-screen-state="dish-quick-view-open">
        {/* flex-1 is load-bearing: DrawerContent is itself flex-col, so this
            scroll area filling the REMAINING space (instead of sizing to its
            own content) is what leaves room for the footer below to sit as a
            sibling that never scrolls out of view — the same "buy bar stays,
            content scrolls under it" contract DishBuyBar keeps on the full
            PDP route. Previously the Add-to-cart button was the last thing
            IN this scrolling div, ~200px below the fold on a typical phone. */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
          <div className="overflow-hidden rounded-xl border border-line bg-surface-raised">
            <SafeImage src={dish.image} className="aspect-[16/9] w-full" />
          </div>

          <div className="mt-4 flex items-start justify-between gap-4">
            <DrawerTitle className="text-xl font-semibold tracking-tight text-ink">
              {dish.name}
            </DrawerTitle>
            <span className="tabular shrink-0 text-lg font-semibold text-ink">
              {formatPaise(dish.price)}
            </span>
          </div>

          <DrawerDescription className="mt-2 text-sm leading-relaxed text-ink-muted">
            {dish.tasteDescription || dish.description}
          </DrawerDescription>

          <DishRationale dishId={dish.id} />

          <dl className="mt-4 grid grid-cols-4 gap-2">
            {macros.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line bg-surface p-2.5 text-center">
                <dd className="tabular text-sm font-semibold text-ink">{value}</dd>
                <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
              </div>
            ))}
          </dl>

          <DishSpec dish={dish} />

          {/* Allergens are never clamped (§6); the disclosure preserves the
              reviewed / auto-detected / under-review states — an unknown list
              is never rendered as "no allergens". */}
          <DishAllergens dish={dish} />
        </div>

        {/* Sibling of the scroll area, not its last child — see the flex-1
            comment above. shrink-0 keeps it from being squeezed as content
            grows; the safe-area pad matches DishBuyBar's fixed bar since this
            sheet already runs to the physical bottom edge on most phones. */}
        <div className="shrink-0 flex items-center justify-between border-t border-line bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
          <Link
            href={`/dish/${dish.slug}`}
            className="text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Open full page
          </Link>
          {/* §4.2 footer Add — server price beside the sole action colour;
              only for à-la-carte-orderable dishes (no dead buttons). */}
          {isAlaCarteEnabled(dish) && <AddToCart dish={dish} />}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
