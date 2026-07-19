// ─────────────────────────────────────────────────────────────────────────────
// Recurring-billing driver. Confirmed finding #1 of the money-path audit:
// POST /payments/charge-mandate existed but had ZERO callers anywhere in the
// repo — no scheduler, no cron, no script — so cycle-2+ subscription billing
// simply never fired. This is that driver: a periodic sweep that finds due
// mandates and charges them through the same chargeMandateCore() the HTTP
// route uses, so there is exactly one charge code path.
//
// Deliberately NOT exposed as a POST /jobs/* HTTP endpoint (unlike
// preDebitScheduler's /jobs/pre-debit-notifications) — that would add a
// second unauthenticated, money-moving HTTP trigger. The in-process interval
// below is sufficient; nothing external needs to invoke this over HTTP.
// ─────────────────────────────────────────────────────────────────────────────

import { and, eq, lte } from "drizzle-orm";
import { db, subscriptionsTable, subscriptionMandatesTable } from "@workspace/db";
import { logger } from "./logger";
import { chargeMandateCore } from "./chargeMandate";

export interface ChargeMandateSweepResult {
  due: number;
  charged: number;
  failed: number;
  skipped: number;
}

/**
 * Find every mandate that is `status: "active"`, belongs to an `active`
 * subscription, and has `nextChargeAt <= now`, and charge each one through
 * chargeMandateCore. Exported (rather than only reachable via the timer)
 * so it is directly unit-testable, matching runPreDebitNotificationsSweep's
 * convention in preDebitScheduler.ts.
 */
export async function runDueMandateChargesSweep(opts?: {
  now?: Date;
}): Promise<ChargeMandateSweepResult> {
  const now = opts?.now ?? new Date();

  const due = await db
    .select({
      subscriptionId: subscriptionMandatesTable.subscriptionId,
      mandateId: subscriptionMandatesTable.id,
    })
    .from(subscriptionMandatesTable)
    .innerJoin(
      subscriptionsTable,
      eq(subscriptionMandatesTable.subscriptionId, subscriptionsTable.id),
    )
    .where(
      and(
        eq(subscriptionMandatesTable.status, "active"),
        eq(subscriptionsTable.status, "active"),
        lte(subscriptionMandatesTable.nextChargeAt, now),
      ),
    );

  let charged = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of due) {
    try {
      const result = await chargeMandateCore({
        subscriptionId: row.subscriptionId,
        log: logger,
      });
      if (result.ok) {
        charged++;
      } else if (result.body?.["code"] === "charge_claim_conflict") {
        // Someone else (an overlapping tick, or a manual HTTP trigger) is
        // already processing this exact cycle — not a real failure.
        skipped++;
      } else {
        failed++;
        logger.warn(
          { subscriptionId: row.subscriptionId, mandateId: row.mandateId, result: result.body },
          "charge-mandate sweep: charge did not succeed",
        );
      }
    } catch (err) {
      failed++;
      logger.error(
        { err, subscriptionId: row.subscriptionId, mandateId: row.mandateId },
        "charge-mandate sweep: unexpected error charging mandate",
      );
    }
  }

  logger.info(
    { due: due.length, charged, failed, skipped },
    "charge-mandate sweep: complete",
  );
  return { due: due.length, charged, failed, skipped };
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

// Every 15 minutes by default — frequent enough that a due mandate is
// charged promptly without hammering the gateway. Overridable for
// tests/ops via CHARGE_MANDATE_SCHEDULER_INTERVAL_MS.
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runDueMandateChargesSweep();
  } catch (err) {
    logger.error({ err }, "charge-mandate scheduler tick failed");
  } finally {
    running = false;
  }
}

export function startChargeMandateScheduler(): void {
  if (timer) return;
  const intervalMs = Number(
    process.env["CHARGE_MANDATE_SCHEDULER_INTERVAL_MS"] ?? DEFAULT_INTERVAL_MS,
  );
  timer = setInterval(() => void tick(), intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  // Fire an immediate tick too so a restart doesn't sit idle for a full
  // interval before the first due mandate is charged.
  void tick();
  logger.info({ intervalMs }, "charge-mandate scheduler started");
}

export function stopChargeMandateScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
