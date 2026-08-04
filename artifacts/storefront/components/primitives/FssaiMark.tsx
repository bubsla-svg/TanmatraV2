interface FssaiMarkProps {
  isVeg: boolean;
  /** Rendered size in px. Clamped to the 14px regulatory minimum (§11.1). */
  size?: number;
  className?: string;
}

/**
 * FSSAI dietary mark (design contract §11.1).
 *
 * The regulatory VEG symbol (a green filled circle inside a green-bordered
 * square) and NON-VEG symbol (a brown filled triangle inside a brown-bordered
 * square), rendered on a white field exactly as they appear on Indian food
 * packaging. Mandatory on every dish surface — card, dish page, cart line,
 * order summary line.
 *
 * These are legal marks, not brand iconography: the geometry and colours
 * (`--color-fssai-*`) are fixed, never restyled or recoloured to brand tokens,
 * and never rendered below 14px. Hand-drawn as SVG on purpose — the mark is a
 * regulatory geometric symbol that no icon library carries, and §11.1 requires
 * the actual mark, so this is the sanctioned exception to the no-hand-rolled-SVG
 * rule. Pairs with a visible or screen-reader label at every call site.
 */
export function FssaiMark({ isVeg, size = 16, className }: FssaiMarkProps) {
  const px = Math.max(14, size);
  const mark = isVeg ? "var(--color-fssai-veg)" : "var(--color-fssai-nonveg)";
  const label = isVeg ? "Vegetarian, FSSAI mark" : "Non-vegetarian, FSSAI mark";

  return (
    <span
      role="img"
      aria-label={label}
      className={className}
      style={{ display: "inline-flex", width: px, height: px, flex: "none" }}
    >
      <svg width={px} height={px} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <rect
          x="1.5"
          y="1.5"
          width="17"
          height="17"
          rx="2.5"
          fill="var(--color-stone-0)"
          stroke={mark}
          strokeWidth="1.7"
        />
        {isVeg ? (
          <circle cx="10" cy="10" r="4.3" fill={mark} />
        ) : (
          <path d="M10 5.4 L14.6 13.8 H5.4 Z" fill={mark} />
        )}
      </svg>
    </span>
  );
}
