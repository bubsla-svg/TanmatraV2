import Link from "next/link";
import { Card } from "@astryxdesign/core/Card";
import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { VStack, HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { isAlaCarteEnabled, type DishData } from "@workspace/menu-catalog";
import { formatPaise } from "@/lib/format";
import { AddToCart } from "@/components/cart/AddToCart";
import type { DishFit } from "@/lib/menuFit";

/**
 * Dish card, composed from Astryx primitives following the product-gallery
 * template (Card > AspectRatio > image, then a VStack of name/description/price).
 *
 * STILL A SERVER COMPONENT. Astryx's Card/Text/AspectRatio/Stack each carry
 * "use client", but a server component may RENDER client components without
 * becoming one — so the catalog data, the à-la-carte gate and the price all
 * stay server-side, and only the primitives ship. That is why there is no
 * "use client" here and no file-cap justification comment.
 *
 * Preserved from the pre-Astryx card, deliberately:
 *   - The Link wraps browse content only. The footer (price · macros · Add) is
 *     a SIBLING, because a <button> inside an <a> is invalid HTML and an a11y
 *     failure. The template has no interactive footer, so this is ours.
 *   - The image sits in a fixed-ratio box so a slow image never shifts layout.
 *     Ratio stays 4/3 (the template uses 1) to match the existing asset crop.
 *   - Price is rendered from dish.price exactly as the server sent it. Nothing
 *     here computes, discounts or re-derives an amount.
 */
export function DishCard({ dish, fit }: { dish: DishData; fit?: DishFit }) {
  const est = dish.macrosEstimated ? "~" : "";
  return (
    // Astryx Card renders a <div> with no `as` prop, so the semantic <article>
    // wraps it with display:contents — zero layout impact, and each dish stays
    // a self-contained article for screen readers (and for the e2e locators,
    // which rightly target the semantic element, not a class).
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-transform hover:-translate-y-0.5">
      <Link href={`/menu?dish=${dish.slug}`} scroll={false} className="flex flex-col">
        <div className="relative overflow-hidden bg-surface-raised">
          <AspectRatio ratio={4 / 3}>
            {/* eslint-disable-next-line @next/next/no-img-element -- plain img
                with an explicit ratio box for zero CLS; Astryx has no Image
                primitive, and next/image + remotePatterns lands in a later phase. */}
            <img
              src={dish.image}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </AspectRatio>
          <span
            role="img"
            aria-label={dish.isVeg ? "Vegetarian" : "Non-vegetarian"}
            className={`absolute left-2 top-2 inline-block h-3 w-3 ring-2 ring-white ${
              dish.isVeg ? "rounded-full" : "rounded-[2px]"
            }`}
            style={{ backgroundColor: dish.isVeg ? "var(--sage)" : "var(--danger)" }}
          />
        </div>

        <div className="p-3 pb-0">
          <VStack gap={1}>
            <Text type="body" weight="bold" as="h3">{dish.name}</Text>
            {fit?.band === "conflict" && fit.conflictLabel && (
              <Text type="supporting" weight="bold" className="text-[var(--danger)]">
                {fit.conflictLabel}
              </Text>
            )}
            {fit?.band === "high" && (
              <Text type="supporting" weight="bold" className="text-sage-text">
                Good match for you
              </Text>
            )}
            <Text type="supporting" color="secondary" maxLines={2}>
              {dish.tasteDescription || dish.description}
            </Text>
          </VStack>
        </div>
      </Link>

      {/* Sibling of the Link — see the a11y note above. */}
      <div className="relative z-10 mt-auto p-3 pt-2">
        <HStack gap={2} vAlign="center" className="justify-between">
          <VStack gap={0}>
            {/* hasTabularNumbers is the Astryx equivalent of .text-clinical-data:
                prices and macros must not jitter between cards. */}
            <Text type="body" weight="bold" hasTabularNumbers>
              {formatPaise(dish.price)}
            </Text>
            <Text type="supporting" color="secondary" hasTabularNumbers>
              {est}{dish.macros.calories} kcal · {est}{dish.macros.protein}g P
            </Text>
          </VStack>
          {/* §4.1 one-tap add — only for à-la-carte-orderable dishes, so a
              plan-only dish never shows a dead CTA. */}
          {isAlaCarteEnabled(dish) && <AddToCart dish={dish} />}
        </HStack>
      </div>
    </article>
  );
}
