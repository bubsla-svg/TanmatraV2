import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShoppingCart, ArrowRight } from "@phosphor-icons/react";
import { useCart, useCartTotals } from "@/lib/cartContext";
import { formatCurrency } from "@/lib/utils";
import { DURATION, EASE } from "@/lib/motion";

const HIDE_ON = [
  /^\/cart\/?$/,
  /^\/checkout(\/.*)?$/,
  /^\/track(\/.*)?$/,
  /^\/admin(\/.*)?$/,
  /^\/rd-console(\/.*)?$/,
  /^\/dish\/.+/,
  /^\/marketplace\/.+/,
];

export default function StickyCheckoutBar() {
  const { items, totalQuantity } = useCart();
  const { subtotal, amountToFreeDelivery, freeDeliveryProgress, hasFreeDelivery } = useCartTotals();
  const { pathname } = useLocation();
  const prefersReducedMotion = useReducedMotion();

  const [showProgress, setShowProgress] = useState(true);

  useEffect(() => {
    let t: NodeJS.Timeout | undefined;
    if (hasFreeDelivery) {
      t = setTimeout(() => {
        setShowProgress(false);
      }, 3000);
    } else {
      setShowProgress(true);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [hasFreeDelivery]);

  const visible =
    items.length > 0 && !HIDE_ON.some((re) => re.test(pathname));

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="sticky-checkout"
          initial={prefersReducedMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : DURATION.base,
            ease: EASE.standard,
          }}
          role="region"
          aria-label="Cart summary"
          className="fixed inset-x-0 z-30 px-3 sm:px-6 bottom-[calc(56px+env(safe-area-inset-bottom))] md:bottom-6 pointer-events-none"
        >
          <div className="mx-auto max-w-3xl pointer-events-auto">
            <div className="flex flex-col rounded-2xl border border-clinical-border bg-clinical-surface/95 backdrop-blur-xl shadow-clinical overflow-hidden">
              
              {/* Free Delivery Progress Bar (only if subtotal > 0 and not collapsed) */}
              {subtotal > 0 && showProgress && (
                <div className="h-7 bg-clinical-surface-elevated/80 border-b border-clinical-border flex items-center justify-between px-4 text-[11px] font-mono font-medium transition-all duration-300">
                  {hasFreeDelivery ? (
                    <span className="text-clinical-sage font-bold flex items-center gap-1">
                      ✓ FREE DELIVERY UNLOCKED
                    </span>
                  ) : (
                    <>
                      <span className="text-clinical-zinc">
                        Add <span className="font-bold text-white">{formatCurrency(amountToFreeDelivery)}</span> more for free delivery
                      </span>
                      <div className="w-24 h-1.5 rounded-full bg-clinical-border/50 overflow-hidden relative">
                        <div 
                          className="h-full bg-clinical-sage transition-all duration-300 ease-out" 
                          style={{ width: `${freeDeliveryProgress}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Main content row */}
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0 grid place-items-center w-10 h-10 rounded-full bg-clinical-gold/15 text-clinical-gold">
                    <ShoppingCart className="w-5 h-5" weight="fill" aria-hidden />
                    <span
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-clinical-gold text-[#050505] text-[10px] font-bold leading-none grid place-items-center"
                      aria-label={`${totalQuantity} items in cart`}
                    >
                      {totalQuantity}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-micro tracking-wider text-clinical-zinc uppercase leading-none mb-1">
                      {totalQuantity === 1 ? "1 item" : `${totalQuantity} items`} · ready to order
                    </p>
                    <p className="font-display text-price text-white font-bold leading-tight">
                      {formatCurrency(subtotal)}
                    </p>
                  </div>
                </div>

                <Link
                  to="/checkout"
                  aria-label={`Checkout · ${formatCurrency(subtotal)} subtotal`}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-clinical-gold px-5 py-2.5 text-[13px] font-bold text-[#050505] shadow-clinical hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clinical-gold"
                >
                  Checkout
                  <ArrowRight className="w-4 h-4" weight="bold" aria-hidden />
                </Link>
              </div>

            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
