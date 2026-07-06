import { useMemo, useState } from "react";
import { Link } from "react-router";
import { DISHES, toView, type DishView } from "./data";

const PILLS = ["All", "High protein", "Low GI", "Under 250 kcal"];

function DishImg({ v }: { v: DishView }) {
  return (
    <div
      className="dimg"
      style={{ backgroundImage: `url(${v.image})`, backgroundSize: "cover", backgroundPosition: "center" }}
      role="img"
      aria-label={v.name}
    />
  );
}

export default function V2Menu() {
  const [pill, setPill] = useState("All");
  const [veg, setVeg] = useState(false);

  const views = useMemo<DishView[]>(() => {
    let list = (DISHES as any[]).filter((d) => d.isAvailable !== false).map(toView);
    if (veg) list = list.filter((d) => d.isVeg);
    if (pill === "High protein") list = list.filter((d) => d.p >= 20);
    if (pill === "Low GI") list = list.filter((d) => d.gi === "low");
    if (pill === "Under 250 kcal") list = list.filter((d) => d.k > 0 && d.k < 250);
    return list;
  }, [pill, veg]);

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Menu</div>
          <Link className="iconbtn" to="/menu" title="Search"><i className="ph-bold ph-magnifying-glass" /></Link>
        </div>
        <div className="chiprow">
          {PILLS.map((p) => (
            <button key={p} className={pill === p ? "chip on" : "chip"} onClick={() => setPill(p)}>{p}</button>
          ))}
          <button className={veg ? "chip on" : "chip"} onClick={() => setVeg((x) => !x)}>
            <span className="vd" />Veg only
          </button>
        </div>
        <div className="content padx" style={{ paddingTop: 12 }}>
          <div className="fine mb10">{views.length} meals · ranked for your profile · allergens screened</div>
          {views.map((v) => (
            <Link key={v.slug} className="dcard pointer" to={`/dish/${v.slug}`} style={{ display: "block" }}>
              <div className="fx gap12">
                <div className="f1" style={{ minWidth: 0 }}>
                  <div className="fx ac g6">
                    <span className="vtag"><span className={v.vcls} />{v.vlabel}</span>
                    <span className={v.gcls}>{v.glabel}</span>
                    {v.rdVerified && <span className="pill sg" style={{ marginLeft: "auto" }}><i className="ph-fill ph-seal-check" />RD</span>}
                  </div>
                  <div className="dtitle">{v.name}</div>
                  <div className="fine"><span className="price">{v.priceStr}</span> · {v.tag}</div>
                </div>
                <DishImg v={v} />
              </div>
              <div className="ribbon cmp mt10" role="group" aria-label={v.aria}>
                <div className="rc"><span className="rl">KCAL</span><span className="rv sf">{v.k}</span></div>
                <div className="rc"><span className="rl">PROTEIN</span><span className="rv">{v.p}<i className="ru">g</i></span></div>
                <div className="rc"><span className="rl">CARBS</span><span className="rv">{v.c}<i className="ru">g</i></span></div>
                <div className="rc"><span className="rl">FAT</span><span className="rv">{v.f}<i className="ru">g</i></span></div>
              </div>
            </Link>
          ))}
          {views.length === 0 && (
            <div className="tc" style={{ padding: "40px 20px" }}>
              <div className="tt mt10">Nothing matches those filters</div>
              <button className="btn btn-g mt20" onClick={() => { setPill("All"); setVeg(false); }}>Clear filters</button>
            </div>
          )}
          <div style={{ height: 24 }} />
        </div>
      </div>
    </div>
  );
}
