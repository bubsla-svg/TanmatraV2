import { useState } from "react";
import { Link, useParams } from "react-router";
import { getDishBySlug, toView } from "./data";

export default function V2Dish() {
  const { slug } = useParams();
  const raw = slug ? getDishBySlug(slug) : undefined;
  const [acc, setAcc] = useState<string | null>("num");

  if (!raw) {
    return (
      <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div className="appbar"><Link className="iconbtn" to="/menu"><i className="ph-bold ph-arrow-left" /></Link><div className="abt">Dish</div></div>
          <div className="content padx"><div className="tt mt20">Dish not found</div><Link className="btn btn-g mt20" to="/menu">Back to menu</Link></div>
        </div>
      </div>
    );
  }

  const v = toView(raw);
  const pair = v.pairingSlug ? getDishBySlug(v.pairingSlug) : undefined;
  const pairV = pair ? toView(pair) : undefined;
  const tAcc = (k: string) => () => setAcc((a) => (a === k ? null : k));
  const rowCls = (k: string) => (acc === k ? "arow on" : "arow");

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div className="content">
          <div className="plc" style={{ height: 280, backgroundImage: `url(${v.image})`, backgroundSize: "cover", backgroundPosition: "center" }}>
            <div className="posabs w100" style={{ top: 0, left: 0, padding: "12px 16px", display: "flex", justifyContent: "space-between", zIndex: 2 }}>
              <Link className="glass" to="/menu"><i className="ph-bold ph-arrow-left" /></Link>
            </div>
          </div>
          <div className="padx" style={{ paddingTop: 16 }}>
            <div className="fx ac g6">
              <span className="vtag"><span className={v.vcls} />{v.vlabel}</span>
              <span className={v.gcls}>{v.glabel}</span>
              {v.rdVerified && <span className="pill sg" style={{ marginLeft: "auto" }}><i className="ph-fill ph-seal-check" />RD-signed</span>}
            </div>
            <h1 className="h2 mt10">{v.name}</h1>
            <div className="fine mt6">{v.tag} · <span className="mono">{v.prepTime}</span> · GI {v.gi}</div>
            <div className="fx ac jb mt10"><span className="price" style={{ fontSize: 19 }}>{v.priceStr}</span><span className="mono fntc" style={{ fontSize: 11 }}>incl. GST</span></div>
            <div className="ribbon mt10" role="group" aria-label={v.aria}>
              <div className="rc"><span className="rl">KCAL</span><span className="rv sf">{v.k}</span></div>
              <div className="rc"><span className="rl">PROTEIN</span><span className="rv">{v.p}<i className="ru">g</i></span></div>
              <div className="rc"><span className="rl">CARBS</span><span className="rv">{v.c}<i className="ru">g</i></span></div>
              <div className="rc"><span className="rl">FAT</span><span className="rv">{v.f}<i className="ru">g</i></span></div>
            </div>

            <div className="acc mt10" style={{ borderTop: "none" }}>
              <button className={rowCls("num")} onClick={tAcc("num")}>The full numbers<i className="ph-bold ph-caret-down" /></button>
              {acc === "num" && <div className="abody">Fibre <span className="mono">{v.fiber} g</span> · sugar <span className="mono">{v.sugar || "—"}</span> · {v.k} kcal per serving. Weighed per batch, not estimated.</div>}
            </div>
            <div className="acc">
              <button className={rowCls("why")} onClick={tAcc("why")}>Why this works<i className="ph-bold ph-caret-down" /></button>
              {acc === "why" && <div className="abody">{v.rdNote || v.longDescription || v.description}</div>}
            </div>
            <div className="acc">
              <button className={rowCls("ing")} onClick={tAcc("ing")}>Ingredients<i className="ph-bold ph-caret-down" /></button>
              {acc === "ing" && <div className="abody">{v.ingredients.length ? v.ingredients.join(" · ") : v.longDescription}</div>}
            </div>
            <div className="acc" style={{ borderBottom: "1px solid var(--ln)" }}>
              <button className={rowCls("all")} onClick={tAcc("all")}>Allergens<i className="ph-bold ph-caret-down" /></button>
              {acc === "all" && <div className="abody">{v.allergens.length ? v.allergens.join(", ") : "No declared allergens."}</div>}
            </div>

            {pairV && (
              <>
                <div className="sh mt20 mb10">Pairs well with</div>
                <Link className="fx ac gap12" to={`/dish/${pairV.slug}`} style={{ padding: "9px 0", borderBottom: "1px solid var(--ln)", display: "flex" }}>
                  <span className={pairV.vcls} />
                  <div className="f1" style={{ minWidth: 0 }}>
                    <div className="small" style={{ fontWeight: 500 }}>{pairV.name}</div>
                    <div className="mono fntc" style={{ fontSize: "10.5px" }}>{pairV.k} kcal · {pairV.p}g protein</div>
                  </div>
                  <span className="price" style={{ fontSize: 13 }}>{pairV.priceStr}</span>
                </Link>
              </>
            )}
            <div style={{ height: 12 }} />
          </div>
        </div>
        <div className="dock">
          <Link className="btn btn-p btn-lg btn-blk" to="/cart">Add to cart — {v.priceStr}</Link>
        </div>
      </div>
    </div>
  );
}
