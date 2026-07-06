import { Link } from "react-router";
import { useCart, FREE_DELIVERY_THRESHOLD, DELIVERY_FEE } from "@/lib/cartContext";
import { F } from "./data";

export default function V2Cart() {
  const { items, updateQty, subtotal } = useCart();
  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD || subtotal === 0 ? 0 : DELIVERY_FEE;
  const gst = Math.round(subtotal * 0.05);
  const total = subtotal + gst + delivery;
  const gap = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/menu"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Your cart</div>
        </div>
        <div className="content padx" style={{ flex: 1 }}>
          {items.length === 0 ? (
            <div className="tc" style={{ padding: "52px 20px" }}>
              <i className="ph-bold ph-shopping-bag" style={{ fontSize: 32, color: "var(--fnt)" }} />
              <div className="tt mt10">Your cart is empty</div>
              <div className="fine mt6">Trial a single meal — no plan needed.</div>
              <Link className="btn btn-p mt20" to="/menu">Browse the menu</Link>
            </div>
          ) : (
            <>
              {items.map((it: any) => (
                <div key={it.lineId} className="card mb10">
                  <div className="fx gap12">
                    <div className="dimg" style={{ width: 60, height: 60, borderRadius: 9, backgroundImage: `url(${it.image})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                    <div className="f1" style={{ minWidth: 0 }}>
                      <div className="fx ac g6">
                        <span className={it.isVeg ? "vd" : "vd nv"} />
                        <span className="small" style={{ fontWeight: 600 }}>{it.name}</span>
                      </div>
                      <div className="fine mt4"><span className="price">{F(it.unitPrice * it.quantity)}</span> · {it.macros?.calories ?? 0} kcal</div>
                    </div>
                    <div className="fx ac gap10" style={{ alignSelf: "flex-start" }}>
                      <button className="qbtn" onClick={() => updateQty(it.lineId, -1)} aria-label="Decrease"><i className="ph-bold ph-minus" /></button>
                      <span className="mono" style={{ width: 18, textAlign: "center", fontWeight: 600 }}>{it.quantity}</span>
                      <button className="qbtn" onClick={() => updateQty(it.lineId, 1)} aria-label="Increase"><i className="ph-bold ph-plus" /></button>
                    </div>
                  </div>
                </div>
              ))}
              {gap > 0 && (
                <div className="note mb14" style={{ background: "var(--safd)", borderColor: "rgba(232,154,62,.35)", color: "var(--safb)" }}>
                  <i className="ph-bold ph-info" /><span>Add {F(gap)} more to unlock free delivery.</span>
                </div>
              )}
              <div className="card mt14">
                <div className="billrow"><span>Item total</span><span className="price" style={{ color: "var(--tx)" }}>{F(subtotal)}</span></div>
                <div className="billrow"><span>GST</span><span className="price" style={{ color: "var(--tx)" }}>{F(gst)}</span></div>
                <div className="billrow"><span>Delivery</span><span className={delivery === 0 ? "price sagec" : "price"} style={delivery ? { color: "var(--tx)" } : undefined}>{delivery === 0 ? "Free" : F(delivery)}</span></div>
                <div className="billrow tot"><span>To pay</span><span className="price">{F(total)}</span></div>
              </div>
              <div style={{ height: 12 }} />
            </>
          )}
        </div>
        {items.length > 0 && (
          <div className="dock">
            <Link className="btn btn-p btn-lg btn-blk" to="/checkout">Checkout · {F(total)}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
