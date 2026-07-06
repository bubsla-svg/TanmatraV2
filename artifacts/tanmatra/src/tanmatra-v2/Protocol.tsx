import { Link } from "react-router";
import { DISHES, toView } from "./data";

type Key = "wellness" | "performance" | "clinical";

const CFG: Record<Key, { name: string; icon: string; thesis: string; quals: string[]; match: (d: any) => boolean }> = {
  wellness: {
    name: "Wellness Protocol",
    icon: "ph-leaf",
    thesis: "Eat well on autopilot — balanced, RD-portioned meals for everyday energy, immunity and gut health.",
    quals: ["≤ 600 kcal per meal", "≥ 15 g protein", "No refined sugar in mains", "RD-verified"],
    match: (d) => d.rdVerified && (d.macros?.calories ?? 0) <= 600,
  },
  performance: {
    name: "Performance Protocol",
    icon: "ph-barbell",
    thesis: "Fuel training and recovery with protein-forward, macro-calibrated plates.",
    quals: ["≥ 25 g protein per meal", "Carbs periodised to training", "Recovery-friendly fats", "RD-verified"],
    match: (d) => (d.macros?.protein ?? 0) >= 25,
  },
  clinical: {
    name: "Clinical Protocol",
    icon: "ph-heartbeat",
    thesis: "Condition-aware meals — low-GI, portion-precise — always inside an RD-supervised frame.",
    quals: ["Low GI across mains", "Portion-precise", "Every menu RD-signed", "Monthly RD review"],
    match: (d) => d.glycaemicIndex === "low",
  },
};

export default function V2Protocol({ which }: { which: Key }) {
  const cfg = CFG[which];
  const dishes = (DISHES as any[]).filter((d) => d.isAvailable !== false && cfg.match(d));
  const hero = dishes[0];
  const featured = dishes.slice(0, 4).map(toView);

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="content" style={{ paddingBottom: 24 }}>
          <div className="plc" style={{ height: 220, backgroundImage: hero ? `url(${hero.image})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
            <div className="herograd" />
            <div className="posabs" style={{ top: 12, left: 16, zIndex: 2 }}>
              <Link className="glass" to="/"><i className="ph-bold ph-arrow-left" /></Link>
            </div>
            <div className="posabs" style={{ left: 18, right: 18, bottom: 16, zIndex: 2 }}>
              <div className="fx ac gap8"><span className="dic"><i className={"ph-bold " + cfg.icon} /></span><h1 className="h2" style={{ color: "#fff" }}>{cfg.name}</h1></div>
            </div>
          </div>
          <div className="padx" style={{ paddingTop: 16 }}>
            <p className="small mut">{cfg.thesis}</p>
            <div className="sh mt20 mb10">What qualifies a dish</div>
            {cfg.quals.map((q) => (
              <div key={q} className="fx ac gap10" style={{ padding: "6px 0" }}><i className="ph-bold ph-check sagec" /><span className="small">{q}</span></div>
            ))}
            <div className="sh mt20 mb10">Dishes in this protocol</div>
            {featured.map((v) => (
              <Link key={v.slug} className="fx ac gap12" to={`/dish/${v.slug}`} style={{ padding: "9px 0", borderBottom: "1px solid var(--ln)", display: "flex" }}>
                <div className="dimg" style={{ width: 52, height: 52, borderRadius: 9, backgroundImage: `url(${v.image})`, backgroundSize: "cover", backgroundPosition: "center", flex: "none" }} />
                <div className="f1" style={{ minWidth: 0 }}>
                  <div className="small" style={{ fontWeight: 500 }}>{v.name}</div>
                  <div className="mono fntc" style={{ fontSize: "10.5px" }}>{v.k} kcal · {v.p}g protein</div>
                </div>
                <span className="price" style={{ fontSize: 13 }}>{v.priceStr}</span>
              </Link>
            ))}
            <div className="note mt14"><i className="ph-bold ph-seal-check" />An RD signs this menu and screens every dish against your allergens.</div>
          </div>
        </div>
        <div className="dock">
          <Link className="btn btn-p btn-lg btn-blk" to="/menu">Browse {cfg.name.split(" ")[0]} meals</Link>
        </div>
      </div>
    </div>
  );
}
