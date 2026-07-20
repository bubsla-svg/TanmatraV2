import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Barbell,
  Check,
  ForkKnife,
  Lightning,
  Question,
  Scales,
  SealCheck,
  Timer,
} from "@phosphor-icons/react";
import { RD_PLANS, getRdAuthor, type RdPlan } from "@/lib/rdPlans";
import { useMenuCatalog, type DishData } from "@/lib/menuData";
import { formatPrice } from "@/lib/api/adapter";
import { computeTrialPricePaise } from "@workspace/subscription-rules";
import { onDishImageError } from "@/lib/imgFallback";
import type { WellnessGoal } from "@/lib/preferencesApi";
import FreshVsColdModule from "@/components/shared/FreshVsColdModule";
import NutritionLabelModal from "@/components/dish/NutritionLabelModal";
import LandingTopBar from "@/components/landing/LandingTopBar";
import LandingStickyCta from "@/components/landing/LandingStickyCta";
import LandingFaq, { type LandingFaqItem } from "@/components/landing/LandingFaq";
import { useLandingAnalytics } from "@/components/landing/useLandingAnalytics";

const IntakeQuiz = lazy(() => import("@/components/preferences/IntakeQuiz"));

/**
 * `/metabolic` — Playbook §3.1. Urban-professional fat-loss / muscle-gain
 * acquisition page. One audience, one promise ("your macros, engineered"),
 * primary CTA repeated. The goal toggle flips every number on the page —
 * all figures come from RD_PLANS / the live catalog, never hardcoded.
 *
 * Copy guardrails (§7.2/§7.6): measurable-nutrient claims with numbers,
 * process claims about the kitchen — never disease or outcome claims.
 */

type MetabolicGoal = "fat_loss" | "muscle_gain";

const TRIAL_MEALS = 9; // 3 days × breakfast, lunch & dinner — same pack the wizard sells.

interface GoalConfig {
  label: string;
  planSlug: string;
  wellnessGoal: WellnessGoal;
  weekOneSub: string;
  dishFilter: (d: DishData) => boolean;
  dishSort: (a: DishData, b: DishData) => number;
  dishStat: (d: DishData) => string;
}

const GOAL_CONFIG: Record<MetabolicGoal, GoalConfig> = {
  fat_loss: {
    label: "Fat loss",
    planSlug: "weight-loss-jumpstart",
    wellnessGoal: "lose_weight",
    weekOneSub:
      "Low-GI, fibre-forward plates from the live rotation — portioned so the afternoon stays sharp.",
    dishFilter: (d) => d.glycaemicIndex !== "high" && d.macros.fiber >= 4,
    dishSort: (a, b) => a.macros.calories - b.macros.calories,
    dishStat: (d) =>
      `${Math.round(d.macros.calories)} kcal · ${Math.round(d.macros.fiber)}g fibre`,
  },
  muscle_gain: {
    label: "Muscle gain",
    planSlug: "lean-muscle-builder",
    wellnessGoal: "gain_muscle",
    weekOneSub:
      "The highest-protein dishes in the live rotation — every gram printed on the label.",
    dishFilter: (d) => d.macros.protein >= 18,
    dishSort: (a, b) => b.macros.protein - a.macros.protein,
    dishStat: (d) =>
      `${Math.round(d.macros.protein)}g protein · ${Math.round(d.macros.calories)} kcal`,
  },
};

const FAQ_ITEMS: LandingFaqItem[] = [
  {
    q: "How do you verify macros?",
    a: "Every dish ships with a per-dish nutrition label. Macros are ingredient-derived, lab-informed estimates reviewed by our RD team — and when a value is provisional, we label it provisional.",
  },
  {
    q: "Can I switch between fat loss and muscle gain?",
    a: "Yes. Programs run week to week — switch programs or swap any dish before it's cooked, and your targets update with it. No lock-in.",
  },
  {
    q: "Is there a vegetarian high-protein option?",
    a: "Weight-Loss Jumpstart runs fully vegetarian if you want it to. Lean Muscle Builder is built omnivore/pescatarian to hold its 160g/day protein floor — book a free RD consult if you want a veg-first variant designed around you.",
  },
  {
    q: "When do meals arrive?",
    a: "Fired in our Sector 63 kitchen only after you order, sealed hot, and delivered in about 40–45 minutes inside our Noida service zones — never a morning cold-drop.",
  },
];

const PAIN_CARDS = [
  {
    icon: ForkKnife,
    title: "Cafeteria roulette",
    body: "The food court decides your macros for you. Paneer swimming in cream one day, a dry salad the next — no numbers on either.",
  },
  {
    icon: Lightning,
    title: "The 6 PM energy crash",
    body: "A heavy, high-GI lunch at 1 PM shows up as a meeting you can barely sit through at 6. Low-GI plates flatten that curve.",
  },
  {
    icon: Question,
    title: "Protein you can't verify",
    body: "A “high-protein bowl” with no label is a guess, not a plan. Every Tanmatra dish publishes protein, carbs, fat and its GI band.",
  },
];

export default function MetabolicLandingView() {
  const { sector, trackCta } = useLandingAnalytics("metabolic");
  const [goal, setGoal] = useState<MetabolicGoal>("fat_loss");
  const [quizOpen, setQuizOpen] = useState(false);
  const { dishes } = useMenuCatalog();

  const cfg = GOAL_CONFIG[goal];
  const plans = useMemo(() => {
    const bySlug = new Map(RD_PLANS.map((p) => [p.slug, p]));
    return [bySlug.get("weight-loss-jumpstart"), bySlug.get("lean-muscle-builder")].filter(
      (p): p is RdPlan => Boolean(p),
    );
  }, []);
  const selectedPlan = plans.find((p) => p.slug === cfg.planSlug) ?? plans[0];

  const previewDishes = useMemo(
    () => [...dishes].filter(cfg.dishFilter).sort(cfg.dishSort).slice(0, 6),
    [dishes, cfg],
  );
  const sampleDish = previewDishes[0];

  const perMealProtein = (p: RdPlan) => Math.round(p.proteinTargetGrams / 3);
  const trialPriceText = formatPrice(computeTrialPricePaise(TRIAL_MEALS));

  return (
    <div className="nn-clinical bg-nn-bg text-white min-h-screen pb-28">
      <LandingTopBar
        ctaLabel="Start 3-Day Trial"
        ctaTo="/subscribe?trial=1"
        onCtaClick={() => trackCta("topbar_trial", "/subscribe?trial=1")}
      />

      {/* ── 1 · Hero + goal toggle ─────────────────────────────────────── */}
      <section className="pt-12 md:pt-16 pb-10 px-4 text-center max-w-4xl mx-auto space-y-5">
        <p className="text-[11px] uppercase tracking-widest text-nn-primary font-semibold">
          {sector ? `Delivering into Sector ${sector} daily` : "Noida tech corridor · fresh-fired · 40–45 min"}
        </p>
        <h1 className="text-clinical-h1 md:text-[clamp(2.25rem,1.4rem+2.6vw,3.25rem)] md:leading-[1.06] tracking-tight font-extrabold text-white">
          Your macros, engineered.
          <br />
          <span className="text-nn-primary">Your lunch, in 45 minutes.</span>
        </h1>
        <p className="text-sm sm:text-base text-nn-on-surface-variant max-w-xl mx-auto leading-relaxed">
          Two RD-calibrated programs — {plans[0] ? `${perMealProtein(plans[0])}g` : ""} or{" "}
          {plans[1] ? `${perMealProtein(plans[1])}g` : ""} protein per meal — designed by registered
          dietitians and fired in our ISO 22000:2018 kitchen only after you order.
        </p>

        {/* Goal toggle — flips every number below */}
        <div
          role="group"
          aria-label="Choose your goal"
          className="inline-flex items-center gap-1 rounded-full bg-nn-surface border border-white/[0.08] p-1"
        >
          {(Object.keys(GOAL_CONFIG) as MetabolicGoal[]).map((g) => {
            const active = g === goal;
            const Icon = g === "fat_loss" ? Scales : Barbell;
            return (
              <button
                key={g}
                type="button"
                aria-pressed={active}
                onClick={() => setGoal(g)}
                className={`inline-flex items-center gap-1.5 h-11 px-5 rounded-full text-xs font-bold transition-all active:scale-[0.97] ${
                  active
                    ? "bg-nn-primary text-stone-900"
                    : "text-nn-on-surface-variant hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" weight={active ? "bold" : "regular"} aria-hidden />
                {GOAL_CONFIG[g].label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              trackCta("hero_assessment", "intake-quiz");
              setQuizOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-nn-primary text-stone-900 hover:bg-nn-primary/90 font-bold text-sm h-12 px-7 rounded-xl active:scale-[0.98] transition-transform"
          >
            Take the 60-sec assessment <ArrowRight className="w-4 h-4" weight="bold" aria-hidden />
          </button>
          <Link
            to="/subscribe?trial=1"
            onClick={() => trackCta("hero_trial", "/subscribe?trial=1")}
            className="inline-flex items-center justify-center w-full sm:w-auto border border-white/15 text-white hover:bg-white/5 font-semibold text-sm h-12 px-7 rounded-xl active:scale-[0.98] transition-transform"
          >
            Start 3-Day Trial
          </Link>
        </div>
      </section>

      {/* ── 2 · Pain mirror ────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
          The 1 PM problem
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          You already know how this goes.
        </h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {PAIN_CARDS.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl bg-nn-surface border border-white/[0.08] p-5 space-y-2.5"
            >
              <span className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                <card.icon className="w-4.5 h-4.5 text-nn-primary" aria-hidden />
              </span>
              <h3 className="text-sm font-bold text-white">{card.title}</h3>
              <p className="text-xs text-nn-on-surface-variant leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3 · Proof of precision ─────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
          Proof of precision
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          {selectedPlan.name} — the daily numbers
        </h2>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { value: selectedPlan.calorieTargetPerDay, unit: "kcal / day" },
            { value: selectedPlan.proteinTargetGrams, unit: "g protein / day" },
            { value: selectedPlan.carbsTargetGrams, unit: "g carbs / day" },
            { value: selectedPlan.fatTargetGrams, unit: "g fat / day" },
          ].map((tile) => (
            <div
              key={tile.unit}
              className="rounded-2xl bg-nn-surface border border-white/[0.08] p-5 text-center"
            >
              <p className="text-3xl font-extrabold text-nn-primary tabular-nums">{tile.value}</p>
              <p className="text-[11px] uppercase tracking-wider text-nn-on-surface-variant font-semibold mt-1">
                {tile.unit}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-xs text-nn-on-surface-variant leading-relaxed">
            <SealCheck className="w-3.5 h-3.5 text-clinical-sage inline mr-1.5 align-[-2px]" aria-hidden />
            Targets from the {selectedPlan.name} program, designed and signed off by{" "}
            {getRdAuthor(selectedPlan)?.name ?? "our RD team"}. Macros are lab-informed estimates —
            provisional values are labelled provisional.
          </p>
          {sampleDish && <NutritionLabelModal dish={sampleDish} />}
        </div>
      </section>

      {/* ── 4 · Program cards ──────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
          RD-designed programs
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          Pick your program
        </h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((p) => {
            const isSelected = p.slug === selectedPlan.slug;
            const Icon = p.slug === "weight-loss-jumpstart" ? Scales : Barbell;
            const author = getRdAuthor(p);
            return (
              <div
                key={p.slug}
                className={`rounded-2xl bg-nn-surface border p-6 space-y-4 transition-colors ${
                  isSelected ? "border-nn-primary/50" : "border-white/[0.08]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="w-10 h-10 rounded-xl bg-nn-primary/10 border border-nn-primary/25 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-nn-primary" aria-hidden />
                  </span>
                  {isSelected && (
                    <span className="text-[9px] uppercase font-bold tracking-wider bg-nn-primary text-stone-900 px-2 py-1 rounded-full">
                      Matched to your goal
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white tracking-tight">{p.name}</h3>
                  <p className="text-xs text-nn-on-surface-variant leading-relaxed mt-1">{p.tagline}</p>
                </div>
                <ul className="space-y-1.5">
                  {[
                    `${p.calorieTargetPerDay} kcal · ${p.proteinTargetGrams}g protein per day`,
                    `~${perMealProtein(p)}g protein per meal, printed on every label`,
                    `Designed by ${author?.name ?? "a registered dietitian"}`,
                  ].map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2 text-xs text-nn-on-surface-variant tabular-nums"
                    >
                      <Check className="w-3.5 h-3.5 text-nn-primary mt-0.5 shrink-0" aria-hidden />
                      {line}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
                  <p className="text-lg font-extrabold text-white tabular-nums">
                    {formatPrice(p.pricePerWeekPaise)}
                    <span className="text-xs text-nn-on-surface-variant font-medium"> /week</span>
                  </p>
                  <Link
                    to={`/subscribe?plan=${p.slug}`}
                    onClick={() => trackCta(`program_${p.slug}`, `/subscribe?plan=${p.slug}`)}
                    className="inline-flex items-center justify-center gap-1.5 bg-nn-primary text-stone-900 hover:bg-nn-primary/90 font-bold text-xs h-11 px-5 rounded-xl active:scale-[0.97] transition-transform"
                  >
                    Start This Program <ArrowRight className="w-3.5 h-3.5" weight="bold" aria-hidden />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 5 · Week-1 preview ─────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
          Week 1 · {cfg.label}
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          What lands on your desk
        </h2>
        <p className="text-xs text-nn-on-surface-variant mt-1.5 max-w-xl">{cfg.weekOneSub}</p>
        <div className="mt-5 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
          {previewDishes.map((dish) => (
            <Link
              key={dish.slug}
              to={`/dish/${dish.slug}`}
              onClick={() => trackCta("week1_dish", `/dish/${dish.slug}`)}
              className="shrink-0 w-44 sm:w-52 rounded-2xl bg-nn-surface border border-white/[0.064] overflow-hidden group active:scale-[0.98] transition-transform"
            >
              <div className="h-28 bg-nn-surface-high relative overflow-hidden">
                <img
                  src={dish.image}
                  alt={dish.name}
                  onError={onDishImageError}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm px-1.5 py-0.5 rounded border border-white/10 text-[9px] font-bold flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${dish.isVeg ? "bg-emerald-500" : "bg-red-500"}`}
                    aria-hidden
                  />
                  {dish.isVeg ? "VEG" : "NON-VEG"}
                </span>
              </div>
              <div className="p-2.5 space-y-1">
                <p className="text-xs font-bold text-white truncate">{dish.name}</p>
                <p className="text-[10px] text-nn-on-surface-variant font-mono tabular-nums">
                  {cfg.dishStat(dish)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 6 · Fresh vs cold (shared S5 module) ───────────────────────── */}
      <div className="border-t border-white/[0.08] py-14">
        <FreshVsColdModule context="metabolic" />
      </div>

      {/* ── 7 · Trial band ─────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <div className="relative overflow-hidden rounded-2xl border border-nn-primary/40 bg-gradient-to-br from-nn-primary/12 via-nn-primary/5 to-transparent p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 space-y-3">
            <span className="inline-block bg-nn-primary text-stone-900 text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full">
              Start small
            </span>
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              Three days. Nine meals. Zero commitment.
            </h2>
            <p className="text-sm text-nn-on-surface-variant max-w-md leading-relaxed">
              The 3-Day Trial runs your chosen program end to end — delivered hot, 40–45 minutes
              from fire to desk. One-off by design: it does not auto-renew.
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-nn-on-surface-variant pt-1">
              <li className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-nn-primary" aria-hidden /> Breakfast, lunch &amp; dinner
              </li>
              <li className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-nn-primary" aria-hidden /> Delivered hot, never cold-chained
              </li>
            </ul>
          </div>
          <div className="shrink-0 md:text-right space-y-3">
            <p className="text-3xl font-bold text-nn-primary tabular-nums">
              {trialPriceText}
              <span className="block md:text-right text-[11px] text-nn-on-surface-variant font-medium mt-1">
                all-in · GST included
              </span>
            </p>
            <Link
              to="/subscribe?trial=1"
              onClick={() => trackCta("trial_band", "/subscribe?trial=1")}
              className="inline-flex items-center justify-center gap-2 w-full md:w-auto bg-nn-primary text-stone-900 hover:bg-nn-primary/90 font-bold text-sm h-12 px-6 rounded-xl active:scale-[0.98] transition-transform"
            >
              Start 3-Day Trial <ArrowRight className="w-4 h-4" weight="bold" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 8 · FAQ ────────────────────────────────────────────────────── */}
      <LandingFaq heading="Macro questions, answered" items={FAQ_ITEMS} />

      {/* ── 9 · Sticky CTA ─────────────────────────────────────────────── */}
      <LandingStickyCta
        sublabel={selectedPlan.name}
        priceText={`${formatPrice(selectedPlan.pricePerWeekPaise)}/week`}
        label="Start This Program"
        to={`/subscribe?plan=${selectedPlan.slug}`}
        onClick={() => trackCta("sticky_program", `/subscribe?plan=${selectedPlan.slug}`)}
      />

      {quizOpen && (
        <Suspense fallback={null}>
          <IntakeQuiz
            open={quizOpen}
            onOpenChange={setQuizOpen}
            initialGoal={cfg.wellnessGoal}
          />
        </Suspense>
      )}
    </div>
  );
}
