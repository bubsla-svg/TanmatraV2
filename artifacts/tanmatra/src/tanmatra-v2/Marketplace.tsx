import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { marketplaceApi, type MarketplaceCategory } from "@/lib/marketplaceApi";
import { formatPrice } from "@/lib/api/adapter";

const CATEGORIES: Array<{ value: "all" | MarketplaceCategory; label: string }> = [
  { value: "all", label: "All" },
  { value: "oils", label: "Oils" },
  { value: "sauces", label: "Sauces" },
  { value: "supplements", label: "Supplements" },
  { value: "snacks", label: "Snacks" },
  { value: "pantry", label: "Pantry" },
];

export default function V2Marketplace() {
  const [category, setCategory] = useState<"all" | MarketplaceCategory>("all");
  const q = useQuery({
    queryKey: ["marketplace", "items", category],
    queryFn: () => marketplaceApi.listItems(category),
    staleTime: 60_000,
  });
  const items: any[] = q.data?.items ?? [];

  return (
    <div className="tnm2 nn" style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Marketplace</div>
          <Link className="iconbtn" to="/orders" title="My orders" aria-label="My orders"><i className="ph-bold ph-bag" /></Link>
        </div>

        <div className="padx" style={{ paddingBottom: 4 }}>
          <span className="pill sg"><i className="ph-fill ph-sparkle" />RD-curated pantry</span>
          <h1 className="h2 mt10" style={{ color: "var(--tx)" }}>The Tanmatra Marketplace</h1>
          <p className="fine mt6">Single-origin oils, small-batch sauces, supplements and pantry staples — hand-picked by our registered dietitians. Ship to you, or bundle with your next meal delivery.</p>
        </div>

        <div className="chiprow mt10">
          {CATEGORIES.map((c) => (
            <button key={c.value} className={category === c.value ? "chip on" : "chip"} onClick={() => setCategory(c.value)}>{c.label}</button>
          ))}
        </div>

        <div className="content padx" style={{ paddingTop: 4, paddingBottom: 24 }}>
          {q.isLoading ? (
            <>
              <div className="fine mb10">Loading pantry…</div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="dcard">
                  <div className="fx gap12">
                    <div className="skel" style={{ width: 92, height: 92, borderRadius: 10, flex: "none" }} />
                    <div className="f1">
                      <div className="skel" style={{ height: 11, width: "35%", marginBottom: 10 }} />
                      <div className="skel" style={{ height: 15, width: "80%", marginBottom: 10 }} />
                      <div className="skel" style={{ height: 11, width: "60%" }} />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : q.isError ? (
            <div className="tc" style={{ padding: "44px 20px" }}>
              <i className="ph-bold ph-warning-circle" style={{ fontSize: 32, color: "var(--dgr)" }} />
              <div className="tt mt10">Couldn't load the pantry</div>
              <div className="fine mt6">Check your connection and try again.</div>
              <button className="btn btn-g mt20" onClick={() => q.refetch()}>Retry</button>
            </div>
          ) : items.length === 0 ? (
            <div className="tc" style={{ padding: "44px 20px" }}>
              <i className="ph-bold ph-package" style={{ fontSize: 32, color: "var(--safb)" }} />
              <div className="tt mt10">No items on this shelf yet</div>
              <div className="fine mt6">Our RDs are still curating this category.</div>
              <button className="btn btn-g mt20" onClick={() => setCategory("all")}>Browse the full pantry</button>
            </div>
          ) : (
            <>
              <div className="fine mb10">{items.length} {items.length === 1 ? "item" : "items"} · look for the RD badge on dietitian-reviewed picks</div>
              {items.map((item) => {
                const lowStock = item.stockQty < 10 && item.stockQty > 0;
                return (
                  <Link key={item.id} className="dcard pointer" to={`/marketplace/${item.slug}`} style={{ display: "block" }}>
                    <div className="fx gap12">
                      {item.image ? (
                        <div className="dimg" style={{ backgroundImage: `url(${item.image})`, backgroundSize: "cover", backgroundPosition: "center" }} role="img" aria-label={item.name} />
                      ) : (
                        <div className="dimg plc" role="img" aria-label={item.name}><span className="plccap">No image</span></div>
                      )}
                      <div className="f1" style={{ minWidth: 0 }}>
                        <div className="fx ac g6" style={{ minHeight: 20 }}>
                          {lowStock &&<span className="pill" style={{ marginLeft: "auto", background: "color-mix(in oklab, var(--color-error) 16%, transparent)", color: "var(--color-error)" }}>Only {item.stockQty} left</span>}
                        </div>
                        <div className="dtitle">{item.name}</div>
                        <p className="fine" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.description}</p>
                        <div className="fine mt6">
                          <span className="price safc">{formatPrice(item.pricePaise)}</span>
                          {item.weightLabel && <> · {item.weightLabel}</>}
                          {item.supplierName && <> · {item.supplierName}</>}
                        </div>
                        {item.badges.length > 0 && (
                          <div className="fx wrap g6 mt6">
                            {item.badges.slice(0, 3).map((b: string) => (
                              <span key={b} className="gi gi-med">{b}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}

              <div className="card mt14 fx ac gap12">
                <span className="dic"><i className="ph-bold ph-bag" /></span>
                <span className="f1">
                  <span className="small" style={{ fontWeight: 600, display: "block" }}>Got a meal order coming?</span>
                  <span className="fine">Bundle pantry items with your next delivery and skip the shipping fee.</span>
                </span>
                <Link className="btn btn-g" to="/orders" aria-label="My orders"><i className="ph-bold ph-arrow-right" /></Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
