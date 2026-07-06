import { Link } from "react-router";
import { DISHES, toView } from "./data";

const PROTOCOLS = [
  { name: "Wellness Protocol", line: "Balanced, RD-portioned meals for everyday energy.", icon: "ph-leaf", to: "/wellness" },
  { name: "Performance Protocol", line: "Protein-forward plates for training and recovery.", icon: "ph-barbell", to: "/performance" },
  { name: "Clinical Protocol", line: "Condition-aware meals, RD-supervised.", icon: "ph-heartbeat", to: "/clinical" },
];

export default function V2Home() {
  const all = (DISHES as any[]).filter((d) => d.isAvailable !== false);
  const feature = all.find((d) => (d.macros?.protein ?? 0) >= 25 && d.rdVerified) || all[0];
  const fv = feature ? toView(feature) : null;

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="content" style={{ paddingBottom: 24 }}>
          <div className="plc" style={{ height: 426, backgroundImage: "url(/hero-bg.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}>
            <div className="herograd" />
            <div className="posabs w100" style={{ top: 0, left: 0, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 2 }}>
              <span className="wordmark">tanmatra</span>
              <Link className="linkq" to="/account">Log in</Link>
            </div>
            <div className="posabs" style={{ left: 18, right: 18, bottom: 20, zIndex: 2 }}>
              <div className="lab" style={{ color: "var(--safb)" }}>RD-designed · Delhi NCR</div>
              <h1 className="disp" style={{ margin: "10px 0 8px", color: "#fff" }}>Meals built by dietitians. Cooked for your week.</h1>
              <p className="small mut" style={{ maxWidth: 300 }}>Every dish carries its numbers. Try one meal tonight — no plan, no signup.</p>
              <div className="fx ac gap12" style={{ marginTop: 16 }}>
                <Link className="btn btn-p btn-lg f1" to="/menu">Try one meal</Link>
                <Link className="btn btn-g btn-lg" to="/subscribe">Find my plan</Link>
              </div>
            </div>
          </div>

          <div className="padx" style={{ paddingTop: 14 }}>
            <div className="trust">
              <div className="tcell"><div className="tn">RD-signed</div><div className="ttx">every menu</div></div>
              <div className="tcell"><div className="tn">Fresh</div><div className="ttx">cooked daily</div></div>
              <div className="tcell"><div className="tn">FSSAI</div><div className="ttx">ISO 22000</div></div>
              <div className="tcell"><div className="tn">Pause</div><div className="ttx">anytime, no lock-in</div></div>
            </div>
          </div>

          {fv && (
            <>
              <div className="secrow"><span className="sh">See the numbers before you taste</span></div>
              <div className="padx">
                <Link className="card pointer" to={`/dish/${fv.slug}`} style={{ padding: 14, display: "block" }}>
                  <div className="fx gap12">
                    <div className="f1">
                      <div className="fx ac g6"><span className="vtag"><span className={fv.vcls} />{fv.vlabel}</span><span className={fv.gcls}>{fv.glabel}</span></div>
                      <div className="dtitle">{fv.name}</div>
                      <div className="fine"><span className="price">{fv.priceStr}</span> · {fv.tag}</div>
                    </div>
                    <div className="dimg" style={{ borderRadius: 10, backgroundImage: `url(${fv.image})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  </div>
                  <div className="ribbon cmp mt10" role="group" aria-label={fv.aria}>
                    <div className="rc"><span className="rl">KCAL</span><span className="rv sf">{fv.k}</span></div>
                    <div className="rc"><span className="rl">PROTEIN</span><span className="rv">{fv.p}<i className="ru">g</i></span></div>
                    <div className="rc"><span className="rl">CARBS</span><span className="rv">{fv.c}<i className="ru">g</i></span></div>
                    <div className="rc"><span className="rl">FAT</span><span className="rv">{fv.f}<i className="ru">g</i></span></div>
                  </div>
                  <div className="fine mt10">The Macro Ribbon rides on every meal — same four numbers, everywhere.</div>
                </Link>
              </div>
            </>
          )}

          <div className="secrow"><span className="sh">Three ways in</span></div>
          <div className="padx">
            {PROTOCOLS.map((p) => (
              <Link key={p.name} className="door" to={p.to}>
                <span className="dic"><i className={"ph-bold " + p.icon} /></span>
                <span className="f1"><span className="tt" style={{ display: "block" }}>{p.name}</span><span className="fine">{p.line}</span></span>
                <i className="ph-bold ph-caret-right fntc" />
              </Link>
            ))}
          </div>

          <div className="secrow"><span className="sh">How it works</span></div>
          <div className="padx fx gap8 mb20">
            <div className="card f1 tc" style={{ padding: "14px 8px" }}><div className="mono safc fs13 fw7">01</div><div className="fine mt6" style={{ color: "var(--tx)", fontWeight: 500 }}>Taste one meal</div></div>
            <div className="card f1 tc" style={{ padding: "14px 8px" }}><div className="mono safc fs13 fw7">02</div><div className="fine mt6" style={{ color: "var(--tx)", fontWeight: 500 }}>Answer 3 questions</div></div>
            <div className="card f1 tc" style={{ padding: "14px 8px" }}><div className="mono safc fs13 fw7">03</div><div className="fine mt6" style={{ color: "var(--tx)", fontWeight: 500 }}>Your RD takes over</div></div>
          </div>

          <div className="padx mb20">
            <Link className="btn btn-p btn-lg btn-blk" to="/menu">Browse the full menu</Link>
            <div className="fine mt10" style={{ fontSize: 11, color: "var(--fnt)", textAlign: "center" }}>Delivering across Delhi NCR · care@tanmatra.health · © 2026 Tanmatra</div>
          </div>
        </div>
      </div>
    </div>
  );
}
