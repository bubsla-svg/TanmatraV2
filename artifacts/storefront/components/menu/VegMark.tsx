import { type DishData } from "@workspace/menu-catalog";

/**
 * The FSSAI-style veg / non-veg / egg mark (TNM-MENU-01 M-5 §3.4, defect S-8).
 *
 * WHY THIS REPLACED A DOT: the card previously carried a bare coloured dot —
 * sage circle for veg, red rounded square for non-veg. Two problems, one
 * regulatory and one accessibility:
 *
 *  1. India's packaged-food convention (FSS Regulations, the mark every
 *     Indian eater reads without thinking) is a SQUARE OUTLINE enclosing a
 *     shape: filled circle = vegetarian, filled triangle = non-vegetarian.
 *     A bare dot is not that mark, so it does not carry the meaning it
 *     appears to claim.
 *  2. Colour was doing all the work. Red/green is the single most common
 *     confusion pair (~8% of men), and at 10px with no enclosing shape the
 *     two states were genuinely indistinguishable — on a menu where the
 *     distinction is dietary and, for some customers, religious.
 *
 * So the mark is SVG, sized 14px, and every state differs by SILHOUETTE as
 * well as hue: circle / triangle / ringed dot. Rendered from `vegClass` when
 * the payload supplies it (M-2 column), falling back to the binary `isVeg`
 * so ungoverned rows still mark correctly.
 *
 * The egg state is deliberately NOT claimed as FSSAI: the regulations define
 * green-circle and brown-triangle only, with no egg mark. Indian delivery
 * platforms have converged on an amber marker for eggetarian, so this uses
 * amber plus a distinct ringed-dot silhouette (a yolk) — honest as a
 * platform convention, not dressed up as a statutory one.
 */

export type VegClass = "veg" | "non-veg" | "egg";

/** `vegClass` (M-2 taxonomy) supersedes the binary `isVeg` for display;
 *  absent falls back to deriving veg/non-veg, which every dish can answer. */
export function resolveVegClass(dish: Pick<DishData, "vegClass" | "isVeg">): VegClass {
  return dish.vegClass ?? (dish.isVeg ? "veg" : "non-veg");
}

const LABEL: Record<VegClass, string> = {
  veg: "Vegetarian",
  "non-veg": "Non-vegetarian",
  egg: "Contains egg",
};

const TINT: Record<VegClass, string> = {
  veg: "var(--sage)",
  "non-veg": "var(--danger)",
  egg: "var(--gold)",
};

export function VegMark({ vegClass, className = "" }: { vegClass: VegClass; className?: string }) {
  const tint = TINT[vegClass];
  return (
    <svg
      role="img"
      aria-label={LABEL[vegClass]}
      data-testid="veg-mark"
      data-veg-class={vegClass}
      viewBox="0 0 16 16"
      className={`inline-block h-3.5 w-3.5 shrink-0 ${className}`}
      focusable="false"
    >
      {/* The enclosing square is the mark; without it this is just a dot. */}
      <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke={tint} strokeWidth="1.5" />
      {vegClass === "non-veg" ? (
        <path d="M8 4.5 L12 11.5 L4 11.5 Z" fill={tint} />
      ) : vegClass === "egg" ? (
        // Ringed dot — a yolk. Distinct in silhouette from the solid veg
        // circle, so the two never rely on amber-vs-green alone.
        <circle cx="8" cy="8" r="3.1" fill="none" stroke={tint} strokeWidth="2.2" />
      ) : (
        <circle cx="8" cy="8" r="3.4" fill={tint} />
      )}
    </svg>
  );
}
