/**
 * Clinical biometric ALERT engine (PRD Phase 3) — deliberately advisory.
 *
 * Detects glycemic anomalies in wearable readings (>=140 mg/dL postprandial),
 * alerts the assigned dietitian, and surfaces ADVISORY ingredient cautions to
 * the storefront.
 *
 * What it deliberately does NOT do — reviewed out of the first draft, which
 * did all of this automatically:
 *
 *   • It does not write daily_targets. A single self-reported reading from
 *     POST /wearable/biometric-anomaly (any signed-in session; nothing device-
 *     attested) was auto-cutting calorieTarget by 150 PER EVENT down to a
 *     1,500 kcal floor and rewriting fiber targets — an unattended clinical
 *     intervention on a clinical-grade platform, triggered at exactly the
 *     boundary of a NORMAL 2-hour postprandial value, with no dietitian
 *     approval, no hysteresis, and no reading provenance. Target changes are
 *     the RD's call: the alert below puts it on their desk.
 *   • Its ingredient list is advisory ("cautions"), not a lockout: nothing
 *     that blocks an order may key off an unauthenticated-provenance number.
 */
import { eq, and } from "drizzle-orm";
import {
  db,
  dailyTargetsTable,
  rdClientSummariesTable,
} from "@workspace/db";
import { logger } from "./logger";

export interface BiometricAnomalyResult {
  userId: string;
  glucoseReadingMgDl: number;
  /** Always false: target changes are proposed to the RD, never auto-applied. */
  targetAdjusted: boolean;
  /** What the RD alert PROPOSES — never written by this engine. */
  proposedFiberTargetGrams?: number;
  proposedCalorieTarget?: number;
  rdAlertGenerated: boolean;
  /** Advisory cautions surfaced to the UI — not an enforcement lockout. */
  restrictedIngredients: string[];
}

const HIGH_GLYCEMIC_RESTRICTIONS = ["refined-sugar", "white-flour", "high-gi-syrup", "maltodextrin"];

/**
 * Process incoming wearable biometric readings and execute automated clinical lockouts.
 */
export async function processBiometricAnomaly(
  userId: string,
  glucoseReadingMgDl: number,
): Promise<BiometricAnomalyResult> {
  if (glucoseReadingMgDl < 140) {
    return {
      userId,
      glucoseReadingMgDl,
      targetAdjusted: false,
      rdAlertGenerated: false,
      restrictedIngredients: [],
    };
  }

  // Glucose spike >= 140 mg/dL: COMPUTE a proposed recalibration for the RD.
  // Read-only against daily_targets — the write is the dietitian's decision,
  // made from the alert below, not this function's.
  const existingTargets = await db
    .select()
    .from(dailyTargetsTable)
    .where(eq(dailyTargetsTable.userId, userId))
    .limit(1);

  let newFiberTarget = 35;
  let newCalorieTarget = 1800;
  if (existingTargets.length > 0) {
    const t = existingTargets[0]!;
    newFiberTarget = Math.min(50, (t.fiberTargetGrams || 28) + 8);
    newCalorieTarget = Math.max(1500, (t.calorieTarget || 2000) - 150);
  }

  // Notify assigned RD by appending a high-priority biometric telemetry note
  const alertText = `CRITICAL BIOMETRIC ALERT: Postprandial glucose reading peaked at ${glucoseReadingMgDl} mg/dL (self-reported via wearable sync — unverified provenance). PROPOSED recalibration for your review: prebiotic fiber ${newFiberTarget}g/day, calories ${newCalorieTarget} kcal/day, plus a simple-carbohydrate caution list. No targets have been changed automatically.`;
  
  try {
    const existingSummary = await db
      .select()
      .from(rdClientSummariesTable)
      .where(and(eq(rdClientSummariesTable.userId, userId), eq(rdClientSummariesTable.rdSlug, "rd-advisory")))
      .limit(1);

    if (existingSummary.length > 0) {
      await db
        .update(rdClientSummariesTable)
        .set({
          summary: `${alertText}\n\nPrevious notes: ${existingSummary[0]!.summary}`,
        })
        .where(eq(rdClientSummariesTable.id, existingSummary[0]!.id));
    } else {
      await db.insert(rdClientSummariesTable).values({
        userId,
        rdSlug: "rd-advisory",
        summary: alertText,
        sources: { source: "wearable-biometric-webhook", triggerMgDl: glucoseReadingMgDl },
      });
    }
  } catch (err) {
    logger.warn({ err, userId }, "guardrails.clinical.rd_summary_skip");
  }

  logger.warn({ userId, glucoseReadingMgDl, newFiberTarget }, "guardrails.clinical.biometric_alert_raised");

  return {
    userId,
    glucoseReadingMgDl,
    targetAdjusted: false,
    proposedFiberTargetGrams: newFiberTarget,
    proposedCalorieTarget: newCalorieTarget,
    rdAlertGenerated: true,
    restrictedIngredients: HIGH_GLYCEMIC_RESTRICTIONS,
  };
}

/**
 * Advisory ingredient CAUTIONS derived from open biometric alerts. Surfaced in
 * the UI as guidance; never an order-blocking lockout — the underlying reading
 * is self-reported and the intervention decision belongs to the RD.
 */
export async function getPatientIngredientLockouts(userId: string): Promise<{ restrictedIngredients: string[]; reason: string | null }> {
  try {
    const summaries = await db
      .select()
      .from(rdClientSummariesTable)
      .where(eq(rdClientSummariesTable.userId, userId));

    for (const s of summaries) {
      if (s.summary.includes("CRITICAL BIOMETRIC ALERT")) {
        return {
          restrictedIngredients: HIGH_GLYCEMIC_RESTRICTIONS,
          reason:
            "An open biometric alert suggests limiting simple carbohydrates — advisory until your dietitian reviews it.",
        };
      }
    }
  } catch {
    // Return empty lockouts if unavailable
  }

  return { restrictedIngredients: [], reason: null };
}
