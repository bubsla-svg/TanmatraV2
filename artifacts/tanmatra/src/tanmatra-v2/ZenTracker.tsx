import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ordersApi, type OrderStatus } from "@/lib/ordersApi";
import { useCart, useAddToCartStatus } from "@/lib/cartContext";
import { DISHES, useMenuCatalog } from "@/lib/menuData";
import { onDishImageError } from "@/lib/imgFallback";
import { formatCurrency } from "@/lib/utils";
import { FADE, DURATION, EASE } from "@/lib/motion";

/* Full-parity re-port of the System-A ZenTracker order tracker (git 2507084,
 * 407 lines) into v2. Same ordersApi polling/back-off, cart handlers and
 * client ticker; v2 dark styling. All state/hooks/handlers reused verbatim. */

// ── SVG Ring ─────────────────────────────────────────────────────────────────
const RING_RADIUS = 88;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const DELIVERY_WINDOW_MINUTES = 20;

function ZenRing({
  progressFraction,
  reducedMotion,
}: {
  progressFraction: number; // 0 → 1
  reducedMotion: boolean;
}) {
  const offset = RING_CIRCUMFERENCE * (1 - progressFraction);
  return (
    <svg
      viewBox="0 0 200 200"
      width="208"
      height="208"
      aria-hidden="true"
      style={{ transform: "rotate(-90deg)" }}
    >
      {/* Background track */}
      <circle cx="100" cy="100" r={RING_RADIUS} fill="none" stroke="var(--s3)" strokeWidth="8" />
      {/* Foreground arc */}
      <circle
        cx="100"
        cy="100"
        r={RING_RADIUS}
        fill="none"
        stroke="var(--sage)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        style={
          reducedMotion
            ? undefined
            : { transition: `stroke-dashoffset ${DURATION.slower}s ${EASE.standard.join(",")}` }
        }
      />
    </svg>
  );
}

// ── Status copy ───────────────────────────────────────────────────────────────
function statusCopy(status: OrderStatus, isLate: boolean): { headline: string; sub: string } {
  if (isLate) {
    return {
      headline: "Running a little late",
      sub: "We're working on it. Your meal will be with you shortly.",
    };
  }
  switch (status) {
    case "confirmed":
    case "prep":
      return {
        headline: "Whisking your dressings and chopping fresh greens",
        sub: "Your meal is being prepared with care.",
      };
    case "out_for_delivery":
      return { headline: "Freshness is on the move", sub: "Arriving shortly." };
    case "delivered":
      return { headline: "Delivered", sub: "Enjoy your meal. Your body will thank you." };
    case "cancelled":
      return {
        headline: "Order cancelled",
        sub: "This order was cancelled and won't be delivered. See your orders page for details.",
      };
    case "failed":
      return {
        headline: "Something went wrong",
        sub: "This order could not be completed. Please contact support.",
      };
    default:
      return { headline: "Your order is on the way", sub: "" };
  }
}

// ── Post-purchase snack upsell ────────────────────────────────────────────────
function SnackCard({ dish, onAdd }: { dish: (typeof DISHES)[number]; onAdd: () => void }) {
  const { status } = useAddToCartStatus(dish.id);
  return (
    <div className="hcard">
      <img className="himg" src={dish.image} alt={dish.name} loading="lazy" onError={onDishImageError} style={{ width: "100%", objectFit: "cover", display: "block" }} />
      <div className="hbody col" style={{ gap: 6 }}>
        <div className="small fw5 clamp1" style={{ fontSize: 12 }}>{dish.name}</div>
        <div className="fine" style={{ fontSize: 11 }}>{formatCurrency(dish.price)}</div>
        <button
          type="button"
          onClick={onAdd}
          disabled={status === "loading"}
          className={`btn ${status === "success" ? "btn-s sagec" : "btn-s safc"} mt2`}
          style={{ height: 30, fontSize: 12, gap: 5 }}
        >
          {status === "success" ? (
            <><i className="ph-bold ph-check" /> Added</>
          ) : status === "loading" ? (
            <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--ln2)", borderTopColor: "var(--safb)", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
          ) : (
            <><i className="ph-bold ph-plus" /> Add</>
          )}
        </button>
      </div>
    </div>
  );
}

function PostPurchaseUpsell() {
  const [dismissed, setDismissed] = useState(false);
  const { addItem } = useCart();
  // Sourced from the live catalog (not the module-level static DISHES import)
  // so a dish an ops/RD editor has 86'd since deploy never gets suggested
  // as a post-purchase add-on.
  const { dishes: catalogDishes } = useMenuCatalog();
  const upsellDishes = useMemo(
    () =>
      catalogDishes
        .filter((d) => (d.category === "snacks" || d.category === "beverages") && d.isAvailable)
        .slice(0, 4),
    [catalogDishes],
  );

  if (dismissed || upsellDishes.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: DURATION.slow, ease: EASE.standard }}
      style={{ width: "100%" }}
    >
      <div className="card posrel">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="qbtn posabs touch-target-48"
          style={{ top: 6, right: 6, width: 36, height: 36 }}
          aria-label="Dismiss"
        >
          <i className="ph-bold ph-x" style={{ fontSize: 13 }} />
        </button>
        <div className="tt mb10" style={{ fontSize: 14, paddingRight: 24 }}>Add a little extra to your delivery</div>
        <div className="fx gap10" style={{ overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
          {upsellDishes.map((dish) => (
            <SnackCard
              key={dish.id}
              dish={dish}
              onAdd={() =>
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
                  rdVerified: dish.rdVerified ?? true,
                  macros: dish.macros,
                  customizations: [],
                })
              }
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function V2ZenTracker() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<OrderStatus>("prep");
  const [etaMinutes, setEtaMinutes] = useState(DELIVERY_WINDOW_MINUTES);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [apiAvailable, setApiAvailable] = useState(true);

  const startTimeRef = useRef(Date.now());
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Guard: empty cart → redirect
  useEffect(() => {
    if (!orderId) navigate("/menu", { replace: true });
  }, [orderId, navigate]);

  // Client elapsed ticker (1 s interval)
  useEffect(() => {
    tickRef.current = window.setInterval(() => {
      setElapsedMinutes(Math.floor((Date.now() - startTimeRef.current) / 60000));
    }, 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, []);

  // Poll server status
  const poll = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await ordersApi.getOrderStatus(orderId);
      setStatus(res.status);
      setEtaMinutes(res.etaMinutes);
      setApiAvailable(true);
      if (res.status === "delivered" || res.status === "cancelled" || res.status === "failed") {
        if (pollRef.current) window.clearInterval(pollRef.current);
      }
    } catch {
      setApiAvailable(false);
    }
  }, [orderId]);

  // Exponential back-off: 5 s, 8 s, 12 s, 20 s, then every 30 s
  useEffect(() => {
    const INTERVALS = [5000, 8000, 12000, 20000];
    let idx = 0;

    function scheduleNext() {
      const ms = idx < INTERVALS.length ? INTERVALS[idx++] : 30000;
      pollRef.current = window.setTimeout(async () => {
        await poll();
        scheduleNext();
      }, ms);
    }

    void poll(); // immediate first fetch
    scheduleNext();

    return () => { if (pollRef.current) window.clearTimeout(pollRef.current); };
  }, [poll]);

  const isTerminated = status === "cancelled" || status === "failed";
  const isLate = status !== "delivered" && !isTerminated && elapsedMinutes > DELIVERY_WINDOW_MINUTES;

  // Progress: based on elapsed time vs window when API available, else client timer
  const progressFraction = isTerminated
    ? 0
    : apiAvailable
      ? status === "delivered"
        ? 1
        : status === "out_for_delivery"
          ? 0.65 + Math.min(0.35, elapsedMinutes / DELIVERY_WINDOW_MINUTES * 0.35)
          : Math.min(0.6, elapsedMinutes / DELIVERY_WINDOW_MINUTES)
      : Math.min(0.99, elapsedMinutes / DELIVERY_WINDOW_MINUTES);

  const copy = statusCopy(status, isLate);
  const isDelivered = status === "delivered";

  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Minimal header / appbar */}
        <div className="appbar" style={{ borderBottom: "1px solid var(--ln)" }}>
          <Link className="iconbtn" to="/menu" aria-label="Menu"><i className="ph-bold ph-arrow-left" /></Link>
          {/* §5.2 naming fix: this calm-ring surface is the "Live Kitchen" —
              the Zen Tracker name moved to the habit/streak strip. */}
          <div className="abt tc"><span className="lab" style={{ fontSize: 11, color: "var(--safb)" }}>Live Kitchen</span></div>
          <Link className="iconbtn" to={`/track?orderId=${orderId ?? ""}`} aria-label="Details" style={{ fontSize: 13, fontWeight: 600, width: "auto", padding: "0 12px" }}>Details</Link>
        </div>

        {/* Main centred content */}
        <main className="f1 col ac jc padx" style={{ gap: 28, padding: "48px 16px", textAlign: "center" }}>
          {/* Order ID */}
          <div className="lab" style={{ letterSpacing: ".2em", color: "var(--fnt)" }}>{orderId ?? "—"}</div>

          {/* Ring */}
          <div className="posrel fx ac jc">
            <ZenRing progressFraction={progressFraction} reducedMotion={reducedMotion} />
            <div className="posabs col ac jc" style={{ inset: 0, gap: 2 }}>
              {isDelivered ? (
                <i className="ph-bold ph-package sagec" style={{ fontSize: 34 }} aria-hidden />
              ) : isTerminated ? (
                <i className="ph-bold ph-x-circle" style={{ fontSize: 34, color: "var(--dgr)" }} aria-hidden />
              ) : (
                <>
                  <div className="eta mono">{apiAvailable ? `${etaMinutes}` : `${Math.max(0, DELIVERY_WINDOW_MINUTES - elapsedMinutes)}`}</div>
                  <div className="lab">min</div>
                </>
              )}
            </div>
          </div>

          {/* Crossfading status text */}
          <AnimatePresence mode="wait">
            <motion.div key={copy.headline} {...FADE} className="col" style={{ gap: 8, maxWidth: 288 }}>
              <h1 className="h2" style={{ fontSize: 20 }}>{copy.headline}</h1>
              {copy.sub && <p className="small mut">{copy.sub}</p>}
            </motion.div>
          </AnimatePresence>

          {/* Post-purchase upsell — only while kitchen is still preparing */}
          <AnimatePresence>
            {(status === "prep" || status === "confirmed") && <PostPurchaseUpsell />}
          </AnimatePresence>

          {/* API unavailable fallback note */}
          {!apiAvailable && (
            <div className="fine" style={{ fontSize: 11, color: "var(--fnt)" }}>
              Live status unavailable — showing estimated time
            </div>
          )}

          {/* Delivered CTA */}
          {isDelivered && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.slow, ease: EASE.standard }}
              className="col ac"
              style={{ gap: 12 }}
            >
              <Link to="/orders" className="btn btn-p">View order history</Link>
              <Link to="/menu" className="fine" style={{ color: "var(--mut)" }}>Order again</Link>
            </motion.div>
          )}
        </main>

        {/* Bottom status bar — announced to assistive tech as the order
            progresses (the ring is decorative/aria-hidden, so this is the
            screen-reader channel for live status). */}
        <footer role="status" aria-live="polite" aria-atomic="true" style={{ padding: "16px", borderTop: "1px solid var(--ln)" }}>
          <AnimatePresence mode="wait">
            <motion.div key={status} {...FADE} className="lab tc" style={{ letterSpacing: ".14em", color: "var(--mut)" }}>
              {status === "prep" && "Kitchen is preparing your order"}
              {status === "confirmed" && "Order confirmed"}
              {status === "out_for_delivery" && "Rider is on the way"}
              {status === "delivered" && "Delivered"}
              {status === "cancelled" && "Order cancelled"}
              {status === "failed" && "Order failed — contact support"}
            </motion.div>
          </AnimatePresence>
        </footer>
      </div>
    </div>
  );
}
