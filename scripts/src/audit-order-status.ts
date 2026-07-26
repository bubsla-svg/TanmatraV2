/**
 * Report every `orders.status` value that is outside the closed vocabulary.
 *
 * Migration 0015 adds `orders_status_chk` as NOT VALID: it binds every new
 * write immediately, but makes no claim about rows that already existed. This
 * script is what turns that unknown into a list, so the constraint can be
 * promoted with `ALTER TABLE orders VALIDATE CONSTRAINT orders_status_chk`.
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run audit-order-status
 *
 * Read-only. It issues one SELECT and writes nothing, deliberately — see below.
 *
 * WHY THIS DOES NOT OFFER TO FIX ANYTHING
 * ---------------------------------------
 * The tempting one-liner is `update orders set status='preparing' where
 * status='confirmed'`, because that is what the mappers do today. It is wrong.
 * A row that has said 'confirmed' for four months is a meal that was cooked,
 * delivered and eaten; moving it to 'preparing' puts it back on the live KDS
 * board and into the dispatcher's sweep for rider assignment. The right target
 * for an old stranded row is 'delivered' or 'cancelled', and which one it is
 * depends on what actually happened — which this script cannot know and a
 * human can.
 *
 * So it prints the age range alongside the count, because age is the fact that
 * decides it, and stops there.
 */
import { sql } from "drizzle-orm";
import { db, orderStatusValues } from "@workspace/db";

type Row = {
  status: string;
  n: number;
  oldest: Date | null;
  newest: Date | null;
};

function ageInDays(d: Date | null, now: number): string {
  if (!d) return "?";
  return `${Math.floor((now - d.getTime()) / 86_400_000)}d`;
}

async function main() {
  // `orderStatusValues` is interpolated rather than pasted as a literal so this
  // audit and the constraint can never disagree about what "legal" means. If a
  // value is added to the tuple, this query widens with it in the same commit.
  const legal = sql.join(
    orderStatusValues.map((v) => sql`${v}`),
    sql`, `,
  );

  const result = await db.execute<Row>(sql`
    select status,
           count(*)::int   as n,
           min(created_at) as oldest,
           max(created_at) as newest
    from orders
    where status not in (${legal})
    group by 1
    order by n desc
  `);

  const rows = (result.rows ?? result) as unknown as Row[];
  const now = Date.now();

  console.log(`Vocabulary (${orderStatusValues.length}): ${orderStatusValues.join(", ")}\n`);

  if (rows.length === 0) {
    console.log("No off-vocabulary rows. The constraint is safe to validate:");
    console.log("  ALTER TABLE orders VALIDATE CONSTRAINT orders_status_chk;");
    return;
  }

  console.log(`${rows.length} off-vocabulary status value(s) found:\n`);
  console.log("  status                rows    oldest    newest   (age of created_at)");
  console.log("  ──────────────────────────────────────────────");
  let total = 0;
  for (const r of rows) {
    total += Number(r.n);
    const oldest = r.oldest ? new Date(r.oldest) : null;
    const newest = r.newest ? new Date(r.newest) : null;
    console.log(
      `  ${r.status.padEnd(20)} ${String(r.n).padStart(5)}` +
        `  ${ageInDays(oldest, now).padStart(8)}  ${ageInDays(newest, now).padStart(8)}`,
    );
  }
  console.log(`\n  ${total} row(s) total.\n`);
  console.log("Each of these needs a decision before the constraint can be validated.");
  console.log("Age is the deciding fact: a stranded row older than a delivery window");
  console.log("is a finished order and wants 'delivered' or 'cancelled' — NOT the");
  console.log("live state the current mapper would translate it to. See the header of");
  console.log("lib/db/drizzle/0015_orders_status_check.sql.");
  // Non-zero so a CI or cron invocation of this notices rather than scrolling past.
  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("audit-order-status failed:", err);
    process.exitCode = 2;
  })
  .finally(() => {
    // The pool keeps the event loop alive; a read-only audit should exit.
    void db.$client?.end?.();
  });
