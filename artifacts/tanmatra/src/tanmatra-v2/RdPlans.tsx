import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { PLAN_FROM_PRICE_PER_WEEK_PAISE,
  RD_PLANS,
  PLAN_GOAL_LABEL,
  recommendPlansForPreferences,
  getRdAuthor,
  formatRupees,
  type PlanGoal,
} from "@/lib/rdPlans";
import MedicalDisclaimer from "@/components/v2/MedicalDisclaimer";
import { usePreferences } from "@/lib/preferencesContext";
import {
  PROTOCOL_LABELS,
  PROTOCOL_PLAN_GOALS,
  PROTOCOL_TAGLINES,
  isProtocol,
  type Protocol,
} from "@/lib/protocols";

const GOAL_FILTERS: Array<{ value: "all" | PlanGoal; label: string }> = [
  { value: "all", label: "All plans" },
  { value: "weight_loss", label: "Weight loss" },
  { value: "lean_muscle", label: "Lean muscle" },
  { value: "pcos_balance", label: "PCOS" },
  { value: "diabetic_friendly", label: "Diabetic" },
  { value: "senior_vitality", label: "Senior" },
  { value: "low_fodmap", label: "Gut / IBS" },
  { value: "healthy_everyday", label: "Everyday" },
  { value: "three_day_trial", label: "Trial Pack" },
];

const CALORIE_BUCKETS: Array<{ value: "all" | "low" | "mid" | "high"; label: string }> = [
  { value: "all", label: "Any kcal" },
  { value: "low", label: "≤ 1700" },
  { value: "mid", label: "1700–2100" },
  { value: "high", label: "> 2100" },
];

const STYLE_FILTERS = ["all", "vegetarian", "omnivore", "pescatarian"] as const;

const goalPillStyle = { background: "var(--safd)", color: "var(--safb)" };

export default function V2RdPlans() {
  const { preferences } = usePreferences();
  const [searchParams, setSearchParams] = useSearchParams();
  const protocolParam = searchParams.get("protocol");
  const activeProtocol: Protocol | null = isProtocol(protocolParam)
    ? protocolParam
    : null;

  const [goalFilter, setGoalFilter] = useState<"all" | PlanGoal>("all");
  const [calBucket, setCalBucket] = useState<"all" | "low" | "mid" | "high">("all");
  const [styleFilter, setStyleFilter] = useState<string>("all");

  const recommendations = useMemo(
    () => recommendPlansForPreferences(preferences, 3),
    [preferences],
  );

  // When a protocol single-goal mapping is exact (e.g. performance →
  // lean_muscle), reflect it in the goal pill so the user sees the chip
  // active. Otherwise leave goalFilter alone — the protocol filter applies
  // on top via PROTOCOL_PLAN_GOALS.
  useEffect(() => {
    if (activeProtocol) {
      const goals = PROTOCOL_PLAN_GOALS[activeProtocol];
      if (goals.length === 1) setGoalFilter(goals[0]);
    }
  }, [activeProtocol]);

  const filtered = useMemo(() => {
    const protocolGoals = activeProtocol ? PROTOCOL_PLAN_GOALS[activeProtocol] : null;
    return RD_PLANS.filter((p) => {
      if (protocolGoals && !protocolGoals.includes(p.goal)) return false;
      if (goalFilter !== "all" && p.goal !== goalFilter) return false;
      if (styleFilter !== "all" && !p.dietaryStyles.includes(styleFilter as never))
        return false;
      if (calBucket === "low" && p.calorieTargetPerDay > 1700) return false;
      if (
        calBucket === "mid" &&
        (p.calorieTargetPerDay < 1700 || p.calorieTargetPerDay > 2100)
      )
        return false;
      if (calBucket === "high" && p.calorieTargetPerDay <= 2100) return false;
      return true;
    });
  }, [goalFilter, calBucket, styleFilter, activeProtocol]);

  function clearProtocol() {
    const next = new URLSearchParams(searchParams);
    next.delete("protocol");
    setSearchParams(next, { replace: true });
    setGoalFilter("all");
  }

  function clearAllFilters() {
    setGoalFilter("all");
    setCalBucket("all");
    setStyleFilter("all");
  }

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="appbar">
          <Link className="iconbtn" to="/" aria-label="Home">
            <i className="ph-bold ph-arrow-left" />
          </Link>
          <div className="abt">RD Plans</div>
          <Link className="iconbtn" to="/menu" title="Menu">
            <i className="ph-bold ph-fork-knife" />
          </Link>
        </div>

        <div className="content" style={{ paddingBottom: 24 }}>
          {/* Hero */}
          <div className="padx" style={{ paddingTop: 4 }}>
            <div className="lab" style={{ color: "var(--safb)" }}>RD-designed</div>
            <h1 className="disp mt6" style={{ color: "var(--text-primary)" }}>
              {activeProtocol
                ? `${PROTOCOL_LABELS[activeProtocol]} Protocol — RD plans`
                : "Plans curated by registered dietitians"}
            </h1>
            <p className="fine mt6">
              {activeProtocol
                ? PROTOCOL_TAGLINES[activeProtocol]
                : "Six- to twelve-week protocols built around one goal — weight loss, lean muscle, PCOS, diabetes and more. Each plan is authored by an in-house RD, signed off for sodium and macros, and adapts to your allergens at delivery."}
            </p>
            {activeProtocol && (
              <button
                type="button"
                onClick={clearProtocol}
                className="linkq mt10"
              >
                <i className="ph-bold ph-x" />
                Clear protocol filter — see all plans
              </button>
            )}
          </div>

          {/* Top matches */}
          {preferences && recommendations.length > 0 && (
            <>
              <div className="secrow">
                <span className="sh fx ac gap8">
                  <i className="ph-fill ph-sparkle safc" />
                  Top matches for your profile
                </span>
              </div>
              <div className="padx">
                {recommendations.map(({ plan, reasons }) => {
                  const rd = getRdAuthor(plan);
                  return (
                    <Link
                      key={plan.slug}
                      className="card pointer mb10"
                      to={`/plans/${plan.slug}`}
                      style={{
                        display: "block",
                        background: "var(--safd)",
                        borderColor: "var(--saf)",
                      }}
                    >
                      <div className="fx ac jb gap8">
                        <span className="pill" style={goalPillStyle}>
                          {PLAN_GOAL_LABEL[plan.goal]}
                        </span>
                        <span className="price safc" style={{ fontSize: 14 }}>
                          {formatRupees(PLAN_FROM_PRICE_PER_WEEK_PAISE)}
                          <span className="fntc" style={{ fontSize: 11 }}> /wk</span>
                        </span>
                      </div>
                      <div className="dtitle">{plan.name}</div>
                      <div className="fine">{plan.tagline}</div>
                      <div className="mt6">
                        {reasons.slice(0, 2).map((r) => (
                          <div key={r} className="fx gap8 mt4" style={{ alignItems: "flex-start" }}>
                            <i className="ph-bold ph-check sagec" style={{ marginTop: 2, flex: "none" }} />
                            <span className="fine sagec">{r}</span>
                          </div>
                        ))}
                      </div>
                      {rd && (
                        <div className="lab mt6">By {rd.name}</div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* Filters */}
          <div className="secrow">
            <span className="sh fx ac gap8">
              <i className="ph-bold ph-funnel fntc" />
              Filter plans
            </span>
          </div>
          <div className="chiprow" role="group" aria-label="Goal filter">
            {GOAL_FILTERS.map((g) => (
              <button
                key={g.value}
                className={goalFilter === g.value ? "chip on" : "chip"}
                onClick={() => setGoalFilter(g.value)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="chiprow" role="group" aria-label="Calorie filter">
            {CALORIE_BUCKETS.map((b) => (
              <button
                key={b.value}
                className={calBucket === b.value ? "chip on" : "chip"}
                onClick={() => setCalBucket(b.value)}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="chiprow" role="group" aria-label="Diet filter">
            {STYLE_FILTERS.map((s) => (
              <button
                key={s}
                className={styleFilter === s ? "chip on" : "chip"}
                onClick={() => setStyleFilter(s)}
              >
                {s === "all" ? "Any diet" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="padx" style={{ paddingTop: 4 }}>
            <div className="fine mb10 mono">
              {filtered.length} {filtered.length === 1 ? "plan" : "plans"}
            </div>

            {filtered.length === 0 ? (
              <div className="tc" style={{ padding: "40px 20px" }}>
                <i className="ph-bold ph-magnifying-glass" style={{ fontSize: 30, color: "var(--fnt)" }} />
                <div className="tt mt10">No plans match those filters</div>
                <div className="fine mt6">Try widening your goal, calorie or diet selection.</div>
                <button className="btn btn-g mt20" onClick={clearAllFilters}>Clear filters</button>
              </div>
            ) : (
              filtered.map((plan) => {
                const rd = getRdAuthor(plan);
                return (
                  <div key={plan.slug} className="card mb12">
                    <div className="fx jb gap12">
                      <div className="f1" style={{ minWidth: 0 }}>
                        <span className="pill" style={goalPillStyle}>
                          {PLAN_GOAL_LABEL[plan.goal]}
                        </span>
                        <div className="dtitle">{plan.name}</div>
                        <div className="fine">{plan.tagline}</div>
                      </div>
                      <div style={{ flex: "none", textAlign: "right" }}>
                        <div className="lab">from</div>
                        <div className="price safc" style={{ fontSize: 18 }}>
                          {formatRupees(PLAN_FROM_PRICE_PER_WEEK_PAISE)}
                        </div>
                        <div className="lab">/ week</div>
                      </div>
                    </div>

                    <div
                      className="ribbon cmp mt10"
                      role="group"
                      aria-label={`Daily targets: ${plan.calorieTargetPerDay} kilocalories, ${plan.proteinTargetGrams} grams protein, ${plan.carbsTargetGrams} grams carbs, ${plan.fatTargetGrams} grams fat`}
                    >
                      <div className="rc"><span className="rl">KCAL</span><span className="rv sf">{plan.calorieTargetPerDay}</span></div>
                      <div className="rc"><span className="rl">PROTEIN</span><span className="rv">{plan.proteinTargetGrams}<i className="ru">g</i></span></div>
                      <div className="rc"><span className="rl">CARBS</span><span className="rv">{plan.carbsTargetGrams}<i className="ru">g</i></span></div>
                      <div className="rc"><span className="rl">FAT</span><span className="rv">{plan.fatTargetGrams}<i className="ru">g</i></span></div>
                    </div>

                    {plan.badges.length > 0 && (
                      <div className="fx wrap g6 mt10">
                        {plan.badges.map((b) => (
                          <span key={b} className="pill sg">
                            <i className="ph-fill ph-shield-check" />
                            {b}
                          </span>
                        ))}
                      </div>
                    )}

                    {rd && (
                      <Link
                        to={`/team/${rd.slug}`}
                        className="fx ac gap8 mt10"
                        style={{ paddingTop: 10, borderTop: "1px solid var(--ln)" }}
                      >
                        <span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{rd.initials}</span>
                        <span className="fine">
                          Authored by <span style={{ color: "var(--tx)", fontWeight: 600 }}>{rd.name}</span>
                        </span>
                      </Link>
                    )}

                    <div className="fx gap8 mt12">
                      <Link className="btn btn-g f1" to={`/plans/${plan.slug}`}>
                        View week
                      </Link>
                      <Link className="btn btn-p f1" to={`/subscribe?plan=${plan.slug}`}>
                        Subscribe
                        <i className="ph-bold ph-arrow-right" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <MedicalDisclaimer compact />
        </div>
      </div>
    </div>
  );
}
