import { formatPaise } from "@/lib/format";
import { PLAN_PRICE_TABLE } from "@workspace/subscription-rules";

export type ClinicalWaitlistTier = "steady" | "glp1";

export const TIERS: { id: ClinicalWaitlistTier; label: string; description: string }[] = [
  {
    id: "steady",
    label: "Steady Clinical Meal Plan",
    description: "Low-GI protocol targeted for post-prandial glycemic stability.",
  },
  {
    id: "glp1",
    label: "GLP-1 Companion Protocol",
    description: "Nutrient-dense muscle preservation during incretin treatments.",
  },
];

export const waitlistInputCls =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-line-strong";
export const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

export interface WaitlistFormProps {
  defaultTier?: ClinicalWaitlistTier;
  lockTier?: boolean;
  source?: string;
  submitLabel?: string;
}

export function getIndicativePrice(tier: ClinicalWaitlistTier): string {
  if (tier === "steady") {
    const perMeal =
      PLAN_PRICE_TABLE.steady.nonveg.perMealPaise ??
      PLAN_PRICE_TABLE.protein_build.veg.perMealPaise!;
    return `${formatPaise(perMeal)} / meal (indicative base)`;
  }
  const monthly =
    PLAN_PRICE_TABLE.glp1_companion.regular.monthlyTotalPaise ??
    PLAN_PRICE_TABLE.glp1_companion.intro.flatPricePaise!;
  return `${formatPaise(monthly)} / month (comprehensive protocol)`;
}
