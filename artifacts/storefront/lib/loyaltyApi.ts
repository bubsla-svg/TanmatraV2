/**
 * Per-subscription loyalty progress (Wave-3). Read-only — the credit itself
 * is issued by a server-side sweep (loyaltyEngine.checkLoyalty), never
 * triggered live from a page view. Two distinct rewards share the same
 * delivered-delivery counter per subscription:
 *   - every `freeEveryN`th delivery: a cash credit worth THAT subscription's
 *     own pricePerDeliveryPaise (varies per plan; repeats indefinitely).
 *   - at `premiumUnlockAt` deliveries: a ONE-TIME cash bonus — after that,
 *     `premiumUnlocked` stays true forever for this subscription.
 * `premiumUnlocked: true` means a cash bonus was credited — it is NOT the
 * same as premium-DISH ordering access, which is a separate paid membership
 * (see routes/premium.ts). Do not conflate the two in UI copy.
 */
import { apiGet, type FetchImpl } from "./apiClient";

export interface SubscriptionLoyaltyProgress {
  subscriptionId: number;
  deliveredCount: number;
  freeEveryN: number;
  deliveriesUntilFree: number;
  premiumUnlockAt: number;
  deliveriesUntilPremium: number;
  premiumUnlocked: boolean;
}

export function getLoyaltyProgress(
  fetchImpl?: FetchImpl,
): Promise<{ progress: SubscriptionLoyaltyProgress[] }> {
  return apiGet("/loyalty/progress", fetchImpl);
}
