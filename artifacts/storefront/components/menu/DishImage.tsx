import { SafeImage } from "@/components/ui/SafeImage";
import { DishFallbackTile } from "@/components/menu/DishFallbackTile";

/**
 * A dish photo — the ONE way to render one (TNM-MENU-01 M-5 §3.5).
 *
 * WHY THIS EXISTS RATHER THAN A PROP. `SafeImage` takes an optional
 * `fallback`, and that optionality is correct for it: a marketplace product
 * or a landing-page hero genuinely should fall back to the neutral glyph
 * rather than borrow the menu's dish tile. But it made the branded tile
 * something each dish surface had to REMEMBER, and five of the six forgot.
 * The menu card passed it; the drawer that opens when you tap that card did
 * not — so a dish went from a designed tile to a broken-image glyph in one
 * tap. Meal-plan day cards, the protocol rail, the saved-dish vault and the
 * metabolic explorer had the same hole.
 *
 * §3.5 allows exactly three states for a dish image: a real photo of THIS
 * dish, the branded fallback tile, or nothing else. Making that a component
 * rather than a convention is what stops the next dish surface from
 * reintroducing a fourth.
 *
 * WHAT ACTUALLY TRIGGERS THE TILE — corrected 2026-08-16 against the live
 * payload, because the previous note here had gone stale and was steering
 * readers wrong.
 *
 * It used to say the platform serves no dish photography at all, every
 * `image` path resolving to the legacy SPA shell (HTTP 200,
 * `content-type: text/html`) that the browser reports as a load error. That
 * WAS true when written. It is not true now: `/api/menu/public` serves real
 * `https://images.unsplash.com/...` URLs, and they load.
 *
 * So the tile is no longer the common case — it is the SLOW case, reached
 * through `ImgWithFallback`'s 8s stall timeout when a remote photo hangs.
 * That distinction matters for anyone testing this: a local build with no
 * image host fails instantly, swaps to the tile immediately, and looks
 * perfect. Production loads slowly and shows an empty box for up to 8
 * seconds first. The environment that feels like the honest test is the one
 * that cannot reproduce the defect.
 *
 * Server Component, like `SafeImage` — the `onError` leaf below it is the
 * only client piece, so this stays free to render from any RSC.
 */
export function DishImage({
  src,
  name,
  className,
  imgClassName,
  priority = false,
  alt,
}: {
  src: string;
  /** Drives both the tile's letter and its deterministic tint. */
  name: string;
  /** Frame classes — MUST size the box (an aspect-* or explicit h/w). */
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  /**
   * Defaults to empty (decorative), which is right wherever the dish name is
   * already adjacent in text — the common case, and repeating it would make a
   * screen reader say the name twice. Pass the name explicitly on a surface
   * where the photo is the only thing identifying the dish.
   */
  alt?: string;
}) {
  return (
    <SafeImage
      src={src}
      alt={alt ?? ""}
      className={className}
      imgClassName={imgClassName}
      priority={priority}
      fallback={<DishFallbackTile name={name} className="h-full w-full" />}
    />
  );
}
