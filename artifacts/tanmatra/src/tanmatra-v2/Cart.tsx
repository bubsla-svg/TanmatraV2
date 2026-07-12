import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { F } from "./data";
import { useQuery } from "@tanstack/react-query";
import { loyaltyApi } from "@/lib/loyaltyApi";
import { useCart, useCartTotals } from "@/lib/cartContext";
import { useOrders } from "@/lib/ordersContext";
import { groupOrdersApi } from "@/lib/queries";
import { usePreferences } from "@/lib/preferencesContext";
import { evaluateDishForPreferences, findSmartSwap } from "@/lib/preferencesMatch";
import { getDishById, useMenuCatalog } from "@/lib/menuData";
import { fulfillmentApi, type DeliverySlotOption } from "@/lib/fulfillmentApi";
import { clinicalCategoryLabel, dishMatchesDietOrder, useClinicalMode } from "@/lib/clinicalDiet";
import ConflictsPanel from "@/components/clinical/ConflictsPanel";

/* Full-parity re-port of the System-A Cart (git 2507084, 652 lines) into v2. */

export default function V2Cart() {
  const navigate = useNavigate();
  const { items, updateQty, updateRecipient, removeItem, totalQuantity } = useCart();
  const { preferences } = usePreferences();
  const { enabled: clinicalMode, dietOrderId } = useClinicalMode();
  const { dishes: catalogDishes } = useMenuCatalog();

  const { data: offer } = useQuery({
    queryKey: ["firstOrderOffer"],
    queryFn: loyaltyApi.getFirstOrderOffer,
    staleTime: 5 * 60_000,
  });

  const [nextSlot, setNextSlot] = useState<DeliverySlotOption | null>(null);
  const [showTagInput, setShowTagInput] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fulfillmentApi.listSlots().then((r: any) => {
      if (!alive) return;
      const c = r.slots.filter((s: any) => !s.full).sort((a: any, b: any) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;
      setNextSlot(c);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const conflictMap = (() => {
    const out = new Map<string, any>();
    for (const item of items) {
      const dish = getDishById(item.dishId);
      if (!dish) continue;
      const m = preferences ? evaluateDishForPreferences(dish, preferences) : null;
      const dietConflict = clinicalMode ? dishMatchesDietOrder(dish, dietOrderId) : null;
      const hasPrefSignal = m !== null && (m.warnings.length > 0 || m.blocked);
      if (!hasPrefSignal && !dietConflict) continue;
      const swap = preferences ? findSmartSwap(dish, preferences, catalogDishes) : null;
      out.set(item.lineId, {
        warnings: m?.warnings ?? [],
        blocked: m?.blocked ?? false,
        matchedAllergens: m?.matchedAllergens ?? [],
        dietConflictReason: dietConflict?.reason ?? null,
        swapSlug: swap?.slug ?? null,
        swapName: swap?.name ?? null,
      });
    }
    return out;
  })();
  const conflictCount = conflictMap.size;
  const allergenCount = Array.from(conflictMap.values()).filter((c) => c.matchedAllergens.length > 0).length;
  const dietConflictCount = Array.from(conflictMap.values()).filter((c) => c.dietConflictReason !== null).length;
  const checkoutBlocked = allergenCount > 0 || dietConflictCount > 0;
  const blockReason =
    allergenCount > 0
      ? `${allergenCount} allergen conflict${allergenCount === 1 ? "" : "s"} — remove flagged item${allergenCount === 1 ? "" : "s"} to continue.`
      : dietConflictCount > 0
        ? `${dietConflictCount} item${dietConflictCount === 1 ? "" : "s"} conflict with the active diet order — remove to continue.`
        : null;

  const { subtotal, tax, deliveryFee, total, amountToFreeDelivery, freeDeliveryProgress } = useCartTotals();
  const { orders } = useOrders();

  const isEligible = offer ? offer.eligible : true;
  const discountPercent = offer ? offer.percentBps / 10000 : 0.25;
  const discountCap = offer ? offer.capPaise : 8000;
  const eligible = orders.length === 0 && isEligible;

  const projectedFirstOrderDiscount = eligible && subtotal > 0
    ? Math.min(Math.floor(subtotal * discountPercent), discountCap)
    : 0;
  const grandTotal = Math.max(0, total - projectedFirstOrderDiscount);

  if (items.length === 0) {
    return (
      <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar"><Link className="iconbtn" to="/menu"><i className="ph-bold ph-arrow-left" /></Link><div className="abt">Your order</div></div>
          <div className="padx tc" style={{ paddingTop: 60 }}>
            <div className="avatar big" style={{ margin: "0 auto" }}><i className="ph-bold ph-shopping-bag" /></div>
            <div className="tt mt20">Your cart is empty</div>
            <div className="fine mt6">Browse the menu to start an instant order — or build a recurring <Link to="/meal-planner" style={{ color: "var(--safb)" }}>Weekly Plan</Link>.</div>
            <Link className="btn btn-p btn-blk mt20" to="/menu"><i className="ph-bold ph-fork-knife" /> Browse menu</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/menu"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Your order</div>
          <Link className="fine" to="/menu" style={{ color: "var(--safb)" }}><i className="ph-bold ph-fork-knife" /> Add more</Link>
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 120 }}>
          <div className="fine mb10">{totalQuantity} item{totalQuantity === 1 ? "" : "s"} · fresh, dietitian-approved meals</div>

          {/* Clinical conflicts panel (self-contained; clinical-mode only) */}
          <ConflictsPanel />

          {/* Aggregate conflict banner */}
          {conflictCount > 0 && (
            <div className="note mb10" style={allergenCount > 0 ? { background: "color-mix(in oklab, var(--color-error) 12%, transparent)", borderColor: "color-mix(in oklab, var(--color-error) 35%, transparent)", color: "var(--color-error)" } : undefined}>
              <i className={allergenCount > 0 ? "ph-fill ph-warning-circle" : "ph-fill ph-shield-warning"} />
              <span>
                {allergenCount > 0
                  ? `${allergenCount} item${allergenCount === 1 ? "" : "s"} contain ingredients flagged in your `
                  : `${conflictCount} item${conflictCount === 1 ? "" : "s"} conflict with your `}
                <Link to="/preferences" style={{ textDecoration: "underline", color: "inherit" }}>{allergenCount > 0 ? "allergen profile" : "preferences"}</Link>.
              </span>
            </div>
          )}

          {/* Free-delivery progress */}
          {amountToFreeDelivery > 0 ? (
            <div className="banner mb10">
              <div className="fx ac jb mb6">
                <span className="fine" style={{ color: "var(--safb)" }}>Add {F(amountToFreeDelivery)} more for FREE delivery</span>
                <Link to="/menu" className="fine" style={{ color: "var(--safb)" }}>Browse →</Link>
              </div>
              <div className="pbar"><b style={{ width: `${Math.min(100, freeDeliveryProgress)}%`, background: "var(--saf)" }} /></div>
            </div>
          ) : (
            <div className="note mb10"><i className="ph-fill ph-check-circle" /><span>You've unlocked FREE delivery on this order.</span></div>
          )}

          {/* Line items */}
          {items.map((item: any) => {
            const dish = getDishById(item.dishId);
            const kitchenLabel = clinicalMode && dish ? clinicalCategoryLabel(dish.category, dish.category) : item.kitchen;
            const c = conflictMap.get(item.lineId);
            const hasAllergen = c?.matchedAllergens?.length > 0;
            const hasDiet = c?.dietConflictReason;
            return (
              <div key={item.lineId} className="dcard">
                <div className="fx gap12">
                  <Link to={`/dish/${item.slug}`} className="dimg" style={{ backgroundImage: `url(${item.image})`, backgroundSize: "cover", backgroundPosition: "center" }} aria-label={item.name} />
                  <div className="f1" style={{ minWidth: 0 }}>
                    <div className="fx ac jb gap8">
                      <div className="fx ac g6" style={{ minWidth: 0 }}>
                        <span className={item.isVeg ? "vd" : "vd nv"} />
                        <Link to={`/dish/${item.slug}`} className="small clamp1" style={{ fontWeight: 600 }}>{item.name}</Link>
                      </div>
                      <button className="qbtn" style={{ width: 30, height: 30 }} onClick={() => { removeItem(item.lineId); toast.success("Item removed from your order"); }} aria-label={`Remove ${item.name}`}><i className="ph-bold ph-trash" style={{ fontSize: 14 }} /></button>
                    </div>
                    <div className="fine mt2" style={{ textTransform: "capitalize" }}>{kitchenLabel} · {item.macros.calories} kcal</div>

                    {item.customizations.length > 0 && (
                      <div className="fx ac g6 wrap mt6">
                        {item.customizations.map((cz: string) => <span key={cz} className="pill" style={{ fontSize: 10 }}>{cz}</span>)}
                      </div>
                    )}

                    {/* Name tag */}
                    {item.recipient || showTagInput === item.lineId ? (
                      <div className="fx ac gap8 mt6">
                        <span className="lab">For</span>
                        <input
                          className="inp"
                          style={{ height: 32, width: 140, padding: "0 10px" }}
                          placeholder="e.g. Mom, Child"
                          autoFocus={showTagInput === item.lineId}
                          value={item.recipient || ""}
                          onChange={(e) => updateRecipient(item.lineId, e.target.value)}
                          onBlur={() => { if (!item.recipient) setShowTagInput(null); }}
                        />
                      </div>
                    ) : (
                      <button className="fine mt6" style={{ color: "var(--safb)" }} onClick={() => setShowTagInput(item.lineId)}>+ Add name tag</button>
                    )}

                    <div className="fx ac jb mt10">
                      <div className="fx ac gap10">
                        <button className="qbtn" onClick={() => updateQty(item.lineId, -1)} aria-label="Decrease"><i className="ph-bold ph-minus" /></button>
                        <span className="mono" style={{ fontSize: 15, fontWeight: 600, width: 20, textAlign: "center" }}>{item.quantity}</span>
                        <button className="qbtn" onClick={() => updateQty(item.lineId, 1)} aria-label="Increase"><i className="ph-bold ph-plus" /></button>
                      </div>
                      <span className="price" style={{ fontSize: 15, color: "var(--safb)" }}>{F(item.unitPrice * item.quantity)}</span>
                    </div>

                    {/* Per-line conflict block */}
                    {c && (
                      <div className="note mt10" style={(hasAllergen || hasDiet) ? { background: "color-mix(in oklab, var(--color-error) 12%, transparent)", borderColor: "color-mix(in oklab, var(--color-error) 35%, transparent)", color: "var(--color-error)" } : { background: "var(--s2)", borderColor: "var(--ln2)", color: "var(--mut)" }}>
                        <i className="ph-fill ph-warning" />
                        <div>
                          {hasAllergen && <div style={{ fontWeight: 600 }}>Contains {c.matchedAllergens.join(", ")}</div>}
                          {hasDiet && <div style={{ fontWeight: 600 }}>{c.dietConflictReason}</div>}
                          {c.warnings.filter((w: string) => !hasAllergen || !w.toLowerCase().includes("allergens")).map((w: string, i: number) => <div key={i}>{w}</div>)}
                          {c.swapSlug && (
                            <Link to={`/dish/${c.swapSlug}`} className="fx ac gap6 mt6" style={{ color: "var(--safb)" }}>
                              <i className="ph-fill ph-sparkle" /> Smart swap: {c.swapName} →
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Order summary */}
          <div className="card mt10">
            <div className="lab mb10"><i className="ph-bold ph-receipt" /> Order summary</div>
            <div className="billrow"><span>Subtotal ({totalQuantity} items)</span><span className="mono" style={{ color: "var(--tx)" }}>{F(subtotal)}</span></div>
            {tax > 0 && <div className="billrow"><span>GST</span><span className="mono" style={{ color: "var(--tx)" }}>{F(tax)}</span></div>}
            <div className="billrow"><span><i className="ph-bold ph-map-pin" /> Delivery</span><span className="mono" style={{ color: deliveryFee === 0 ? "var(--sage)" : "var(--tx)" }}>{deliveryFee === 0 ? "FREE" : F(deliveryFee)}</span></div>
            {projectedFirstOrderDiscount > 0 && (
              <div className="billrow"><span style={{ color: "var(--safb)" }}>First-order offer ({discountPercent * 100}% up to {F(discountCap)})</span><span className="mono" style={{ color: "var(--safb)" }}>−{F(projectedFirstOrderDiscount)}</span></div>
            )}
            <div className="billrow tot"><span>Total</span><span className="price" style={{ fontSize: 17, color: "var(--safb)" }}>{F(grandTotal)}</span></div>
            {projectedFirstOrderDiscount > 0 && <div className="fine mt4">Offer applied automatically at checkout.</div>}

            {nextSlot && (
              <div className="note mt10" style={{ background: "var(--s2)", borderColor: "var(--ln2)", color: "var(--mut)" }}>
                <i className="ph-bold ph-clock" />
                <span>Next slot: <span style={{ color: "var(--tx)", fontWeight: 500 }}>{new Date(nextSlot.startsAt).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span> · change at checkout</span>
              </div>
            )}
          </div>

          <StartGroupOrderButton />
          <Link to="/subscribe?fromCart=1" className="fine tc mt10" style={{ color: "var(--safb)", display: "block" }}>Subscribe to weekly delivery — save 10% →</Link>
          <div className="fine tc mt6"><i className="ph-bold ph-lock-simple" /> Secured by Razorpay · SSL encrypted</div>
        </div>

        {/* Sticky checkout dock */}
        <div className="dock">
          {checkoutBlocked && blockReason && <div className="fine tc mb6" style={{ color: "var(--dgr)" }} role="alert">{blockReason}</div>}
          <div className="fx ac jb gap12">
            <div style={{ flex: "none" }}>
              <div className="lab">{totalQuantity} item{totalQuantity === 1 ? "" : "s"} · {deliveryFee === 0 ? "FREE delivery" : `+${F(deliveryFee)}`}</div>
              <div className="price" style={{ fontSize: 19, color: "var(--safb)" }}>{F(grandTotal)}</div>
            </div>
            <button className={checkoutBlocked ? "btn btn-p btn-lg dis" : "btn btn-p btn-lg"} disabled={checkoutBlocked} onClick={() => navigate("/checkout")}>
              {checkoutBlocked ? "Blocked" : "Proceed to checkout"}<i className="ph-bold ph-arrow-right" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StartGroupOrderButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const r = await groupOrdersApi.create();
      const code = r.group.code;
      toast.success(`Group order ${code} created`, { description: "Share the code with friends" });
      navigate(`/group/${code}`);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (msg.includes("401")) toast.error("Sign in to start a group order", { action: { label: "Sign in", onClick: () => navigate("/login?next=/cart") } });
      else toast.error("Could not start a group order — please try again");
      setBusy(false);
    }
  };
  return (
    <button className="btn btn-g btn-blk mt10" onClick={start} disabled={busy}>
      <i className="ph-bold ph-users" /> {busy ? "Starting…" : "Start a group order"}
    </button>
  );
}
