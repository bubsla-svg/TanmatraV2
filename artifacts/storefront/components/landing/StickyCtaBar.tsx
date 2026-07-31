"use client"; // Justification: interactive click event emitter for analytics and scrolling action.

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/CartProvider";
import { cn } from "@/lib/utils";
import { emitLpEvent } from "@/lib/lpEvents";
import { LandingIcon } from "./LandingIcon";

/**
 * Bottom-offset variants. Written out as whole literal class strings and never
 * assembled from interpolated fragments — Tailwind scans source text, so a
 * template-built class name is simply never generated.
 *
 * RESTING is the historical position: clear of the MobileBottomNav band on
 * mobile, flush to the bottom edge (and owning the safe-area inset itself)
 * from `md` up.
 *
 * LIFTED stacks one MiniCartBar band higher. That bar is 4.5rem tall (1px
 * border + py-3 + its 44px `min-h-11` button row) and pads the safe-area inset
 * itself, so the extra offset is that band alone and the safe-area term is
 * unchanged from RESTING.
 */
const RESTING =
  "bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]";
const LIFTED =
  "bottom-[calc(4rem+4.5rem+env(safe-area-inset-bottom))] md:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]";

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
 *
 * The same rule is why the bar is cart-aware. At z-40 it fully covered
 * MiniCartBar's `bottom-16 z-30` band, and the four routes that render it
 * (/corporate, /corporate-wellness, /partners/gyms, /partners/dietitians)
 * expose no other way into the cart — no Header cart icon, no MobileBottomNav
 * tab, no lib/nav.ts entry — so a shopper with items lost every route back to
 * them. It STACKS above the mini-cart rather than hiding: this is the page's
 * only conversion action, and the mini-cart is the page's only cart access, so
 * suppressing either one strands the buyer. Unlike the guard DishBuyBar and
 * the /trial, /vouchers and /subscription/bridge bars use, there is no
 * alternative surface here to fall back to.
 */
export function StickyCtaBar({
  pageSlug,
  ctaLabel,
  ctaHref,
  title,
  subtitle,
  onCtaClick,
}: StickyCtaBarProps) {
  const { cart } = useCart();

  const handleClick = () => {
    emitLpEvent("sticky_cta_click", { page: pageSlug, label: ctaLabel });
    onCtaClick?.();
  };

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-40 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md md:px-6",
        cart.lines.length > 0 ? LIFTED : RESTING,
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="hidden flex-1 truncate sm:block">
          {title && <p className="truncate text-sm font-semibold text-ink">{title}</p>}
          {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
        </div>
        <Button asChild shape="pill" size="fluid" className="w-full shrink-0 gap-2 px-8 py-4 font-semibold sm:w-auto">
          <a href={ctaHref} onClick={handleClick}>
            {ctaLabel}
            <LandingIcon name="arrow-right" className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
