/**
 * Partner / segment landing copy — ported from the legacy app
 * (artifacts/tanmatra src/pages/GymsLanding.tsx + MorningFitnessLanding.tsx) as
 * part of route-parity Wave B. Kept as data so the RSC pages + landing kit
 * stay under the component cap and every claim is reviewable in one place.
 *
 * Both segments POST to the SAME lead endpoint the storefront already owns
 * (POST /corporate-leads via lib/corporateApi.ts) — see CorporateLeadForm. The
 * only per-page differences are the `kind` tag, the `source` attribution, and
 * the copy below.
 *
 * COMPLIANCE NOTE: this is B2B marketing copy. Any per-person health claim
 * stays diet-descriptive; the therapeutic promise rides on the RD service, not
 * the food. The gym "revenue" figure is an explicitly-captioned marketing
 * ESTIMATE, never a quote — nothing here is charged.
 */
import type { CorporateLeadKind } from "@/lib/corporateApi";

export type LandingIconName =
  | "trend-up"
  | "percent"
  | "smartphone"
  | "clock"
  | "coffee"
  | "users"
  | "check"
  | "map-pin"
  | "arrow-right";

export interface LandingBenefit {
  icon: LandingIconName;
  title: string;
  body: string;
}

export interface LandingHero {
  eyebrow: string;
  /** Plain lead-in of the headline. */
  title: string;
  /** Gold-accented completion of the headline. */
  accent: string;
  subtitle: string;
  /** Trust chips under the CTA — each is [icon, label]. */
  trust: { icon: LandingIconName; label: string }[];
}

export interface LandingForm {
  kind: CorporateLeadKind;
  source: string;
  heading: string;
  blurb: string;
  submitLabel: string;
  /** Digits-only WhatsApp number for the wa.me fallback link. */
  whatsApp: string;
}

/** WhatsApp coordination line — the confirmed Tanmatra support number. */
export const PARTNER_WHATSAPP = "919289213115";

export interface GymModel {
  tag: string;
  title: string;
  body: string;
  points: string[];
}

/** Gym revenue-estimator inputs. Marketing estimate ONLY — see file header. */
export const GYM_CALCULATOR = {
  /** Standard 30-day plan sticker used for the estimate, in rupees. */
  standardPlanRupees: 6500,
  /** Conservative assumed adoption rate among a gym's members. */
  adoptionRate: 0.15,
  minMembers: 50,
  maxMembers: 1500,
  stepMembers: 25,
  defaultMembers: 250,
  tiers: [
    { pct: 10, label: "Standard" },
    { pct: 12.5, label: "Silver" },
    { pct: 15, label: "Gold" },
  ],
} as const;

export const GYM_MODELS: GymModel[] = [
  {
    tag: "Model A",
    title: "Affiliate partnership",
    body: "Promote Tanmatra to your members via your custom landing page, physical flyers, and trainer referrals. Your unique link tracks every signup automatically — perfect for a rapid launch.",
    points: [
      "10% commission on all sales",
      "Free branded welcome kits & brochures",
      "Digital trainer dashboard to assign goals",
    ],
  },
  {
    tag: "Model B",
    title: "Bundled membership",
    body: "Include Tanmatra subscription plans in your premium-tier packages (e.g. a “VIP Transformation Membership”). We invoice the gym monthly at wholesale rates.",
    points: [
      "Wholesale discounting (up to 20% off)",
      "1-on-1 private dietitian sessions for VIPs",
      "Dedicated local dispatch for bulk gym delivery",
    ],
  },
];

export interface FitnessDish {
  name: string;
  macros: string;
  body: string;
}

export const FITNESS_MENU: FitnessDish[] = [
  {
    name: "Boiled 3-egg with sautéed veggies",
    macros: "280 kcal · 22g P · 8g C · 14g F",
    body: "Bioavailable egg-white protein with warm, lightly seasoned steamed broccoli and carrots.",
  },
  {
    name: "English breakfast plate",
    macros: "450 kcal · 32g P · 24g C · 18g F",
    body: "Scrambled eggs, chicken sausages, baked beans, and whole-wheat toast.",
  },
  {
    name: "Spiced buckwheat & mung khichdi",
    macros: "310 kcal · 14g P · 52g C · 5g F",
    body: "A warm, prebiotic comfort bowl — low-glycaemic carbs and fibre for cellular restoration.",
  },
];

export const GYMS_LANDING = {
  metaTitle: "Partner with Tanmatra | Gyms & fitness centres",
  metaDescription:
    "Bundle clinical-grade nutrition with your gym membership. Increase member retention, generate ancillary revenue, and offer a complete fitness solution.",
  hero: {
    eyebrow: "Gym & fitness centre partnerships",
    title: "Training is half the result.",
    accent: "Own the other half.",
    subtitle:
      "Integrate Tanmatra’s dietitian-designed, macro-calibrated meals directly into your memberships. Increase client retention, accelerate their fat-loss or muscle-gain results, and add a new revenue line.",
    trust: [
      { icon: "check", label: "Zero inventory or setup costs" },
      { icon: "check", label: "Custom co-branded portal" },
    ],
  } satisfies LandingHero,
  benefitsHeading: "Why gyms partner with Tanmatra",
  benefitsSub: "Workout sessions are only half the battle. Bridge the gap between training and nutrition.",
  benefits: [
    {
      icon: "trend-up",
      title: "Higher client retention",
      body: "When gym members get real results, they renew. By addressing their dietary needs alongside their training, they reach milestones faster.",
    },
    {
      icon: "percent",
      title: "Ancillary monthly profits",
      body: "Earn up to 15% recurring commission on every meal-plan subscription sold through your gym. Completely handled by our fulfilment.",
    },
    {
      icon: "smartphone",
      title: "Digital co-branded portal",
      body: "Give members a customised interface where your logo stands alongside Tanmatra’s dietitian console, prescribing meals that match your trainers’ recommendations.",
    },
  ] satisfies LandingBenefit[],
  form: {
    kind: "gym",
    source: "web:/partners/gyms",
    heading: "Start your application",
    blurb: "Tell us about your centre below. A partnership specialist will verify your details and call you within one working day.",
    submitLabel: "Submit partnership application",
    whatsApp: PARTNER_WHATSAPP,
  } satisfies LandingForm,
} as const;

export const FITNESS_LANDING = {
  metaTitle: "Morning fitness & running clubs | Tanmatra",
  metaDescription:
    "Post-workout breakfast drop-offs for running, cycling, and morning bootcamps. Dietitian-designed recovery meals delivered warm to your meetup spots.",
  hero: {
    eyebrow: "Morning running & cycling clubs",
    title: "Post-workout recovery,",
    accent: "delivered to your finish line.",
    subtitle:
      "Ditch the sugary tea-stall stops. Coordinate fresh, dietitian-approved post-workout breakfasts delivered warm directly to your meetup, park, or trail finish line by 7:00 AM.",
    trust: [
      { icon: "clock", label: "Delivered by 7:00 AM" },
      { icon: "map-pin", label: "NCR parks & meetup spots" },
    ],
  } satisfies LandingHero,
  benefitsHeading: "Fuelling runners and cyclists across NCR",
  benefitsSub: "We coordinate bulk, site-specific drop-offs so your group can rehydrate and refuel together instantly.",
  benefits: [
    {
      icon: "clock",
      title: "7:00 AM delivery guarantee",
      body: "We schedule dispatch to meet you right after your cooldown. No late deliveries, no cold food — kept warm in insulated carrier boxes.",
    },
    {
      icon: "coffee",
      title: "Clean recovery macros",
      body: "Boiled-egg plates, buckwheat–mung khichdi, and high-protein berry smoothies replenish glycogen and repair muscle fibres without the sugar.",
    },
    {
      icon: "users",
      title: "Group subscriptions",
      body: "Members set their own meal preferences online. Club admins get a single dispatch manifest, or we deploy a local courier setup right at your park drop-off.",
    },
  ] satisfies LandingBenefit[],
  form: {
    kind: "fitness_club",
    source: "web:/partners/fitness-clubs",
    heading: "Get your club onboarded",
    blurb: "Tell us where your group trains. We’ll coordinate a trial delivery morning — complete with complimentary protein shakes and sample menus for your next group session.",
    submitLabel: "Request trial breakfast drop-off",
    whatsApp: PARTNER_WHATSAPP,
  } satisfies LandingForm,
} as const;
