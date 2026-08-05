import { ActiveSubscription } from "../domain/types";

let currentSub: ActiveSubscription = {
  id: "sub_tanmatra_active_1",
  planDraftId: "draft_active_sub",
  orderId: "ord_active_1",
  status: "active",
  startDate: "2026-08-01",
  renewalPreference: "auto-renew",
  entitlementIds: [],
  nextChangeCutoff: "2099-12-31T20:00:00Z",
};

export const SubscriptionManagementService = {
  getActiveSubscription(): ActiveSubscription {
    return { ...currentSub };
  },

  skipDelivery(date: string): { success: boolean; skippedDate: string } {
    return {
      success: true,
      skippedDate: date,
    };
  },

  togglePause(): ActiveSubscription {
    if (currentSub.status === "active") {
      currentSub.status = "paused";
    } else {
      currentSub.status = "active";
    }
    return { ...currentSub };
  },

  cancelSubscription(): ActiveSubscription {
    currentSub.status = "cancelled";
    return { ...currentSub };
  },
};
