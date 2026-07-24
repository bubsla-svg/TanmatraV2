/**
 * `/performance` + `/clinical` copy + config — ported from the shared legacy
 * `Protocol` template (artifacts/tanmatra src/tanmatra-v2/Protocol.tsx),
 * route-parity Wave B. (The template's third variant, `wellness`, is a separate,
 * heavier page shipped later.)
 *
 * COMPLIANCE: the legacy `clinical` copy pre-dated the compliance rewrite and
 * used disease-suitability language ("medical nutrition therapy for diabetes,
 * cardiovascular, renal..."). This port applies the SAME discipline as the newer
 * /care pages (FSSAI A&C Regs §7.6): food copy is diet-DESCRIPTIVE and measurable;
 * the clinical promise rides on the RD consult SERVICE; and the clinical page
 * carries the verbatim safety/scope disclaimer (CARE_SAFETY). Performance copy
 * has no disease claims and is kept close to the original.
 *
 * PLAN: legacy `plansForProtocol(RD_PLANS,...)` is DEAD. Map to PLAN_CATALOG:
 * performance → `protein_build`, clinical → `steady` (rendered via PlanCard,
 * server-priced). No fabricated price.
 */
import type { PlanId } from "@workspace/subscription-rules";
import type { LandingBenefit } from "./partners";

export type ProtocolKey = "performance" | "clinical" | "wellness";
export const PROTOCOL_KEYS: ProtocolKey[] = ["performance", "clinical", "wellness"];

export interface ProtocolConfig {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  headline: string;
  accent: string;
  desc: string;
  pillars: LandingBenefit[];
  featuredLabel: string;
  featuredSub: string;
  /** Storefront plan for this protocol (authoritative pricing). */
  planId: PlanId;
  /** Dish-rail filter + badge selector. */
  filter: ProtocolKey;
  /** Specialty keywords that select the RDs shown (matched on rdApi specialties). */
  rdKeywords: string[];
  /** Clinical carries the safety/scope disclaimer + an RD-consult primary CTA. */
  clinical: boolean;
}

export const PROTOCOL_CONFIG: Record<ProtocolKey, ProtocolConfig> = {
  performance: {
    metaTitle: "Performance Protocol | Tanmatra",
    metaDescription:
      "High-protein, macro-calibrated meals built for athletes, gym-goers, and anyone optimising for physical performance and recovery.",
    eyebrow: "Performance Protocol",
    headline: "Athletic nutrition for",
    accent: "peak output.",
    desc: "High-protein, recovery-tuned plates — engineered for muscle protein synthesis, glycogen replenishment and recovery. Every gram is printed on the label; macro ratios are informed by exercise-physiology research.",
    pillars: [
      {
        icon: "trend-up",
        title: "Muscle protein synthesis",
        body: "Leucine-rich protein, 18g+ per plate, to support the muscle-building signal after training.",
      },
      {
        icon: "timer",
        title: "Glycogen replenishment",
        body: "Carbohydrate timing built in — higher-GI options post-workout, complex carbs to fuel the session.",
      },
      {
        icon: "lightning",
        title: "Recovery-tuned",
        body: "Tart cherry, turmeric and omega-3 sources to support recovery between sessions.",
      },
    ],
    featuredLabel: "Top protein-dense picks",
    featuredSub: "The highest-protein dishes that pass the Performance criteria (≥18g protein).",
    planId: "protein_build",
    filter: "performance",
    rdKeywords: ["sport", "muscle", "performance", "recomposition", "lean"],
    clinical: false,
  },
  clinical: {
    metaTitle: "Clinical Nutrition Protocol | Tanmatra",
    metaDescription:
      "RD-supervised, low-GI therapeutic meals with published nutrition on every dish. The clinical thinking comes from your registered dietitian, in a free 15-minute consult.",
    eyebrow: "Clinical Protocol",
    headline: "Therapeutic nutrition,",
    accent: "RD-supervised.",
    desc: "Low-GI, sugar-capped, controlled-sodium meals — built to measurable specs and RD-signed before dispatch, with the numbers published on every dish. What the numbers mean for you is a conversation with a registered dietitian; the first 15 minutes are free.",
    pillars: [
      {
        icon: "scale",
        title: "Built to measurable specs",
        body: "Low-GI carbs, capped sugar and controlled sodium — the specs are printed on every label, RD-signed before it leaves the kitchen.",
      },
      {
        icon: "clipboard",
        title: "Care-team friendly",
        body: "Weekly plans and per-dish nutrition labels you can share with your doctor or dietitian.",
      },
      {
        icon: "shield-check",
        title: "Claims we can measure",
        body: "Diet-descriptive, measurable claims only — no outcome promises. The clinical thinking rides on your RD consult, not the food.",
      },
    ],
    featuredLabel: "Lowest-sugar clinical picks",
    featuredSub: "RD-verified, low-GI dishes that pass the Clinical criteria, sorted by lowest sugar per serving.",
    planId: "steady",
    filter: "clinical",
    rdKeywords: ["diabet", "pcos", "cardio", "cholesterol", "clinical", "ibs", "gut"],
    clinical: true,
  },
  wellness: {
    metaTitle: "Wellness Protocol — Preventive, Everyday Nutrition | Tanmatra",
    metaDescription:
      "Preventive, longevity-leaning meals — high-fibre, low-GI, and gentle on sodium and sugar. RD-portioned for daily energy and gut health, with published nutrition on every dish.",
    eyebrow: "Wellness Protocol",
    headline: "Preventive nutrition for",
    accent: "everyday vitality.",
    desc: "Balanced, RD-portioned meals for daily energy and gut health — high-fibre, low-glycaemic, and gentle on sodium and sugar, with the numbers published on every dish.",
    pillars: [
      {
        icon: "shield-check",
        title: "Anti-inflammatory leaning",
        body: "Micronutrient-dense plates that prioritise anti-inflammatory whole-food ingredients.",
      },
      {
        icon: "check",
        title: "Gut-health forward",
        body: "12g+ fibre per meal to support a healthy microbiome — printed on every label.",
      },
      {
        icon: "timer",
        title: "Sustainable",
        body: "Portioned for the long run — habits you can actually keep, not a crash reset.",
      },
    ],
    featuredLabel: "Wellness-aligned picks",
    featuredSub: "High-fibre, low-glycaemic plates that pass the Wellness criteria.",
    planId: "desk_fuel",
    filter: "wellness",
    rdKeywords: ["wellness", "family", "senior", "longevity", "general", "gut"],
    clinical: false,
  },
};
