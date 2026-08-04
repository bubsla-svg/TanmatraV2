import { HealthConnection } from "../domain/types";

export interface WearableTelemetrySummary {
  dailySteps: number;
  activeEnergyKcal: number;
  sleepHours: number;
  workoutMinutes: number;
  lastSyncedAt: string;
}

export class WearableConnectionService {
  private static connectionState: HealthConnection = {
    platform: "apple-health",
    status: "disconnected",
    grantedDataTypes: [],
    deniedDataTypes: [],
  };

  private static telemetry: WearableTelemetrySummary = {
    dailySteps: 9420,
    activeEnergyKcal: 480,
    sleepHours: 7.4,
    workoutMinutes: 45,
    lastSyncedAt: new Date().toISOString(),
  };

  static getConnectionStatus(): HealthConnection {
    return { ...this.connectionState };
  }

  static connect(platform: "apple-health" | "health-connect"): HealthConnection {
    this.connectionState = {
      platform,
      status: "connected",
      grantedDataTypes: ["steps", "active-energy", "sleep", "workouts"],
      deniedDataTypes: [],
      lastSyncAt: new Date().toISOString(),
      lastSuccessfulSyncAt: new Date().toISOString(),
    };
    return this.getConnectionStatus();
  }

  static disconnect(): HealthConnection {
    this.connectionState = {
      platform: "apple-health",
      status: "disconnected",
      grantedDataTypes: [],
      deniedDataTypes: [],
    };
    return this.getConnectionStatus();
  }

  static getTelemetrySummary(): WearableTelemetrySummary | null {
    if (this.connectionState.status !== "connected") return null;
    return { ...this.telemetry };
  }

  /**
   * Phase 10 Rule: Wearable data provides explainable recommendations 
   * BUT MUST NEVER automatically modify a user's active meals without explicit confirmation.
   */
  static getExplainableRecommendation(): { signal: string; recommendation: string; requiresUserConfirmation: boolean } | null {
    if (this.connectionState.status !== "connected") return null;
    return {
      signal: "High active energy expenditure detected (480 kcal active workout)",
      recommendation: "Increase post-workout protein portion by +15g in evening slot",
      requiresUserConfirmation: true, // Strict Phase 10 rule
    };
  }
}
