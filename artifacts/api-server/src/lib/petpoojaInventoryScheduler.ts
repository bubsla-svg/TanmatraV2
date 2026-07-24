import { logger } from "./logger";
import { petpoojaInventoryConfig } from "./petpoojaInventory";
import { runPurchaseIngest } from "./purchaseIngest";

/**
 * Daily pull of PetPooja supplier invoices → real ingredient prices.
 *
 * Gating, in order:
 *   1. `PETPOOJA_PURCHASE_SYNC_DISABLED=1` — explicit off switch.
 *   2. `petpoojaInventoryConfig()` — null unless the three PetPooja secrets AND
 *      `PETPOOJA_INVENTORY_RID` are set, so this is inert on every environment
 *      that has not been wired up. No timer is even registered.
 *   3. `PETPOOJA_PURCHASE_SYNC_DRY_RUN=1` — fetch, match and log the plan
 *      WITHOUT writing. Use this for the first live run: the vendor response
 *      shape is unverified (see petpoojaInventory.ts), so the sane order is
 *      "see what it would change" → confirm → let it write.
 *
 * Registered outside `index.ts`'s blanket `DISABLE_SCHEDULERS` gate, mirroring
 * `startAnalyticsScheduler` — that flag is set in production, and gate 2 is the
 * stronger and more meaningful guard here. Duplicate ticks across Cloud Run
 * replicas are safe: the ingest recomputes the same weighted averages from the
 * same invoice window, so concurrent runs converge instead of compounding.
 */

const DEFAULT_INTERVAL_MS = Number(
  process.env["PETPOOJA_PURCHASE_SYNC_INTERVAL_MS"] ?? 24 * 60 * 60 * 1000,
);
const LOOKBACK_DAYS = Number(process.env["PETPOOJA_PURCHASE_SYNC_LOOKBACK_DAYS"] ?? 7);
const FIRST_TICK_DELAY_MS = 120_000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export async function tickPurchaseSync(): Promise<void> {
  if (running) return;
  running = true;
  const start = Date.now();
  try {
    const summary = await runPurchaseIngest({
      lookbackDays: LOOKBACK_DAYS,
      dryRun: process.env["PETPOOJA_PURCHASE_SYNC_DRY_RUN"] === "1",
      log: logger,
    });
    if (!summary.ok && !summary.skipped) {
      logger.error({ summary, durationMs: Date.now() - start }, "petpooja purchase sync tick failed");
      return;
    }
    // Unmatched vendor products and refused price jumps are the two things a
    // human has to act on, so keep them at warn rather than burying them.
    if (summary.unmatched.length || summary.ambiguous.length || summary.suspicious.length) {
      logger.warn(
        {
          unmatched: summary.unmatched.slice(0, 50),
          ambiguous: summary.ambiguous.slice(0, 50),
          suspicious: summary.suspicious.slice(0, 50),
        },
        "petpooja purchase sync: vendor products needing attention",
      );
    }
  } catch (err) {
    logger.error({ err }, "petpooja purchase sync tick threw");
  } finally {
    running = false;
  }
}

export function startPetpoojaInventoryScheduler(intervalMs = DEFAULT_INTERVAL_MS): void {
  if (timer) return;
  if (process.env["PETPOOJA_PURCHASE_SYNC_DISABLED"] === "1") {
    logger.info("petpooja purchase sync disabled via env");
    return;
  }
  if (!petpoojaInventoryConfig()) {
    logger.info(
      "petpooja purchase sync inert — set PETPOOJA_INVENTORY_RID + the three PETPOOJA_* secrets to enable",
    );
    return;
  }
  setTimeout(() => void tickPurchaseSync(), FIRST_TICK_DELAY_MS);
  timer = setInterval(() => void tickPurchaseSync(), intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  logger.info(
    { intervalMs, lookbackDays: LOOKBACK_DAYS, dryRun: process.env["PETPOOJA_PURCHASE_SYNC_DRY_RUN"] === "1" },
    "petpooja purchase sync started",
  );
}

export function stopPetpoojaInventoryScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
