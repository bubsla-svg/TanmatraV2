interface LogoProps {
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
  /** Render only the logomark (no wordmark) — for tight spaces / app icon. */
  markOnly?: boolean;
}

/**
 * Tanmatra brand logo — crisp inline SVG (replaces the old raster PNG).
 *
 * Mark: a clinical hexagon ("structure / ISO-grade rigor") enclosing a rising
 * leaf rendered in the locked gold→sage brand gradient ("subtle essence /
 * vitality" — the literal meaning of तन्मात्र). Wordmark inherits `currentColor`
 * so it adapts to whatever surface it sits on (light on the Clinical Dark
 * theme, muted in the footer). Palette is the approved set only:
 * #D4AF37 gold · #7D9E7E sage.
 */
export default function Logo({
  className,
  "aria-hidden": ariaHidden,
  markOnly = false,
}: LogoProps) {
  const decorative = ariaHidden === true || ariaHidden === "true";
  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": "Tanmatra" } as const);

  const Mark = (
    <>
      <defs>
        <linearGradient id="tm-leaf" x1="24" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E7C766" />
          <stop offset="0.55" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#7D9E7E" />
        </linearGradient>
      </defs>
      {/* clinical hexagon */}
      <path
        d="M24 3.5 L41.8 13.75 V34.25 L24 44.5 L6.2 34.25 V13.75 Z"
        stroke="#D4AF37"
        strokeWidth="2.2"
        strokeLinejoin="round"
        fill="rgba(212,175,55,0.06)"
      />
      {/* rising essence leaf */}
      <path
        d="M24 37 C13.5 30.5 14.5 18.5 24 11.5 C33.5 18.5 34.5 30.5 24 37 Z"
        fill="url(#tm-leaf)"
      />
      {/* leaf vein */}
      <path
        d="M24 34.5 V15"
        stroke="#050505"
        strokeOpacity="0.35"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  );

  if (markOnly) {
    return (
      <svg
        viewBox="0 0 48 48"
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...a11y}
      >
        {!decorative && <title>Tanmatra</title>}
        {Mark}
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 208 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...a11y}
    >
      {!decorative && <title>Tanmatra</title>}
      {Mark}
      <text
        x="58"
        y="30.5"
        fontFamily="'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
        fontSize="23"
        fontWeight="600"
        letterSpacing="-0.2"
        fill="currentColor"
      >
        Tanmatra
      </text>
      {/* precision underscore — a hairline gold rule under the wordmark */}
      <path
        d="M58 38 H150"
        stroke="#D4AF37"
        strokeOpacity="0.5"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
