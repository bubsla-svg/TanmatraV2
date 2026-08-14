import React from "react";

interface HorizontalSnapRailProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  /**
   * "rail" (default) — the horizontal snap-scroller, for BROWSING many items
   * where showing them all would cost more vertical space than it is worth.
   *
   * "grid" — every item visible, two columns on a phone. For DECIDING among a
   * few, which is a different job: a 280px card plus a 16px gap in a 390px
   * viewport shows ~1.2 cards, and with `no-scrollbar` there is no affordance
   * that more exist — the second card is simply cut mid-word ("Keep m…"),
   * which reads as broken rather than as "scroll for more". On /care, whose
   * whole purpose is routing a visitor to the right goal or condition, that
   * hid 3 of 4 goals and 4 of 6 conditions behind an invisible gesture.
   * Vertical space on a scrolling page is cheap; hidden options are not.
   */
  layout?: "rail" | "grid";
}

export const HorizontalSnapRail: React.FC<HorizontalSnapRailProps> = ({
  title,
  subtitle,
  children,
  className = "",
  layout = "rail",
}) => {
  return (
    <div className={`w-full py-4 ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4 flex items-end justify-between px-1">
          <div>
            {title && <h3 className="text-xl font-bold tracking-tight text-ink">{title}</h3>}
            {subtitle && <p className="text-xs text-ink-muted mt-1">{subtitle}</p>}
          </div>
        </div>
      )}

      {layout === "grid" ? (
        // `items-stretch` + the children's own h-full keeps a two-line card
        // level with its one-line neighbour, so the grid reads as a set of
        // equal choices rather than a ragged list.
        <div className="grid grid-cols-2 items-stretch gap-3">
          {React.Children.map(children, (child) => (
            <div className="min-w-0">{child}</div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 no-scrollbar scroll-smooth">
          {React.Children.map(children, (child) => (
            <div className="snap-start shrink-0 min-w-[280px] max-w-[320px]">
              {child}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
