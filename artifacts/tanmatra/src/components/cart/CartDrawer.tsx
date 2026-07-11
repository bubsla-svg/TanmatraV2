import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type KeyboardEvent,
} from "react";
import { Link, useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, X, Leaf, ShieldCheck, Loader2, Check, Zap, Crown } from "lucide-react";
import { toast } from "sonner";
import {
  useCart,
  useCartStore,
  useCartDrawer,
  useCartTotals,
  FREE_DELIVERY_THRESHOLD,
  DELIVERY_FEE,
  type CartItem,
} from "@/lib/cartContext";
import { useMenuCatalog, type DishData } from "@/lib/menuData";
import { addressesApi } from "@/lib/userAddressesApi";
import { API_BASE } from "@/lib/apiBase";
import { loyaltyApi } from "@/lib/loyaltyApi";
import { formatPrice } from "@/lib/api/adapter";
import { track } from "@/lib/analytics";
import { PANEL_SLIDE, BACKDROP, PULSE_OPACITY } from "@/lib/motion";
import { localDishSrcset, getLocalDishFallback } from "@/lib/imgSrcset";
import { onDishImageError } from "@/lib/imgFallback";
import { usePremiumStatus } from "@/lib/usePremium";
import { useOrders } from "@/lib/ordersContext";
import { savePendingTransaction, removePendingTransaction, subscribeUpiRecovery } from "@/lib/paymentRecovery";

// Suppress unused-import warning — DELIVERY_FEE is used in the comment context only,
// the actual constant is pulled from cartContext which re-exports it.
void DELIVERY_FEE;

const UPSELL_CATEGORIES = new Set<string>(["beverages", "soups", "snacks", "breakfast"]);

/**
 * Slide-out cart drawer built with Framer Motion.
 * Ghost-Math: hovering an upsell card shows a projected fill on the
 * free-delivery progress bar before the user commits to adding it.
 */
export default function CartDrawer() {
  const { isOpen, close } = useCartDrawer();
  const { items, bundleSlugs, addItem, updateQty, updateRecipient, removeItem, clear } = useCart();
  const totals = useCartTotals();
  const { dishes } = useMenuCatalog();
  const navigate = useNavigate();
  const { isPremium } = usePremiumStatus();
  const { addOrder } = useOrders();
  const [expressLoading, setExpressLoading] = useState(false);

  // Ghost-math state
  const [ghostItem, setGhostItemState] = useState<DishData | null>(null);
  const ghostTimerRef = useRef<number | null>(null);

  const setGhost = useCallback((dish: DishData | null) => {
    if (ghostTimerRef.current) window.clearTimeout(ghostTimerRef.current);
    if (dish === null) {
      ghostTimerRef.current = window.setTimeout(() => setGhostItemState(null), 80);
    } else {
      setGhostItemState(dish);
      track("upsell_focus", { dishId: dish.id, dishName: dish.name });
    }
  }, []);

  // Projected fill for ghost-math
  const subtotal = totals.subtotal;
  const currentFill = Math.min(1, subtotal / FREE_DELIVERY_THRESHOLD);
  const projectedFill =
    ghostItem && !totals.hasFreeDelivery
      ? Math.min(1, (subtotal + ghostItem.price) / FREE_DELIVERY_THRESHOLD)
      : null;
  const ghostUnlocksDelivery =
    projectedFill !== null && projectedFill >= 1 && !totals.hasFreeDelivery;

  // Upsell handler with analytics
  const addUpsell = useCallback(
    (dish: DishData) => {
      addItem({
        dishId: dish.id,
        slug: dish.slug,
        name: dish.name,
        image: dish.image,
        basePrice: dish.price,
        unitPrice: dish.price,
        quantity: 1,
        kitchen: dish.kitchen,
        isVeg: dish.isVeg,
        rdVerified: dish.rdVerified,
        macros: dish.macros,
        customizations: [],
      });
      track("upsell_add", { dishId: dish.id, dishName: dish.name, price: dish.price });
      const wouldUnlock =
        projectedFill !== null && projectedFill >= 1 && !totals.hasFreeDelivery;
      if (wouldUnlock) {
        track("free_delivery_unlocked", { via: "upsell" });
      }
      setGhost(null);
    },
    [addItem, projectedFill, totals.hasFreeDelivery, setGhost],
  );

  // Freeze the upsell rail per drawer-open. Recomputing pickUpsells on every
  // cart change made cards jump position and vanish mid-tap (the reshuffle was
  // also what unmounted cards and stranded their add-status). We snapshot the
  // rail when the drawer opens (and once more if the catalog finishes loading
  // after open) and keep it stable for the session; a dish that gets added
  // stays in its slot and simply flips to an "Added" state.
  const [upsells, setUpsells] = useState<DishData[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    const its = useCartStore.getState().items;
    const sub = its.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const gap = Math.max(0, FREE_DELIVERY_THRESHOLD - sub);
    setUpsells(pickUpsells(dishes, its, gap));
    // Intentionally NOT keyed on items/totals — stability is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dishes]);
  const inCartIds = useMemo(() => new Set(items.map((i) => i.dishId)), [items]);

  // Express UPI checkout — finalize-then-pay, mirroring the Checkout page:
  // the server order is created (safety gates, discounts, ASAP slot) BEFORE
  // any money moves, so a charge can never exist without a kitchen order.
  // Falls back to /checkout when any step needs the full page's UI.
  const handleExpressUPI = useCallback(async () => {
    const rpKey = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined;
    if (!rpKey) { navigate("/checkout"); return; }
    // Cancel any previous in-flight request before starting a new one.
    expressAbortRef.current?.abort();
    expressAbortRef.current = new AbortController();
    setExpressLoading(true);
    const localOrderId = `TAN-${Date.now()}`;
    try {
      // 1. Resolve default address
      const { addresses } = await addressesApi.list();
      const addr = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (!addr) { navigate("/checkout"); return; }

      // 2. Create the server order FIRST — runs the allergen safety gate,
      //    applies the first-order discount, and reserves an ASAP slot.
      //    Any rejection (safety block, auth, serviceability) sends the
      //    user to /checkout where the full error UI lives — unpaid.
      const out = await loyaltyApi.finalizeOrder({
        idempotencyKey: `idem-express-${localOrderId}`,
        orderId: localOrderId,
        items: items.map((it) => ({
          id: it.dishId,
          name: it.name,
          qty: it.quantity,
          price: it.unitPrice,
        })),
        address: {
          label: addr.label,
          line: [addr.line1, addr.line2].filter(Boolean).join(", "),
          city: addr.city,
          pincode: addr.pincode,
          phone: addr.phone,
        },
        // Pass accepted combo bundles so the server applies the discount the
        // user saw — omitting them silently charged full price for bundles.
        bundleSlugs: bundleSlugs.length > 0 ? bundleSlugs : undefined,
        fulfillmentType: "delivery",
        deliverySlotId: null,
      });

      // 3. Charge EXACTLY the server-authoritative amount (meal-after-discount
      //    + GST + delivery fee, computed once server-side). Never recompute
      //    the total on the client.
      const chargeTotal = out.chargePaise;

      const cancelServerOrder = () => {
        void fetch(`${API_BASE}/orders/${encodeURIComponent(localOrderId)}/cancel`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Payment cancelled by user" }),
        }).catch(() => undefined);
      };

      // 4. Create the Razorpay order for the reconciled amount.
      const rpRes = await fetch(`${API_BASE}/payments/razorpay/order`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // The server prices the gateway order from the stored charge; we send
        // only the order id (amount included for server-side drift detection).
        body: JSON.stringify({ orderId: localOrderId, amountPaise: chargeTotal }),
      });
      if (!rpRes.ok) { cancelServerOrder(); navigate("/checkout"); return; }
      const { razorpayOrderId } = (await rpRes.json()) as { razorpayOrderId: string };

      // 5. Load Razorpay script lazily (5 s timeout → fallback to /checkout)
      await new Promise<void>((resolve, reject) => {
        if ((window as { Razorpay?: unknown }).Razorpay) { resolve(); return; }
        const timer = window.setTimeout(() => reject(new Error("timeout")), 5000);
        if (!document.getElementById("__rzp_script")) {
          const s = document.createElement("script");
          s.id = "__rzp_script";
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.async = true;
          s.onload = () => { window.clearTimeout(timer); resolve(); };
          s.onerror = () => { window.clearTimeout(timer); reject(new Error("load-failed")); };
          document.head.appendChild(s);
        } else {
          window.clearTimeout(timer);
          resolve();
        }
      }).catch((err) => { cancelServerOrder(); throw err; });

      // 6. Open modal
      savePendingTransaction({
        orderId: localOrderId,
        idempotencyKey: `idem-express-${localOrderId}`,
        initiatedAt: Date.now(),
        amount: chargeTotal,
        provider: "razorpay",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const RazorpayClass = (window as any).Razorpay;
      if (!RazorpayClass) { cancelServerOrder(); navigate("/checkout"); return; }
      const rzp = new RazorpayClass({
        key: rpKey,
        amount: chargeTotal,
        currency: "INR",
        order_id: razorpayOrderId,
        name: "Tanmatra",
        description: `${totals.totalQuantity} item${totals.totalQuantity === 1 ? "" : "s"}`,
        theme: { color: "#F4C430" },
        prefill: { contact: addr.phone },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const vres = await fetch(`${API_BASE}/payments/razorpay/verify`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: localOrderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            // Only clear the recovery marker when the server actually confirmed
            // the payment. On a non-OK verify (e.g. 400 bad signature) keep the
            // pending tx so the webhook/recovery poller can reconcile it — a
            // 4xx must never be treated as a successful payment.
            if (vres.ok) {
              removePendingTransaction(localOrderId);
            }
          } catch { /* non-fatal; webhook + pending-tx recovery reconcile server-side */ }
          // Record the order locally so it appears in /orders and the Track
          // page can resolve `/track/:id`.
          const nowMs = Date.now();
          addOrder({
            orderId: localOrderId,
            placedAt: new Date(nowMs).toISOString(),
            etaAt: new Date(nowMs + 40 * 60 * 1000).toISOString(),
            status: "placed",
            items: [...items],
            subtotal: out.finalPaise,
            deliveryFee: out.deliveryFeePaise,
            tip: 0,
            total: chargeTotal,
            serverOrderId: out.serverOrderId,
            fulfillmentType: "delivery",
            address: {
              label: addr.label,
              line1: addr.line1,
              line2: addr.line2,
              city: addr.city,
              pincode: addr.pincode,
              phone: addr.phone,
            },
          });
          clear();
          close();
          navigate(`/track/${localOrderId}`);
        },
        modal: {
          ondismiss: () => {
            // The unpaid server order must not sit in the kitchen queue.
            cancelServerOrder();
            removePendingTransaction(localOrderId);
            setExpressLoading(false);
            toast.info("Payment cancelled — your cart is safe");
          },
        },
      });
      rzp.open();
    } catch {
      navigate("/checkout");
    } finally {
      setExpressLoading(false);
    }
  }, [totals, items, addOrder, navigate, close, clear]);
  const isEmpty = items.length === 0;

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [isOpen]);

  // Analytics: cart_open
  useEffect(() => {
    if (isOpen) {
      track("cart_open");
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // Focus trap refs
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Abort any in-flight express-checkout fetch when the component unmounts
  // (e.g., user navigates away while the order-creation request is pending).
  const expressAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => { expressAbortRef.current?.abort(); }, []);

  useEffect(() => {
    // CartDrawer is globally mounted, so this listener runs whether or not the
    // drawer is open. It must NOT be gated on isOpen — a payment that captured
    // after the modal closed (or on the next app boot) would otherwise be
    // silently swallowed, leaving the customer charged with no confirmation.
    return subscribeUpiRecovery({
      onRecovered: (event) => {
        if (event.tx.orderId.startsWith("TAN-")) {
          toast.success(`Payment confirmed for order ${event.tx.orderId}`);
          clear();
          close();
          navigate(`/track/${event.tx.orderId}`);
        }
      },
    });
  }, [clear, close, navigate]);

  // Focus the close button when drawer opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Manual focus trap
  const handlePanelKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    const els = Array.from(focusable);
    if (els.length === 0) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cart-backdrop"
            variants={BACKDROP}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={close}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 70 }}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="cart-panel"
            ref={panelRef}
            variants={PANEL_SLIDE}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
            onKeyDown={handlePanelKeyDown}
            className="tnm2"
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              zIndex: 71,
              height: "100dvh",
              width: "100%",
              maxWidth: "min(420px,100vw)",
              background: "var(--s1)",
              borderLeft: "1px solid var(--ln)",
              color: "var(--tx)",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 40px 90px rgba(0,0,0,.65)",
            }}
          >
            <CartHeader
              totalQuantity={totals.totalQuantity}
              onClose={close}
              closeButtonRef={closeButtonRef}
            />

            {isEmpty ? (
              <EmptyState onClose={close} />
            ) : (
              <>
                <div
                  className="content"
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    overscrollBehavior: "contain",
                    touchAction: "pan-y",
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {/* FreeDeliveryBar inside scroll so it stays visible on long carts */}
                  <FreeDeliveryBar
                    subtotal={subtotal}
                    currentFill={currentFill}
                    projectedFill={projectedFill}
                    ghostUnlocksDelivery={ghostUnlocksDelivery}
                    ghostItem={ghostItem}
                    hasFreeDelivery={totals.hasFreeDelivery}
                    amountToFreeDelivery={totals.amountToFreeDelivery}
                  />
                  <CartLineList
                    items={items}
                    updateQty={updateQty}
                    updateRecipient={updateRecipient}
                    removeItem={removeItem}
                    addItem={addItem}
                  />

                  {upsells.length > 0 && (
                    <UpsellCarousel
                      dishes={upsells}
                      inCartIds={inCartIds}
                      onGhost={setGhost}
                      onAdd={addUpsell}
                    />
                  )}

                  {!isPremium && (
                    <button
                      type="button"
                      onClick={() => { close(); navigate("/premium"); }}
                      className="banner"
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--safd)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                        <Crown className="w-4 h-4" style={{ color: "var(--safb)" }} />
                      </div>
                      <div className="f1" style={{ minWidth: 0 }}>
                        <p className="small" style={{ fontWeight: 600 }}>Unlock Tanmatra Premium</p>
                        <p className="fine mt2" style={{ fontSize: 11 }}>
                          Priority delivery · free RD consult · exclusive dishes
                        </p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--safb)", flex: "none" }}>₹999/mo →</span>
                    </button>
                  )}
                </div>


                <FooterTotals
                  totals={totals}
                  items={items}
                  onClose={close}
                  onExpressUPI={handleExpressUPI}
                  expressLoading={expressLoading}
                />
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* CartHeader                                                          */
/* ------------------------------------------------------------------ */

function CartHeader({
  totalQuantity,
  onClose,
  closeButtonRef,
}: {
  totalQuantity: number;
  onClose: () => void;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--ln)", display: "flex", alignItems: "center", justifyContent: "space-between", flex: "none" }}>
      <div className="fx ac gap8">
        <ShoppingBag className="w-4 h-4" style={{ color: "var(--safb)" }} aria-hidden />
        <span style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".14em", color: "var(--tx)" }}>
          Your Cart
        </span>
        {totalQuantity > 0 && (
          <span
            className="mono"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--saf)", color: "var(--onsaf)", borderRadius: 999, height: 20, minWidth: 20, padding: "0 6px", fontSize: 10, fontWeight: 700 }}
          >
            {totalQuantity}
          </span>
        )}
      </div>
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close cart"
        style={{ width: 44, height: 44, marginRight: -8, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--mut)", background: "none", border: "none" }}
      >
        <X className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                            */
/* ------------------------------------------------------------------ */

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="f1 col ac jc tc" style={{ padding: "0 32px", gap: 16 }}>
      <div className="avatar big" style={{ background: "var(--safd)", color: "var(--safb)" }}>
        <ShoppingBag className="w-7 h-7" aria-hidden />
      </div>
      <div>
        <div className="tt">Your cart is empty</div>
        <div className="fine mt6" style={{ maxWidth: 240, margin: "6px auto 0" }}>
          Browse the menu and add dishes designed by registered dietitians.
        </div>
      </div>
      <Link
        to="/menu"
        onClick={onClose}
        className="btn btn-p"
      >
        Browse menu
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FreeDeliveryBar                                                       */
/* ------------------------------------------------------------------ */

function FreeDeliveryBar({
  currentFill,
  projectedFill,
  ghostUnlocksDelivery,
  ghostItem,
  hasFreeDelivery,
  amountToFreeDelivery,
}: {
  subtotal: number;
  currentFill: number;
  projectedFill: number | null;
  ghostUnlocksDelivery: boolean;
  ghostItem: DishData | null;
  hasFreeDelivery: boolean;
  amountToFreeDelivery: number;
}) {
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
    [],
  );

  const showGhostLayer = projectedFill !== null && !hasFreeDelivery;
  const ghostWidth =
    showGhostLayer && projectedFill !== null
      ? Math.max(0, projectedFill - currentFill) * 100
      : 0;

  // Copy logic
  let label: string;
  if (hasFreeDelivery) {
    label = "Free Delivery Unlocked!";
  } else if (ghostUnlocksDelivery) {
    label = "→ Unlocks free delivery";
  } else if (ghostItem !== null) {
    label = `Would add ${ghostItem.name} · ${formatPrice(ghostItem.price)}`;
  } else {
    label = `Add ${formatPrice(amountToFreeDelivery)} more for free delivery`;
  }

  return (
    <div
      style={{
        borderRadius: 12,
        padding: "12px 14px 10px",
        border: "1px solid",
        transition: "all .3s",
        ...(hasFreeDelivery
          ? { borderColor: "rgba(136,170,132,.35)", background: "var(--saged)" }
          : { borderColor: "var(--saf)", background: "var(--safd)" }),
      }}
    >
      <div className="fx ac jb" style={{ marginBottom: 6 }}>
        <span className="lab" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: hasFreeDelivery ? "var(--sage)" : "var(--mut)" }}>
          {hasFreeDelivery ? <ShieldCheck className="w-3.5 h-3.5" style={{ color: "var(--sage)" }} /> : <Zap className="w-3.5 h-3.5" style={{ color: "var(--safb)", fill: "var(--safb)" }} />}
          Free Delivery
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            transition: "color .2s",
            color: hasFreeDelivery ? "var(--sage)" : ghostUnlocksDelivery ? "var(--sage)" : "var(--tx)",
          }}
        >
          {label}
        </span>
      </div>

      {/* Progress track */}
      <div style={{ position: "relative", height: 8, borderRadius: 999, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
        {/* Filled (real) track */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            borderRadius: 999,
            transition: "all .5s ease-out",
            width: `${currentFill * 100}%`,
            ...(hasFreeDelivery
              ? { background: "var(--sage)", boxShadow: "0 0 10px rgba(136,170,132,.85)" }
              : { background: "linear-gradient(to right,var(--safb),var(--saf))" }),
          }}
        />

        {/* Ghost layer — uses only transform (GPU-composited, zero layout cost).
            translateX moves by a percentage of the element's own width (= 100%
            of the bar), then scaleX shrinks it to ghostWidth% from the left. */}
        {showGhostLayer && ghostWidth > 0 && (
          <motion.div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: "100%",
              borderRadius: 999,
              transformOrigin: "left",
              background: prefersReducedMotion ? "rgba(136,170,132,.25)" : "rgba(136,170,132,.4)",
              transform: `translateX(${currentFill * 100}%) scaleX(${ghostWidth / 100})`,
            }}
            variants={prefersReducedMotion ? undefined : PULSE_OPACITY}
            initial={prefersReducedMotion ? undefined : "idle"}
            animate={prefersReducedMotion ? undefined : "pulse"}
          />
        )}

        {/* Micro-label above bar when ghost unlocks delivery */}
        {ghostUnlocksDelivery && (
          <span
            style={{ position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 600, color: "var(--sage)", whiteSpace: "nowrap", pointerEvents: "none" }}
            aria-hidden="true"
          >
            Unlocks free delivery
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CartLineList                                                          */
/* ------------------------------------------------------------------ */

function CartLineList({
  items,
  updateQty,
  updateRecipient,
  removeItem,
  addItem,
}: {
  items: CartItem[];
  updateQty: (lineId: string, delta: number) => void;
  updateRecipient: (lineId: string, recipient: string) => void;
  removeItem: (lineId: string) => void;
  addItem: (item: Omit<CartItem, "lineId">) => void;
}) {
  return (
    <div className="col" style={{ gap: 12 }}>
      {items.map((item) => (
        <CartLine
          key={item.lineId}
          item={item}
          onInc={() => updateQty(item.lineId, +1)}
          onDec={() => updateQty(item.lineId, -1)}
          onRemove={() => removeItem(item.lineId)}
          onUpdateRecipient={(val) => updateRecipient(item.lineId, val)}
          addItem={addItem}
        />
      ))}
    </div>
  );
}

function CartLine({
  item,
  onInc,
  onDec,
  onRemove,
  onUpdateRecipient,
  addItem,
}: {
  item: CartItem;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
  onUpdateRecipient: (val: string) => void;
  addItem: (item: Omit<CartItem, "lineId">) => void;
}) {
  const lineTotal = item.unitPrice * item.quantity;
  const [showTagInput, setShowTagInput] = useState(false);

  const handleRemove = () => {
    onRemove();
    toast(`Removed ${item.name}`, {
      action: {
        label: "Undo",
        onClick: () => addItem({
          dishId: item.dishId,
          slug: item.slug,
          name: item.name,
          image: item.image,
          basePrice: item.basePrice,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          kitchen: item.kitchen,
          isVeg: item.isVeg,
          rdVerified: item.rdVerified,
          macros: item.macros,
          customizations: item.customizations,
        }),
      },
      duration: 4000,
    });
  };

  return (
    <div className="dcard" style={{ marginBottom: 0 }}>
      <div className="fx gap12">
        <img
          src={getLocalDishFallback(item.image, 200)}
          srcSet={localDishSrcset(item.image, "webp")}
          sizes="64px"
          alt=""
          loading="lazy"
          decoding="async"
          onError={onDishImageError}
          style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flex: "none", background: "var(--s2)" }}
        />
        <div className="f1" style={{ minWidth: 0 }}>
          <div className="fx" style={{ alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <p className="small" style={{ fontWeight: 600, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {item.name}
              </p>
              <div className="fx ac" style={{ gap: 6, marginTop: 2, fontSize: 10, color: "var(--mut)" }}>
                {item.isVeg && (
                  <Leaf className="w-3 h-3" style={{ color: "var(--sage)" }} aria-label="Vegetarian" />
                )}
                {item.rdVerified && (
                  <ShieldCheck
                    className="w-3 h-3"
                    style={{ color: "var(--safb)" }}
                    aria-label="RD-verified"
                  />
                )}
                <span className="mono" style={{ fontSize: 10 }}>
                  {item.macros.calories} kcal · P{item.macros.protein}g
                </span>
              </div>
              {item.customizations.length > 0 && (
                <p className="fine clamp1" style={{ fontSize: 10, marginTop: 4 }}>
                  {item.customizations.join(" · ")}
                </p>
              )}
              {item.recipient || showTagInput ? (
                <div className="fx ac" style={{ gap: 6, marginTop: 6 }}>
                  <span className="lab">For</span>
                  <input
                    type="text"
                    placeholder="e.g. Mom, Child"
                    autoFocus={showTagInput}
                    value={item.recipient || ""}
                    onChange={(e) => onUpdateRecipient(e.target.value)}
                    onBlur={() => {
                      if (!item.recipient) setShowTagInput(false);
                    }}
                    className="inp"
                    style={{ height: 28, width: 120, padding: "0 10px", fontSize: 11 }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTagInput(true)}
                  className="linkq"
                  style={{ fontSize: 11, marginTop: 6, display: "block" }}
                >
                  + Add name tag
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleRemove}
              aria-label={`Remove ${item.name}`}
              className="qbtn"
              style={{ width: 30, height: 30, flex: "none" }}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>

          <div className="fx ac jb mt10">
            <QtyStepper
              quantity={item.quantity}
              onInc={onInc}
              onDec={item.quantity === 1 ? handleRemove : onDec}
              name={item.name}
            />
            <span className="price" style={{ fontSize: 15, color: "var(--safb)" }}>
              {formatPrice(lineTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QtyStepper({
  quantity,
  onInc,
  onDec,
  name,
}: {
  quantity: number;
  onInc: () => void;
  onDec: () => void;
  name: string;
}) {
  return (
    <div className="fx ac gap10">
      <button
        type="button"
        onClick={onDec}
        aria-label={`Decrease ${name} quantity`}
        className="qbtn"
      >
        <Minus className="w-3 h-3" aria-hidden />
      </button>
      <span
        aria-live="polite"
        className="mono"
        style={{ width: 20, textAlign: "center", fontSize: 15, fontWeight: 600 }}
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={onInc}
        aria-label={`Increase ${name} quantity`}
        className="qbtn"
      >
        <Plus className="w-3 h-3" aria-hidden />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* UpsellCarousel                                                        */
/* ------------------------------------------------------------------ */

function UpsellCarousel({
  dishes,
  inCartIds,
  onGhost,
  onAdd,
}: {
  dishes: DishData[];
  inCartIds: Set<number>;
  onGhost: (dish: DishData | null) => void;
  onAdd: (dish: DishData) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    const SCROLL_AMOUNT = 160;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollRef.current.scrollBy({ left: SCROLL_AMOUNT, behavior: "smooth" });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollRef.current.scrollBy({ left: -SCROLL_AMOUNT, behavior: "smooth" });
    }
  }, []);

  return (
    <section aria-label="Frequently added together" style={{ paddingTop: 8 }}>
      <div className="fx" style={{ alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <h3 className="lab" style={{ color: "var(--safb)" }}>
          Add to your order
        </h3>
        <span className="fine" style={{ fontSize: 10 }}>RD picks</span>
      </div>
      <div
        ref={scrollRef}
        role="list"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="hrail"
        style={{ margin: "0 -4px", padding: "2px 4px 4px", scrollSnapType: "x mandatory", outline: "none" }}
        aria-label="Upsell items, use arrow keys to scroll"
      >
        {dishes.map((d) => (
          <UpsellCard key={d.id} dish={d} inCart={inCartIds.has(d.id)} onGhost={onGhost} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}

function UpsellCard({
  dish,
  inCart,
  onGhost,
  onAdd,
}: {
  dish: DishData;
  inCart: boolean;
  onGhost: (dish: DishData | null) => void;
  onAdd: (dish: DishData) => void;
}) {
  // `inCart` (derived from the live cart) is the durable "Added" signal — it
  // can never strand, unlike the old global dishId→status map. A short local
  // pulse gives immediate tap feedback and self-clears; if the card unmounts
  // the timer is cleaned up and nothing leaks because the add already fired.
  const [justAdded, setJustAdded] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const handleAdd = () => {
    // Fire the add synchronously — no artificial delay that a close/unmount
    // could drop. Re-taps simply add another unit (never a dead no-op).
    onGhost(null);
    onAdd(dish);
    setJustAdded(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setJustAdded(false), 1100);
  };

  const showAdded = justAdded || inCart;

  return (
    <article
      role="group"
      aria-label={dish.name}
      className="hcard"
      style={{ width: 156, scrollSnapAlign: "start" }}
      onPointerEnter={() => { onGhost(dish); }}
      onPointerLeave={() => { onGhost(null); }}
      onFocus={() => onGhost(dish)}
      onBlur={() => { onGhost(null); }}
    >
      <div className="posrel" style={{ aspectRatio: "4 / 3", background: "var(--s2)" }}>
        <img
          src={getLocalDishFallback(dish.image, 200)}
          srcSet={localDishSrcset(dish.image, "webp")}
          sizes="156px"
          alt=""
          loading="lazy"
          decoding="async"
          onError={onDishImageError}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {dish.isVeg && (
          <span style={{ position: "absolute", top: 6, left: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 4, border: "1px solid rgba(136,170,132,.7)", background: "rgba(10,12,13,.7)" }}>
            <Leaf className="w-2.5 h-2.5" style={{ color: "var(--sage)" }} aria-label="Vegetarian" />
          </span>
        )}
      </div>
      <div className="hbody" style={{ padding: 8 }}>
        <p className="small" style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.3, minHeight: 28, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {dish.name}
        </p>
        <div className="fx ac jb" style={{ gap: 4, marginTop: 6 }}>
          <span className="price" style={{ fontSize: 11, color: "var(--safb)" }}>
            {formatPrice(dish.price)}
          </span>
          <button
            type="button"
            onClick={handleAdd}
            aria-label={inCart ? `Add another ${dish.name}` : `Add ${dish.name} to order`}
            className="btn"
            style={{
              height: 30,
              padding: "0 10px",
              fontSize: 11,
              borderRadius: 8,
              flex: "none",
              gap: 4,
              ...(showAdded
                ? { background: "var(--saged)", color: "var(--sage)" }
                : { background: "var(--saf)", color: "var(--onsaf)" }),
            }}
          >
            {showAdded ? <><Check className="w-3 h-3" /> Added</> : <><Plus className="w-3 h-3" /> Add</>}
          </button>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* FooterTotals                                                          */
/* ------------------------------------------------------------------ */

function FooterTotals({
  totals,
  items,
  onClose,
  onExpressUPI,
  expressLoading,
}: {
  totals: ReturnType<typeof useCartTotals>;
  items: CartItem[];
  onClose: () => void;
  onExpressUPI: () => void;
  expressLoading: boolean;
}) {
  const cartMacros = useMemo(
    () =>
      items.reduce(
        (acc, it) => ({
          calories: acc.calories + Math.round(it.macros.calories * it.quantity),
          protein: acc.protein + Math.round(it.macros.protein * it.quantity),
          carbs: acc.carbs + Math.round(it.macros.carbs * it.quantity),
          fat: acc.fat + Math.round(it.macros.fat * it.quantity),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [items],
  );

  const hasExpressUPI = Boolean(import.meta.env.VITE_RAZORPAY_KEY_ID);
  // Collapsed by default so the tall bill breakdown doesn't push the upsell rail
  // + Premium banner (above, in the scroll area) below the fold. Full breakdown
  // is always available on the checkout page; here it's one tap away.
  const [showBill, setShowBill] = useState(false);

  return (
    <div
      style={{
        borderTop: "1px solid var(--ln)",
        background: "var(--s1)",
        padding: "16px 20px calc(16px + env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        flex: "none",
      }}
    >
      {/* Bill breakdown — collapsed by default (revealed on tapping Total). */}
      {showBill && (
        <dl style={{ margin: 0 }}>
          <TotalsRow label="Subtotal" value={formatPrice(totals.subtotal)} />
          <TotalsRow label="GST (18%)" value={formatPrice(totals.tax)} muted />
          <TotalsRow
            label="Delivery"
            value={totals.hasFreeDelivery ? "FREE" : formatPrice(totals.deliveryFee)}
            valueClass={totals.hasFreeDelivery ? "sagec" : undefined}
          />
          <p className="fine" style={{ fontSize: 10, marginTop: 4 }}>
            Discounts &amp; credits applied at checkout
          </p>
        </dl>
      )}

      {/* Total doubles as the breakdown toggle — keeps the footer compact. */}
      <button
        type="button"
        onClick={() => setShowBill((v) => !v)}
        aria-expanded={showBill}
        aria-label={showBill ? "Hide bill breakdown" : "Show bill breakdown"}
        className="fx ac jb"
        style={{ width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--tx)" }}
      >
        <span className="fx ac" style={{ gap: 6 }}>
          <span style={{ textTransform: "uppercase", letterSpacing: ".12em", fontSize: 11 }}>Total</span>
          <span className="fine" style={{ fontSize: 10, color: "var(--mut)" }}>
            {showBill ? "hide" : "incl. GST · details"}
          </span>
          <i className={`ph-bold ph-caret-${showBill ? "up" : "down"}`} style={{ fontSize: 11, color: "var(--mut)" }} />
        </span>
        <span className="price" style={{ fontSize: 16 }}>{formatPrice(totals.total)}</span>
      </button>

      {/* Aggregated cart macros — clinical differentiator */}
      <div className="fx ac jb mono" style={{ fontSize: 10, color: "var(--mut)", padding: "6px 8px", borderRadius: 10, background: "var(--s2)" }}>
        <span>{cartMacros.calories} kcal</span>
        <span className="fntc">·</span>
        <span><span style={{ color: "var(--tx)" }}>{cartMacros.protein}g</span> protein</span>
        <span className="fntc">·</span>
        <span><span style={{ color: "var(--tx)" }}>{cartMacros.carbs}g</span> carbs</span>
        <span className="fntc">·</span>
        <span><span style={{ color: "var(--tx)" }}>{cartMacros.fat}g</span> fat</span>
      </div>

      {/* Express UPI — bypasses checkout entirely when Razorpay key is set */}
      {hasExpressUPI && (
        <button
          type="button"
          onClick={onExpressUPI}
          disabled={expressLoading}
          className={expressLoading ? "btn btn-g btn-blk dis" : "btn btn-g btn-blk"}
          style={{ color: "var(--safb)", borderColor: "var(--saf)" }}
        >
          {expressLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              Pay now · UPI / Cards
            </>
          )}
        </button>
      )}

      <Link
        to="/checkout"
        onClick={onClose}
        className="btn btn-p btn-blk"
      >
        {hasExpressUPI ? "Checkout →" : `Checkout · ${formatPrice(totals.total)}`}
      </Link>
    </div>
  );
}

function TotalsRow({
  label,
  value,
  muted,
  large,
  valueClass,
}: {
  label: string;
  value: string;
  muted?: boolean;
  large?: boolean;
  valueClass?: string;
}) {
  return (
    <div className={large ? "billrow tot" : "billrow"}>
      <dt style={large ? { textTransform: "uppercase", letterSpacing: ".12em", fontSize: 11 } : muted ? { color: "var(--mut)" } : { color: "var(--tx)" }}>
        {label}
      </dt>
      <dd
        className={large ? "price" : "mono"}
        style={{
          ...(large ? { fontSize: 16 } : {}),
          ...(valueClass === "sagec" ? { fontWeight: 600 } : {}),
          color: valueClass === "sagec" ? "var(--sage)" : large ? "var(--safb)" : "var(--tx)",
        }}
      >
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                               */
/* ------------------------------------------------------------------ */

/**
 * Pick up to 8 upsell candidates with three layers of intelligence:
 * 1. Dietary coherence — if cart is keto/protein-dominant, bias toward
 *    matching add-ons so suggestions stay within the user's protocol.
 * 2. Threshold bridging — when the user is within ₹200 of free delivery,
 *    surface the item whose price most precisely bridges the gap first.
 * 3. RD-verified default sort when neither condition fires.
 */
function pickUpsells(
  all: DishData[],
  items: CartItem[],
  amountToFreeDelivery: number,
): DishData[] {
  if (all.length === 0) return [];
  const inCart = new Set(items.map((i) => i.dishId));
  let candidates = all.filter(
    (d) =>
      UPSELL_CATEGORIES.has(d.category) && !inCart.has(d.id) && d.isAvailable,
  );

  // Layer 1: dietary coherence
  if (items.length > 0) {
    const totalCals = items.reduce((s, it) => s + it.macros.calories * it.quantity, 0);
    const totalFat  = items.reduce((s, it) => s + it.macros.fat * it.quantity, 0);
    const totalCarbs = items.reduce((s, it) => s + it.macros.carbs * it.quantity, 0);
    const totalProtein = items.reduce((s, it) => s + it.macros.protein * it.quantity, 0);

    const fatCalFraction = totalCals > 0 ? (totalFat * 9) / totalCals : 0;
    const proteinCalFraction = totalCals > 0 ? (totalProtein * 4) / totalCals : 0;

    const isKeto = fatCalFraction > 0.4 && totalCarbs < 30;
    const isProteinFirst = !isKeto && proteinCalFraction > 0.35;

    if (isKeto) {
      const ketoOpts = candidates.filter((d) => d.macros.carbs < 10);
      if (ketoOpts.length >= 3) candidates = ketoOpts;
    } else if (isProteinFirst) {
      candidates = [...candidates].sort(
        (a, b) =>
          b.macros.protein / (b.macros.calories || 1) -
          a.macros.protein / (a.macros.calories || 1),
      );
    }
  }

  // Layer 2: bridge the free-delivery gap when within ₹200
  if (amountToFreeDelivery > 0 && amountToFreeDelivery <= 20000) {
    return [...candidates]
      .sort(
        (a, b) =>
          Math.abs(a.price - amountToFreeDelivery) -
          Math.abs(b.price - amountToFreeDelivery),
      )
      .slice(0, 8);
  }

  // Layer 3: RD-verified default
  return [...candidates]
    .sort((a, b) => Number(b.rdVerified) - Number(a.rdVerified))
    .slice(0, 8);
}
