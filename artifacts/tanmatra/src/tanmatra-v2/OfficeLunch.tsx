import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { corporateApi, type OfficeOrder, type CompanyMember } from "@/lib/corporateApi";
import { usePublicMenu } from "@/lib/queries";
import { formatPrice } from "@/lib/api/adapter";

/* Full-parity re-port of the System-A Office Lunch page (git 2507084) into v2.
 * Reuses corporateApi (getOfficeOrder / pickOfficeOrder / closeOfficeOrder),
 * usePublicMenu, formatPrice and the exact pick/close/budget logic verbatim. */

export default function V2OfficeLunch() {
  const { id = "" } = useParams<{ id: string }>();
  const orderId = Number(id);
  const [data, setData] = useState<{
    officeOrder: OfficeOrder;
    membership: CompanyMember;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const { data: menu = [] } = usePublicMenu();

  const refresh = async () => {
    try {
      const r = await corporateApi.getOfficeOrder(orderId);
      setData(r);
    } catch {
      toast.error("Could not load office lunch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const myPick = useMemo(() => {
    if (!data) return null;
    const me = data.membership.userId;
    return data.officeOrder.picks.find((p) => p.userId === me) ?? null;
  }, [data]);

  useEffect(() => {
    // Pre-fill form from existing pick
    if (myPick) {
      const seed: Record<number, number> = {};
      for (const it of myPick.items) seed[it.dishId] = it.quantity;
      setPicks(seed);
    }
  }, [myPick?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !data) {
    return (
      <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="padx fine mut" style={{ paddingTop: 24 }}>Loading…</div>
        </div>
      </div>
    );
  }

  const o = data.officeOrder;
  const isAdmin = data.membership.role === "admin";
  const window = new Date(o.windowClosesAt);
  const windowOpen = o.status === "open" && window.getTime() > Date.now();

  const myTotal = Object.entries(picks).reduce((sum, [dishId, qty]) => {
    const dish = menu.find((m) => m.id === Number(dishId));
    return sum + (dish?.price ?? 0) * qty;
  }, 0);
  const overBudget = myTotal > o.perEmployeeBudgetPaise;

  const handleSave = async () => {
    const items = Object.entries(picks)
      .filter(([, q]) => q > 0)
      .map(([dishId, quantity]) => ({ dishId: Number(dishId), quantity }));
    if (items.length === 0) {
      toast.error("Pick at least one dish");
      return;
    }
    if (overBudget) {
      toast.error("Over your budget");
      return;
    }
    setSubmitting(true);
    try {
      await corporateApi.pickOfficeOrder(orderId, items);
      toast.success("Pick saved");
      refresh();
    } catch (e) {
      toast.error(String((e as Error).message).includes("422") ? "Over budget" : "Could not save pick");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    try {
      await corporateApi.closeOfficeOrder(orderId);
      toast.success("Picks closed — order locked in");
      refresh();
    } catch {
      toast.error("Could not close");
    }
  };

  const bump = (dishId: number, delta: number) => {
    setPicks((prev) => {
      const next = { ...prev, [dishId]: Math.max(0, (prev[dishId] ?? 0) + delta) };
      if (next[dishId] === 0) delete next[dishId];
      return next;
    });
  };

  const saveDisabled = !windowOpen || submitting || overBudget;

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div className="content" style={{ paddingBottom: 24 }}>
          {/* Hero */}
          <div className="plc" style={{ minHeight: 200 }}>
            <div className="herograd" />
            <div className="posabs" style={{ top: 12, left: 16, zIndex: 2 }}>
              <Link className="glass" to="/corporate" aria-label="Companies"><i className="ph-bold ph-arrow-left" /></Link>
            </div>
            <div className="posabs padx" style={{ left: 0, right: 0, bottom: 16, zIndex: 2 }}>
              <span className="pill" style={o.status === "open" && windowOpen ? { background: "var(--saged)", color: "var(--sage)" } : {}}>
                <i className="ph-fill ph-circle" style={{ fontSize: 8 }} /> {windowOpen ? "Picks open" : o.status}
              </span>
              <h1 className="disp mt10" style={{ fontSize: 26, color: "var(--color-stone-0)" }}>{o.title}</h1>
            </div>
          </div>

          <div className="padx" style={{ paddingTop: 14 }}>
            {/* Meta */}
            <div className="fx col g6">
              <div className="fine fx ac g6"><i className="ph-bold ph-calendar-dots" style={{ color: "var(--safb)" }} /> {new Date(o.scheduledFor).toLocaleString("en-IN", { weekday: "long", hour: "numeric", minute: "2-digit" })}</div>
              <div className="fine fx ac g6"><i className="ph-bold ph-map-pin" style={{ color: "var(--safb)" }} /> {o.address.line}, {o.address.city} {o.address.pincode}</div>
              <div className="fine fx ac g6"><i className="ph-bold ph-shield-check" style={{ color: "var(--safb)" }} /> Budget {formatPrice(o.perEmployeeBudgetPaise)} / person</div>
            </div>

            {/* Pick your meal */}
            <div className="sh mt20 mb10">Pick your meal</div>
            {!windowOpen && (
              <div className="note mb10" style={{ background: "var(--s3)", borderColor: "var(--ln2)", color: "var(--mut)" }}>
                <i className="ph-bold ph-lock" /> Pick window has closed.
              </div>
            )}
            {menu.map((dish) => {
              const qty = picks[dish.id] ?? 0;
              return (
                <div key={dish.id} className="dcard fx ac jb" style={{ padding: 10 }}>
                  <div className="fx ac gap12" style={{ minWidth: 0 }}>
                    {dish.imageUrl && (
                      <div className="plc" style={{ width: 44, height: 44, borderRadius: 8, backgroundImage: `url(${dish.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center", flex: "none" }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div className="small clamp1" style={{ fontWeight: 500 }}>{dish.name}</div>
                      <div className="mono fntc" style={{ fontSize: 11 }}>{formatPrice(dish.price)}</div>
                    </div>
                  </div>
                  <div className="fx ac g6" style={{ flex: "none" }}>
                    <button className="qbtn" disabled={!windowOpen || qty <= 0} onClick={() => bump(dish.id, -1)} aria-label={`Remove one ${dish.name}`} style={{ opacity: !windowOpen || qty <= 0 ? 0.4 : 1 }}><i className="ph-bold ph-minus" /></button>
                    <span className="mono tc" style={{ width: 24, fontSize: 13 }}>{qty}</span>
                    <button className="qbtn" disabled={!windowOpen} onClick={() => bump(dish.id, 1)} aria-label={`Add one ${dish.name}`} style={{ opacity: !windowOpen ? 0.4 : 1 }}><i className="ph-bold ph-plus" /></button>
                  </div>
                </div>
              );
            })}

            {/* Your total */}
            <div className="billrow tot">
              <span>Your total</span>
              <span className="mono" style={{ color: overBudget ? "var(--dgr)" : "var(--tx)" }}>{formatPrice(myTotal)} / {formatPrice(o.perEmployeeBudgetPaise)}</span>
            </div>

            {/* Team picks */}
            <div className="sh mt20 mb10 fx ac g6"><i className="ph-bold ph-users" style={{ color: "var(--safb)" }} /> Team picks ({o.picks.length})</div>
            <div className="fine mb10">Aggregated total: <span className="mono" style={{ color: "var(--tx)" }}>{formatPrice(o.totalPaise)}</span></div>
            {o.picks.length === 0 ? (
              <div className="fine">No picks yet.</div>
            ) : (
              o.picks.map((p) => (
                <div key={p.userId} className="dcard" style={{ padding: 12 }}>
                  <div className="fx ac jb">
                    <div className="small" style={{ fontWeight: 600 }}>{p.userName}</div>
                    <span className="mono" style={{ fontSize: 12, color: "var(--safb)" }}>{formatPrice(p.totalPaise)}</span>
                  </div>
                  <div className="fx col" style={{ gap: 2, marginTop: 6 }}>
                    {p.items.map((it) => (
                      <div key={it.dishId} className="fine">{it.quantity} × {it.name}</div>
                    ))}
                  </div>
                </div>
              ))
            )}
            {isAdmin && windowOpen && (
              <button onClick={handleClose} className="btn btn-g btn-blk mt10">Close picks</button>
            )}
          </div>
        </div>

        {/* Sticky pick CTA */}
        <div className="dock">
          <button
            className={`btn btn-p btn-lg btn-blk${saveDisabled ? " dis" : ""}`}
            onClick={handleSave}
          >
            {submitting ? "Saving…" : myPick ? "Update my pick" : "Lock my pick"}
          </button>
        </div>
      </div>
    </div>
  );
}
