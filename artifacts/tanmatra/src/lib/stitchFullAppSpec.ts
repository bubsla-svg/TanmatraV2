/**
 * Complete Reimagined UX/UI Screen Architecture for Tanmatra
 * Source Project: Stitch (Project ID: 8786878931922736855)
 */

export interface StitchScreenDef {
  id: string;
  route: string;
  title: string;
  description: string;
  keyFeatures: string[];
}

export const STITCH_FULL_APP_SCREENS: StitchScreenDef[] = [
  {
    id: "screen_homepage",
    route: "/",
    title: "Daily Clinical Feed & Homepage",
    description: "Personalized clinical browse surface with biometric match scores, category filters, and Zomato-style density cards.",
    keyFeatures: [
      "Ink canvas (--bg) & Card container (--surface)",
      "Biometric Match Score badge (e.g. 98% High Fit)",
      "Interactive dietary filters (High Protein, Low GI, Diabetes Mgmt, Kid Friendly, Heart Healthy, Keto)",
      "Cropped dish media cards with JetBrains Mono macro ribbons & saffron + ADD actions",
      "V2 Persistent bottom navigation dock",
    ],
  },
  {
    id: "screen_pdp",
    route: "/dish/:slug",
    title: "Product Detail Page (PDP)",
    description: "High-impact therapeutic meal detail page with RD verification seals, allergen disclosures, and macro visualization tracks.",
    keyFeatures: [
      "Aspect-ratio locked media carousel with 48dp dot indicators",
      "Sensory taste line, Veg/Non-Veg indicators, and Low GI category tag",
      "RD Reviewed by IDA certification seal",
      "Persistent allergen safety summary box",
      "Interactive macro split tracks (Calories, Protein, Carbs, Fat) vs daily targets",
      "Goal fit analysis narrative by RD",
      "Sticky bottom bar with pinned allergen line and saffron checkout CTA",
    ],
  },
  {
    id: "screen_subscription_builder",
    route: "/subscribe",
    title: "Subscription Protocol Builder",
    description: "Multi-step clinical meal plan stepper with cadence selection, protocol duration targets, and mandate disclosures.",
    keyFeatures: [
      "5-step progress indicator (Goal -> Cadence -> Duration -> Schedule -> Review)",
      "Cadence cards (Weekly 5% off, Fortnightly 10% off, Monthly 15% off)",
      "Protocol duration selector with clinical target outcomes",
      "Delivery time slot selector (Breakfast, Lunch, Dinner windows)",
      "Verbatim UPI Autopay mandate disclosure & 24hr cut-off cancellation disclosure",
      "Itemized bill preview and saffron checkout action",
    ],
  },
  {
    id: "screen_meal_planner",
    route: "/meal-planner",
    title: "Weekly Meal Planner & Calendar",
    description: "7-day personalized meal matrix with macro target progress bars and smart allergen swap suggestions.",
    keyFeatures: [
      "7-day horizontal calendar ribbon (Mon-Sun)",
      "Daily macro target progress bars in JetBrains Mono",
      "Meal slot cards (Breakfast, Lunch, Dinner) with RD Verified badges",
      "Smart allergen & diet safety swap triggers",
      "RD verified weekly safety assurance banner",
    ],
  },
  {
    id: "screen_checkout",
    route: "/checkout",
    title: "Checkout & Clinical Consent",
    description: "Secure clinical checkout screen with DPDPA consent capture, address selection, and UPI Autopay integration.",
    keyFeatures: [
      "Saved delivery address book selector",
      "Delivery date & time window picker",
      "Mandatory DPDPA clinical consent capture checkbox",
      "Itemized order summary with free packaging fee callout",
      "UPI Autopay / GPay / Razorpay credit card payment integration",
    ],
  },
  {
    id: "screen_tracking_wellness",
    route: "/track",
    title: "Live Order Tracking & Wellness Dashboard",
    description: "Real-time kitchen dispatch tracking timeline and clinical wellness progress dashboard.",
    keyFeatures: [
      "Live order ETA counter and progress timeline (Order Placed -> RD Checked -> Kitchen Prepared -> Out for Delivery -> Delivered)",
      "Rider detail card with call/message triggers",
      "Glucose stability, weight target, and daily protein progress graphs",
      "Quick actions: Contact Dietitian, Pause Next Delivery, View Recipe",
    ],
  },
];
