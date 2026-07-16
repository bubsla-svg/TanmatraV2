import { logger } from "./logger";

/**
 * Business Metric Anomaly Alerting Engine
 * 
 * Step 1: Tracks business vitals (payments/hr, signups/hr, checkouts/hr).
 * Triggers alerts when revenue/payments drop to zero while signups/traffic continue.
 */

export interface BusinessHourlyMetrics {
  timestamp: string;
  signupsCount: number;
  paymentsCount: number;
  checkoutsCompletedCount: number;
  totalRevenuePaise: number;
}

export const hourlyMetricsWindow: BusinessHourlyMetrics[] = [];
export const businessAnomalyAlertsLog: string[] = [];

export function recordBusinessMetric(event: "signup" | "payment" | "checkout_completed", valuePaise = 0): void {
  const currentHour = new Date().toISOString().substring(0, 13) + ":00:00.000Z";
  let window = hourlyMetricsWindow.find((m) => m.timestamp === currentHour);

  if (!window) {
    window = {
      timestamp: currentHour,
      signupsCount: 0,
      paymentsCount: 0,
      checkoutsCompletedCount: 0,
      totalRevenuePaise: 0,
    };
    hourlyMetricsWindow.push(window);
  }

  if (event === "signup") window.signupsCount++;
  if (event === "payment") {
    window.paymentsCount++;
    window.totalRevenuePaise += valuePaise;
  }
  if (event === "checkout_completed") window.checkoutsCompletedCount++;

  evaluateBusinessMetricAnomalies(window);
}

export function evaluateBusinessMetricAnomalies(metric: BusinessHourlyMetrics): { hasAnomaly: boolean; reason?: string } {
  // Anomaly: Signups & Checkouts are active (>= 5), but Payments drop to ZERO (Silent Webhook / Payment Bleed)
  if (metric.signupsCount >= 5 && metric.paymentsCount === 0) {
    const alertMsg = `CRITICAL_BUSINESS_BLEED_ALERT: Signups active (${metric.signupsCount}/hr) but Payments dropped to ZERO in window ${metric.timestamp}!`;
    businessAnomalyAlertsLog.push(alertMsg);
    logger.fatal({ metric }, "business.metric.anomaly_revenue_bleed");
    return { hasAnomaly: true, reason: alertMsg };
  }

  return { hasAnomaly: false };
}
