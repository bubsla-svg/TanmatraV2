import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useOrders, formatRelativeTime, type PastOrder } from "@/lib/ordersContext";
import { useCart } from "@/lib/cartContext";
import { formatPrice } from "@/lib/api/adapter";
import { ClinicalLifecycleStepper } from "@/components/track/ClinicalLifecycleStepper";
import { StatCancelButton } from "@/components/track/StatCancelButton";
import { useSocketStatus } from "@/lib/useSocketStatus";
import { isCancellable } from "@/lib/clinicalLifecycle";

// v2 status pill: same labels as the clinical page, mapped to dark-theme tokens.
const STATUS_BADGE: Record<PastOrder["status"], { label: string; cls: string; style?: any }> = {
  placed: { label: "Submitted", cls: "pill", style: { background: "var(--safd)", color: "var(--safb)" } },
  preparing: { label: "In Preparation", cls: "pill", style: { background: "var(--s3)", color: "var(--tx)" } },
  ready: { label: "In Preparation", cls: "pill", style: { background: "var(--s3)", color: "var(--tx)" } },
  out_for_delivery: { label: "Out for Delivery", cls: "pill", style: { background: "var(--safd)", color: "var(--safb)" } },
  delivered: { label: "Patient Received", cls: "pill sg" },
  cancelled: { label: "STAT Cancelled", cls: "pill", style: { background: "rgba(201,124,112,.16)", color: "var(--dgr)" } },
};

export default function V2Orders() {
  const navigate = useNavigate();
  const { orders } = useOrders();
  const { addItem } = useCart();
  const { connected: socketConnected } = useSocketStatus();
  const [disputeFor, setDisputeFor] = useState<PastOrder | null>(null);
  const [disputeText, setDisputeText] = useState("");

  const handleReorder = (order: PastOrder) => {
    order.items.forEach((item) => {
      addItem({
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
      });
    });
    toast.success("Items added to your order", {
      description: `${order.items.length} item${order.items.length === 1 ? "" : "s"} from ${order.orderId}`,
      action: { label: "View Cart", onClick: () => navigate("/cart") },
    });
  };

  const submitDispute = () => {
    if (!disputeFor || !disputeText.trim()) return;
    toast.success(`Dispute raised for ${disputeFor.orderId}`, {
      description: "Our care team will reach out within 30 minutes.",
    });
    setDisputeFor(null);
    setDisputeText("");
  };

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">Orders</div>
          <Link className="iconbtn" to="/menu" title="Menu">
            <i className="ph-bold ph-fork-knife" />
          </Link>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 24 }}>
          {orders.length === 0 ? (
            <div className="tc" style={{ padding: "52px 20px" }}>
              <i className="ph-bold ph-package" style={{ fontSize: 32, color: "var(--fnt)" }} />
              <div className="tt mt10">No orders yet</div>
              <div className="fine mt6">Place your first clinical-grade meal and it will appear here.</div>
              <div className="fx ac jc wrap gap8 mt20">
                <Link className="btn btn-p" to="/menu">Browse menu</Link>
                <Link className="btn btn-g" to="/preferences">Set preferences first</Link>
              </div>
              <div className="fine mt12" style={{ fontSize: 11.5 }}>
                New here? Browse the menu, add dishes to your order, then check out — orders track in real time and earn loyalty credits.
              </div>
            </div>
          ) : (
            <>
              <div className="lab" style={{ color: "var(--safb)" }}>Order history</div>
              <h1 className="disp mt6" style={{ color: "#fff" }}>Your orders</h1>
              <p className="fine mt6">
                {orders.length} past order{orders.length === 1 ? "" : "s"} · Tap any order to track or reorder
              </p>

              <div className="mt16">
                {orders.map((order) => {
                  const badge = STATUS_BADGE[order.status];
                  const active = order.status !== "delivered" && order.status !== "cancelled";
                  return (
                    <div key={order.orderId} className="card mb12">
                      {/* Header row */}
                      <div className="fx jb gap8" style={{ alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="mono safc" style={{ fontSize: 12 }}>{order.orderId}</div>
                          <div className="fine mt2" style={{ fontSize: 11 }}>
                            Submitted {formatRelativeTime(order.placedAt)}
                            {order.patientName ? ` · ${order.patientName}` : ""}
                          </div>
                        </div>
                        <div className="fx ac wrap g6" style={{ flex: "none", justifyContent: "flex-end" }}>
                          <span className={badge.cls} style={badge.style}>{badge.label}</span>
                          {isCancellable(order.status) && (
                            <StatCancelButton
                              orderId={order.orderId}
                              patientName={order.patientName}
                              size="sm"
                            />
                          )}
                        </div>
                      </div>

                      {/* Clinical lifecycle stepper (child component, reused verbatim) */}
                      <div className="mt12">
                        <ClinicalLifecycleStepper
                          order={order}
                          socketConnected={socketConnected}
                          compact
                        />
                      </div>

                      {/* Item thumbnails */}
                      <div className="fx gap8 mt12" style={{ overflowX: "auto", paddingBottom: 4 }}>
                        {order.items.map((item) => (
                          <div key={item.lineId} style={{ flex: "none", width: 56, textAlign: "center" }}>
                            <img
                              src={item.image}
                              alt={item.name}
                              style={{ width: 56, height: 56, borderRadius: 9, objectFit: "cover", border: "1px solid var(--ln)" }}
                            />
                            <div className="fine mt4" style={{ fontSize: 10 }}>×{item.quantity}</div>
                          </div>
                        ))}
                      </div>

                      {/* Item details (collapsed list with customizations) */}
                      <details className="mt12">
                        <summary
                          className="fine pointer"
                          style={{ listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}
                        >
                          <i className="ph-bold ph-caret-right" />
                          View items &amp; customizations
                        </summary>
                        <div className="mt8" style={{ paddingLeft: 12, borderLeft: "1px solid var(--ln)" }}>
                          {order.items.map((item) => (
                            <div key={item.lineId} className="mt8">
                              <div className="fx jb gap8" style={{ alignItems: "baseline" }}>
                                <span className="small">{item.name} · ×{item.quantity}</span>
                                <span className="price mut" style={{ fontSize: 13 }}>
                                  {formatPrice(item.unitPrice * item.quantity)}
                                </span>
                              </div>
                              {item.customizations.length > 0 && (
                                <div className="fx wrap g6 mt4">
                                  {item.customizations.map((c) => (
                                    <span key={c} className="gi gi-med">{c}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>

                      {/* Address */}
                      <div className="fine mt12" style={{ fontSize: 11 }}>
                        <div className="fx ac g6">
                          <i className="ph-bold ph-map-pin" /> {order.address.label} · {order.address.city}
                        </div>
                        <div className="fx ac g6 mt4">
                          <i className="ph-bold ph-phone" /> {order.address.phone}
                        </div>
                      </div>

                      {/* Total */}
                      <div className="billrow tot mt12">
                        <span>Total paid</span>
                        <span className="price safc" style={{ fontSize: 15 }}>{formatPrice(order.total)}</span>
                      </div>

                      {/* Actions */}
                      <div className="fx wrap gap8 mt12">
                        {active && (
                          <Link
                            className="btn btn-p f1"
                            style={{ minWidth: 130 }}
                            to={`/track?orderId=${encodeURIComponent(order.orderId)}`}
                          >
                            <i className="ph-bold ph-package" />
                            Track order
                          </Link>
                        )}
                        <button
                          className="btn btn-g f1"
                          style={{ minWidth: 130 }}
                          onClick={() => handleReorder(order)}
                        >
                          <i className="ph-bold ph-arrows-clockwise" />
                          Reorder
                        </button>
                      </div>
                      <button
                        className="fx ac jc gap8 mt10 w100 pointer"
                        style={{ color: "var(--dgr)", fontSize: 13, fontWeight: 600, padding: "6px 0" }}
                        onClick={() => setDisputeFor(order)}
                      >
                        <i className="ph-bold ph-warning" />
                        Report a problem
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Dispute dialog — reuse the accessible modal primitive, restyled v2 */}
        <Dialog open={disputeFor !== null} onOpenChange={(open) => !open && setDisputeFor(null)}>
          <DialogContent
            className="tnm2"
            style={{ background: "var(--s1)", border: "1px solid var(--ln)", color: "var(--tx)" }}
            aria-describedby="dispute-desc"
          >
            <DialogHeader>
              <DialogTitle className="fx ac gap8" style={{ color: "var(--tx)" }}>
                <i className="ph-bold ph-warning safc" />
                Report a problem
              </DialogTitle>
              <DialogDescription id="dispute-desc" className="fine">
                Tell us what went wrong with order{" "}
                <span className="mono safc">{disputeFor?.orderId}</span>. Our care team responds
                within 30 minutes during operating hours.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              aria-describedby="dispute-desc"
              placeholder="e.g., Wrong dish delivered, food was cold, missing item, allergen concern…"
              value={disputeText}
              onChange={(e) => setDisputeText(e.target.value)}
              className="min-h-[120px] bg-clinical-dark border-clinical-border text-sm"
            />
            <DialogFooter className="gap8">
              <button className="btn btn-g" onClick={() => setDisputeFor(null)}>
                Cancel
              </button>
              <button
                className="btn btn-p"
                onClick={submitDispute}
                disabled={!disputeText.trim()}
                style={!disputeText.trim() ? { opacity: 0.4, pointerEvents: "none" } : undefined}
              >
                <i className="ph-bold ph-check-circle" />
                Submit report
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
