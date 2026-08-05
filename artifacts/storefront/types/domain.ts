export type AcquisitionContext = {
  sourceType:
    | "organic"
    | "corporate"
    | "gym"
    | "fitness-club"
    | "dietitian"
    | "challenge"
    | "referral"
    | "campaign";
  sourceId?: string;
  campaignId?: string;
  referralCode?: string;
  intendedGoal?: string;
  recommendedPlanId?: string;
  verificationStatus:
    | "not-required"
    | "pending"
    | "verified"
    | "failed"
    | "expired";
  eligibleBenefitIds: string[];
  expiresAt?: string;
  returnRoute: string;
};

export type PlannedMeal = {
  id: string;
  // Stub for now
};

export type ValidationError = {
  code: string;
  message: string;
};

export type PlanDraft = {
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
  serviceabilityStatus:
    | "unchecked"
    | "checking"
    | "serviceable"
    | "unserviceable";
  mealSlots: Array<"breakfast" | "lunch" | "dinner">;
  deliveryDaysPerWeek?: number;
  servingCount: number;
  dietaryPattern?: string;
  allergenExclusions: string[];
  hardIngredientExclusions: string[];
  dislikedIngredients: string[];
  spicePreference?: string;
  varietyPreference?: string;
  portionProfile?: string;
  proteinPreference?: string;
  carbohydratePreference?: string;
  therapeuticBoosts: string[];
  duration?: number;
  totalMeals?: number;
  renewalPreference?: "auto-renew" | "fixed-term" | "decide-later";
  generatedMeals: PlannedMeal[];
  lockedMealIds: string[];
  manuallyReplacedMealIds: string[];
  previousShuffleSnapshot?: PlannedMeal[];
  startDate?: string;
  deliveryDates: string[];
  deliverySlotId?: string;
  deliveryMethod?: string;
  entitlementIds: string[];
  wearableInfluenceEnabled: boolean;
  validationErrors: ValidationError[];
  unsavedChanges: boolean;
};

export type QuotedMeal = any;
export type QuotedSchedule = any;
export type QuotedEntitlement = any;
export type PriceBreakdown = any;

export type QuoteSnapshot = {
  quoteId: string;
  planDraftId: string;
  planDraftVersion: number;
  version: number;
  mealSnapshot: QuotedMeal[];
  scheduleSnapshot: QuotedSchedule;
  entitlementSnapshot: QuotedEntitlement[];
  priceBreakdown: PriceBreakdown;
  currency: "INR";
  status:
    | "active"
    | "expired"
    | "superseded"
    | "consumed";
  createdAt: string;
  expiresAt: string;
  validationHash: string;
};

export type PaymentAttempt = {
  paymentAttemptId: string;
  quoteId: string;
  idempotencyKey: string;
  status:
    | "created"
    | "requires-action"
    | "processing"
    | "succeeded"
    | "failed"
    | "cancelled";
  providerReference?: string;
  createdAt: string;
  updatedAt: string;
};

export type Order = {
  orderId: string;
  quoteId: string;
  paymentAttemptId?: string;
  type:
    | "a-la-carte"
    | "subscription"
    | "trial"
    | "sponsored-activation"
    | "group"
    | "office-lunch";
  status:
    | "creating"
    | "confirmed"
    | "preparing"
    | "out-for-delivery"
    | "delivered"
    | "partially-fulfilled"
    | "cancelled"
    | "failed";
  createdAt: string;
};

export type SubscriptionDelivery = any;

export type ActiveSubscription = {
  id: string;
  planDraftId: string;
  orderId: string;
  status:
    | "scheduled"
    | "active"
    | "paused"
    | "payment-action-required"
    | "completed"
    | "cancelled";
  startDate: string;
  endDate?: string;
  renewalPreference:
    | "auto-renew"
    | "fixed-term"
    | "decide-later";
  deliveries: SubscriptionDelivery[];
  entitlementIds: string[];
  nextChangeCutoff?: string;
};

export type HealthConnection = {
  platform: "apple-health" | "health-connect";
  status:
    | "disconnected"
    | "partially-connected"
    | "connected"
    | "no-data"
    | "stale"
    | "permission-revoked"
    | "sync-error";
  grantedDataTypes: string[];
  deniedDataTypes: string[];
  lastSyncAt?: string;
  lastSuccessfulSyncAt?: string;
};
