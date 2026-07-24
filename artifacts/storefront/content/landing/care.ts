/**
 * `/care/:condition` copy + config — ported from the legacy app
 * (artifacts/tanmatra src/components/landing/CareLandingView.tsx), route-parity
 * Wave B. One template, two launches (PCOS, diabetes).
 *
 * COMPLIANCE-CRITICAL (Playbook §7.6 — FSSAI A&C Regs 2018): all condition copy
 * is diet-DESCRIPTIVE ("low-GI, measured", "hormone-aware menu"), NEVER disease-
 * suitability ("treats / manages / prevents / cures" is barred; diabetes sits on
 * the DMR Act schedule). The clinical promise rides EXCLUSIVELY on the RD consult
 * SERVICE (→ the /rd directory). The food only ever claims its measurable numbers
 * and our process. Copy here is VERBATIM from the legacy page — do not add outcome
 * or efficacy claims without legal review.
 *
 * PLAN: the legacy `planSlug` (pcos-balance / diabetic-friendly) was DEAD RD_PLANS
 * data. Both conditions map to the storefront's authoritative low-GI clinical plan
 * `steady` (PLAN_CATALOG), rendered via PlanCard (server-priced). No fabricated price.
 */
import type { PlanId } from "@workspace/subscription-rules";
import type { LandingBenefit } from "./partners";

export type CareCondition = "pcos" | "diabetes";
export const CARE_CONDITIONS: CareCondition[] = ["pcos", "diabetes"];

export function isCareCondition(v: unknown): v is CareCondition {
  return v === "pcos" || v === "diabetes";
}

/** The RD-consult CTA target — the /rd directory (clinical desk). */
export const CONSULT_HREF = "/rd";

export interface CareConfig {
  metaTitle: string;
  metaDescription: string;
  conditionLabel: string;
  protocolLabel: string;
  heroTitle: string;
  heroSub: string;
  /** Storefront plan this condition maps to (authoritative pricing). */
  planId: PlanId;
  /** Diet-descriptive macro-caps card body. */
  capsBody: string;
  marketStat: { label: string; body: string } | null;
  /** How CareEvidence sorts the low-GI plates. */
  dishSort: "fiber_desc" | "sugar_asc";
}

export const CARE_CONFIG: Record<CareCondition, CareConfig> = {
  pcos: {
    metaTitle: "Hormone-Aware Meals, Designed by RDs | Tanmatra Care",
    metaDescription:
      "A low-GI, anti-inflammatory, fibre-forward menu designed by registered dietitians, plus a free 15-minute RD intro consult. Published nutrition on every dish, delivered hot across Noida.",
    conditionLabel: "PCOS",
    protocolLabel: "Hormone-aware menu",
    heroTitle: "Hormone-aware meals, designed by RDs — not influencers.",
    heroSub:
      "A low-GI, anti-inflammatory, fibre-and-omega-3-forward menu built by registered dietitians — with the numbers published on every dish. The clinical thinking comes from your RD, in a free 15-minute consult.",
    planId: "steady",
    capsBody:
      "Low-GI carbs, a 100g/day protein floor, magnesium-rich greens and omega-3 sources — the low-GI rotation is built to those specs and each plate’s numbers are printed on its label.",
    marketStat: null,
    dishSort: "fiber_desc",
  },
  diabetes: {
    metaTitle: "Low-GI, Sugar-Conscious Meals — Measured, Not Marketed | Tanmatra Care",
    metaDescription:
      "Published GI bands, carbs and sugar on every dish, with meals held to measured caps — and a free 15-minute consult with a registered dietitian. Delivered hot across Noida.",
    conditionLabel: "Diabetes",
    protocolLabel: "Sugar-conscious menu",
    heroTitle: "Low-GI, measured — not marketed.",
    heroSub:
      "Low-GI here means the FSSAI-defined band, and we publish each dish’s GI band, carbs and sugar per serving. What the numbers mean for you is a conversation with a registered dietitian — the first 15 minutes are free.",
    planId: "steady",
    capsBody:
      "The sugar-conscious rotation holds every meal to ≤45g carbs and ≤8g sugar, pairs protein with fibre on each plate, and prints GI band, carbs and sugar per serving on the label.",
    marketStat: {
      label: "Market context — ICMR-INDIAB, Lancet 2023",
      body: "11.4% of Indian adults — about 101 million people — live with diabetes. We think that number deserves published food data: per-dish GI bands, carbs and sugar you can take to your doctor.",
    },
    dishSort: "sugar_asc",
  },
};

export const PROTOCOL_STEPS: LandingBenefit[] = [
  {
    icon: "clipboard",
    title: "1 · RD intake",
    body: "A free 15-minute intro consult: your history, routines, preferences, allergens — and your labs, if you’d like to share them.",
  },
  {
    icon: "check",
    title: "2 · A personalised low-GI plan",
    body: "Your RD assembles a weekly rotation from the program and calibrates portions to the targets you agree on together.",
  },
  {
    icon: "users",
    title: "3 · Weekly adjustments",
    body: "Check in through your RD chat. The plan adjusts week by week as your routine, appetite and priorities change.",
  },
];

/** The two condition-independent "science, honestly" cards. The middle card
 *  (macro caps) is per-condition — injected from cfg.capsBody in the page. */
export const SCIENCE_LOW_GI: LandingBenefit = {
  icon: "percent",
  title: "Low-GI, defined",
  body: "“Low-GI” follows the FSSAI-defined threshold (GI under 55), and each dish carries its GI band on the published label — low is a measurement here, not a vibe.",
};
export const SCIENCE_ALLERGEN: LandingBenefit = {
  icon: "shield-check",
  title: "Allergen governance",
  body: "Structured allergen gating on every order — the kitchen works from your allergen list, not a free-text note. Disclosures ride with each dish.",
};

/** Safety / scope strip — VERBATIM, compliance-critical. */
export const CARE_SAFETY = {
  headline: "Tanmatra complements your doctor’s care — it never replaces it.",
  body: "Share our nutrition data with your physician. Our meals and plans do not diagnose, treat or cure any condition, and are not a substitute for medical advice. If you take prescription medication, loop your doctor in before changing how you eat.",
};

export const CARE_CLOSE = {
  headline: "Start with a conversation, not a cart.",
  body: "Fifteen free minutes with a registered dietitian — or try three days of the menu first and bring the labels to your next appointment.",
};
