import { logger } from "./logger";
import { petpoojaInventoryConfig } from "./petpoojaInventory";
import { runPurchaseIngest } from "./purchaseIngest";
import { runStockSync } from "./stockSync";

/**
 * Two polls against PetPooja's Inventory API, on separate cadences:
 *
 *   - purchases (daily)  → real ingredient prices      (`purchaseIngest.ts`)
 *   - stock     (6-hourly) → real on-hand quantities   (`stockSync.ts`)
 *
 * They are separate timers, and each has its own kill switch, because they fail
 * differently: a bad price shows up as a wrong margin on a report, while a bad
 * on-hand quantity makes the reorder engine buy — or fail to buy — real food.
 * Being able to stop one without stopping the other matters.
 *
 * Gating, in order:
 *   1. `PETPOOJA_PURCHASE_SYNC_DISABLED=1` / `PETPOOJA_STOCK_SYNC_DISABLED=1` —
 *      explicit per-sync off switches.
 *   2. `petpoojaInventoryConfig()` — null unless the three PetPooja secrets AND
 *      `PETPOOJA_INVENTORY_RID` are set, so this is inert on every environment
 *      that has not been wired up. No timer is even registered.
 *   3. `PETPOOJA_PURCHASE_SYNC_DRY_RUN=1` / `PETPOOJA_STOCK_SYNC_DRY_RUN=1` —
 *      fetch, match and log the plan WITHOUT writing. Use this for the first
 *      live run of each: the vendor response shape is unverified (see
 *      petpoojaInventory.ts), so the sane order is "see what it would change" →
 *      confirm → let it write.
 *
 * Registered outside `index.ts`'s blanket `DISABLE_SCHEDULERS` gate, mirroring
 * `startAnalyticsScheduler` — that flag is set in production, and gate 2 is the
 * stronger and more meaningful guard here. Duplicate ticks across Cloud Run
 * replicas are safe: both syncs recompute the same values from the same vendor
 * window, so concurrent runs converge instead of compounding.
 */

const DEFAULT_INTERVAL_MS = Number(
  process.env["PETPOOJA_PURCHASE_SYNC_INTERVAL_MS"] ?? 24 * 60 * 60 * 1000,
);
const LOOKBACK_DAYS = Number(process.env["PETPOOJA_PURCHASE_SYNC_LOOKBACK_DAYS"] ?? 7);
const FIRST_TICK_DELAY_MS = 120_000;

const DEFAULT_STOCK_INTERVAL_MS = Number(
  process.env["PETPOOJA_STOCK_SYNC_INTERVAL_MS"] ?? 6 * 60 * 60 * 1000,
);
/**
 * Staggered a minute past the purchase tick so a cold start does not fire two
 * vendor calls at once — PetPooja rate-limits per outlet, and a 429 that kills
 * both syncs on every boot would be self-inflicted.
 */
const STOCK_FIRST_TICK_DELAY_MS = 180_000;

let timer: ReturnType<typeof setInterval> | null = null;
let stockTimer: ReturnType<typeof setInterval> | null = null;
let running = false;
let stockRunning = false;

/** Detach a timer from the event loop where the runtime supports it. */
function unref(t: unknown): void {
  const maybe = t as { unref?: () => void } | null;
  if (maybe && typeof maybe.unref === "function") maybe.unref();
}

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

export async function tickStockSync(): Promise<void> {
  if (stockRunning) return;
  stockRunning = true;
  const start = Date.now();
  try {
    const summary = await runStockSync({
      dryRun: process.env["PETPOOJA_STOCK_SYNC_DRY_RUN"] === "1",
      log: logger,
    });
    if (!summary.ok && !summary.skipped) {
      logger.error({ summary, durationMs: Date.now() - start }, "petpooja stock sync tick failed");
      return;
    }
    // Each of these is a row the reorder engine is still deciding on stale data
    // for, so they are the actionable output of the tick, not diagnostics.
    if (
      summary.unmatched.length ||
      summary.ambiguous.length ||
      summary.unitMismatch.length ||
      summary.noStockRow.length
    ) {
      logger.warn(
        {
          unmatched: summary.unmatched.slice(0, 50),
          ambiguous: summary.ambiguous.slice(0, 50),
          unitMismatch: summary.unitMismatch.slice(0, 50),
          noStockRow: summary.noStockRow.slice(0, 50),
        },
        "petpooja stock sync: vendor rows needing attention",
      );
    }
  } catch (err) {
    logger.error({ err }, "petpooja stock sync tick threw");
  } finally {
    stockRunning = false;
  }
}

export function startPetpoojaInventoryScheduler(
  opts: { purchaseIntervalMs?: number; stockIntervalMs?: number } = {},
): void {
  if (timer || stockTimer) return;
  if (!petpoojaInventoryConfig()) {
    logger.info(
      "petpooja inventory syncs inert — set PETPOOJA_INVENTORY_RID + the three PETPOOJA_* secrets to enable",
    );
    return;
  }

  const purchaseIntervalMs = opts.purchaseIntervalMs ?? DEFAULT_INTERVAL_MS;
  const stockIntervalMs = opts.stockIntervalMs ?? DEFAULT_STOCK_INTERVAL_MS;

  if (process.env["PETPOOJA_PURCHASE_SYNC_DISABLED"] === "1") {
    logger.info("petpooja purchase sync disabled via env");
  } else {
    unref(setTimeout(() => void tickPurchaseSync(), FIRST_TICK_DELAY_MS));
    timer = setInterval(() => void tickPurchaseSync(), purchaseIntervalMs);
    unref(timer);
    logger.info(
      {
        intervalMs: purchaseIntervalMs,
        lookbackDays: LOOKBACK_DAYS,
        dryRun: process.env["PETPOOJA_PURCHASE_SYNC_DRY_RUN"] === "1",
      },
      "petpooja purchase sync started",
    );
  }

  if (process.env["PETPOOJA_STOCK_SYNC_DISABLED"] === "1") {
    logger.info("petpooja stock sync disabled via env");
  } else {
    unref(setTimeout(() => void tickStockSync(), STOCK_FIRST_TICK_DELAY_MS));
    stockTimer = setInterval(() => void tickStockSync(), stockIntervalMs);
    unref(stockTimer);
    logger.info(
      {
        intervalMs: stockIntervalMs,
        dryRun: process.env["PETPOOJA_STOCK_SYNC_DRY_RUN"] === "1",
      },
      "petpooja stock sync started",
    );
  }
}

export function stopPetpoojaInventoryScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (stockTimer) {
    clearInterval(stockTimer);
    stockTimer = null;
  }
}
