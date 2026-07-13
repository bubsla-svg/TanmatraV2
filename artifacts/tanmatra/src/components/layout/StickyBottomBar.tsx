import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useCart } from "@/lib/cartContext";
import { usePersonalisationStore } from "@/lib/usePersonalisationStore";
import { formatPrice } from "@/lib/api/adapter";
import { ArrowRight, Warning, ShoppingCart } from "@phosphor-icons/react";

export type BottomBarContext = "homepage" | "pdp" | "builder" | "attention";

interface StickyBottomBarProps {
  context: BottomBarContext;
  // PDP props
  dishName?: string;
  dishPricePaise?: number;
  isInPlan?: boolean;
  onAddDish?: () => void;
  // Builder props
  step?: number;
  planSummaryText?: string;
  pricePaise?: number;
  ctaText?: string;
  onContinue?: () => void;
  disabled?: boolean;
  loading?: boolean;
  attentionReason?: string;
  attentionResolveLink?: string;
}

export default function StickyBottomBar({
  context,
  dishName,
  dishPricePaise,
  isInPlan = false,
  onAddDish,
  step = 0,
  planSummaryText,
  pricePaise,
  ctaText,
  onContinue,
  disabled = false,
  loading = false,
  attentionReason,
  attentionResolveLink,
}: StickyBottomBarProps) {
  const navigate = useNavigate();
  const { items } = useCart();
  const { hasCompletedOnboarding } = usePersonalisationStore();

  const cartHasItems = items.length > 0;

  // Determine active render state based on context and precedence rules
  let renderContext = context;
  if (context === "homepage" && cartHasItems) {
    renderContext = "builder"; // Override homepage with builder/cart summary if cart has items
  }

  // Scroll listener for scroll-minimize behavior
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const motionListener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", motionListener);

    // Scroll listener
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Hide bar on scroll down (only if scrolled down > 60px to avoid jumpiness), show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 60) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      mediaQuery.removeEventListener("change", motionListener);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollY]);

  // Calculate cart details for cart fallback mode
  const cartMealsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotalPricePaise = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  // Height transitions dynamically: 88px on checkout/payment transition, else 72px
  const isCheckoutStep = context === "builder" && step === 6;
  const barHeightClass = isCheckoutStep ? "h-[88px]" : "h-[72px]";

  // Style helper for scroll translation & motion settings
  const stickyStyle = {
    transform: visible ? "translateY(0)" : "translateY(100%)",
    transition: prefersReducedMotion ? "none" : "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",
  };

  if (renderContext === "attention") {
    return (
      <div
        role="status"
        aria-live="polite"
        style={stickyStyle}
        className={`fixed bottom-0 inset-x-0 z-[900] ${barHeightClass} bg-[var(--tnm-surface-ink)] border-t border-[var(--tnm-alert)] px-4 flex items-center justify-between safe-bottom`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Warning className="w-5 h-5 text-[var(--tnm-alert)] shrink-0" weight="bold" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--tnm-alert)]">
              Action Required
            </span>
            <p className="text-xs text-white/80 font-medium truncate">{attentionReason}</p>
          </div>
        </div>
        <Link
          to={attentionResolveLink || "#"}
          className="btn btn-s bg-[var(--tnm-alert)] text-white text-xs font-bold px-4 rounded-xl shrink-0"
          style={{ height: 36 }}
        >
          Resolve
        </Link>
      </div>
    );
  }

  if (renderContext === "homepage") {
    if (hasCompletedOnboarding) {
      return (
        <div
          role="status"
          aria-live="polite"
          style={stickyStyle}
          className={`fixed bottom-0 inset-x-0 z-[900] ${barHeightClass} bg-[var(--tnm-surface-ink)] border-t border-white/5 px-4 flex items-center justify-between safe-bottom`}
        >
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-white/40">
              Assessment Completed
            </span>
            <span className="text-xs font-bold text-white/90 truncate">
              Your personalized plan is ready
            </span>
          </div>
          <Link
            to="/subscribe"
            className="btn btn-s btn-p bg-[var(--tnm-action)] text-black text-xs font-bold px-5 rounded-xl flex items-center gap-1 shrink-0"
            style={{ height: 38 }}
          >
            View Recommendations
            <ArrowRight className="w-3.5 h-3.5" weight="bold" />
          </Link>
        </div>
      );
    }

    return (
      <div
        role="status"
        aria-live="polite"
        style={stickyStyle}
        className={`fixed bottom-0 inset-x-0 z-[900] ${barHeightClass} bg-[var(--tnm-surface-ink)] border-t border-white/5 px-4 flex items-center justify-between safe-bottom`}
      >
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 font-mono">
            Get Started
          </span>
          <span className="text-xs font-bold text-white/90 truncate">
            Find your custom metabolic program
          </span>
        </div>
        <Link
          to="/subscribe"
          className="btn btn-s btn-p bg-[var(--tnm-action)] text-black text-xs font-bold px-5 rounded-xl flex items-center gap-1 shrink-0"
          style={{ height: 38 }}
        >
          Find My Plan
          <ArrowRight className="w-3.5 h-3.5" weight="bold" />
        </Link>
      </div>
    );
  }

  if (renderContext === "pdp") {
    const isIncluded = isInPlan;
    const formattedPrice = dishPricePaise ? formatPrice(dishPricePaise) : "";

    return (
      <div
        role="status"
        aria-live="polite"
        style={stickyStyle}
        className={`fixed bottom-0 inset-x-0 z-[900] ${barHeightClass} bg-[var(--tnm-surface-ink)] border-t border-white/5 px-4 flex items-center justify-between safe-bottom`}
      >
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--tnm-action)] truncate">
            {dishName}
          </span>
          <span className="tnm-data text-xs font-bold text-white/95 mt-0.5">
            {isIncluded ? "Included in plan" : formattedPrice}
          </span>
        </div>
        <button
          type="button"
          onClick={onAddDish}
          disabled={disabled}
          className="btn btn-s btn-p bg-[var(--tnm-action)] text-black text-xs font-bold px-6 rounded-xl shrink-0"
          style={{ height: 44 }}
        >
          {isIncluded ? "Add Another" : "Add to Order"}
        </button>
      </div>
    );
  }

  // Builder or Cart override mode
  if (renderContext === "builder") {
    // If we fell back here because the cart has items but we are on home/menu:
    const summary = planSummaryText || `${cartMealsCount} meals selected`;
    const price = pricePaise !== undefined ? pricePaise : cartTotalPricePaise;
    const cta = ctaText || "Continue to Checkout";
    const continueAction = onContinue || (() => navigate("/checkout"));

    return (
      <div
        role="status"
        aria-live="polite"
        style={stickyStyle}
        className={`fixed bottom-0 inset-x-0 z-[900] ${barHeightClass} bg-[var(--tnm-surface-ink)] border-t border-white/5 px-4 flex items-center justify-between safe-bottom`}
      >
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 truncate">
            {summary}
          </span>
          <span className="tnm-data text-sm font-bold text-[var(--tnm-action)] mt-0.5">
            {formatPrice(price)}
            <span className="text-[10px] text-white/50 font-normal ml-1">
              {isCheckoutStep ? "total payable" : "estimated"}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={continueAction}
          disabled={disabled || loading}
          className="btn btn-s btn-p bg-[var(--tnm-action)] text-black text-xs font-bold px-6 rounded-xl flex items-center gap-1.5 shrink-0"
          style={{ height: 44 }}
        >
          {loading ? "Processing…" : cta}
          {!loading && <ArrowRight className="w-3.5 h-3.5" weight="bold" />}
        </button>
      </div>
    );
  }

  return null;
}
