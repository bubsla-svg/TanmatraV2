import { useEffect } from "react";
import { Link, useParams, type MetaFunction } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { subscriptionsApi } from "@/lib/subscriptionsApi";
import { formatPrice, formatPriceRounded } from "@/lib/api/adapter";
import { useOrders } from "@/lib/ordersContext";
import { track } from "@/lib/analytics";

export const meta: MetaFunction = () => [
  { title: "Order Confirmed | Tanmatra" },
  { name: "robots", content: "noindex, follow" },
];

export const handle = { chrome: false };

// Honest fulfilment pipeline — maps 1:1 to the real order lifecycle. There is
// NO per-order "dietitian review" step (not a backed pipeline state).
const STEPS = [
  { key: "confirmed", label: "Order confirmed", icon: "ph-check-circle" },
  { key: "kitchen", label: "Kitchen preparation", icon: "ph-cooking-pot" },
  { key: "doorstep", label: "Doorstep delivery", icon: "ph-moped" },
] as const;

// Map the real order status onto the 3 honest steps.
//  completed = steps fully done; activeIdx = the step currently in progress
//  (-1 = none). A just-placed order shows "Order confirmed" DONE and the rest
//  upcoming — nothing is marked "in progress" until the kitchen actually starts.
function pipelineState(status: string | undefined): { completed: number; activeIdx: number } {
  switch (status) {
    case "preparing":
    case "ready":
      return { completed: 1, activeIdx: 1 };
    case "out_for_delivery":
      return { completed: 2, activeIdx: 2 };
    case "delivered":
      return { completed: 3, activeIdx: -1 };
    default: // "placed" or order not in local context
      return { completed: 1, activeIdx: -1 };
  }
}

export default function OrderConfirmedStub() {
  const { orderId } = useParams();
  const { getOrder } = useOrders();
  const order = orderId ? getOrder(orderId) : undefined;

  // The trial per-meal, derived live from the server quote (never a hardcoded
  // ₹ literal) so the bridge stays honest if the trial is repriced.
  const { data: trialQuote } = useQuery({
    queryKey: ["trial-quote-bridge"],
    queryFn: () =>
      subscriptionsApi.quote({
        cadence: "weekly",
        mealsPerDelivery: 3,
        planType: "trial",
      }),
    staleTime: 10 * 60 * 1000,
  });
  const trialPerMeal = trialQuote
    ? formatPriceRounded(Math.round(trialQuote.totalPaise / 3))
    : null;

  useEffect(() => {
    track("alacarte_order_placed", { orderId });
    track("bridge_cta_shown", { orderId, surface: "order_confirmed" });
  }, [orderId]);

  const cancelled = order?.status === "cancelled";
  const { completed, activeIdx } = pipelineState(order?.status);
  const deliveryLine =
    order?.deliverySlotLabel ||
    (order?.etaAt
      ? `Arriving around ${new Date(order.etaAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`
      : null);

  return (
    <div
      className="tnm2 nn"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div style={{ textAlign: "center", maxWidth: 440, width: "100%" }}>
        <i
          className={`ph-fill ${cancelled ? "ph-x-circle dgrc" : "ph-check-circle safc"}`}
          style={{ fontSize: 56 }}
        />
        <h1 style={{ marginTop: 8 }}>{cancelled ? "Order Cancelled" : "Order Confirmed"}</h1>
        {orderId && orderId !== "default" && (
          <div className="mono fntc" style={{ fontSize: 12, marginTop: 4 }}>
            {order?.orderId ?? orderId}
          </div>
        )}
        {!cancelled && deliveryLine && (
          <p className="fine text-white/60" style={{ marginTop: 6 }}>{deliveryLine}</p>
        )}

        {/* Honest fulfilment pipeline */}
        {!cancelled && (
          <div className="card border border-white/[0.08]" style={{ marginTop: 20, textAlign: "left" }}>
            {STEPS.map((s, i) => {
              const done = i < completed;
              const active = i === activeIdx;
              const color = done || active ? "var(--safb)" : "var(--fnt)";
              return (
                <div key={s.key} className="fx ac gap12" style={{ padding: "8px 0" }}>
                  <i className={`ph-fill ${done ? "ph-check-circle" : s.icon}`} style={{ fontSize: 20, color, flex: "none" }} />
                  <span className="small" style={{ fontWeight: active ? 700 : 500, color: done || active ? "var(--tx)" : "var(--mut)" }}>
                    {s.label}
                  </span>
                  {active && <span className="lab safc" style={{ marginLeft: "auto" }}>In progress</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Order details — only real data from the order record */}
        {order && order.items.length > 0 && (
          <div className="card border border-white/[0.08]" style={{ marginTop: 12, textAlign: "left" }}>
            {order.items.map((item) => (
              <div key={`${item.dishId}-${item.name}`} className="fx ac jb" style={{ padding: "4px 0" }}>
                <span className="small">{item.name} · ×{item.quantity}</span>
                <span className="price fntc" style={{ fontSize: 12 }}>{formatPrice(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
            <div className="fx ac jb" style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--ln)" }}>
              <span className="lab">Total paid</span>
              <span className="price safc" style={{ fontSize: 15 }}>{formatPrice(order.total)}</span>
            </div>
          </div>
        )}

        {/* Track CTA — real, useful next action */}
        {orderId && orderId !== "default" && !cancelled && (
          <Link to={`/track/${encodeURIComponent(orderId)}`} className="btn btn-p btn-blk" style={{ marginTop: 16 }}>
            <i className="ph-bold ph-map-pin-line" /> Track your order
          </Link>
        )}

        {/* Per-meal bridge to the trial — the funnel's first rung (unchanged). */}
        {!cancelled && (
          <div
            className="card border border-white/[0.08]"
            style={{ marginTop: 16, textAlign: "left", background: "var(--tnm-surface-ink-2)" }}
          >
            <div className="sh" style={{ fontWeight: 700 }}>Loved it? Make it a habit.</div>
            <p className="fine text-white/60" style={{ marginTop: 6, lineHeight: 1.5 }}>
              The same dietitian-designed meals, delivered on your schedule — and on
              the 3-Day Trial they work out to{" "}
              <strong>{trialPerMeal ? `${trialPerMeal}/meal` : "less per meal"}</strong>,
              with a registered dietitian planning your week.
            </p>
            <Link
              to="/subscribe?trial=1"
              className="btn btn-p"
              style={{ marginTop: 12, display: "inline-flex" }}
              onClick={() => track("bridge_cta_clicked", { orderId, surface: "order_confirmed" })}
            >
              Start the 3-Day Trial
            </Link>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Link to={order ? "/orders" : "/menu"} className="btn btn-blk">
            {order ? "View all orders" : "Back to Menu"}
          </Link>
        </div>
      </div>
    </div>
  );
}
