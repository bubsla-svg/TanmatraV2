"use client"; // Justification: interactive click event emitter for analytics and scrolling action.

import React from "react";
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
 * Sticky bottom conversion bar (L-1). Enforces one gold primary action CTA per viewport
 * per CRO styling directives, dynamic zero-literal prices, and emits sticky_cta_click event.
 */
export function StickyCtaBar({
  pageSlug,
  ctaLabel,
  ctaHref,
  title,
  subtitle,
  onCtaClick,
}: StickyCtaBarProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    emitLpEvent("sticky_cta_click", { page: pageSlug, label: ctaLabel });
    if (onCtaClick) {
      onCtaClick();
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md shadow-lg sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="flex-1 truncate">
          {title && <p className="truncate text-sm font-semibold text-ink">{title}</p>}
          {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
        </div>
        <a
          href={ctaHref}
          onClick={handleClick}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gold px-6 py-2.5 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-95"
        >
          {ctaLabel}
          <LandingIcon name="arrow-right" className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
