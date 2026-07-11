import { Link, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/analytics";
import { F } from "./data";
import { useOrders } from "@/lib/ordersContext";
import { useCart, useCartDrawer } from "@/lib/cartContext";
import { useMenuCatalog, type DishData } from "@/lib/menuData";
import { TEAM } from "@/lib/teamData";
import { useChallenges } from "@/lib/contentApi";
import { isSecondaryVariant } from "@/lib/dishEnrichment";
import { WeeklySummaryCard } from "@/components/wellness/WeeklySummaryCard";
import IntakeQuiz from "@/components/preferences/IntakeQuiz";
import TrustHeader from "@/components/home/TrustHeader";
import HeroCarousel from "@/components/home/HeroCarousel";
import CategoryBadges from "@/components/home/CategoryBadges";
import AssessmentNudge from "@/components/home/AssessmentNudge";
import MetaDishCard from "@/components/home/MetaDishCard";
import MedicalDisclaimer from "@/components/v2/MedicalDisclaimer";
import { toast } from "sonner";
import { localDishSrcset, getLocalDishFallback } from "@/lib/imgSrcset";
import { onDishImageError } from "@/lib/imgFallback";

/* Full-parity re-port of the System-A Home (git 2507084, 955 lines) into v2. */

const TRUST_SIGNALS = [
  { icon: "ph-shield-check", label: "FSSAI Lic. 22725926001018", sub: "ISO 22000 certified kitchen · audit-trailed sourcing" },
  { icon: "ph-seal-check", label: "RD Advisory Board Verified", sub: "Every recipe reviewed by a registered dietitian" },
  { icon: "ph-microscope", label: "Macro-nutrient transparency", sub: "Calories, protein, carbs, fat, GI on every dish" },
  { icon: "ph-brain", label: "Personalised to your goals", sub: "Plans tuned to your activity, allergens & preferences" },
];

const HOW_STEPS = [
  { icon: "ph-clipboard-text", step: "01", title: "RDs design every dish", desc: "Registered dietitians formulate each recipe around a therapeutic goal — blood sugar, protein synthesis, anti-inflammation. Not taste-first." },
  { icon: "ph-seal-check", step: "02", title: "Your profile shapes the menu", desc: "Take the 60-second metabolic assessment and the menu re-ranks around your goal, restrictions and macros." },
  { icon: "ph-bicycle", step: "03", title: "Delivered fresh in 25–40 min", desc: "Prepared to order in ISO 22000 kitchens and dispatched the moment your order is confirmed, across Delhi NCR." },
];

const PLANS = [
  { slug: "weight-loss-jumpstart", name: "Weight-Loss Jumpstart", desc: "1500 kcal, low-GI, fibre-forward. Lose weight without constant hunger spikes.", price: "₹5,490 / week", details: "1500 kcal · 90g protein · 25g+ fiber", badge: "Weight Loss" },
  { slug: "lean-muscle-builder", name: "Lean Muscle Builder", desc: "2400 kcal, 160g protein. Fuel muscle growth and accelerate recovery.", price: "₹7,490 / week", details: "2400 kcal · 160g protein · recovery-focused", badge: "Lean Muscle" },
  { slug: "pcos-balance", name: "PCOS Hormone Balance", desc: "Anti-inflammatory, low-GI, omega-3 forward. Manage insulin resistance.", price: "₹5,990 / week", details: "1700 kcal · 100g protein · hormone balance", badge: "Hormone Health" },
];

const PROTOCOLS = [
  { id: "wellness", title: "Wellness Protocol", subtitle: "Preventive & longevity nutrition", icon: "ph-heartbeat", features: ["Anti-inflammatory", "12g+ fiber/meal", "<400 avg kcal", "Gut-health optimized"] },
  { id: "performance", title: "Performance Protocol", subtitle: "Athletic & recovery nutrition", icon: "ph-lightning", features: ["2.5g+ leucine/meal", "3:1 carb:protein", "40g+ protein/meal", "Tart-cherry recovery"] },
  { id: "clinical", title: "Clinical Protocol", subtitle: "Therapeutic & condition-specific", icon: "ph-dna", features: ["RD-designed menu", "Keto-friendly options ≤15g net carbs", "ADA-guideline informed", "Designed with your RD"] },
];

const QUICK = [
  { to: "/menu", label: "Menu", icon: "ph-fork-knife" },
  { to: "/meal-planner", label: "Plan", icon: "ph-calendar-dots" },
  { to: "/wellness", label: "Track", icon: "ph-activity" },
  { to: "/rd", label: "Book RD", icon: "ph-hand-heart" },
];

type Daypart = "breakfast" | "lunch" | "dinner";
function currentDaypart(): Daypart {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  return "dinner";
}
const DAYPART_META: Record<Daypart, { label: string; sub: string; icon: string; categories: string[] }> = {
  breakfast: { label: "Good morning — built for breakfast", sub: "High-protein starts and energizing smoothies.", icon: "ph-sun", categories: ["breakfast", "beverages"] },
  lunch: { label: "Lunch picks for right now", sub: "Balanced bowls, salads and warm comfort under 700 kcal.", icon: "ph-sun-horizon", categories: ["bowls", "salads", "wraps", "soups", "pasta"] },
  dinner: { label: "Tonight's lighter options", sub: "Lighter proteins, soups and slow-digesting carbs.", icon: "ph-moon", categories: ["soups", "salads", "mains", "bowls"] },
};

export default function V2Home() {
  const navigate = useNavigate();
  const { orders } = useOrders();
  const { addItem } = useCart();
  const { open: openCart } = useCartDrawer();
  const [quizOpen, setQuizOpen] = useState(false);

  useEffect(() => { track("view_home"); }, []);

  const reorderRail = useMemo(() => orders.slice(0, 3), [orders]);
  const { data: challenges } = useChallenges();
  const featuredChallenge = useMemo(() => {
    if (!challenges) return null;
    const now = Date.now();
    const live = challenges.filter((c: any) => new Date(c.endsAt).getTime() > now && c.featured > 0);
    return (live[0] ?? challenges[0]) ?? null;
  }, [challenges]);

  const daypart = currentDaypart();
  const daypartMeta = DAYPART_META[daypart];
  const { dishes: catalogDishes } = useMenuCatalog();
  const daypartDishes = useMemo(
    () => catalogDishes.filter((d: any) => d.isAvailable && daypartMeta.categories.includes(d.category) && !isSecondaryVariant(d.slug)).slice(0, 6),
    [daypartMeta, catalogDishes],
  );
  const featured = useMemo(
    () => catalogDishes.filter((d: any) => d.isAvailable && d.rdVerified && !isSecondaryVariant(d.slug)).slice(0, 6),
    [catalogDishes],
  );

  const quickAdd = (item: DishData) => {
    addItem({
      dishId: item.id, slug: item.slug, name: item.name, image: item.image,
      basePrice: item.price, unitPrice: item.price, quantity: 1,
      kitchen: item.kitchen, isVeg: item.isVeg, rdVerified: item.rdVerified,
      macros: item.macros, customizations: [],
    });
    openCart();
    toast.success(`Added ${item.name} to your order`, { action: { label: "View cart", onClick: () => navigate("/cart") } });
  };

  const rdCount = TEAM.filter((m: any) => m.role === "rd").length;

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* ── Zomato-style conversion funnel ─────────────────────────────── */}

        {/* Viewport 1 — Trust header (location · search · veg-only) */}
        <TrustHeader />

        {/* Viewport 2 — Hero offer carousel (real 25% first-order offer) */}
        <div className="mt14"><HeroCarousel /></div>

        {/* Viewport 3 — Circular category badges → real Menu deep-links */}
        <div className="mt16"><CategoryBadges /></div>

        {/* Order again — hoisted for returning customers; hidden for new visitors */}
        {reorderRail.length > 0 && (
          <>
            <div className="secrow"><span className="sh"><i className="ph-bold ph-arrows-clockwise" style={{ color: "var(--safb)" }} /> Order again</span><Link to="/orders" className="fine" style={{ color: "var(--safb)" }}>All →</Link></div>
            <div className="hrail">
              {reorderRail.map((order: any) => (
                <div key={order.orderId} className="hcard" style={{ width: 210, padding: 12 }}>
                  <div className="fx ac jb"><span className="mono" style={{ fontSize: 10, color: "var(--safb)" }}>{order.orderId}</span><span className="pill" style={{ fontSize: 9, textTransform: "capitalize" }}>{order.status.replace(/_/g, " ")}</span></div>
                  <div className="fine mt2">{order.items.length} item{order.items.length === 1 ? "" : "s"} · {F(order.total)}</div>
                  <div className="fx g6 mt6">
                    {order.items.slice(0, 3).map((it: any) => <div key={it.lineId} className="plc" style={{ width: 40, height: 40, borderRadius: 8, backgroundImage: `url(${it.image})`, backgroundSize: "cover" }} />)}
                  </div>
                  <button
                    className="btn btn-s btn-blk mt10"
                    style={{ height: 36 }}
                    onClick={() => {
                      order.items.forEach((it: any) => addItem({ dishId: it.dishId, slug: it.slug, name: it.name, image: it.image, basePrice: it.basePrice, unitPrice: it.unitPrice, quantity: it.quantity, kitchen: it.kitchen, isVeg: it.isVeg, rdVerified: it.rdVerified, macros: it.macros, customizations: it.customizations }));
                      toast.success(`${order.items.length} item${order.items.length === 1 ? "" : "s"} added`, { action: { label: "View cart", onClick: () => navigate("/cart") } });
                    }}
                  >
                    <i className="ph-bold ph-arrows-clockwise" /> Reorder
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Viewport 4 — Ambient assessment nudge (opens the real IntakeQuiz) */}
        <div className="mt16"><AssessmentNudge onStart={() => setQuizOpen(true)} /></div>

        {/* Viewport 5 — Zomato-style meta cards (featured RD-verified dishes) */}
        {featured.length > 0 && (
          <>
            <div className="secrow"><span className="sh">Fresh picks near you</span><Link to="/menu" className="fine" style={{ color: "var(--safb)" }}>Full menu →</Link></div>
            <div className="padx">
              {featured.map((d: any) => (
                <MetaDishCard key={d.id} dish={d} onAdd={quickAdd} />
              ))}
            </div>
          </>
        )}

        {/* ── Deeper CUJ sections (preserved) ────────────────────────────── */}

        {/* Trust stats */}
        <div className="padx mt16">
          <div className="trust">
            <div className="tcell"><div className="tn">{rdCount}</div><div className="ttx">Registered Dietitians</div></div>
            <div className="tcell"><div className="tn">100%</div><div className="ttx">Macros &amp; allergens disclosed</div></div>
            <div className="tcell"><div className="tn">FSSAI</div><div className="ttx">Licensed · ISO 22000</div></div>
          </div>
        </div>

        {/* Quick start */}
        <div className="padx mt16">
          <div className="lab mb10">Quick start</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            {QUICK.map((q) => (
              <Link key={q.to} to={q.to} className="tc" style={{ padding: "12px 4px", borderRadius: 12, background: "var(--s1)", border: "1px solid var(--ln)" }}>
                <div className="dic" style={{ margin: "0 auto 6px" }}><i className={`ph-bold ${q.icon}`} /></div>
                <div className="fine" style={{ color: "var(--tx)", fontSize: 11 }}>{q.label}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Trust signals */}
        <div className="padx mt16">
          {TRUST_SIGNALS.map((s) => (
            <div key={s.label} className="fx gap12 mb10">
              <div className="dic" style={{ color: "var(--safb)" }}><i className={`ph-bold ${s.icon}`} /></div>
              <div className="f1"><div className="small" style={{ fontWeight: 600 }}>{s.label}</div><div className="fine">{s.sub}</div></div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="secrow"><span className="sh">Not just a meal — a protocol on a plate</span></div>
        <div className="padx">
          {HOW_STEPS.map((s) => (
            <div key={s.step} className="card mb10 fx gap12">
              <div className="dic" style={{ color: "var(--safb)" }}><i className={`ph-bold ${s.icon}`} /></div>
              <div className="f1"><div className="lab">{s.step}</div><div className="small" style={{ fontWeight: 600 }}>{s.title}</div><div className="fine mt2">{s.desc}</div></div>
            </div>
          ))}
          <Link to="/clinical" className="fine tc" style={{ color: "var(--safb)", display: "block" }}>See our clinical protocols →</Link>
        </div>

        {/* Subscription plans */}
        <div className="secrow"><span className="sh">Never plan lunch again</span><Link to="/plans" className="fine" style={{ color: "var(--safb)" }}>All plans →</Link></div>
        <div className="padx">
          {PLANS.map((p) => (
            <div key={p.slug} className="card mb10">
              <div className="fx ac jb"><span className="pill" style={{ background: "var(--safd)", color: "var(--safb)" }}>{p.badge}</span><span className="mono fntc" style={{ fontSize: 12 }}>{p.price}</span></div>
              <div className="tt mt6" style={{ fontSize: 15 }}>{p.name}</div>
              <div className="fine mt2">{p.desc}</div>
              <div className="mono mt6" style={{ fontSize: 11, color: "var(--safb)" }}>{p.details}</div>
              <Link to={`/subscribe?plan=${p.slug}`} className="btn btn-s btn-blk mt10">Subscribe &amp; save</Link>
            </div>
          ))}
          <Link to="/subscribe?trial=1" className="btn btn-p btn-blk mt6">Start 3-day trial — 25% off <i className="ph-bold ph-arrow-right" /></Link>
        </div>

        {/* Cohort challenge */}
        {featuredChallenge && (
          <div className="padx mt16">
            <Link to={`/challenges/${featuredChallenge.slug}`} className="card" style={{ display: "block", padding: 0, overflow: "hidden" }}>
              {featuredChallenge.image && <div className="plc" style={{ height: 140, backgroundImage: `url(${featuredChallenge.image})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
              <div style={{ padding: 14 }}>
                <div className="lab"><i className="ph-bold ph-flag" style={{ color: "var(--safb)" }} /> Cohort challenge</div>
                <div className="h2 mt6" style={{ fontSize: 18 }}>{featuredChallenge.title}</div>
                <div className="fine mt6">{featuredChallenge.tagline}</div>
                <div className="fx ac g6 wrap mt6">
                  <span className="mono fntc" style={{ fontSize: 11 }}><i className="ph-bold ph-calendar-dots" /> {featuredChallenge.durationDays} days</span>
                  <span className="mono fntc" style={{ fontSize: 11 }}><i className="ph-bold ph-users" /> {featuredChallenge.memberCount} joined</span>
                  <span className="fine">Led by {featuredChallenge.rdName}</span>
                </div>
                <div className="btn btn-p mt10">Join the cohort <i className="ph-bold ph-arrow-right" /></div>
              </div>
            </Link>
          </div>
        )}

        {/* Wellness weekly summary (reused, self-contained) */}
        <div className="padx mt16"><WeeklySummaryCard /></div>

        {/* Time-of-day rail */}
        {daypartDishes.length > 0 && (
          <>
            <div className="secrow"><span className="sh"><i className={`ph-bold ${daypartMeta.icon}`} style={{ color: "var(--safb)" }} /> {daypartMeta.label}</span><Link to="/menu" className="fine" style={{ color: "var(--safb)" }}>Menu →</Link></div>
            <div className="hrail">
              {daypartDishes.map((d: any) => (
                <div key={d.id} className="hcard">
                  <Link to={`/dish/${d.slug}`}>
                    <div className="himg plc" style={{ position: "relative", overflow: "hidden" }}>
                      <picture>
                        <source srcSet={localDishSrcset(d.image, "avif")} type="image/avif" />
                        <source srcSet={localDishSrcset(d.image, "webp")} type="image/webp" />
                        <img
                          src={getLocalDishFallback(d.image, 200)}
                          srcSet={localDishSrcset(d.image, "jpg")}
                          sizes="152px"
                          width="152"
                          height="88"
                          loading="lazy"
                          decoding="async"
                          alt={d.name}
                          onError={onDishImageError}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </picture>
                    </div>
                  </Link>
                  <div className="hbody">
                    <div className="fx ac g6 mb4"><span className={d.isVeg ? "vd" : "vd nv"} />{d.rdVerified && <span className="pill sg" style={{ padding: "2px 6px" }}><i className="ph-fill ph-seal-check" /></span>}</div>
                    <Link to={`/dish/${d.slug}`} className="small clamp1" style={{ fontWeight: 600, display: "block" }}>{d.name}</Link>
                    <div className="fx ac jb mt6"><span className="price" style={{ fontSize: 13, color: "var(--safb)" }}>{F(d.price)}</span><button className="qbtn" onClick={() => quickAdd(d)} aria-label={`Add ${d.name}`}><i className="ph-bold ph-plus" /></button></div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Protocols */}
        <div className="secrow"><span className="sh">Clinical nutrition programs</span></div>
        <div className="padx">
          {PROTOCOLS.map((p) => (
            <Link key={p.id} to={`/${p.id}`} className="card mb10" style={{ display: "block" }}>
              <div className="fx ac gap12">
                <div className="dic" style={{ color: "var(--safb)" }}><i className={`ph-bold ${p.icon}`} /></div>
                <div className="f1"><div className="tt" style={{ fontSize: 15 }}>{p.title}</div><div className="fine">{p.subtitle}</div></div>
                <i className="ph-bold ph-caret-right" style={{ color: "var(--fnt)" }} />
              </div>
              <div className="fx ac g6 wrap mt10">
                {p.features.map((f) => <span key={f} className="pill" style={{ fontSize: 10 }}><i className="ph-bold ph-check" />{f}</span>)}
              </div>
            </Link>
          ))}
        </div>

        {/* Final CTA */}
        <div className="padx mt16 mb20 tc">
          <div className="h2">Ready to begin your <span style={{ color: "var(--safb)" }}>clinical nutrition journey</span>?</div>
          <div className="fine mt6" style={{ maxWidth: 320, margin: "6px auto 0" }}>Take the 60-second metabolic assessment for a plan calibrated to your BMR, TDEE and goals.</div>
          <button className="btn btn-p mt14" onClick={() => setQuizOpen(true)}><i className="ph-bold ph-activity" /> Start assessment</button>
        </div>

        {/* Medical disclaimer — v2 pages have no legacy footer, so mount it here. */}
        <div className="padx mb20"><MedicalDisclaimer compact /></div>
      </div>

      {/* The real 60-second metabolic assessment — re-ranks the menu by goal + macros. */}
      <IntakeQuiz open={quizOpen} onOpenChange={setQuizOpen} />
    </div>
  );
}
