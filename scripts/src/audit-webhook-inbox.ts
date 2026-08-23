/**
 * Report the Razorpay webhook backlog that nothing in the running system reads.
 *
 * WHY THIS EXISTS
 * ---------------
 * `POST /payments/razorpay/webhook` (artifacts/api-server/src/routes/payments.ts)
 * store-and-forwards every verified gateway event into `webhook_inbox` and then
 * marks the row processed / failed / pending. That table is written on every
 * capture and read by NOBODY: repo-wide, the only other references are two
 * manual verification scripts (verify-idempotency-webhook.ts,
 * stress-test-idempotency-adversarial.ts). No scheduler sweeps it, and none of
 * the five anomaly metrics in artifacts/api-server/src/lib/anomalies.ts covers
 * it. A rotated webhook secret, a schema drift, or a sustained gateway outage
 * therefore accumulates `failed` rows in total silence.
 *
 * Two integrity halts on the same path have the same problem — payments.ts:851
 * ("captured amount does not match order total — not confirming") and
 * payments.ts:906 ("capture arrived for a cancelled/failed order — needs refund
 * review"). Both are `req.log.error` and nothing else. In both cases the
 * customer's money is captured and the order is deliberately NOT confirmed,
 * which is the correct call — but the "needs review" it produces has no path to
 * a human.
 *
 * This script is the manual stand-in for the alerting that does not exist yet,
 * and the measurement that sizes it: it answers "has this already been firing?"
 * before anyone writes the detector.
 *
 * It is READ-ONLY. It writes nothing and changes nothing.
 *
 * Run with:
 *   DATABASE_URL=... pnpm --filter @workspace/scripts run audit-webhook-inbox
 *
 * Exit codes:
 *   0 — no unprocessed rows, and no stuck-placed orders carrying a payment id
 *   1 — a backlog exists (details printed); this is the signal, not an error
 *   2 — could not run (no DATABASE_URL, table absent, query failed)
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const LOOKBACK_HOURS = Number(process.env["WEBHOOK_INBOX_LOOKBACK_HOURS"] ?? "168");

async function main(): Promise<number> {
  if (!process.env["DATABASE_URL"]) {
    console.error("DATABASE_URL must be set — this reads the live inbox, it cannot be inferred.");
    return 2;
  }

  console.log(`\n=== webhook_inbox — status breakdown (source = razorpay) ===`);
  const byStatus = await db.execute(sql`
    SELECT status,
           count(*)::int      AS rows,
           min(created_at)    AS oldest,
           max(created_at)    AS newest
    FROM webhook_inbox
    WHERE source = 'razorpay'
    GROUP BY status
    ORDER BY rows DESC
  `);

  const statusRows = byStatus.rows as Array<{
    status: string;
    rows: number;
    oldest: string | null;
    newest: string | null;
  }>;

  if (statusRows.length === 0) {
    console.log("  (no razorpay rows at all — either a fresh database or the webhook has never been delivered)");
  }
  for (const r of statusRows) {
    console.log(`  ${r.status.padEnd(12)} ${String(r.rows).padStart(7)}   oldest=${r.oldest ?? "-"}  newest=${r.newest ?? "-"}`);
  }

  const stuck = statusRows
    .filter((r) => r.status !== "processed")
    .reduce((sum, r) => sum + r.rows, 0);

  // The recent window is what an hourly detector would actually alarm on, so
  // report it separately from the all-time backlog.
  console.log(`\n=== unprocessed in the last ${LOOKBACK_HOURS}h (what an hourly detector would fire on) ===`);
  const recent = await db.execute(sql`
    SELECT status, count(*)::int AS rows
    FROM webhook_inbox
    WHERE source = 'razorpay'
      AND status <> 'processed'
      AND created_at > now() - (${LOOKBACK_HOURS} || ' hours')::interval
    GROUP BY status
    ORDER BY rows DESC
  `);
  const recentRows = recent.rows as Array<{ status: string; rows: number }>;
  if (recentRows.length === 0) console.log("  none");
  for (const r of recentRows) console.log(`  ${r.status.padEnd(12)} ${String(r.rows).padStart(7)}`);

  // The customer-visible half of the same failure: an order that carries a
  // gateway payment id (so a capture reached us) but never left "placed".
  // reconciliationScheduler.ts is supposed to heal these — but it skips every
  // guest order, because line 229 requires order.userId. Split the count so the
  // guest half is visible rather than folded into a total.
  console.log(`\n=== orders still 'placed' carrying a razorpay_payment_id ===`);
  const stranded = await db.execute(sql`
    SELECT (user_id IS NULL) AS is_guest,
           count(*)::int     AS rows,
           min(created_at)   AS oldest
    FROM orders
    WHERE status = 'placed'
      AND razorpay_payment_id IS NOT NULL
    GROUP BY (user_id IS NULL)
  `);
  const strandedRows = stranded.rows as Array<{ is_guest: boolean; rows: number; oldest: string | null }>;
  if (strandedRows.length === 0) console.log("  none");
  let guestStranded = 0;
  for (const r of strandedRows) {
    const who = r.is_guest ? "GUEST (never reconciled — see F-3)" : "signed-in (sweep covers these)";
    if (r.is_guest) guestStranded = r.rows;
    console.log(`  ${String(r.rows).padStart(7)}  ${who}  oldest=${r.oldest ?? "-"}`);
  }

  console.log("");
  if (stuck === 0 && guestStranded === 0) {
    console.log("CLEAN — no unprocessed inbox rows and no stranded guest captures.");
    return 0;
  }
  console.log(
    `BACKLOG — ${stuck} unprocessed inbox row(s), ${guestStranded} stranded guest capture(s). ` +
      `Neither is surfaced anywhere today; that is the finding, not this script's output.`,
  );
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error("audit-webhook-inbox failed:", err);
    process.exit(2);
  });
