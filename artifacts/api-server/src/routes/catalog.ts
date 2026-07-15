import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

export interface CatalogSku {
  id: string;
  name: string;
  type: "trial" | "weekly_recurring" | "committed_subscription" | "combo";
  pricePaise: number;
  commitmentTotalPaise?: number;
  commitmentWeeks?: number;
  weeklyEquivalentRatePaise?: number;
  autoRenew: boolean;
  savingsPaise?: number;
  description: string;
  tags: string[];
}

export function computeWeeklyEquivalentRate(totalCommitmentPaise: number, weeks: number): number {
  if (weeks <= 0) return 0;
  return Math.round(totalCommitmentPaise / weeks);
}

export const CATALOG_SKUS: CatalogSku[] = [
  {
    id: "3-day-trial-pack",
    name: "3-Day Trial Pack",
    type: "trial",
    pricePaise: 236300, // ₹2,363
    autoRenew: false, // Ensures trial plans do not trigger auto-renewal state machines
    description: "One-off 3-day sampler pack crafted by registered dietitians.",
    tags: ["trial", "no_auto_renew", "one_off"],
  },
  {
    id: "weight-loss-jumpstart",
    name: "Weight-Loss Jumpstart",
    type: "weekly_recurring",
    pricePaise: 399000, // ₹3,990/wk
    autoRenew: true,
    description: "Lighter, high-fibre meals designed for steady weight loss without feeling hungry.",
    tags: ["weekly", "weight_loss", "high_fiber"],
  },
  {
    id: "lean-muscle-builder",
    name: "Lean Muscle Builder",
    type: "weekly_recurring",
    pricePaise: 785500, // ₹7,855/wk
    autoRenew: true,
    description: "Calorie surplus & high protein to fuel muscle growth and accelerate recovery.",
    tags: ["weekly", "muscle_gain", "high_protein"],
  },
  {
    id: "pcos-hormone-balance",
    name: "PCOS Hormone Balance",
    type: "weekly_recurring",
    pricePaise: 399000, // ₹3,990/wk
    autoRenew: true,
    description: "Balanced, low-GI meals designed to support steady blood sugar and hormone health.",
    tags: ["weekly", "pcos", "low_gi"],
  },
  {
    id: "six-week-reset",
    name: "6-Week Reset",
    type: "committed_subscription",
    pricePaise: 2274300, // ₹22,743 total commitment
    commitmentTotalPaise: 2274300,
    commitmentWeeks: 6,
    // Weekly equivalent rate calculation: P_weekly = T_commitment / N_weeks
    // 2274300 / 6 = 379050 paise = ₹3,791/wk
    weeklyEquivalentRatePaise: computeWeeklyEquivalentRate(2274300, 6),
    autoRenew: false,
    description: "6-week committed therapeutic metabolic reset program.",
    tags: ["committed", "6_week", "metabolic_reset"],
  },
  {
    id: "lunch-balance-combo",
    name: "Lunch Balance Combo",
    type: "combo",
    pricePaise: 23500, // ₹235
    savingsPaise: 2500, // saving ₹25
    autoRenew: false,
    description: "High-protein wrap + antioxidant cold-pressed juice.",
    tags: ["combo", "lunch_special"],
  },
  {
    id: "performance-stack",
    name: "Performance Stack",
    type: "combo",
    pricePaise: 23500, // ₹235
    savingsPaise: 2500, // saving ₹25
    autoRenew: false,
    description: "Recovery bowl + charcoal detox smoothie.",
    tags: ["combo", "performance"],
  },
];

/**
 * GET /api/v1/catalog/skus
 * Endpoint returning catalog SKUs with committed plan calculations and trial parameters.
 */
router.get("/api/v1/catalog/skus", (_req: Request, res: Response) => {
  res.json({
    skus: CATALOG_SKUS,
    count: CATALOG_SKUS.length,
  });
});

/** Also alias GET /catalog/skus */
router.get("/catalog/skus", (_req: Request, res: Response) => {
  res.json({
    skus: CATALOG_SKUS,
    count: CATALOG_SKUS.length,
  });
});

export default router;
