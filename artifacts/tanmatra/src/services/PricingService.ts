import { PlanDraft, PriceBreakdown, QuoteSnapshot, QuotedMeal } from "../domain/types";

/**
 * PricingService - Sole Authoritative Pricing Engine
 * Money logic: All calculations are strictly in Paise (1 INR = 100 Paise).
 * Client calculations are non-authoritative estimates only.
 */
export class PricingService {
  private static DEFAULT_TAX_RATE_BP = 500; // 5% GST (500 basis points)
  private static DEFAULT_DELIVERY_FEE_PAISE = 4900; // Rs 49
  private static PACKAGING_FEE_PER_MEAL_PAISE = 1500; // Rs 15

  /**
   * Computes authoritative price breakdown for a plan draft.
   */
  static calculateBreakdown(draft: PlanDraft): PriceBreakdown {
    const mealSubtotalPaise = draft.generatedMeals.reduce(
      (sum, meal) => sum + meal.pricePaise, 
      0
    );

    const totalMeals = draft.generatedMeals.length || 1;
    const packagingFeePaise = totalMeals * this.PACKAGING_FEE_PER_MEAL_PAISE;
    const deliveryFeePaise = draft.servingCount > 0 ? this.DEFAULT_DELIVERY_FEE_PAISE : 0;

    // Duration discounts
    let planDiscountRate = 0;
    if (draft.durationDays && draft.durationDays >= 30) {
      planDiscountRate = 0.20; // 20% off for 30-day plan
    } else if (draft.durationDays && draft.durationDays >= 14) {
      planDiscountRate = 0.10; // 10% off for 14-day plan
    }

    const planDiscountPaise = Math.round(mealSubtotalPaise * planDiscountRate);
    const netTaxablePaise = Math.max(0, mealSubtotalPaise - planDiscountPaise + packagingFeePaise);
    const taxPaise = Math.round((netTaxablePaise * this.DEFAULT_TAX_RATE_BP) / 10000);

    const chargePaise = netTaxablePaise + deliveryFeePaise + taxPaise;
    const effectivePricePerMealPaise = Math.round(chargePaise / totalMeals);

    return {
      mealSubtotalPaise,
      portionUpgradePaise: 0,
      accompanimentUpgradePaise: 0,
      deliveryFeePaise,
      packagingFeePaise,
      taxPaise,
      planDiscountPaise,
      entitlementDiscountPaise: 0,
      voucherDiscountPaise: 0,
      walletCreditPaise: 0,
      chargePaise,
      effectivePricePerMealPaise,
    };
  }

  /**
   * Generates an immutable QuoteSnapshot with a 15-minute validity window.
   */
  static generateQuote(draft: PlanDraft): QuoteSnapshot {
    const breakdown = this.calculateBreakdown(draft);
    const now = new Date();
    const expires = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins

    const quotedMeals: QuotedMeal[] = draft.generatedMeals.map(m => ({
      mealId: m.mealId,
      name: m.name,
      pricePaise: m.pricePaise,
      quantity: 1,
    }));

    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const hashData = `${quoteId}:${draft.id}:${draft.version}:${breakdown.chargePaise}`;
    
    // Simple deterministic hash simulation
    let hash = 0;
    for (let i = 0; i < hashData.length; i++) {
      hash = (hash << 5) - hash + hashData.charCodeAt(i);
      hash |= 0;
    }

    return {
      quoteId,
      planDraftId: draft.id,
      planDraftVersion: draft.version,
      version: 1,
      mealSnapshot: quotedMeals,
      entitlementSnapshot: [],
      priceBreakdown: breakdown,
      currency: "INR",
      status: "active",
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      validationHash: `sha256_${Math.abs(hash).toString(16)}`,
    };
  }
}
