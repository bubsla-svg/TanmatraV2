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
      <DrawerContent aria-describedby={undefined}>
        <div className="overflow-y-auto overscroll-contain px-4 pb-6 pt-3">
          <div className="overflow-hidden rounded-xl border border-line bg-surface-raised">
            <div className="aspect-[16/9] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed
                  aspect box, zero CLS; see DishCard */}
              <img src={dish.image} alt="" className="h-full w-full object-cover" />
            </div>
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

          {/* Allergens are never clamped (§6). */}
          {dish.allergens.length > 0 && (
            <p className="mt-4 text-xs text-ink-muted">
              <span className="font-semibold text-ink">Allergens:</span>{" "}
              {dish.allergens.join(", ")}
            </p>
          )}

          <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
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
        </div>
      </DrawerContent>
    </Drawer>
  );
}
