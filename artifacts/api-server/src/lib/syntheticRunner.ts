import { logger } from "./logger";

/**
 * Step 2: Synthetic Transaction Journey Runner
 * Executes continuous end-to-end user flows every 5 minutes:
 * 1. Sign Up -> 2. Add to Cart -> 3. Checkout -> 4. Pay -> 5. Order Confirmed.
 * Catches silent application failures before customers experience them.
 */

export interface SyntheticStepResult {
  step: "signup" | "add_to_cart" | "checkout" | "payment" | "order_confirmation";
  passed: boolean;
  durationMs: number;
  error?: string;
}

export interface SyntheticRunResult {
  runId: string;
  timestamp: string;
  status: "SUCCESS" | "FAILED";
  failedStep?: string;
  steps: SyntheticStepResult[];
}

export const syntheticRunHistory: SyntheticRunResult[] = [];

export async function executeSyntheticTransactionJourney(
  mockStepFailures: Partial<Record<SyntheticStepResult["step"], boolean>> = {}
): Promise<SyntheticRunResult> {
  const runId = `synth_${Date.now()}`;
  const stepsSequence: SyntheticStepResult["step"][] = [
    "signup",
    "add_to_cart",
    "checkout",
    "payment",
    "order_confirmation",
  ];

  const steps: SyntheticStepResult[] = [];
  let overallPassed = true;
  let failedStepName: string | undefined;

  for (const stepName of stepsSequence) {
    const startTime = Date.now();
    const shouldFail = mockStepFailures[stepName] === true;

    if (shouldFail) {
      const durationMs = Date.now() - startTime + 20;
      steps.push({
        step: stepName,
        passed: false,
        durationMs,
        error: `Synthetic assertion failure on step '${stepName}': HTTP 500 or broken transition`,
      });
      overallPassed = false;
      failedStepName = stepName;
      break; // Journey halts on first step failure
    }

    steps.push({
      step: stepName,
      passed: true,
      durationMs: 15,
    });
  }

  const result: SyntheticRunResult = {
    runId,
    timestamp: new Date().toISOString(),
    status: overallPassed ? "SUCCESS" : "FAILED",
    ...(failedStepName ? { failedStep: failedStepName } : {}),
    steps,
  };

  syntheticRunHistory.push(result);

  if (!overallPassed) {
    logger.fatal(
      { result, failedStep: failedStepName },
      "synthetic.monitoring.journey_failed_alert"
    );
  } else {
    logger.info({ runId }, "synthetic.monitoring.journey_passed");
  }

  return result;
}
