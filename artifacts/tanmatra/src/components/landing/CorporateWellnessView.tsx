import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowClockwise,
  ArrowRight,
  Buildings,
  Calculator,
  ChatCircleText,
  CheckCircle,
  ClipboardText,
  EnvelopeSimple,
  ForkKnife,
  Lightning,
  MapPin,
  PaperPlaneTilt,
  Percent,
  Phone,
  ShieldCheck,
  Timer,
  Warning,
} from "@phosphor-icons/react";
import { PER_MEAL_PAISE, GST_RATE } from "@workspace/subscription-rules";
import { formatPrice } from "@/lib/api/adapter";
import { API_BASE } from "@/lib/apiBase";
import { track } from "@/lib/analytics";
import LandingTopBar from "@/components/landing/LandingTopBar";
import LandingFaq, { type LandingFaqItem } from "@/components/landing/LandingFaq";
import { useLandingAnalytics } from "@/components/landing/useLandingAnalytics";

/**
 * `/corporate-wellness` — Playbook §3.3. B2B page for HR directors in the
 * Noida IT parks. The product behind it already exists (company budgets,
 * office order windows, consolidated delivery, vouchers, QBR reporting) —
 * this page's job is to stop the WhatsApp lead leak: the lead FORM is the
 * primary conversion, WhatsApp/phone demoted to secondary contact.
 *
 * The subsidy calculator derives every figure from PER_MEAL_PAISE — no
 * hardcoded prices anywhere on this surface.
 */

type SubsidyModel = "full" | "split" | "voucher";
type TeamSizeBand = "1-20" | "21-100" | "101-500" | "500+";

const LEAD_SOURCE = "corporate-wellness";
const WORKING_LUNCHES_PER_MONTH = 21;
const VOUCHER_MEALS_PER_MONTH = 12;
const SPLIT_COMPANY_SHARE = 0.5;
const GST_PCT = Math.round(GST_RATE * 100);
const CONTACT_EMAIL = "care@tanmatra.health";
const CONTACT_PHONE_DISPLAY = "+91 92892 13115";
const CONTACT_PHONE_E164 = "+919289213115";

const SUBSIDY_MODELS: Record<
  SubsidyModel,
  { name: string; desc: string; mealsPerMonth: number; companyShare: number }
> = {
  full: {
    name: "Full subsidy",
    desc: "The company covers every working lunch. The benefit employees notice on day one.",
    mealsPerMonth: WORKING_LUNCHES_PER_MONTH,
    companyShare: 1,
  },
  split: {
    name: "Split subsidy",
    desc: "Company and employee share each lunch 50/50 — half the budget, full participation.",
    mealsPerMonth: WORKING_LUNCHES_PER_MONTH,
    companyShare: SPLIT_COMPANY_SHARE,
  },
  voucher: {
    name: "Voucher wallet",
    desc: `A fixed monthly wallet of ${VOUCHER_MEALS_PER_MONTH} meals per employee, spent whenever they like.`,
    mealsPerMonth: VOUCHER_MEALS_PER_MONTH,
    companyShare: 1,
  },
};

const TEAM_SIZE_BANDS: TeamSizeBand[] = ["1-20", "21-100", "101-500", "500+"];

function bandForTeamSize(n: number): TeamSizeBand {
  if (n <= 20) return "1-20";
  if (n <= 100) return "21-100";
  if (n <= 500) return "101-500";
  return "500+";
}

/** GST-inclusive monthly employer cost for one employee under a model. */
function perEmployeeMonthlyPaise(model: SubsidyModel): number {
  const m = SUBSIDY_MODELS[model];
  return Math.round(m.mealsPerMonth * PER_MEAL_PAISE * m.companyShare * (1 + GST_RATE));
}

const PAIN_TILES = [
  {
    icon: Lightning,
    title: "The 3 PM energy dip",
    body: "Heavy, oily cafeteria lunches show up as slower afternoons across the floor. A macro-balanced lunch is the cheapest productivity line item you can buy.",
  },
  {
    icon: ForkKnife,
    title: "Cafeteria fatigue",
    body: "Same counter, same menu. Teams drift to delivery apps, long lunch runs, and skipped meals — and the canteen contract still gets paid.",
  },
  {
    icon: Percent,
    title: "The unused wellness budget",
    body: "Gym tie-ups and webinars post single-digit uptake. Lunch is the one benefit every employee uses every working day.",
  },
];

const HOW_IT_WORKS = [
  {
    icon: Buildings,
    title: "1 · Set a company budget",
    body: "A company account with a per-employee monthly lunch budget. One consolidated GST invoice — nobody files a lunch expense again.",
  },
  {
    icon: ForkKnife,
    title: "2 · Your team picks",
    body: "Employees choose from the RD-designed menu inside your office order window — each person's menu already gated by their own allergen profile.",
  },
  {
    icon: Timer,
    title: "3 · One hot drop per floor",
    body: "When the window closes, the kitchen fires the batch and one consolidated delivery lands per floor — hot, on time, one security clearance.",
  },
];

const DELIVERY_DESTINATIONS = [
  "Candor TechSpace · Sector 62",
  "Advant Navis Business Park · Sector 142",
  "Stellar 135 · Noida Expressway",
  "Offices across Sectors 125–135",
];

const FAQ_ITEMS: LandingFaqItem[] = [
  {
    q: "How does invoicing work?",
    a: "One consolidated GST invoice per month against the company account, with cost-centre splits if you need them. Employees never expense a lunch again.",
  },
  {
    q: "Is there a minimum team size?",
    a: "Pilots usually start with a single team or floor — there's no hard minimum while we prove uptake. Subsidy budgets kick in when you scale.",
  },
  {
    q: "How do deliveries clear park security?",
    a: "One consolidated drop per office per order window, by a registered rider — a single gate clearance instead of a lobby full of individual couriers.",
  },
  {
    q: "What about employees with allergies or health conditions?",
    a: "Every employee sets a private allergen and preference profile, and the menu they see is already gated by it. HR reporting is aggregate and anonymised — individual health data stays with the individual.",
  },
  {
    q: "Can we trial a floor before committing?",
    a: "Yes. We run a subsidised trial week for one floor or team so you can watch real uptake before you set a budget.",
  },
];

export default function CorporateWellnessView() {
  const { sector, trackCta } = useLandingAnalytics("corporate-wellness");

  // ── Calculator state ──────────────────────────────────────────────────
  const [teamSize, setTeamSize] = useState(40);
  const [model, setModel] = useState<SubsidyModel>("full");
  const lastCalcSignature = useRef<string | null>(null);

  const fireCalculatorUsed = (nextTeamSize: number, nextModel: SubsidyModel) => {
    const signature = `${bandForTeamSize(nextTeamSize)}:${nextModel}`;
    if (lastCalcSignature.current === signature) return;
    lastCalcSignature.current = signature;
    track("corporate_calculator_used", {
      team_size_band: bandForTeamSize(nextTeamSize),
      subsidy_model: nextModel,
    });
  };

  const monthlyCostPaise = useMemo(
    () => teamSize * perEmployeeMonthlyPaise(model),
    [teamSize, model],
  );

  // ── Lead form state ───────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [company, setCompany] = useState("");
  const [teamSizeBand, setTeamSizeBand] = useState<TeamSizeBand | "">("");
  const [parkOrSector, setParkOrSector] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [validationError, setValidationError] = useState<string | null>(null);

  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `Corporate pilot enquiry — ${company.trim() || "my team"}`,
  )}&body=${encodeURIComponent(
    `Name: ${name}\nWork email: ${workEmail}\nCompany: ${company}\nTeam size: ${teamSizeBand}\nPark / sector: ${parkOrSector}\n\nPlease send pilot pricing.`,
  )}`;

  const submitLead = async () => {
    setValidationError(null);
    // Mirrors the server's leadSchema (name/company min 2 chars) so users get
    // a friendly message instead of a 400.
    if (name.trim().length < 2 || workEmail.trim().length === 0 || company.trim().length < 2 || !teamSizeBand) {
      setValidationError("Name, work email, company and team size are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail.trim())) {
      setValidationError("That email doesn't look right — check the address.");
      return;
    }
    trackCta("lead_submit", "/corporate-leads");
    setStatus("submitting");
    try {
      const res = await fetch(`${API_BASE}/corporate-leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "corporate",
          name: name.trim(),
          workEmail: workEmail.trim(),
          company: company.trim(),
          teamSizeBand,
          parkOrSector: parkOrSector.trim(),
          source: LEAD_SOURCE,
        }),
      });
      if (!res.ok) throw new Error(`corporate-leads ${res.status}`);
      setStatus("success");
      // PII never enters analytics — bands and sector text only (§8.4).
      track("corporate_lead_submitted", {
        company_size_band: teamSizeBand,
        park_or_sector: parkOrSector.trim(),
        source: LEAD_SOURCE,
      });
    } catch {
      setStatus("error");
    }
  };

  const inputClasses =
    "w-full rounded-xl bg-nn-bg border border-white/[0.1] px-3.5 min-h-[48px] text-sm text-white " +
    "placeholder:text-nn-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-nn-primary focus:border-nn-primary/50";

  return (
    <div className="nn-clinical bg-nn-bg text-white min-h-dvh pb-16">
      <LandingTopBar
        ctaLabel="Get pilot pricing"
        ctaTo="#pilot-form"
        onCtaClick={() => trackCta("topbar_pilot", "#pilot-form")}
      />

      {/* ── 1 · Hero ───────────────────────────────────────────────────── */}
      <section className="pt-12 md:pt-16 pb-10 px-4 text-center max-w-3xl mx-auto space-y-5">
        <p className="text-[11px] uppercase tracking-widest text-nn-primary font-semibold">
          {sector
            ? `Delivering into Sector ${sector} daily`
            : "For HR & People teams · Noida IT parks"}
        </p>
        <h1 className="text-clinical-h1 md:text-[clamp(2.1rem,1.4rem+2.2vw,3rem)] md:leading-[1.08] tracking-tight font-extrabold text-white">
          The lunch benefit that shows up in your health-insurance renewals.
        </h1>
        <p className="text-sm sm:text-base text-nn-on-surface-variant max-w-xl mx-auto leading-relaxed">
          RD-designed, subsidised team lunches — fired after the order window closes and delivered
          hot inside Candor TechSpace, Advant Navis, Stellar 135 and offices across the Noida
          corridor.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
          <a
            href="#pilot-form"
            onClick={() => trackCta("hero_pilot_call", "#pilot-form")}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-nn-primary text-stone-900 hover:bg-nn-primary/90 font-bold text-sm h-12 px-7 rounded-xl active:scale-[0.98] transition-transform"
          >
            Book a 20-min pilot call <ArrowRight className="w-4 h-4" weight="bold" aria-hidden />
          </a>
          <a
            href="#how-it-works"
            onClick={() => trackCta("hero_how_it_works", "#how-it-works")}
            className="inline-flex items-center justify-center w-full sm:w-auto border border-white/15 text-white hover:bg-white/5 font-semibold text-sm h-12 px-7 rounded-xl active:scale-[0.98] transition-transform"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* ── 2 · HR pain math ───────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
          The math HR already knows
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          Three line items nobody budgets for
        </h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {PAIN_TILES.map((tile) => (
            <div
              key={tile.title}
              className="rounded-2xl bg-nn-surface border border-white/[0.08] p-5 space-y-2.5"
            >
              <span className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                <tile.icon className="w-4.5 h-4.5 text-nn-primary" aria-hidden />
              </span>
              <h3 className="text-sm font-bold text-white">{tile.title}</h3>
              <p className="text-xs text-nn-on-surface-variant leading-relaxed">{tile.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3 · How it works for teams ─────────────────────────────────── */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-4 py-10 scroll-mt-20">
        <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
          Built on the live product
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          How it works for teams
        </h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {HOW_IT_WORKS.map((step) => (
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

      {/* ── 4 · Subsidy models + calculator ────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
          Subsidy models
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          Pick a model, see the number
        </h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.keys(SUBSIDY_MODELS) as SubsidyModel[]).map((key) => {
            const m = SUBSIDY_MODELS[key];
            const active = model === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setModel(key);
                  fireCalculatorUsed(teamSize, key);
                }}
                className={`text-left rounded-2xl bg-nn-surface border p-5 space-y-2 transition-all active:scale-[0.99] ${
                  active ? "border-nn-primary/60" : "border-white/[0.08] hover:border-white/[0.16]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">{m.name}</h3>
                  {active && (
                    <span className="text-[9px] uppercase font-bold tracking-wider bg-nn-primary text-stone-900 px-2 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-nn-on-surface-variant leading-relaxed">{m.desc}</p>
                <p className="text-sm font-extrabold text-nn-primary tabular-nums pt-1">
                  {formatPrice(perEmployeeMonthlyPaise(key))}
                  <span className="text-[10px] text-nn-on-surface-variant font-medium">
                    {" "}
                    /employee/month
                  </span>
                </p>
              </button>
            );
          })}
        </div>

        {/* Interactive calculator */}
        <div className="mt-4 rounded-2xl border border-nn-primary/30 bg-nn-primary/[0.05] p-6 md:p-7">
          <div className="flex items-center gap-2.5 mb-5">
            <Calculator className="w-5 h-5 text-nn-primary" aria-hidden />
            <h3 className="text-base font-bold text-white">Your monthly estimate</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="corp-team-size"
                  className="flex items-center justify-between text-xs font-semibold text-nn-on-surface-variant"
                >
                  Team size
                  <span className="text-white text-base font-extrabold tabular-nums">
                    {teamSize}
                  </span>
                </label>
                <input
                  id="corp-team-size"
                  type="range"
                  min={5}
                  max={500}
                  step={5}
                  value={teamSize}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setTeamSize(next);
                    fireCalculatorUsed(next, model);
                  }}
                  className="w-full mt-2 h-11 accent-[var(--color-nn-primary)] cursor-pointer"
                  aria-valuetext={`${teamSize} employees`}
                />
                <p className="text-[10px] text-nn-on-surface-variant mt-0.5">
                  Band: {bandForTeamSize(teamSize)} · {SUBSIDY_MODELS[model].mealsPerMonth} lunches
                  per employee per month
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-nn-bg/70 border border-white/[0.08] p-5 text-center md:text-right">
              <p className="text-[10px] uppercase tracking-widest text-nn-on-surface-variant font-semibold">
                {SUBSIDY_MODELS[model].name} · {teamSize} people
              </p>
              <p className="text-3xl md:text-4xl font-extrabold text-nn-primary tabular-nums mt-1">
                {formatPrice(monthlyCostPaise)}
                <span className="text-xs text-nn-on-surface-variant font-medium"> /month</span>
              </p>
              <p className="text-[11px] text-nn-on-surface-variant tabular-nums mt-1">
                {formatPrice(perEmployeeMonthlyPaise(model))} per employee · GST included
              </p>
            </div>
          </div>
          <p className="text-[10px] text-nn-on-surface-variant leading-relaxed mt-4">
            Estimated at the list rate of {formatPrice(PER_MEAL_PAISE)} per meal + {GST_PCT}% GST.
            Pilot pricing is customised to team size and park — the form below gets you the real
            number.
          </p>
        </div>
      </section>

      {/* ── 5 · Clinical differentiator ────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold">
          Not a caterer
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
          A clinical kitchen, not a buffet counter
        </h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-nn-surface border border-white/[0.08] p-5 space-y-2.5">
            <span className="w-9 h-9 rounded-xl bg-nn-primary/10 border border-nn-primary/25 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5 text-nn-primary" aria-hidden />
            </span>
            <h3 className="text-sm font-bold text-white">Allergen-gated, per person</h3>
            <p className="text-xs text-nn-on-surface-variant leading-relaxed">
              Every employee gets their own allergen- and preference-gated menu, with a published
              nutrition label on each dish — designed by registered dietitians and cooked in an ISO
              22000:2018 kitchen (FSSAI Lic. 22725926001018).
            </p>
          </div>
          <div className="rounded-2xl bg-nn-surface border border-white/[0.08] p-5 space-y-2.5">
            <span className="w-9 h-9 rounded-xl bg-nn-primary/10 border border-nn-primary/25 flex items-center justify-center">
              <ClipboardText className="w-4.5 h-4.5 text-nn-primary" aria-hidden />
            </span>
            <h3 className="text-sm font-bold text-white">A quarterly wellness report for HR</h3>
            <p className="text-xs text-nn-on-surface-variant leading-relaxed">
              Participation, budget utilisation and menu trends, aggregated and anonymised every
              quarter — a benefits line you can actually show leadership. Individual health data is
              never shared.
            </p>
          </div>
        </div>
      </section>

      {/* ── 6 · Delivery destinations ──────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-[10px] uppercase tracking-widest text-nn-on-surface-variant font-semibold mb-3">
          Where we already deliver daily
        </p>
        <div className="flex flex-wrap gap-2">
          {DELIVERY_DESTINATIONS.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1.5 text-xs text-white/80 border border-white/[0.1] bg-nn-surface rounded-full px-3.5 py-2"
            >
              <MapPin className="w-3.5 h-3.5 text-nn-primary" aria-hidden />
              {d}
            </span>
          ))}
        </div>
      </section>

      {/* ── 7 · Lead form (the fix for the WhatsApp leak) ──────────────── */}
      <section id="pilot-form" className="max-w-5xl mx-auto px-4 py-10 scroll-mt-20">
        <div className="max-w-xl mx-auto">
          <p className="text-[10px] uppercase tracking-widest text-nn-primary font-semibold text-center">
            Pilot pricing
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 text-center">
            Five fields. One working day.
          </h2>
          <p className="text-xs text-nn-on-surface-variant text-center mt-1.5 mb-6">
            Tell us who you are and where you sit — our corporate team replies with pilot pricing
            within one business day.
          </p>

          {status === "success" ? (
            <div className="rounded-2xl border border-clinical-sage/40 bg-clinical-sage/[0.08] p-8 text-center space-y-3">
              <CheckCircle className="w-10 h-10 text-clinical-sage mx-auto" weight="fill" aria-hidden />
              <h3 className="text-lg font-bold text-white">Request received.</h3>
              <p className="text-sm text-nn-on-surface-variant leading-relaxed">
                Our corporate team will reach out to {company.trim() || "you"} within one business
                day with pilot pricing and a proposed trial floor.
              </p>
              <Link
                to="/menu"
                onClick={() => trackCta("success_browse_menu", "/menu")}
                className="inline-flex items-center justify-center gap-2 border border-white/15 text-white hover:bg-white/5 font-semibold text-sm h-12 px-6 rounded-xl active:scale-[0.98] transition-transform"
              >
                Browse the menu meanwhile <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <form
              className="rounded-2xl bg-nn-surface border border-white/[0.08] p-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitLead();
              }}
              noValidate
            >
              <div>
                <label htmlFor="corp-name" className="block text-xs font-semibold text-nn-on-surface-variant mb-1.5">
                  Your name
                </label>
                <input
                  id="corp-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Priya Sharma"
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="corp-email" className="block text-xs font-semibold text-nn-on-surface-variant mb-1.5">
                  Work email
                </label>
                <input
                  id="corp-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  placeholder="priya@company.com"
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="corp-company" className="block text-xs font-semibold text-nn-on-surface-variant mb-1.5">
                  Company
                </label>
                <input
                  id="corp-company"
                  type="text"
                  autoComplete="organization"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company name"
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="corp-band" className="block text-xs font-semibold text-nn-on-surface-variant mb-1.5">
                  Team size
                </label>
                <select
                  id="corp-band"
                  required
                  value={teamSizeBand}
                  onChange={(e) => setTeamSizeBand(e.target.value as TeamSizeBand | "")}
                  className={`${inputClasses} appearance-none cursor-pointer ${teamSizeBand ? "" : "text-nn-on-surface-variant/50"}`}
                >
                  <option value="" disabled>
                    Select a band
                  </option>
                  {TEAM_SIZE_BANDS.map((band) => (
                    <option key={band} value={band}>
                      {band} people
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="corp-park" className="block text-xs font-semibold text-nn-on-surface-variant mb-1.5">
                  Park / sector
                </label>
                <input
                  id="corp-park"
                  type="text"
                  value={parkOrSector}
                  onChange={(e) => setParkOrSector(e.target.value)}
                  placeholder="e.g. Candor TechSpace, Sector 62"
                  className={inputClasses}
                />
              </div>

              {validationError && (
                <p role="alert" className="text-xs text-nn-error flex items-center gap-1.5">
                  <Warning className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  {validationError}
                </p>
              )}

              {status === "error" && (
                <div
                  role="alert"
                  className="rounded-xl border border-nn-error/40 bg-nn-error-container/20 p-4 space-y-2.5"
                >
                  <p className="text-xs text-white flex items-start gap-1.5 leading-relaxed">
                    <Warning className="w-4 h-4 text-nn-error shrink-0" aria-hidden />
                    We couldn't submit your details right now. Nothing was lost — retry, or email
                    us directly and we'll pick it up.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-1.5 border border-white/20 text-white hover:bg-white/5 font-semibold text-xs h-11 px-4 rounded-xl active:scale-[0.98] transition-transform"
                    >
                      <ArrowClockwise className="w-3.5 h-3.5" aria-hidden /> Retry
                    </button>
                    <a
                      href={mailtoHref}
                      onClick={() => trackCta("lead_mailto_fallback", "mailto")}
                      className="inline-flex items-center justify-center gap-1.5 border border-white/20 text-white hover:bg-white/5 font-semibold text-xs h-11 px-4 rounded-xl active:scale-[0.98] transition-transform"
                    >
                      <EnvelopeSimple className="w-3.5 h-3.5" aria-hidden /> Email {CONTACT_EMAIL}
                    </a>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full inline-flex items-center justify-center gap-2 bg-nn-primary text-stone-900 hover:bg-nn-primary/90 font-bold text-sm h-12 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:pointer-events-none"
              >
                {status === "submitting" ? (
                  "Sending…"
                ) : (
                  <>
                    Get pilot pricing <PaperPlaneTilt className="w-4 h-4" weight="bold" aria-hidden />
                  </>
                )}
              </button>

              <p className="text-[10px] text-nn-on-surface-variant text-center leading-relaxed">
                Prefer to talk first? Call{" "}
                <a
                  href={`tel:${CONTACT_PHONE_E164}`}
                  onClick={() => trackCta("phone_secondary", "tel")}
                  className="text-white/80 hover:text-nn-primary underline-offset-2 hover:underline"
                >
                  <Phone className="w-3 h-3 inline align-[-1px]" aria-hidden /> {CONTACT_PHONE_DISPLAY}
                </a>{" "}
                or{" "}
                <a
                  href={`https://wa.me/${CONTACT_PHONE_E164.replace("+", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackCta("whatsapp_secondary", "wa.me")}
                  className="text-white/80 hover:text-nn-primary underline-offset-2 hover:underline"
                >
                  <ChatCircleText className="w-3 h-3 inline align-[-1px]" aria-hidden /> WhatsApp us
                </a>
                — the form is still the fastest route to pilot pricing.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── 8 · FAQ ────────────────────────────────────────────────────── */}
      <LandingFaq heading="What HR asks us" items={FAQ_ITEMS} />
    </div>
  );
}
