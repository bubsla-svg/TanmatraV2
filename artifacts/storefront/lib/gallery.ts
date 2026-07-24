import type { DishData } from "@workspace/menu-catalog";

type GalleryFields = Pick<
  DishData,
  "image" | "imageIngredient" | "imageDelivered" | "imageLifestyle" | "imagePackaging"
>;

/**
 * Ordered, de-duplicated image set for a dish's PDP gallery. The hero `image`
 * always leads; companion shots follow in an "as it arrives, then what's in it"
 * order — delivered → ingredient → lifestyle → packaging — so the first swap
 * shows the plated dish, not a styling shot. Duplicates are dropped (a dish
 * that reuses `image` as a companion never renders the same photo twice) and
 * empty/absent fields are skipped. Always returns at least the hero, so the
 * gallery is never empty and single-image dishes just render one frame.
 */
export function galleryImages(dish: GalleryFields): string[] {
  const ordered = [
    dish.image,
    dish.imageDelivered,
    dish.imageIngredient,
    dish.imageLifestyle,
    dish.imagePackaging,
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const src of ordered) {
    if (src && !seen.has(src)) {
      seen.add(src);
      out.push(src);
    }
  }
  return out;
}
