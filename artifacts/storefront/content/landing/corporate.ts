/**
 * `/corporate-wellness` copy + config — ported from the legacy app
 * (artifacts/tanmatra src/components/landing/CorporateWellnessView.tsx),
 * route-parity Wave B. B2B lander for HR / People teams in the Noida IT parks.
 *
 * The product behind it already exists (company budgets, order windows,
 * consolidated delivery, vouchers, QBR reporting); the page's job is to convert
 * the lead FORM (POST /corporate-leads, kind=corporate) instead of leaking to
 * WhatsApp. The subsidy calculator derives EVERY figure from PER_MEAL_PAISE +
 * GST_RATE (imported live in the island) — no price is hardcoded on this surface.
 *
 * COMPLIANCE: aggregate/anonymised HR reporting only; individual health data
 * stays with the individual. Clinical claims ride on the RD service + the
 * ISO 22000 / FSSAI kitchen, not on the food itself.
 */
import type { LandingBenefit, LandingHero } from "./partners";
import type { FaqItem } from "@/content/faq";

export const CORPORATE_META = {
  title: "Corporate Wellness — macro-labelled team lunches in Noida | Tanmatra",
  description:
    "Subsidised team lunches delivered hot inside Noida IT parks. Company budgets, office order windows, one consolidated delivery per floor, a single GST invoice. Book a 20-minute pilot call.",
};

export const CORPORATE_HERO: LandingHero = {
  eyebrow: "For HR & People teams · Noida IT parks",
  title: "The lunch benefit that shows up in your",
  accent: "health-insurance renewals.",
  subtitle:
    "Subsidised team lunches — fired after the order window closes and delivered hot inside Candor TechSpace, Advant Navis, Stellar 135 and offices across the Noida corridor.",
  trust: [],
};

/** § HR pain math — "Three line items nobody budgets for". */
export const PAIN_TILES: LandingBenefit[] = [
  {
    icon: "lightning",
    title: "The 3 PM energy dip",
    body: "Heavy, oily cafeteria lunches show up as slower afternoons across the floor. A macro-balanced lunch is the cheapest productivity line item you can buy.",
  },
  {
    icon: "fork-knife",
    title: "Cafeteria fatigue",
    body: "Same counter, same menu. Teams drift to delivery apps, long lunch runs, and skipped meals — and the canteen contract still gets paid.",
  },
  {
    icon: "percent",
    title: "The unused wellness budget",
    body: "Gym tie-ups and webinars post single-digit uptake. Lunch is the one benefit every employee uses every working day.",
  },
];

/** § How it works for teams. */
export const HOW_IT_WORKS: LandingBenefit[] = [
  {
    icon: "buildings",
    title: "1 · Set a company budget",
    body: "A company account with a per-employee monthly lunch budget. One consolidated GST invoice — nobody files a lunch expense again.",
  },
  {
    icon: "fork-knife",
    title: "2 · Your team picks",
    body: "Employees choose from the menu inside your office order window — each person’s menu already gated by their own allergen profile.",
  },
  {
    icon: "timer",
    title: "3 · One hot drop per floor",
    body: "When the window closes, the kitchen fires the batch and one consolidated delivery lands per floor — hot, on time, one security clearance.",
  },
];

/** § Clinical differentiator — "A clinical kitchen, not a buffet counter". */
export const DIFFERENTIATORS: LandingBenefit[] = [
  {
    icon: "shield-check",
    title: "Allergen-gated, per person",
    body: "Every employee gets their own allergen- and preference-gated menu, with a published nutrition label on each dish — designed by registered dietitians and cooked in an ISO 22000:2018 kitchen (FSSAI Reg. 22725926001018).",
  },
  {
    icon: "clipboard",
    title: "A quarterly wellness report for HR",
    body: "Participation, budget utilisation and menu trends, aggregated and anonymised every quarter — a benefits line you can actually show leadership. Individual health data is never shared.",
  },
];

export const DELIVERY_DESTINATIONS = [
  "Candor TechSpace · Sector 62",
  "Advant Navis Business Park · Sector 142",
  "Stellar 135 · Noida Expressway",
  "Offices across Sectors 125–135",
];

/** Subsidy-model metadata. The per-employee cost is computed in the island from
 *  PER_MEAL_PAISE × mealsPerMonth × companyShare × (1 + GST_RATE) — see
 *  SubsidyCalculator. Nothing here is a price. */
export type SubsidyModelId = "full" | "split" | "voucher";

export interface SubsidyModel {
  id: SubsidyModelId;
  name: string;
  desc: string;
  mealsPerMonth: number;
  companyShare: number;
}

export const WORKING_LUNCHES_PER_MONTH = 21;
export const VOUCHER_MEALS_PER_MONTH = 12;

export const SUBSIDY_MODELS: SubsidyModel[] = [
  {
    id: "full",
    name: "Full subsidy",
    desc: "The company covers every working lunch. The benefit employees notice on day one.",
    mealsPerMonth: WORKING_LUNCHES_PER_MONTH,
    companyShare: 1,
  },
  {
    id: "split",
    name: "Split subsidy",
    desc: "Company and employee share each lunch 50/50 — half the budget, full participation.",
    mealsPerMonth: WORKING_LUNCHES_PER_MONTH,
    companyShare: 0.5,
  },
  {
    id: "voucher",
    name: "Voucher wallet",
    desc: `A fixed monthly wallet of ${VOUCHER_MEALS_PER_MONTH} meals per employee, spent whenever they like.`,
    mealsPerMonth: VOUCHER_MEALS_PER_MONTH,
    companyShare: 1,
  },
];

export const CORPORATE_FAQ: FaqItem[] = [
  {
    q: "How does invoicing work?",
    a: "One consolidated GST invoice per month against the company account, with cost-centre splits if you need them. Employees never expense a lunch again.",
  },
  {
    q: "Is there a minimum team size?",
    a: "Pilots usually start with a single team or floor — there’s no hard minimum while we prove uptake. Subsidy budgets kick in when you scale.",
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

export const CORPORATE_FORM = {
  kind: "corporate",
  source: "web:/corporate-wellness",
  heading: "Five fields. One working day.",
  blurb: "Tell us who you are and where you sit — our corporate team replies with pilot pricing within one business day.",
  submitLabel: "Request pilot pricing",
  whatsApp: "919289213115",
} as const;
