"use client"; // Justification: interactive click event emitter for analytics and scrolling action.

import { emitLpEvent } from "@/lib/lpEvents";
import { LandingIcon } from "./LandingIcon";

export interface StickyCtaBarProps {
  pageSlug: string;
  ctaLabel: string;
  ctaHref: string;
  title?: string;
  subtitle?: string;
  onCtaClick?: () => void;
}

/**
 * Sticky bottom conversion bar (L-1) — one gold primary action per viewport,
 * zero price literals, emits `sticky_cta_click`.
 *
 * Positioning is load-bearing (Stitch brief 14: a bottom-fixed element must
 * never cover content or other chrome). On mobile the global MobileBottomNav is
 * `fixed bottom-0` with an `h-16` row plus the safe-area inset and sits at
 * z-50 — so this bar is offset above it rather than parked underneath, where it
 * would be invisible on every phone. On `md` and up that nav is hidden, so the
 * bar drops to the bottom edge and owns the safe-area padding itself. Pages
 * that render this bar reserve matching bottom padding so the last section
 * stays reachable.
 */
export function StickyCtaBar({
  pageSlug,
  ctaLabel,
  ctaHref,
  title,
  subtitle,
  onCtaClick,
}: StickyCtaBarProps) {
  const handleClick = () => {
    emitLpEvent("sticky_cta_click", { page: pageSlug, label: ctaLabel });
    onCtaClick?.();
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md md:bottom-0 md:px-6 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="hidden flex-1 truncate sm:block">
          {title && <p className="truncate text-sm font-semibold text-ink">{title}</p>}
          {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
        </div>
        <a
          href={ctaHref}
          onClick={handleClick}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-gold px-8 py-4 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98] sm:w-auto"
        >
          {ctaLabel}
          <LandingIcon name="arrow-right" className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
