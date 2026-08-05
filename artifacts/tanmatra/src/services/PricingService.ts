import { PlanDraft, PriceBreakdown, QuoteSnapshot } from "../domain/types";

export const PricingService = {
  calculateBreakdown(draft: PlanDraft): PriceBreakdown {
    const mealCount = Math.max(draft.generatedMeals.length, 1);
    const subtotal = draft.generatedMeals.reduce(
      (sum, meal) => sum + meal.pricePaise,
      0
    ) || 29900 * mealCount;

    let discountPercentage = 0;
    if ((draft.durationDays || 0) >= 30) {
      discountPercentage = 0.20; // 20% discount for monthly
    } else if ((draft.durationDays || 0) >= 14) {
      discountPercentage = 0.10; // 10% discount for fortnightly
    }

    const planDiscountPaise = Math.round(subtotal * discountPercentage);
    const discountedBase = subtotal - planDiscountPaise;
    const taxPaise = Math.round(discountedBase * 0.05); // 5% GST
    const chargePaise = discountedBase + taxPaise;

    return {
      mealSubtotalPaise: subtotal,
      portionUpgradePaise: 0,
      accompanimentUpgradePaise: 0,
      deliveryFeePaise: 0,
      packagingFeePaise: 0,
      taxPaise,
      planDiscountPaise,
      entitlementDiscountPaise: 0,
      voucherDiscountPaise: 0,
      walletCreditPaise: 0,
      chargePaise,
      futureRenewalPaise: chargePaise,
      effectivePricePerMealPaise: Math.round(chargePaise / mealCount),
    };
  },

  generateQuote(draft: PlanDraft): QuoteSnapshot {
    const priceBreakdown = this.calculateBreakdown(draft);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    return {
      quoteId: `quote_${Date.now()}_${draft.id}`,
      planDraftId: draft.id,
      planDraftVersion: draft.version,
      version: 1,
      mealSnapshot: draft.generatedMeals.map((m) => ({
        mealId: m.mealId,
        name: m.name,
        pricePaise: m.pricePaise,
        quantity: 1,
      })),
      entitlementSnapshot: [],
      priceBreakdown,
      currency: "INR",
      status: "active",
      createdAt: now.toISOString(),
      expiresAt,
      validationHash: `hash_${draft.id}_${priceBreakdown.chargePaise}`,
    };
  },
};
