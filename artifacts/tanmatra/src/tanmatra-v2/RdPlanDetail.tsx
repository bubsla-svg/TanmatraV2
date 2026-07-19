import { useMemo } from "react";
import { Link, useParams, Navigate } from "react-router";
import { PLAN_FROM_PRICE_PER_WEEK_PAISE,
  getRdPlanBySlug,
  resolvePlanWeek,
  getRdAuthor,
  getPlanConflicts,
  PLAN_GOAL_LABEL,
} from "@/lib/rdPlans";
import { usePreferences } from "@/lib/preferencesContext";
import { F } from "./data";
import MedicalDisclaimer from "@/components/v2/MedicalDisclaimer";

const INCLUDED = [
  { n: "01", t: "Clinical Calorie Mapping", d: "Every meal is weighed and measured to match your daily calorie and macro goals exactly. No guesswork." },
  { n: "02", t: "RD-Curated Swaps", d: "Our dietitians map swaps automatically if any selected dish conflicts with your declared allergens." },
  { n: "03", t: "Premium Protein Sources", d: "High-quality lean meats, fish, paneer, and plant-based protein blends to match recovery targets." },
  { n: "04", t: "Fresh Prep SLA", d: "Prepared in clean, isolated kitchen lanes under strict temperature and packaging controls." },
];

const BENEFITS = [
  { t: "Dietitian Consult Included", d: "Get direct feedback and adjustments from your registered dietitian every week." },
  { t: "Zero Binding Contracts", d: "Pause, resume, or cancel your deliveries at any time from your subscription dashboard." },
  { t: "Serviceable Noida Delivery", d: "Locked-in morning and evening slots delivered via temperature-controlled logistics." },
  { t: "100% Clean Ingredients", d: "No artificial preservatives, no refined sugar, and zero hidden seed oils." },
  { t: "Allergen Safety Automated", d: "Our backend filters out unreviewed dishes and swaps allergens to protect your health." },
  { t: "Fresh Cooking Protocols", d: "Never frozen. Cooked from scratch using organic ingredients daily." },
];

export default function V2RdPlanDetail() {
  const { slug = "" } = useParams<{ slug: string }>();
  const plan = getRdPlanBySlug(slug);
  const { preferences } = usePreferences();

  const week = useMemo(() => (plan ? resolvePlanWeek(plan) : []), [plan]);
  const conflicts = useMemo(
    () => (plan ? getPlanConflicts(plan, preferences) : []),
    [plan, preferences],
  );

  if (!plan) return <Navigate to="/plans" replace />;
  const rd = getRdAuthor(plan);

  return (
    <div className="tnm2 nn" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/plans" aria-label="All plans"><i className="ph-bold ph-arrow-left" /></Link>
          <div className="abt">Plan</div>
        </div>

        <div className="content padx" style={{ paddingBottom: 100 }}>
          {/* Hero */}
          <div className="lab" style={{ color: "var(--safb)" }}>{PLAN_GOAL_LABEL[plan.goal]}</div>
          <h1 className="h2 mt6">{plan.name}</h1>
          <p className="fine mt6">{plan.tagline}</p>
          <div className="fx wrap gap8 mt10">
            {plan.badges.map((b) => (
              <span key={b} className="pill sg"><i className="ph-fill ph-seal-check" />{b}</span>
            ))}
          </div>

          <div
            className="ribbon mt14"
            role="group"
            aria-label={`Daily targets: ${plan.calorieTargetPerDay} kilocalories, ${plan.proteinTargetGrams} grams protein, ${plan.carbsTargetGrams} grams carbs, ${plan.fatTargetGrams} grams fat`}
          >
            <div className="rc"><span className="rl">KCAL/DAY</span><span className="rv sf">{plan.calorieTargetPerDay}</span></div>
            <div className="rc"><span className="rl">PROTEIN</span><span className="rv">{plan.proteinTargetGrams}<i className="ru">g</i></span></div>
            <div className="rc"><span className="rl">CARBS</span><span className="rv">{plan.carbsTargetGrams}<i className="ru">g</i></span></div>
            <div className="rc"><span className="rl">FAT</span><span className="rv">{plan.fatTargetGrams}<i className="ru">g</i></span></div>
          </div>

          <div className="fx ac jb mt14">
            <div>
              <div className="lab mb4">FROM</div>
              <span className="price safc" style={{ fontSize: 22 }}>{F(PLAN_FROM_PRICE_PER_WEEK_PAISE)}</span>
              <span className="fine" style={{ fontSize: 12 }}> / week</span>
            </div>
            <Link className="btn btn-p" to={`/subscribe?plan=${plan.slug}`}>Subscribe<i className="ph-bold ph-arrow-right" /></Link>
          </div>

          <p className="small mut mt14">{plan.description}</p>

          {/* Author */}
          {rd && (
            <>
              <div className="sh mt20 mb10">Your dietitian</div>
              <Link className="door" to={`/team/${rd.slug}`}>
                <span className="avatar big">{rd.initials}</span>
                <span className="f1" style={{ minWidth: 0 }}>
                  <span className="tt" style={{ display: "block" }}>{rd.name}</span>
                  <span className="fine">{rd.title}</span>
                </span>
                <i className="ph-bold ph-caret-right fntc" />
              </Link>
              <p className="fine mt10">{rd.bio}</p>
              <p className="lab mt6">{rd.credentials.join(" · ")}</p>
            </>
          )}

          {/* Allergen conflicts overlay */}
          {preferences && conflicts.length > 0 && (
            <>
              <div className="banner mt14 fx gap8" style={{ alignItems: "flex-start" }}>
                <i className="ph-bold ph-warning safc" style={{ fontSize: 16, marginTop: 1, flex: "none" }} />
                <div className="f1" style={{ minWidth: 0 }}>
                  <div className="small fw6 safc">
                    {conflicts.length} dish{conflicts.length === 1 ? "" : "es"} conflict with your profile
                  </div>
                  <div className="fine mt4">
                    We'll auto-swap these at delivery so you get the same nutritional shape without your allergens or dislikes. Edit your{" "}
                    <Link to="/preferences" style={{ color: "var(--safb)", textDecoration: "underline" }}>preferences</Link>{" "}
                    any time.
                  </div>
                </div>
              </div>
              <div className="card mt10" style={{ padding: "6px 12px" }}>
                {conflicts.slice(0, 6).map((c, idx) => (
                  <div
                    key={`${c.dayLabel}-${c.mealKey}-${idx}`}
                    className="fx ac gap8 wrap"
                    style={{ padding: "8px 0", borderBottom: idx < conflicts.slice(0, 6).length - 1 ? "1px solid var(--ln)" : "none" }}
                  >
                    <span className="lab" style={{ width: 42, flex: "none", color: "var(--safb)" }}>
                      {c.dayLabel} {c.mealKey[0].toUpperCase()}
                    </span>
                    <span className="small strike mut">{c.dish.name}</span>
                    {c.swap && (
                      <>
                        <i className="ph-bold ph-arrow-right sagec" />
                        <Link className="small sagec" to={`/dish/${c.swap.slug}`}>{c.swap.name}</Link>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Sample week */}
          <div className="fx ac jb mt20 mb10">
            <span className="sh">Sample week</span>
            <span className="lab">3 meals × {plan.week.length} days</span>
          </div>
          {week.map((day) => (
            <div key={day.label} className="card mb12" style={{ padding: 14 }}>
              <div className="lab mb10" style={{ color: "var(--safb)" }}>{day.label}</div>
              <MealRow label="Breakfast" dish={day.breakfast} />
              <MealRow label="Lunch" dish={day.lunch} />
              <MealRow label="Dinner" dish={day.dinner} last />
              {day.rdTip && (
                <div className="note mt10"><i className="ph-bold ph-sparkle" />{day.rdTip}</div>
              )}
            </div>
          ))}

          {/* Weekly notes */}
          <div className="sh mt20 mb10">Weekly notes from {rd?.name ?? "your RD"}</div>
          {plan.weeklyNotes.map((note) => (
            <div key={note.weekNumber} className="card mb12">
              <span className="pill sg" style={{ display: "inline-flex" }}>Week {note.weekNumber}</span>
              <div className="tt mt10">{note.title}</div>
              <p className="fine mt4">{note.body}</p>
            </div>
          ))}

          {/* What's included */}
          <div className="sh mt20 mb10">What's included in your daily plan</div>
          {INCLUDED.map((i) => (
            <div key={i.n} className="card mb12">
              <div className="fx ac gap10">
                <span className="mono safc fw7" style={{ fontSize: 13 }}>{i.n}</span>
                <span className="tt">{i.t}</span>
              </div>
              <p className="fine mt6">{i.d}</p>
            </div>
          ))}

          {/* Benefits */}
          <div className="sh mt20 mb10">Why subscribe with Tanmatra</div>
          {BENEFITS.map((b) => (
            <div key={b.t} className="fx gap12 mb14" style={{ alignItems: "flex-start" }}>
              <i className="ph-fill ph-check-circle sagec" style={{ fontSize: 20, flex: "none", marginTop: 1 }} />
              <div>
                <div className="small fw6">{b.t}</div>
                <div className="fine mt2">{b.d}</div>
              </div>
            </div>
          ))}

          <div className="note mt10"><i className="ph-bold ph-seal-check" />An RD signs this plan and screens every dish against your allergens.</div>

          <MedicalDisclaimer />
        </div>

        {/* Persistent CTA */}
        <div className="dock" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 0, width: "100%", maxWidth: 480 }}>
          <Link className="btn btn-p btn-lg btn-blk" to={`/subscribe?plan=${plan.slug}`}>
            Subscribe — from <span className="price">{F(PLAN_FROM_PRICE_PER_WEEK_PAISE)}</span>/week
            <i className="ph-bold ph-arrow-right" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function MealRow({ label, dish, last }: { label: string; dish: any; last?: boolean }) {
  const border = last ? "none" : "1px solid var(--ln)";
  if (!dish) {
    return (
      <div className="fx ac gap12" style={{ padding: "8px 0", borderBottom: border, opacity: 0.5 }}>
        <div className="plc" style={{ width: 44, height: 44, borderRadius: 9, flex: "none" }} />
        <div className="f1" style={{ minWidth: 0 }}>
          <div className="lab">{label}</div>
          <div className="fine">Curator's choice</div>
        </div>
      </div>
    );
  }
  const m = dish.macros || {};
  return (
    <Link
      className="fx ac gap12"
      to={`/dish/${dish.slug}`}
      style={{ padding: "8px 0", borderBottom: border, display: "flex" }}
    >
      <div
        className="dimg"
        style={{ width: 44, height: 44, borderRadius: 9, backgroundImage: `url(${dish.image})`, backgroundSize: "cover", backgroundPosition: "center", flex: "none" }}
      />
      <div className="f1" style={{ minWidth: 0 }}>
        <div className="lab">{label}</div>
        <div className="small clamp1" style={{ fontWeight: 500 }}>{dish.name}</div>
        <div className="mono fntc" style={{ fontSize: "10.5px" }}>{m.calories ?? 0} kcal · {m.protein ?? 0}g protein</div>
      </div>
    </Link>
  );
}
