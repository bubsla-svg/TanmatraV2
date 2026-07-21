import { useMemo } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  CalendarCheck,
  ChatCircleText,
  ClipboardText,
  FirstAid,
  Gauge,
  HandHeart,
  Scales,
  SealCheck,
  ShieldCheck,
  Stethoscope,
} from "@phosphor-icons/react";
import { getRdPlanBySlug, planCardPricePaise } from "@/lib/rdPlans";
import { RD_BOOKING } from "@/lib/rdBookingData";
import { rdsForProtocol } from "@/lib/protocols";
import { TEAM } from "@/lib/teamData";
import { useMenuCatalog, type DishData } from "@/lib/menuData";
import { formatPrice } from "@/lib/api/adapter";
import { onDishImageError } from "@/lib/imgFallback";
import NutritionLabelModal from "@/components/dish/NutritionLabelModal";
import LandingTopBar from "@/components/landing/LandingTopBar";
import { useLandingAnalytics } from "@/components/landing/useLandingAnalytics";

/**
 * `/care/:condition` — Playbook §3.2. One template, two launches (PCOS,
 * diabetes); the template scales to further conditions later.
 *
 * COMPLIANCE-CRITICAL (Playbook §7.6 — FSSAI A&C Regs 2018): all condition
 * copy on this page is diet-DESCRIPTIVE ("low-GI, measured", "hormone-aware
 * menu"), never disease-suitability ("treats / manages / prevents / cures" is
 * barred, and diabetes sits on the DMR Act schedule). The clinical promise
 * rides exclusively on the RD consult SERVICE — the food only ever claims its
 * measurable numbers and our process. Do not add outcome or efficacy claims
 * about meals here without legal review.
 */

export type CareCondition = "pcos" | "diabetes";

export function isCareCondition(v: unknown): v is CareCondition {
  return v === "pcos" || v === "diabetes";
}

const CONSULT_TARGET = "/rd?protocol=clinical";

interface CareConfig {
  conditionLabel: string;
  protocolLabel: string;
  heroTitle: string;
  heroSub: string;
  planSlug: string;
  /** Diet-descriptive "macro caps" card body — numbers from the plan data. */
  capsBody: string;
  /** Optional market-context stat (never fear copy). */
  marketStat: { label: string; body: string } | null;
  dishSort: (a: DishData, b: DishData) => number;
}

const CARE_CONFIG: Record<CareCondition, CareConfig> = {
  pcos: {
    conditionLabel: "PCOS",
    protocolLabel: "Hormone-aware menu",
    heroTitle: "Hormone-aware meals, designed by RDs — not influencers.",
    heroSub:
      "A low-GI, anti-inflammatory, fibre-and-omega-3-forward menu built by registered dietitians — with the numbers published on every dish. The clinical thinking comes from your RD, in a free 15-minute consult.",
    planSlug: "pcos-balance",
    capsBody:
      "Low-GI carbs, a 100g/day protein floor, magnesium-rich greens and omega-3 sources — the PCOS Hormone Balance rotation is built to those specs and each plate's numbers are printed on its label.",
    marketStat: null,
    dishSort: (a, b) => b.macros.fiber - a.macros.fiber,
  },
  diabetes: {
    conditionLabel: "Diabetes",
    protocolLabel: "Sugar-conscious menu",
    heroTitle: "Low-GI, measured — not marketed.",
    heroSub:
      "Low-GI here means the FSSAI-defined band, and we publish each dish's GI band, carbs and sugar per serving. What the numbers mean for you is a conversation with a registered dietitian — the first 15 minutes are free.",
    planSlug: "diabetic-friendly",
    capsBody:
      "The sugar-conscious rotation holds every meal to ≤45g carbs and ≤8g sugar, pairs protein with fibre on each plate, and prints GI band, carbs and sugar per serving on the label.",
    marketStat: {
      label: "Market context — ICMR-INDIAB, Lancet 2023",
      body: "11.4% of Indian adults — about 101 million people — live with diabetes. We think that number deserves published food data: per-dish GI bands, carbs and sugar you can take to your doctor.",
    },
    dishSort: (a, b) =>
      (parseFloat(a.sugarPerServing) || 0) - (parseFloat(b.sugarPerServing) || 0),
  },
};

const PROTOCOL_STEPS = [
  {
    icon: ClipboardText,
    title: "1 · RD intake",
    body: "A free 15-minute intro consult: your history, routines, preferences, allergens — and your labs, if you'd like to share them.",
  },
  {
    icon: CalendarCheck,
    title: "2 · A personalised low-GI plan",
    body: "Your RD assembles a weekly rotation from the program and calibrates portions to the targets you agree on together.",
  },
  {
    icon: ChatCircleText,
    title: "3 · Weekly adjustments",
    body: "Check in through your RD chat. The plan adjusts week by week as your routine, appetite and priorities change.",
  },
];

export default function CareLandingView({ condition }: { condition: CareCondition }) {
  const cfg = CARE_CONFIG[condition];
  const { sector, trackCta } = useLandingAnalytics(`care-${condition}`);
  const { dishes } = useMenuCatalog();

  const plan = getRdPlanBySlug(cfg.planSlug);
  const leadRd = useMemo(() => TEAM.find((m) => m.slug === "rd-anjali-nair"), []);
  const clinicalRds = useMemo(() => rdsForProtocol(RD_BOOKING, "clinical"), []);
  const teamBySlug = useMemo(() => new Map(TEAM.map((m) => [m.slug, m])), []);

  const evidenceDishes = useMemo(
    () =>
      [...dishes]
        .filter((d) => d.glycaemicIndex === "low")
        .sort(cfg.dishSort)
        .slice(0, 3),
    [dishes, cfg],
  );

  return (
    <div className="nn-clinical bg-nn-bg text-white min-h-dvh pb-16">
      <LandingTopBar
        ctaLabel="Free 15-min RD consult"
        ctaTo={CONSULT_TARGET}
        onCtaClick={() => trackCta("topbar_consult", CONSULT_TARGET)}
      />

      {/* ── 1 · Hero — consult-first ───────────────────────────────────── */}
      <section className="pt-12 md:pt-16 pb-10 px-4 text-center max-w-3xl mx-auto space-y-5">
        <p className="text-[11px] uppercase tracking-widest text-nn-primary font-semibold">
          {sector
            ? `Delivering into Sector ${sector} daily · ${cfg.protocolLabel}`
            : `${cfg.protocolLabel} · ${cfg.conditionLabel}`}
        </p>
        <h1 className="text-clinical-h1 md:text-[clamp(2.1rem,1.4rem+2.2vw,3rem)] md:leading-[1.08] tracking-tight font-extrabold text-white">
          {cfg.heroTitle}
        </h1>
        <p className="text-sm sm:text-base text-nn-on-surface-variant max-w-xl mx-auto leading-relaxed">
          {cfg.heroSub}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <Link
            to={CONSULT_TARGET}
            onClick={() => trackCta("hero_consult", CONSULT_TARGET)}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-nn-primary text-stone-900 hover:bg-nn-primary/90 font-bold text-sm h-12 px-7 rounded-xl active:scale-[0.98] transition-transform"
          >
            Book a free 15-min RD consult{" "}
            <ArrowRight className="w-4 h-4" weight="bold" aria-hidden />
          </Link>
          <a
            href="#program"
            onClick={() => trackCta("hero_see_program", "#program")}
            className="inline-flex items-center justify-center w-full sm:w-auto border border-white/15 text-white hover:bg-white/5 font-semibold text-sm h-12 px-7 rounded-xl active:scale-[0.98] transition-transform"
          >
            See the program
          </a>
        </div>
        <p className="text-[11px] text-nn-on-surface-variant">
          15 minutes, free, with a registered dietitian. No card required.
        </p>
      </section>

      {/* ── 2 · Credibility block ──────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
          Who signs this menu
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          Named RDs. Real registrations.
        </h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {leadRd && (
            <div className="rounded-2xl bg-nn-surface border border-white/[0.08] p-6 space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-full bg-clinical-sage/15 border border-clinical-sage/30 flex items-center justify-center text-clinical-sage font-bold">
                  {leadRd.initials}
                </span>
                <div>
                  <p className="text-base font-bold text-white">{leadRd.name}</p>
                  <p className="text-xs text-nn-on-surface-variant">{leadRd.title}</p>
                </div>
              </div>
              <ul className="space-y-1">
                {leadRd.credentials.map((c) => (
                  <li
                    key={c}
                    className="flex items-start gap-2 text-xs text-nn-on-surface-variant"
                  >
                    <SealCheck className="w-3.5 h-3.5 text-clinical-sage mt-0.5 shrink-0" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-white/80 leading-relaxed border-t border-white/[0.06] pt-3">
                “{leadRd.signatureLine}”
              </p>
            </div>
          )}
          <div className="space-y-3">
            {clinicalRds
              .filter((rd) => rd.slug !== "rd-anjali-nair")
              .slice(0, 2)
              .map((rd) => {
                const member = teamBySlug.get(rd.slug);
                return (
                  <div
                    key={rd.slug}
                    className="rounded-2xl bg-nn-surface border border-white/[0.08] p-4 flex items-center gap-3"
                  >
                    <span className="w-10 h-10 rounded-full bg-nn-primary/10 border border-nn-primary/25 flex items-center justify-center text-nn-primary text-sm font-bold shrink-0">
                      {member?.initials ?? "RD"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {member?.name ?? rd.slug}
                      </p>
                      <p className="text-[11px] text-nn-on-surface-variant truncate">
                        {rd.specialties.join(" · ")}
                      </p>
                    </div>
                    <Link
                      to={`/rd/${rd.slug}`}
                      onClick={() => trackCta("credibility_rd_profile", `/rd/${rd.slug}`)}
                      className="text-[11px] font-bold text-nn-primary hover:underline shrink-0 inline-flex items-center min-h-[44px] px-2"
                    >
                      Profile
                    </Link>
                  </div>
                );
              })}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-1.5 text-xs text-nn-on-surface-variant leading-relaxed">
              <p className="flex items-center gap-2 text-white font-semibold">
                <ShieldCheck className="w-4 h-4 text-clinical-sage" aria-hidden />
                Process, on the record
              </p>
              <p>
                Every plate is signed off for sodium and blood-sugar impact before it leaves the
                kitchen. ISO 22000:2018 processes · FSSAI Lic. 22725926001018.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 · How the protocol works ─────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
          The protocol
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          How it works
        </h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {PROTOCOL_STEPS.map((step) => (
            <div
              key={step.title}
              className="rounded-2xl bg-nn-surface border border-white/[0.08] p-5 space-y-2.5"
            >
              <span className="w-9 h-9 rounded-xl bg-nn-primary/10 border border-nn-primary/25 flex items-center justify-center">
                <step.icon className="w-4.5 h-4.5 text-nn-primary" aria-hidden />
              </span>
              <h3 className="text-sm font-bold text-white">{step.title}</h3>
              <p className="text-xs text-nn-on-surface-variant leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4 · The science, honestly ──────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
          The science, honestly
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          Claims we can measure. Nothing we can't.
        </h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-nn-surface border border-white/[0.08] p-5 space-y-2.5">
            <span className="w-9 h-9 rounded-xl bg-nn-primary/10 border border-nn-primary/25 flex items-center justify-center">
              <Gauge className="w-4.5 h-4.5 text-nn-primary" aria-hidden />
            </span>
            <h3 className="text-sm font-bold text-white">Low-GI, defined</h3>
            <p className="text-xs text-nn-on-surface-variant leading-relaxed">
              “Low-GI” follows the FSSAI-defined threshold (GI under 55), and each dish carries its
              GI band on the published label — low is a measurement here, not a vibe.
            </p>
          </div>
          <div className="rounded-2xl bg-nn-surface border border-white/[0.08] p-5 space-y-2.5">
            <span className="w-9 h-9 rounded-xl bg-nn-primary/10 border border-nn-primary/25 flex items-center justify-center">
              <Scales className="w-4.5 h-4.5 text-nn-primary" aria-hidden />
            </span>
            <h3 className="text-sm font-bold text-white">Macro caps, printed</h3>
            <p className="text-xs text-nn-on-surface-variant leading-relaxed">{cfg.capsBody}</p>
          </div>
          <div className="rounded-2xl bg-nn-surface border border-white/[0.08] p-5 space-y-2.5">
            <span className="w-9 h-9 rounded-xl bg-nn-primary/10 border border-nn-primary/25 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5 text-nn-primary" aria-hidden />
            </span>
            <h3 className="text-sm font-bold text-white">Allergen governance</h3>
            <p className="text-xs text-nn-on-surface-variant leading-relaxed">
              Structured allergen gating on every order — the kitchen works from your allergen
              list, not a free-text note. Disclosures ride with each dish.
            </p>
          </div>
        </div>
        <p className="text-[11px] text-nn-on-surface-variant leading-relaxed mt-4">
          Macros are lab-informed estimates; when a value is provisional, we label it provisional.
        </p>
        {cfg.marketStat && (
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <p className="text-[10px] uppercase tracking-widest text-nn-on-surface-variant font-semibold">
              {cfg.marketStat.label}
            </p>
            <p className="text-sm text-white/85 leading-relaxed mt-1.5">{cfg.marketStat.body}</p>
          </div>
        )}
      </section>

      {/* ── 5 · Program card ───────────────────────────────────────────── */}
      {plan && (
        <section id="program" className="max-w-5xl mx-auto px-4 py-10 scroll-mt-20">
          <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
            The program
          </p>
          <div className="mt-3 rounded-2xl bg-nn-surface border border-nn-primary/40 p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">{plan.name}</h2>
                <span className="text-[9px] uppercase font-bold tracking-wider bg-nn-primary/15 text-nn-primary border border-nn-primary/30 px-2 py-0.5 rounded-full">
                  RD-designed
                </span>
              </div>
              <p className="text-sm text-nn-on-surface-variant leading-relaxed max-w-xl">
                {plan.tagline}
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-nn-on-surface-variant tabular-nums pt-1">
                <span>{plan.calorieTargetPerDay} kcal/day</span>
                <span>{plan.proteinTargetGrams}g protein/day</span>
                <span>{plan.carbsTargetGrams}g carbs/day</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {plan.badges.map((b) => (
                  <span
                    key={b}
                    className="text-[10px] font-semibold text-white/80 border border-white/[0.1] rounded-full px-2.5 py-1"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0 md:text-right space-y-3">
              <p className="text-3xl font-bold text-nn-primary tabular-nums">
                {formatPrice(planCardPricePaise(plan))}
                <span className="block text-[11px] text-nn-on-surface-variant font-medium mt-1">
                  per week · GST included
                </span>
              </p>
              <Link
                to={`/subscribe?plan=${plan.slug}`}
                onClick={() => trackCta("program_start", `/subscribe?plan=${plan.slug}`)}
                className="inline-flex items-center justify-center gap-2 w-full md:w-auto bg-nn-primary text-stone-900 hover:bg-nn-primary/90 font-bold text-sm h-12 px-6 rounded-xl active:scale-[0.98] transition-transform"
              >
                Start This Program <ArrowRight className="w-4 h-4" weight="bold" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── 6 · Meal evidence ──────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
          Meal evidence
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          Real plates, with their numbers
        </h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {evidenceDishes.map((dish) => (
            <div
              key={dish.slug}
              className="rounded-2xl bg-nn-surface border border-white/[0.08] overflow-hidden flex flex-col"
            >
              <Link
                to={`/dish/${dish.slug}`}
                onClick={() => trackCta("dish_evidence", `/dish/${dish.slug}`)}
                className="block group"
              >
                <div className="h-36 bg-nn-surface-high relative overflow-hidden">
                  <img
                    src={dish.image}
                    alt={dish.name}
                    onError={onDishImageError}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10 text-[9px] font-bold uppercase tracking-wider text-clinical-sage">
                    GI {dish.glycaemicIndex}
                  </span>
                </div>
              </Link>
              <div className="p-4 space-y-2 flex-1 flex flex-col">
                <Link
                  to={`/dish/${dish.slug}`}
                  onClick={() => trackCta("dish_evidence", `/dish/${dish.slug}`)}
                  className="text-sm font-bold text-white hover:text-nn-primary transition-colors"
                >
                  {dish.name}
                </Link>
                <p className="text-[11px] text-nn-on-surface-variant font-mono tabular-nums">
                  {Math.round(dish.macros.calories)} kcal · {Math.round(dish.macros.carbs)}g carbs ·
                  sugar {dish.sugarPerServing}
                </p>
                <div className="pt-1 mt-auto">
                  <NutritionLabelModal dish={dish} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 7 · Safety & scope strip ───────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-6">
        <div className="rounded-2xl border border-clinical-sage/30 bg-clinical-sage/[0.06] p-5 flex items-start gap-3">
          <FirstAid className="w-5 h-5 text-clinical-sage shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">
              Tanmatra complements your doctor's care — it never replaces it.
            </p>
            <p className="text-xs text-nn-on-surface-variant leading-relaxed">
              Share our nutrition data with your physician. Our meals and plans do not diagnose,
              treat or cure any condition, and are not a substitute for medical advice. If you take
              prescription medication, loop your doctor in before changing how you eat.
            </p>
          </div>
        </div>
      </section>

      {/* ── 8 · Dual CTA close ─────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 py-12 text-center space-y-5">
        <h2 className="text-clinical-h2 text-white">Start with a conversation, not a cart.</h2>
        <p className="text-sm text-nn-on-surface-variant max-w-md mx-auto leading-relaxed">
          Fifteen free minutes with a registered dietitian — or try three days of the menu first
          and bring the labels to your next appointment.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to={CONSULT_TARGET}
            onClick={() => trackCta("close_consult", CONSULT_TARGET)}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-nn-primary text-stone-900 hover:bg-nn-primary/90 font-bold text-sm h-12 px-7 rounded-xl active:scale-[0.98] transition-transform"
          >
            <HandHeart className="w-4 h-4" weight="bold" aria-hidden />
            Book the free consult
          </Link>
          <Link
            to="/subscribe?trial=1"
            onClick={() => trackCta("close_trial", "/subscribe?trial=1")}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto border border-white/15 text-white hover:bg-white/5 font-semibold text-sm h-12 px-7 rounded-xl active:scale-[0.98] transition-transform"
          >
            <Stethoscope className="w-4 h-4" aria-hidden />
            Try 3 days first
          </Link>
        </div>
      </section>
    </div>
  );
}
