import { ActiveSubscription, SubscriptionDelivery } from "../domain/types";

export interface DeliverySlotAction {
  date: string;
  mealId: string;
  status: "scheduled" | "delivered" | "skipped" | "swapped";
  isCutoffPassed: boolean;
  canSwap: boolean;
  canSkip: boolean;
  reasonIfDisabled?: string;
}

export class SubscriptionManagementService {
  private static activeSub: ActiveSubscription = {
    id: "sub_30day_glycemic",
    planDraftId: "draft_glycemic_active",
    orderId: "ord_8823719",
    status: "active",
    startDate: "2026-08-01",
    endDate: "2026-08-30",
    renewalPreference: "auto-renew",
    entitlementIds: [],
    nextChangeCutoff: "10:00 PM Today",
  };

  static getActiveSubscription(): ActiveSubscription {
    return { ...this.activeSub };
  }

  /**
   * Checks if daily 10 PM cutoff has passed for a given delivery date.
   */
  static isCutoffPassed(deliveryDateStr: string): boolean {
    const deliveryDate = new Date(deliveryDateStr);
    const now = new Date();
    // Cutoff is 10 PM on the day before delivery
    const cutoffDate = new Date(deliveryDate);
    cutoffDate.setDate(cutoffDate.getDate() - 1);
    cutoffDate.setHours(22, 0, 0, 0);

    return now > cutoffDate;
  }

  static skipDelivery(deliveryDate: string): { success: boolean; message: string } {
    if (this.isCutoffPassed(deliveryDate)) {
      return {
        success: false,
        message: "Cannot skip delivery: The 10:00 PM daily change cutoff for this delivery has passed.",
      };
    }
    return { success: true, message: `Delivery on ${deliveryDate} successfully skipped.` };
  }

  static swapMeal(deliveryDate: string, oldMealId: string, newMealId: string): { success: boolean; message: string } {
    if (this.isCutoffPassed(deliveryDate)) {
      return {
        success: false,
        message: "Cannot swap meal: The 10:00 PM daily change cutoff for this delivery has passed.",
      };
    }
    return { success: true, message: `Meal for ${deliveryDate} successfully swapped.` };
  }

  static togglePause(): ActiveSubscription {
    this.activeSub = {
      ...this.activeSub,
      status: this.activeSub.status === "active" ? "paused" : "active",
    };
    return this.getActiveSubscription();
  }

  static updateRenewal(pref: "auto-renew" | "fixed-term" | "decide-later"): ActiveSubscription {
    this.activeSub = {
      ...this.activeSub,
      renewalPreference: pref,
    };
    return this.getActiveSubscription();
  }
}
