import { Link } from "react-router";
import { ArrowRight } from "@phosphor-icons/react";

interface LandingStickyCtaProps {
  label: string;
  to: string;
  /** Small uppercase line above the price, e.g. the selected program name. */
  sublabel?: string;
  /** Pre-formatted price string (from `formatPrice` — never a literal). */
  priceText?: string;
  onClick?: () => void;
}

/**
 * Simple sticky footer CTA for landing pages (Playbook §3.1 row 9).
 * StickyBottomBar's contexts are cart/PDP/wizard-bound, so landings use this
 * dependency-free primitive instead: one ≥48px CTA, price on the left,
 * safe-area padded.
 */
export default function LandingStickyCta({
  label,
  to,
  sublabel,
  priceText,
  onClick,
}: LandingStickyCtaProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-nn-bg/95 backdrop-blur-xl pb-[var(--safe-bottom)]">
      <div className="max-w-5xl mx-auto min-h-[76px] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          {sublabel && (
            <span className="text-[10px] uppercase font-bold tracking-wider text-nn-on-surface-variant truncate">
              {sublabel}
            </span>
          )}
          {priceText && (
            <span className="text-base font-extrabold text-white tabular-nums leading-tight mt-0.5">
              {priceText}
            </span>
          )}
        </div>
        <Link
          to={to}
          onClick={onClick}
          className="inline-flex items-center justify-center gap-2 bg-nn-primary text-stone-900 hover:bg-nn-primary/90 text-sm font-bold h-12 px-6 rounded-xl shrink-0 active:scale-[0.97] transition-transform"
        >
          {label}
          <ArrowRight className="w-4 h-4" weight="bold" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
