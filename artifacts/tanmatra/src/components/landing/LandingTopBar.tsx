import { Link } from "react-router";
import Logo from "@/components/layout/Logo";

interface LandingTopBarProps {
  ctaLabel: string;
  /** Internal route ("/subscribe?trial=1") or same-page anchor ("#pilot-form"). */
  ctaTo: string;
  onCtaClick?: () => void;
}

const CTA_CLASSES =
  "inline-flex items-center justify-center bg-nn-primary text-stone-900 hover:bg-nn-primary/90 " +
  "text-xs font-bold h-11 px-4 rounded-full shrink-0 active:scale-[0.97] transition-transform";

/**
 * Minimal sticky header for the chrome-less landing pages (Playbook Part 3):
 * logo home-link on the left, one context CTA on the right. Both targets are
 * ≥44px tall.
 */
export default function LandingTopBar({ ctaLabel, ctaTo, onCtaClick }: LandingTopBarProps) {
  const isAnchor = ctaTo.startsWith("#");
  return (
    <div className="sticky top-0 z-40 bg-nn-bg/95 backdrop-blur-md border-b border-white/[0.08] px-4 py-1.5">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <Link
          to="/"
          aria-label="Tanmatra home"
          className="flex items-center min-h-[44px] pr-2 text-white"
        >
          <Logo className="h-7 w-auto" aria-hidden />
        </Link>
        {isAnchor ? (
          <a href={ctaTo} onClick={onCtaClick} className={CTA_CLASSES}>
            {ctaLabel}
          </a>
        ) : (
          <Link to={ctaTo} onClick={onCtaClick} className={CTA_CLASSES}>
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
