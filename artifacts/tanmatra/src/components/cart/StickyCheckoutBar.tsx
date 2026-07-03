import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShoppingCart, ArrowRight, CaretUp } from "@phosphor-icons/react";
import { useCart, useCartTotals, useCartDrawer } from "@/lib/cartContext";
import { formatPrice } from "@/lib/api/adapter";
import { DURATION, EASE } from "@/lib/motion";
import { Zap, ShieldCheck } from "lucide-react";

const HIDE_ON = [
  /^\/cart\/?$/,
  /^\/checkout(\/.*)?$/,
  /^\/track(\/.*)?$/,
  /^\/admin(\/.*)?$/,
  /^\/rd-console(\/.*)?$/,
];

export default function StickyCheckoutBar() {
  const { items, totalQuantity } = useCart();
  const { subtotal, amountToFreeDelivery, freeDeliveryProgress, hasFreeDelivery } = useCartTotals();
  const { open: openCart } = useCartDrawer();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const [showProgress, setShowProgress] = useState(true);

  useEffect(() => {
    let t: NodeJS.Timeout | undefined;
    if (hasFreeDelivery) {
      t = setTimeout(() => {
        setShowProgress(false);
      }, 4000);
    } else {
      setShowProgress(true);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [hasFreeDelivery, subtotal]);

  const visible =
    items.length > 0 && !HIDE_ON.some((re) => re.test(pathname));

  const amountNeededRupees = Math.max(0, Math.ceil(amountToFreeDelivery / 100));

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="sticky-checkout"
          initial={prefersReducedMotion ? { opacity: 0 } : { y: 32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { y: 32, opacity: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : DURATION.base,
            ease: EASE.standard,
          }}
          role="region"
          aria-label="Cart summary and free delivery tracker"
          className="fixed inset-x-0 z-30 px-3 sm:px-6 bottom-[calc(58px+env(safe-area-inset-bottom))] md:bottom-6 pointer-events-none"
        >
          <div className="mx-auto max-w-3xl pointer-events-auto">
            <div className="flex flex-col rounded-2xl border border-[#D4AF37]/40 bg-[#050505]/95 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_20px_rgba(212,175,55,0.15)] overflow-hidden">
              
              {/* Dynamic Threshold Progress Tracker (AOV Booster) */}
              {subtotal > 0 && showProgress && (
                <div 
                  onClick={openCart}
                  className="cursor-pointer bg-gradient-to-r from-[#111111] to-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-4 py-2 text-xs transition-all duration-300 hover:bg-white/5"
                >
                  {hasFreeDelivery ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5 tracking-wide">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      FREE DELIVERY UNLOCKED!
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
                      <Zap className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 fill-[#D4AF37]" />
                      <span className="text-zinc-300 truncate font-sans">
                        Add <span className="font-bold text-[#D4AF37]">₹{amountNeededRupees}</span> more for free delivery
                      </span>
                    </div>
                  )}
                  <div className="w-24 sm:w-32 h-2 rounded-full bg-white/10 overflow-hidden relative shrink-0">
                    <div 
                      className={`h-full transition-all duration-500 ease-out ${
                        hasFreeDelivery ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-gradient-to-r from-amber-500 to-[#D4AF37]"
                      }`} 
                      style={{ width: `${freeDeliveryProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Main cart action row */}
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                {/* Left / Center clickable drawer trigger area */}
                <button
                  type="button"
                  onClick={openCart}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left group focus:outline-none"
                  aria-label="Open sliding cart drawer"
                >
                  <div className="relative shrink-0 grid place-items-center w-11 h-11 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] group-hover:scale-105 transition-transform">
                    <ShoppingCart className="w-5 h-5" weight="fill" aria-hidden />
                    <span
                      className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-[#D4AF37] text-[#050505] text-[11px] font-extrabold leading-none grid place-items-center shadow-md"
                    >
                      {totalQuantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-zinc-400 group-hover:text-zinc-200 transition-colors">
                      <p className="font-mono text-[10px] tracking-wider uppercase font-semibold leading-none">
                        {totalQuantity === 1 ? "1 item" : `${totalQuantity} items`} · View Cart
                      </p>
                      <CaretUp className="w-3.5 h-3.5 text-[#D4AF37] animate-bounce" weight="bold" />
                    </div>
                    <p className="font-display text-base sm:text-lg text-white font-bold leading-tight mt-1 tabular-nums">
                      {formatPrice(subtotal)}
                    </p>
                  </div>
                </button>

                {/* Right: High-contrast gold checkout CTA */}
                <button
                  type="button"
                  onClick={() => navigate("/checkout")}
                  aria-label={`Proceed to checkout · ${formatPrice(subtotal)} subtotal`}
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-3 text-xs sm:text-sm font-extrabold text-[#050505] shadow-[0_0_20px_rgba(212,175,55,0.35)] hover:bg-[#e6c148] hover:scale-[1.03] active:scale-[0.97] transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]"
                >
                  Checkout
                  <ArrowRight className="w-4 h-4" weight="bold" aria-hidden />
                </button>
              </div>

            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
