/**
 * Tanmatra End-to-End Platform Domain Objects
 * Phase P0 Clean-Slate Architecture Contract
 */

export type AcquisitionSource = 
  | "organic" 
  | "corporate" 
  | "gym" 
  | "fitness-club" 
  | "dietitian" 
  | "challenge" 
  | "referral" 
  | "campaign";

export interface AcquisitionContext {
  sourceType: AcquisitionSource;
  sourceId?: string;
  campaignId?: string;
  referralCode?: string;
  intendedGoal?: string;
  recommendedPlanId?: string;
  verificationStatus: "not-required" | "pending" | "verified" | "failed" | "expired";
  eligibleBenefitIds: string[];
  expiresAt?: string;
  returnRoute: string;
}

export interface PlannedMeal {
  mealId: string;
  name: string;
  slug: string;
  imageUrl: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  clinicalTags: string[];
  isLocked: boolean;
  pricePaise: number;
}

export interface PlanDraft {
  id: string;
  version: number;
  type: 
    | "recommended" 
    | "custom" 
    | "trial" 
    | "corporate-sponsored" 
    | "partner-discounted" 
    | "rd-referred" 
    | "challenge-support";
  currentStage: string;
  source?: AcquisitionContext;
  primaryGoal?: string;
  secondaryGoal?: string;
  deliveryAddressId?: string;
  serviceabilityStatus: "unchecked" | "checking" | "serviceable" | "unserviceable";
  mealSlots: Array<"breakfast" | "lunch" | "dinner">;
  deliveryDaysPerWeek?: number;
  servingCount: number;
  dietaryPattern?: string;
  allergenExclusions: string[];
  hardIngredientExclusions: string[];
  dislikedIngredients: string[];
  durationDays?: number;
  totalMeals?: number;
  renewalPreference?: "auto-renew" | "fixed-term" | "decide-later";
  generatedMeals: PlannedMeal[];
  lockedMealIds: string[];
  manuallyReplacedMealIds: string[];
  previousShuffleSnapshot?: PlannedMeal[];
  startDate?: string;
  deliveryDates: string[];
  deliverySlotId?: string;
  entitlementIds: string[];
  wearableInfluenceEnabled: boolean;
  validationErrors: Array<{ code: string; message: string }>;
  unsavedChanges: boolean;
}

export interface QuotedMeal {
  mealId: string;
  name: string;
  pricePaise: number;
  quantity: number;
}

export interface QuotedEntitlement {
  entitlementId: string;
  code: string;
  discountPaise: number;
}

export interface PriceBreakdown {
  mealSubtotalPaise: number;
  portionUpgradePaise: number;
  accompanimentUpgradePaise: number;
  deliveryFeePaise: number;
  packagingFeePaise: number;
  taxPaise: number;
  planDiscountPaise: number;
  entitlementDiscountPaise: number;
  voucherDiscountPaise: number;
  walletCreditPaise: number;
  chargePaise: number; // THE authoritative amount to charge today
  futureRenewalPaise?: number;
  effectivePricePerMealPaise: number;
}

export interface QuoteSnapshot {
  quoteId: string;
  planDraftId: string;
  planDraftVersion: number;
  version: number;
  mealSnapshot: QuotedMeal[];
  entitlementSnapshot: QuotedEntitlement[];
  priceBreakdown: PriceBreakdown;
  currency: "INR";
  status: "active" | "expired" | "superseded" | "consumed";
  createdAt: string;
  expiresAt: string;
  validationHash: string;
}

export interface PaymentAttempt {
  paymentAttemptId: string;
  quoteId: string;
  idempotencyKey: string;
  status: "created" | "requires-action" | "processing" | "succeeded" | "failed" | "cancelled";
  providerReference?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  orderId: string;
  quoteId: string;
  paymentAttemptId?: string;
  type: "a-la-carte" | "subscription" | "trial" | "sponsored-activation" | "group" | "office-lunch";
  status: "creating" | "confirmed" | "preparing" | "out-for-delivery" | "delivered" | "partially-fulfilled" | "cancelled" | "failed";
  createdAt: string;
}

export interface ActiveSubscription {
  id: string;
  planDraftId: string;
  orderId: string;
  status: "scheduled" | "active" | "paused" | "payment-action-required" | "completed" | "cancelled";
  startDate: string;
  endDate?: string;
  renewalPreference: "auto-renew" | "fixed-term" | "decide-later";
  entitlementIds: string[];
  nextChangeCutoff?: string;
}

export interface HealthConnection {
  platform: "apple-health" | "health-connect";
  status: "disconnected" | "partially-connected" | "connected" | "no-data" | "stale" | "permission-revoked" | "sync-error";
  grantedDataTypes: string[];
  deniedDataTypes: string[];
  lastSyncAt?: string;
  lastSuccessfulSyncAt?: string;
}
