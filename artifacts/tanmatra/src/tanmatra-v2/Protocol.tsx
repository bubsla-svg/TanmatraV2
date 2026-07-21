import { useMemo } from "react";
import { Link } from "react-router";
import { F } from "./data";
import { useMenuCatalog, type DishData } from "@/lib/menuData";
import { dishesForProtocol, plansForProtocol, rdsForProtocol } from "@/lib/protocols";
import { RD_PLANS } from "@/lib/rdPlans";
import { RD_BOOKING } from "@/lib/rdBookingData";
import { TEAM } from "@/lib/teamData";
import { useEnableClinicalMode } from "@/lib/clinicalDiet";
import MedicalDisclaimer from "@/components/v2/MedicalDisclaimer";

/* Full-parity re-port of the System-A protocol landings (Performance 322 /
 * Clinical 389, git 2507084) into v2. Reuses dishesForProtocol /
 * plansForProtocol / rdsForProtocol + TEAM; Clinical enables clinical mode. */

type Key = "wellness" | "performance" | "clinical";

const CFG: Record<Key, {
  name: string; accent: string; accentBg: string; icon: string; headline: string; accentWord: string; desc: string;
  pillars: { icon: string; title: string; desc: string }[];
  featuredLabel: string; featuredSub: string; sort: (d: DishData[]) => DishData[]; dishBadge: (d: DishData) => string;
  heroImg?: string;
}> = {
  performance: {
    name: "Performance Protocol", accent: "var(--color-nn-tertiary)", accentBg: "color-mix(in srgb, var(--color-nn-tertiary) 12%, transparent)", icon: "ph-lightning",
    headline: "Athletic nutrition for", accentWord: "peak output",
    desc: "Evidence-based sports nutrition engineered for muscle protein synthesis, glycogen replenishment and rapid recovery. Macro ratios validated by exercise-physiology research.",
    pillars: [
      { icon: "ph-trend-up", title: "Muscle protein synthesis", desc: "Leucine-rich protein delivering 2.5g+ leucine per meal to trigger the mTOR pathway." },
      { icon: "ph-timer", title: "Glycogen replenishment", desc: "Strategic carbohydrate timing — high-GI post-workout, complex pre-workout." },
      { icon: "ph-lightning", title: "Recovery acceleration", desc: "Tart cherry, turmeric and omega-3 to reduce exercise-induced muscle damage." },
    ],
    featuredLabel: "Top protein-dense picks", featuredSub: "Highest-protein dishes that pass the Performance criteria (≥18g protein).",
    sort: (d) => [...d].sort((a, b) => b.macros.protein - a.macros.protein).slice(0, 4),
    dishBadge: (d) => `${d.macros.protein}g protein`,
    heroImg: "/dishes/buddha-bowl.jpg",
  },
  clinical: {
    name: "Clinical Protocol", accent: "var(--tnm-action)", accentBg: "var(--safd)", icon: "ph-heartbeat",
    headline: "Therapeutic nutrition,", accentWord: "RD-supervised",
    desc: "Evidence-based medical nutrition therapy for diabetes, cardiovascular, renal and post-surgical recovery — precise nutrient restrictions, every menu RD-signed.",
    pillars: [
      { icon: "ph-syringe", title: "Condition-specific", desc: "Formulated for diabetes, cardiovascular, renal and post-surgical protocols with precise nutrient restrictions." },
      { icon: "ph-heartbeat", title: "Care-team friendly", desc: "Weekly plans and nutrition labels you can share with your doctor or dietitian." },
      { icon: "ph-dna", title: "Evidence-based", desc: "Grounded in peer-reviewed clinical trials and ADA/ESC guidelines." },
    ],
    featuredLabel: "Lowest-sugar clinical picks", featuredSub: "Dishes passing the Clinical criteria, sorted by lowest sugar per serving.",
    sort: (d) => [...d].sort((a, b) => (parseFloat(a.sugarPerServing) || 0) - (parseFloat(b.sugarPerServing) || 0)).slice(0, 4),
    dishBadge: (d) => `GI ${d.glycaemicIndex}`,
  },
  wellness: {
    name: "Wellness Protocol", accent: "var(--color-clinical-sage)", accentBg: "color-mix(in srgb, var(--color-clinical-sage) 12%, transparent)", icon: "ph-leaf",
    headline: "Preventive nutrition for", accentWord: "everyday vitality",
    desc: "Balanced, RD-portioned meals for daily energy, immunity and gut health.",
    pillars: [
      { icon: "ph-leaf", title: "Anti-inflammatory", desc: "Micronutrient-dense plates that prioritise anti-inflammatory compounds." },
      { icon: "ph-plant", title: "Gut health", desc: "12g+ fibre per meal to support a healthy microbiome." },
      { icon: "ph-heart", title: "Sustainable", desc: "Under 400 avg kcal — habits you can keep." },
    ],
    featuredLabel: "Wellness-aligned picks", featuredSub: "High-fibre, low-glycaemic plates.",
    sort: (d) => [...d].slice(0, 4),
    dishBadge: (d) => `${d.macros.fiber}g fibre`,
  },
};

function EnableClinical() { useEnableClinicalMode(); return null; }

export default function V2Protocol({ which }: { which: Key }) {
  const cfg = CFG[which];
  const { dishes } = useMenuCatalog();
  const qualifying = useMemo(() => dishesForProtocol(dishes as any, which), [dishes, which]);
  const featured = useMemo(() => cfg.sort(qualifying), [qualifying, cfg]);
  const plans = useMemo(() => plansForProtocol(RD_PLANS, which), [which]);
  const rds = useMemo(() => rdsForProtocol(RD_BOOKING, which), [which]);
  const teamBySlug = useMemo(() => new Map(TEAM.map((m: any) => [m.slug, m])), []);
  const samplePlan: any = plans[0];
  const heroImg = cfg.heroImg ?? featured[0]?.image;

  return (
    <div className="tnm2 nn min-h-dvh bg-[var(--tnm-surface-ink)] text-white antialiased">
      {which === "clinical" && <EnableClinical />}
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="content" style={{ paddingBottom: 24 }}>
          {/* Hero */}
          <div className="plc" style={{ minHeight: 260, backgroundImage: heroImg ? `url(${heroImg})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
            <div className="herograd" />
            <div className="posabs" style={{ top: 12, left: 16, zIndex: 2 }}><Link className="glass" to="/challenges" aria-label="Community"><i className="ph-bold ph-arrow-left" /></Link></div>
            <div className="posabs padx" style={{ left: 0, right: 0, bottom: 16, zIndex: 2 }}>
              <span className="pill" style={{ background: cfg.accentBg, color: cfg.accent }}><i className={`ph-fill ${cfg.icon}`} /> {cfg.name}</span>
              <h1 className="disp mt10" style={{ fontSize: 26, color: "white" }}>{cfg.headline} <span style={{ color: cfg.accent }}>{cfg.accentWord}</span></h1>
            </div>
          </div>

          <div className="padx" style={{ paddingTop: 16 }}>
            <p className="small mut">{cfg.desc}</p>

            {/* Stat strip */}
            {qualifying.length > 0 && plans.length > 0 && rds.length > 0 && (
              <div className="trust mt14">
                <div className="tcell"><div className="tn" style={{ color: cfg.accent }}>{qualifying.length}</div><div className="ttx">Qualifying dishes</div></div>
                <div className="tcell"><div className="tn" style={{ color: cfg.accent }}>{plans.length}</div><div className="ttx">RD plans</div></div>
                <div className="tcell"><div className="tn" style={{ color: cfg.accent }}>{rds.length}</div><div className="ttx">Specialist RDs</div></div>
              </div>
            )}

            <div className="fx ac gap8 mt14">
              <Link className="btn btn-p f1" to={`/menu?protocol=${which}`} style={{ background: cfg.accent, color: "var(--color-ink-900)" }}><i className="ph-bold ph-fork-knife" /> See dishes</Link>
              <Link className="btn btn-g f1" to={`/plans?protocol=${which}`}><i className="ph-bold ph-calendar-dots" /> Plans</Link>
            </div>

            {/* Pillars */}
            <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50 mt20 mb10">The science</div>
            {cfg.pillars.map((p) => (
              <div key={p.title} className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10 fx gap12">
                <div className="dic" style={{ color: cfg.accent, background: cfg.accentBg }}><i className={`ph-bold ${p.icon}`} /></div>
                <div className="f1"><div className="small" style={{ fontWeight: 600 }}>{p.title}</div><div className="fine mt2">{p.desc}</div></div>
              </div>
            ))}

            {/* Featured dishes */}
            <div className="secrow" style={{ padding: 0 }}><span className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50">{cfg.featuredLabel}</span><Link to={`/menu?protocol=${which}`} className="fine" style={{ color: cfg.accent }}>All {qualifying.length} →</Link></div>
            <div className="fine mb10">{cfg.featuredSub}</div>
            {featured.length === 0 ? (
              <div className="fine">No qualifying dishes are live right now — check back soon.</div>
            ) : featured.map((meal: any) => (
              <Link key={meal.id} to={`/dish/${meal.slug}`} className="fx ac gap12" style={{ padding: "9px 0", borderBottom: "1px solid var(--ln)" }}>
                <div className="dimg" style={{ width: 52, height: 52, borderRadius: 9, backgroundImage: `url(${meal.image})`, backgroundSize: "cover", backgroundPosition: "center", flex: "none" }} />
                <div className="f1" style={{ minWidth: 0 }}>
                  <div className="small clamp1" style={{ fontWeight: 500 }}>{meal.name}</div>
                  <div className="mono fntc" style={{ fontSize: 10.5 }}>{meal.macros.calories} kcal · {cfg.dishBadge(meal)}</div>
                </div>
                <span className="price" style={{ fontSize: 13, color: cfg.accent }}>{F(meal.price)}</span>
              </Link>
            ))}

            {/* Plans */}
            {plans.length > 0 && (
              <>
                <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50 mt20 mb10">{cfg.name.split(" ")[0]} RD plans</div>
                {plans.map((plan: any) => (
                  <Link key={plan.slug} to={`/plans/${plan.slug}`} className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10" style={{ display: "block" }}>
                    <div className="fx ac jb"><span className="pill" style={{ background: cfg.accentBg, color: cfg.accent }}>{plan.calorieTargetPerDay} kcal · {plan.proteinTargetGrams}g</span><span className="price" style={{ color: cfg.accent }}>{F(plan.pricePerWeekPaise)}<span className="fntc" style={{ fontSize: 10 }}>/wk</span></span></div>
                    <div className="tt mt6" style={{ fontSize: 15 }}>{plan.name}</div>
                    <div className="fine mt2 clamp1">{plan.tagline}</div>
                  </Link>
                ))}
              </>
            )}

            {/* RDs */}
            {rds.length > 0 && (
              <>
                <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-white/50 mt20 mb10">Talk to a {cfg.name.split(" ")[0].toLowerCase()} RD</div>
                {rds.map((rd: any) => {
                  const m: any = teamBySlug.get(rd.slug);
                  return (
                    <div key={rd.slug} className="rounded-2xl bg-[var(--tnm-surface-ink-2)] border border-white/[0.08] shadow-[0_8px_32px_color-mix(in_srgb,black_40%,transparent)] p-4 mb10">
                      <div className="fx ac gap12">
                        <span className="avatar" style={{ background: cfg.accentBg, color: cfg.accent }}>{m?.initials ?? "RD"}</span>
                        <div className="f1" style={{ minWidth: 0 }}><div className="small" style={{ fontWeight: 600 }}>{m?.name ?? rd.slug}</div><div className="fine">{m?.title}</div></div>
                      </div>
                      <div className="fine mt6"><i className="ph-bold ph-stethoscope" style={{ color: cfg.accent }} /> {rd.specialties.join(" · ")}</div>
                      <Link to={`/rd/${rd.slug}`} className="btn btn-g btn-blk mt10">Book — first 15 min free <i className="ph-bold ph-arrow-right" /></Link>
                    </div>
                  );
                })}
              </>
            )}

            <div className="note mt14"><i className="ph-bold ph-seal-check" />An RD signs this menu and screens every dish against your allergens.</div>
          </div>
        </div>

        {/* Closing CTA dock */}
        <div className="dock">
          {samplePlan ? (
            <Link className="btn btn-p btn-lg btn-blk" to={`/subscribe?plan=${samplePlan.slug}`} style={{ background: cfg.accent, color: "var(--color-ink-900)" }}>Start {samplePlan.name} <i className="ph-bold ph-arrow-right" /></Link>
          ) : (
            <Link className="btn btn-p btn-lg btn-blk" to={`/subscribe?plan=${which}`} style={{ background: cfg.accent, color: "var(--color-ink-900)" }}>Start {cfg.name} <i className="ph-bold ph-arrow-right" /></Link>
          )}
          <MedicalDisclaimer />
        </div>
      </div>
    </div>
  );
}
