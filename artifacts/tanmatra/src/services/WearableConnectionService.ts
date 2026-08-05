export interface WearableConnectionStatus {
  status: "disconnected" | "connected" | "partially-connected";
  platform?: "apple-health" | "health-connect";
  lastSyncAt?: string;
}

export interface TelemetrySummary {
  dailySteps: number;
  activeEnergyKcal: number;
  sleepHours: number;
  workoutsThisWeek: number;
}

export interface ExplainableRecommendation {
  recommendationId: string;
  rationale: string;
  suggestedTags: string[];
  requiresUserConfirmation: boolean;
}

let currentStatus: WearableConnectionStatus = { status: "disconnected" };

export const WearableConnectionService = {
  getConnectionStatus(): WearableConnectionStatus {
    return currentStatus;
  },

  connect(platform: "apple-health" | "health-connect"): WearableConnectionStatus {
    currentStatus = {
      status: "connected",
      platform,
      lastSyncAt: new Date().toISOString(),
    };
    return currentStatus;
  },

  disconnect(): WearableConnectionStatus {
    currentStatus = { status: "disconnected" };
    return currentStatus;
  },

  getTelemetrySummary(): TelemetrySummary | null {
    if (currentStatus.status !== "connected") {
      return null;
    }
    return {
      dailySteps: 9420,
      activeEnergyKcal: 480,
      sleepHours: 7.4,
      workoutsThisWeek: 4,
    };
  },

  getExplainableRecommendation(): ExplainableRecommendation | null {
    if (currentStatus.status !== "connected") {
      return null;
    }
    return {
      recommendationId: "rec_post_workout_recovery",
      rationale: "Higher activity recorded today (480 kcal active energy). Recommending higher protein density.",
      suggestedTags: ["high-protein", "recovery"],
      requiresUserConfirmation: true, // Non-automated safeguard rule
    };
  },
};
