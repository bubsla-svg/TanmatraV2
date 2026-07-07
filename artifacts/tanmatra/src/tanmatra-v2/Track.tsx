import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { F } from "./data";
import { useDeliveryTimeline, useRecordDeliveryEvent } from "@/lib/queries";
import { useOrders } from "@/lib/ordersContext";
import { getSocket } from "@/lib/socket";
import { API_BASE } from "@/lib/apiBase";
import { ClinicalLifecycleStepper } from "@/components/track/ClinicalLifecycleStepper";
import { StatCancelButton } from "@/components/track/StatCancelButton";
import { useSocketStatus } from "@/lib/useSocketStatus";
import { wellnessApi } from "@/lib/wellnessApi";
import { isCancellable } from "@/lib/clinicalLifecycle";
import { fulfillmentApi, type PackagingReturnRow } from "@/lib/fulfillmentApi";
import SupportTicketDialog from "@/components/track/SupportTicketDialog";
import { PostCheckoutWizard } from "@/components/onboarding/PostCheckoutWizard";

const RiderMap = lazy(() => import("@/components/track/RiderMap"));

/* Full-parity re-port of the System-A Track (git 2507084, 743 lines) into v2.
 * All live-tracking effects/handlers preserved verbatim; presentation is v2. */

const EVENT_LABELS: Record<string, string> = {
  rider_assigned: "Rider assigned",
  rider_en_route_to_kitchen: "Rider heading to kitchen",
  rider_at_kitchen: "Rider at kitchen",
  order_picked_up: "Order picked up",
  rider_en_route_to_customer: "Rider heading to you",
  rider_at_customer: "Rider at your location",
  delivered: "Delivered",
  delivery_failed: "Delivery failed",
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

function PackagingReturnCard({ orderServerId, delivered }: { orderServerId: number | undefined; delivered: boolean }) {
  const [row, setRow] = useState<PackagingReturnRow | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!orderServerId) return;
    let alive = true;
    fulfillmentApi.listPackagingReturns().then((r: any) => { if (!alive) return; setRow(r.returns.find((x: any) => x.orderId === orderServerId) ?? null); }).catch(() => setRow(null));
    return () => { alive = false; };
  }, [orderServerId]);
  const status = row?.status ?? "opted_in";
  const credit = row?.creditPaise ?? 2000;
  const confirmReturn = async () => {
    if (!orderServerId || busy) return;
    setBusy(true);
    try { const r = await fulfillmentApi.confirmPackagingReturn(orderServerId); setRow(r.packagingReturn); toast.success(r.alreadyCredited ? "Container return already credited" : `₹${(credit / 100).toFixed(0)} credit added — thanks for returning!`); }
    catch { toast.error("Could not confirm return — please try again"); }
    finally { setBusy(false); }
  };
  return (
    <div className="card mb10" style={{ borderLeft: "3px solid var(--sage)" }}>
      <div className="lab mb6" style={{ color: "var(--sage)" }}><i className="ph-fill ph-leaf" /> Reusable eco packaging</div>
      {status === "credited" ? (
        <div className="fine" style={{ color: "var(--sage)" }}>₹{(credit / 100).toFixed(0)} credit applied to your account. Thanks for closing the loop.</div>
      ) : status === "returned" ? (
        <div className="fine" style={{ color: "var(--sage)" }}>Return logged — credit will appear shortly.</div>
      ) : (
        <>
          <div className="fine">Hand the clean container to the rider on your next order, or drop it at a partner pickup point. We'll add ₹{(credit / 100).toFixed(0)} to your wallet.</div>
          <button className="btn btn-g mt10" style={{ height: 38 }} disabled={!delivered || busy || !orderServerId} onClick={confirmReturn}>{delivered ? "I've returned the container" : "Available after delivery"}</button>
        </>
      )}
    </div>
  );
}

export default function V2Track() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderIdParam = searchParams.get("orderId") ?? undefined;
  const showDevPanel = searchParams.get("dev") === "1";

  const { orders, latest, getOrder, updateStatus } = useOrders();
  const order: any = orderIdParam ? getOrder(orderIdParam) : latest();
  const { connected: socketConnected } = useSocketStatus();

  const [hasAutologged, setHasAutologged] = useState(false);
  useEffect(() => {
    if (!order || order.status !== "delivered" || hasAutologged) return;
    const logOrderMacros = async () => {
      try {
        const totals = order.items.reduce((acc: any, it: any) => {
          const qty = it.quantity ?? 1;
          const m = (it.macros ?? { protein: 0, carbs: 0, fat: 0, fiber: 0, calories: 0 }) as any;
          return { calories: acc.calories + (m.calories ?? 0) * qty, proteinGrams: acc.proteinGrams + (m.protein ?? 0) * qty, carbsGrams: acc.carbsGrams + (m.carbs ?? 0) * qty, fatGrams: acc.fatGrams + (m.fat ?? 0) * qty, fiberGrams: acc.fiberGrams + (m.fiber ?? 0) * qty, vegServings: acc.vegServings + (m.vegServings ?? 0) * qty };
        }, { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0, fiberGrams: 0, vegServings: 0 });
        if (totals.calories === 0) return;
        await wellnessApi.log({ label: `Tanmatra Order: ${order.orderId}`, ...totals });
        setHasAutologged(true);
        toast.success("🎉 Order delivered & automatically logged!", { description: `Added +${Math.round(totals.proteinGrams)}g Protein & +${Math.round(totals.calories)} kcal to your Wellness tracker!`, action: { label: "View Dashboard", onClick: () => navigate("/wellness") } });
      } catch {}
    };
    void logOrderMacros();
  }, [order, hasAutologged, navigate]);

  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  useEffect(() => {
    if (!order || order.priority !== "stat" || order.status === "delivered" || order.status === "cancelled") { setTimeLeftMs(null); return; }
    const deadline = new Date(order.placedAt).getTime() + 5 * 60 * 1000;
    const interval = setInterval(() => setTimeLeftMs(deadline - Date.now()), 33);
    return () => clearInterval(interval);
  }, [order]);
  const formatTimeLeft = (ms: number) => {
    if (ms <= 0) return "⚠️ SLA BREACHED";
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), sec = s % 60, cs = Math.floor((ms % 1000) / 10);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(m)}:${pad(sec)}.${pad(cs)}`;
  };

  const numericOrderId = useMemo(() => { if (!order) return 0; const m = order.orderId.match(/(\d+)$/); return m ? Number(m[1]) : 1; }, [order]);
  const { data: timeline, isLoading } = useDeliveryTimeline(numericOrderId || 0);
  const recordEvent = useRecordDeliveryEvent();
  const qc = useQueryClient();
  const [supportOpen, setSupportOpen] = useState(false);

  const [dynamicEta, setDynamicEta] = useState<any>(null);
  useEffect(() => {
    if (!numericOrderId || !order) return;
    if (order.status === "delivered" || order.status === "cancelled") return;
    let cancelled = false;
    const fetchEta = async () => {
      try { const r = await fetch(`${API_BASE}/delivery/eta/${numericOrderId}`, { credentials: "include" }); if (!r.ok) return; const data = await r.json(); if (!cancelled && data?.etaAt) setDynamicEta(data); } catch {}
    };
    void fetchEta();
    const id = window.setInterval(fetchEta, 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [numericOrderId, order]);
  const displayEtaAt = dynamicEta?.etaAt ?? order?.etaAt;

  useEffect(() => {
    if (!numericOrderId) return;
    const socket = getSocket();
    socket.emit("subscribe:order", numericOrderId);
    const onEvent = () => qc.invalidateQueries({ queryKey: ["delivery", "timeline", numericOrderId] });
    socket.on("delivery:event", onEvent);
    return () => { socket.off("delivery:event", onEvent); socket.emit("unsubscribe:order", numericOrderId); };
  }, [numericOrderId, qc]);

  useEffect(() => {
    if (!numericOrderId) return;
    if (order?.status !== "ready" && order?.status !== "out_for_delivery") return;
    void fetch(`${API_BASE}/delivery/auto-assign`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: numericOrderId }) }).catch(() => {});
  }, [order?.status, numericOrderId]);

  useEffect(() => {
    if (!order || order.status !== "placed" || !numericOrderId) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`${API_BASE}/delivery/schedule-advance`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: numericOrderId, step: "preparing", delayMs: 6000 }) });
        if (!r.ok && !cancelled) setTimeout(() => !cancelled && updateStatus(order.orderId, "preparing"), 6000);
      } catch { setTimeout(() => !cancelled && updateStatus(order.orderId, "preparing"), 6000); }
    })();
    return () => { cancelled = true; };
  }, [order, updateStatus, numericOrderId]);

  const shell = (body: any) => (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>{body}</div>
    </div>
  );

  if (orders.length === 0) return shell(
    <>
      <div className="appbar"><Link className="iconbtn" to="/menu"><i className="ph-bold ph-arrow-left" /></Link><div className="abt">Track order</div></div>
      <div className="padx tc" style={{ paddingTop: 48 }}><i className="ph-bold ph-package" style={{ fontSize: 32, color: "var(--saf)" }} /><div className="tt mt10">No orders yet</div><div className="fine mt6">Your first order will show up here for live tracking.</div><Link className="btn btn-p btn-blk mt20" to="/menu">Browse menu</Link></div>
    </>
  );
  if (!order) return shell(
    <>
      <div className="appbar"><Link className="iconbtn" to="/orders"><i className="ph-bold ph-arrow-left" /></Link><div className="abt">Track order</div></div>
      <div className="padx tc" style={{ paddingTop: 48 }}><i className="ph-bold ph-warning" style={{ fontSize: 32, color: "var(--saf)" }} /><div className="tt mt10">Order not found</div><div className="fine mt6">We couldn't find an order matching that ID.</div><Link className="btn btn-g btn-blk mt20" to="/orders">View all orders</Link></div>
    </>
  );

  const handleEvent = (event: string) => {
    recordEvent.mutate({ orderId: numericOrderId, riderId: 1, event }, {
      onSuccess: () => {
        toast.info(EVENT_LABELS[event] ?? event);
        if (event === "delivered") updateStatus(order.orderId, "delivered");
        else if (event === "order_picked_up") updateStatus(order.orderId, "out_for_delivery");
        else if (event === "rider_at_kitchen") updateStatus(order.orderId, "ready");
      },
    });
  };
  const showRiderCard = order.status === "ready" || order.status === "out_for_delivery" || order.status === "delivered";

  return shell(
    <>
      <div className="appbar">
        <Link className="iconbtn" to="/orders" aria-label="Orders"><i className="ph-bold ph-arrow-left" /></Link>
        <div className="abt">Track order</div>
        <button className="iconbtn" onClick={() => setSupportOpen(true)} aria-label="Help"><i className="ph-bold ph-lifebuoy" /></button>
      </div>

      <div className="content padx" style={{ paddingBottom: 24 }}>
        {/* Header */}
        <div className="fx ac jb gap8">
          <div><div className="h2" style={{ fontSize: 20 }}>{order.orderId}</div><div className="fine mt2">Submitted {fmtTime(order.placedAt)}</div></div>
          {timeLeftMs !== null && (
            <div className="pill" style={{ background: "rgba(201,124,112,.14)", border: "1px solid rgba(201,124,112,.4)", color: "var(--dgr)", flexDirection: "column", alignItems: "flex-start", padding: "6px 10px" }}>
              <span className="lab" style={{ fontSize: 8, color: "var(--dgr)" }}>STAT SLA</span>
              <span className="mono" style={{ fontWeight: 700 }}>{formatTimeLeft(timeLeftMs)}</span>
            </div>
          )}
        </div>

        {/* Summary ribbon */}
        <div className="ribbon mt10">
          <div className="rc"><span className="rl">ARRIVING{dynamicEta?.source === "model" ? " · LIVE" : ""}</span><span className="rv sf">{fmtTime(displayEtaAt ?? order.etaAt)}</span></div>
          <div className="rc"><span className="rl">ITEMS</span><span className="rv">{order.items.reduce((t: number, i: any) => t + i.quantity, 0)}</span></div>
          <div className="rc"><span className="rl">TOTAL</span><span className="rv">{F(order.total)}</span></div>
        </div>

        {/* Actions */}
        <div className="fx ac gap8 mt10">
          {isCancellable(order.status) && <StatCancelButton orderId={order.orderId} patientName={order.patientName} size="sm" />}
          <button className="btn btn-g f1" style={{ height: 40 }} onClick={() => setSupportOpen(true)}><i className="ph-bold ph-lifebuoy" /> Need help?</button>
        </div>

        {/* Lifecycle stepper (reused) */}
        <div className="card mt10"><ClinicalLifecycleStepper order={order} socketConnected={socketConnected} /></div>

        {/* Live rider map */}
        {showRiderCard && numericOrderId > 0 && (
          <div className="card mt10">
            <div className="lab mb10"><i className="ph-bold ph-navigation-arrow" style={{ color: "var(--safb)" }} /> Live rider location</div>
            <Suspense fallback={<div className="skel" style={{ height: 240 }} />}>
              <RiderMap orderId={numericOrderId} destination={dynamicEta?.dropLat != null && dynamicEta?.dropLng != null ? { lat: dynamicEta.dropLat, lng: dynamicEta.dropLng, label: order?.address?.label ?? "Delivery address" } : undefined} />
            </Suspense>
          </div>
        )}

        {/* Rider card */}
        {showRiderCard ? (
          <div className="card mt10">
            <div className="fx ac jb">
              <div className="fx ac gap12">
                <div className="dic"><i className="ph-bold ph-user" /></div>
                <div><div className="small" style={{ fontWeight: 600 }}>{order.status === "delivered" ? "Delivered by your rider" : "Rider on the way"}</div><div className="fine">{order.status === "delivered" ? `Completed at ${fmtTime(order.etaAt)}` : `Arriving by ${fmtTime(displayEtaAt ?? order.etaAt)}`}</div></div>
              </div>
              {order.status !== "delivered" && order.riderPhone && (
                <div className="fx ac gap8">
                  <a href={`tel:${order.riderPhone}`} className="qbtn" aria-label="Call rider"><i className="ph-bold ph-phone" /></a>
                  <a href={`https://wa.me/${order.riderPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="qbtn" style={{ borderColor: "var(--sage)", color: "var(--sage)" }} aria-label="WhatsApp rider"><i className="ph-bold ph-whatsapp-logo" /></a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card mt10 fx ac gap8" style={{ borderStyle: "dashed" }}><i className="ph-bold ph-cooking-pot" style={{ color: "var(--safb)" }} /><span className="fine">Kitchen is preparing your order. A rider will be assigned once it's ready.</span></div>
        )}

        {/* Address */}
        <div className="card mt10">
          <div className="lab mb6">{order.fulfillmentType === "pickup" ? <><i className="ph-bold ph-storefront" /> Pickup at</> : <><i className="ph-bold ph-map-pin" /> Delivery address</>}</div>
          {order.fulfillmentType === "pickup" && order.pickupLocationName && <div className="small" style={{ fontWeight: 600 }}>{order.pickupLocationName}</div>}
          <div className="small" style={{ fontWeight: 600 }}>{order.address.label}</div>
          <div className="fine mt2">{order.address.line1}{order.address.line2 ? ` · ${order.address.line2}` : ""} · {order.address.city} {order.address.pincode}</div>
          <div className="fine mt2"><i className="ph-bold ph-phone" /> {order.fulfillmentType === "pickup" ? `We'll text ${order.address.phone} when it's ready` : `Rider will call ${order.address.phone}`}</div>
          {order.deliverySlotLabel && <div className="fine mt2"><i className="ph-bold ph-calendar-dots" /> Window: {order.deliverySlotLabel}</div>}
          {order.deliveryInstructions && <div className="note mt6" style={{ background: "var(--s2)", borderColor: "var(--ln2)", color: "var(--mut)" }}><i className="ph-bold ph-note-pencil" /><span><b>Notes for rider:</b> {order.deliveryInstructions}</span></div>}
        </div>

        {order.ecoPackagingOptIn && <div className="mt10"><PackagingReturnCard orderServerId={order.serverOrderId} delivered={order.status === "delivered"} /></div>}

        {/* Timeline */}
        <div className="card mt10">
          <div className="lab mb10"><i className="ph-bold ph-clock" /> Delivery timeline</div>
          {isLoading ? (
            <div className="skel" style={{ height: 60 }} />
          ) : timeline && timeline.length > 0 ? (
            timeline.map((event: any, idx: number) => (
              <div key={idx} className="fx gap12" style={{ padding: "4px 0" }}>
                <div className="col ac" style={{ width: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: event.event === "delivered" ? "var(--sage)" : "var(--safb)", flex: "none" }} />
                  {idx < timeline.length - 1 && <span style={{ width: 2, flex: 1, background: "var(--ln2)", marginTop: 2 }} />}
                </div>
                <div style={{ paddingBottom: 10 }}><div className="small" style={{ fontWeight: 500 }}>{EVENT_LABELS[event.event] ?? event.event}</div><div className="fine">{event.createdAt ? fmtTime(event.createdAt) : "Just now"}</div></div>
              </div>
            ))
          ) : (
            <div className="fine" style={{ fontStyle: "italic" }}>Timeline events will appear here as your order progresses.</div>
          )}
        </div>

        {/* Items */}
        <div className="card mt10">
          <div className="lab mb10"><i className="ph-bold ph-receipt" /> Order items</div>
          {order.items.map((item: any) => (
            <div key={item.lineId} className="fx ac gap12" style={{ padding: "6px 0" }}>
              <div className="plc" style={{ width: 40, height: 40, borderRadius: 8, backgroundImage: `url(${item.image})`, backgroundSize: "cover", backgroundPosition: "center", flex: "none" }} />
              <div className="f1" style={{ minWidth: 0 }}><div className="small clamp1">{item.name}</div><div className="fine" style={{ fontSize: 10 }}>Qty: {item.quantity}</div></div>
              <span className="price" style={{ fontSize: 13, color: "var(--safb)" }}>{F(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
        </div>

        {/* Dev panel */}
        {showDevPanel && (
          <div className="card mt10" style={{ borderStyle: "dashed" }}>
            <div className="lab mb10"><i className="ph-bold ph-warning" /> Developer controls · ?dev=1</div>
            <div className="fx ac g6 wrap">
              {["rider_en_route_to_kitchen", "rider_at_kitchen", "order_picked_up", "rider_en_route_to_customer", "delivered"].map((evt) => (
                <button key={evt} className="chip" disabled={recordEvent.isPending} onClick={() => handleEvent(evt)}>{EVENT_LABELS[evt]}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <SupportTicketDialog open={supportOpen} onOpenChange={setSupportOpen} orderDisplayId={order.orderId} orderServerId={order.serverOrderId} />

      {/* Phase 3 — Post-Purchase Ingestion: optional profile capture on first
          arrival after a successful payment. Fixed overlay (CLS 0.0), fully
          dismissable, and reads only the arrival orderId — no payment coupling. */}
      <PostCheckoutWizard orderId={orderIdParam} />
    </>
  );
}
