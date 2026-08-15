/**
 * The designed no-photo state for a dish (TNM-MENU-01 M-5 §3.5, defects
 * S-4 / S-5).
 *
 * WHY THIS IS THE DEFAULT AND NOT AN EDGE CASE: as of 2026-08-15 the
 * platform serves NO dish photography at all. Every `image` path in
 * /api/menu/public points at `/images/dishes/<slug>.jpg`, and every one of
 * those returns HTTP 200 with `content-type: text/html` — the legacy app's
 * SPA shell, because the file does not exist and the catch-all route
 * swallows the request. The repo tracks zero dish images. So the browser
 * fails to decode all 145, fires `error`, and the customer sees a broken
 * glyph or raw alt text (defect S-4, confirmed on-screen in F10).
 *
 * §3.5 allows exactly three image states: a real photo of THIS dish, a
 * branded fallback tile, or nothing else. Since state (a) is unavailable
 * platform-wide, this tile is the menu's actual visual surface today — which
 * is why it is designed rather than apologetic: a section-tinted gradient
 * wash carrying the dish's initial, so a photoless grid still reads as
 * deliberate. It also removes defect S-5 by construction: a fallback tile
 * cannot show another dish's food.
 *
 * Deterministic by design — the tint is derived from the dish name, so a
 * dish keeps the same tile across renders, sessions and viewports. Nothing
 * here is random.
 */

/** Tints drawn from the semantic palette only (no raw hex — `lint:tokens`
 *  scans this directory). Six steps is enough spread that adjacent cards
 *  rarely repeat, while every value stays inside the brand. */
const TINTS = [
  "var(--sage)",
  "var(--gold)",
  "var(--blue)",
  "var(--sage)",
  "var(--gold)",
  "var(--blue)",
] as const;

/** Stable, order-independent hash of the dish name → tint index. Uses the
 *  name rather than the id so a re-seeded catalog (ids are synthetic for
 *  CMS rows) doesn't reshuffle every tile. */
function tintFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length] ?? TINTS[0];
}

/** First letter of the dish, uppercased. Falls back to the brand mark when a
 *  name somehow starts with punctuation or is empty. */
function initialFor(name: string): string {
  const ch = name.trim().charAt(0).toUpperCase();
  return /[A-Z0-9]/.test(ch) ? ch : "T";
}

export function DishFallbackTile({ name, className = "" }: { name: string; className?: string }) {
  const tint = tintFor(name);
  return (
    <span
      aria-hidden
      data-testid="dish-fallback-tile"
      className={`flex items-center justify-center overflow-hidden bg-surface-raised ${className}`}
      style={{
        backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${tint} 22%, transparent), color-mix(in srgb, ${tint} 6%, transparent))`,
      }}
    >
      <span
        className="font-semibold leading-none opacity-70"
        style={{ color: tint, fontSize: "clamp(1.25rem, 38%, 2.5rem)" }}
      >
        {initialFor(name)}
      </span>
    </span>
  );
}
