/**
 * Report retention exposure for the three unbounded-growth tables flagged in
 * TODO_optimization-auditor.md OA-MED-1.11: `delivery_events`, `funnel_events`,
 * and `audit_log`.
 *
 * Run with:
 *   pnpm --filter @workspace/scripts run audit-data-retention
 *
 * Read-only. It issues SELECTs and writes nothing, deliberately — see below.
 *
 * WHY THIS DOES NOT OFFER TO PARTITION OR DELETE ANYTHING
 * ---------------------------------------------------------
 * The audit's fix is "partition by month, archive funnel_events past ~90
 * days, detach-and-archive old audit_log partitions rather than deleting."
 * Every one of those actions is either destructive (row deletion) or hard to
 * reverse in production (a partitioning migration on a live table). Two of
 * the three inputs a real retention window needs are business/legal
 * decisions this script cannot make:
 *
 *   - `audit_log` exists specifically to prove what happened to sensitive
 *     data (RD patient reads, admin moderation, clinical overrides). Its
 *     retention floor is whatever DPDPA/contractual/audit requirement the
 *     business has committed to — a number nowhere in this codebase.
 *   - `funnel_events` past `funnel_daily`'s rollup horizon has real
 *     analytical value the daily aggregate throws away (session-level
 *     replay, per-user funnel debugging) — how long that's worth keeping
 *     live is a product-analytics tradeoff, not a technical one.
 *
 * `delivery_events` is the least contentious of the three (it's an
 * operational timeline, not a compliance record), but it shares
 * infrastructure with the other two and a wrong guess there still deletes
 * real order-tracking history. So this script does what
 * audit-order-status.ts does for its own stranded-row problem: it turns the
 * unknowns into numbers, prints candidate cutoffs, and stops. Executing the
 * actual archive/partition step needs an explicit human-approved retention
 * window plus a maintenance-window migration plan — not an autonomous run.
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const CANDIDATE_WINDOWS_DAYS = [30, 90, 180, 365] as const;

interface TableProfile {
  table: string;
  label: string;
  note: string;
}

const TABLES: TableProfile[] = [
  {
    table: "delivery_events",
    label: "delivery_events",
    note: "Operational order-tracking timeline. Lowest-risk of the three — no known compliance floor, but still real support/refund history.",
  },
  {
    table: "funnel_events",
    label: "funnel_events",
    note: "Rolled up nightly into funnel_daily (see funnelRollupScheduler.ts), but source rows are never archived or deleted after rollup.",
  },
  {
    table: "audit_log",
    label: "audit_log",
    note: "WORM by design (see schema/auditLog.ts) — retention here means detach-and-archive old partitions, never DELETE. Floor must come from an actual compliance/DPDPA requirement, not a guess.",
  },
];

type SummaryRow = {
  n: number;
  oldest: Date | string | null;
  newest: Date | string | null;
  bytes: number;
};

type CutoffRow = {
  cutoffDays: number;
  n: number;
};

async function tableSummary(table: string): Promise<SummaryRow> {
  const result = await db.execute<SummaryRow>(sql`
    select count(*)::int as n,
           min(created_at) as oldest,
           max(created_at) as newest,
           pg_total_relation_size(${table}::regclass)::bigint as bytes
    from ${sql.identifier(table)}
  `);
  const rows = (result.rows ?? result) as unknown as SummaryRow[];
  return rows[0] ?? { n: 0, oldest: null, newest: null, bytes: 0 };
}

async function rowsOlderThan(table: string, days: number): Promise<number> {
  const result = await db.execute<{ n: number }>(sql`
    select count(*)::int as n
    from ${sql.identifier(table)}
    where created_at < now() - (${days} * interval '1 day')
  `);
  const rows = (result.rows ?? result) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

async function funnelEventsUnrolled(): Promise<number> {
  // Rows older than the rollup's own lookback window that have NO matching
  // funnel_daily row for their (day, name) — i.e. genuinely never
  // summarized, as opposed to "summarized but the source row still exists"
  // (which is every row, since the rollup never deletes).
  const result = await db.execute<{ n: number }>(sql`
    select count(*)::int as n
    from funnel_events fe
    where fe.created_at < now() - interval '3 days'
      and not exists (
        select 1 from funnel_daily fd
        where fd.day = (fe.created_at at time zone 'utc')::date
          and fd.name = fe.name
      )
  `);
  const rows = (result.rows ?? result) as unknown as { n: number }[];
  return rows[0]?.n ?? 0;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${units[i]}`;
}

// db.execute's raw SQL path returns timestamptz columns as ISO strings, not
// parsed Date instances (unlike Drizzle's query builder, which applies
// column type mappers) — normalize once here rather than trust the driver.
function asDate(v: Date | string | null): Date | null {
  if (v === null) return null;
  return v instanceof Date ? v : new Date(v);
}

function fmtDate(v: Date | string | null): string {
  const d = asDate(v);
  return d ? d.toISOString().slice(0, 10) : "—";
}

function ageDays(v: Date | string | null, now: number): number | null {
  const d = asDate(v);
  return d ? Math.floor((now - d.getTime()) / 86_400_000) : null;
}

async function main() {
  const now = Date.now();
  console.log("Data retention exposure — OA-MED-1.11\n");
  console.log("Read-only report. No rows are modified or deleted by this script.\n");

  let anyRows = false;

  for (const profile of TABLES) {
    const summary = await tableSummary(profile.table);
    console.log(`── ${profile.label} ${"─".repeat(Math.max(0, 60 - profile.label.length))}`);
    console.log(`   ${profile.note}`);
    console.log(
      `   rows: ${summary.n.toLocaleString()}   size: ${fmtBytes(summary.bytes)}   ` +
        `span: ${fmtDate(summary.oldest)} → ${fmtDate(summary.newest)} ` +
        `(${ageDays(summary.oldest, now) ?? "—"}d old at the oldest row)`,
    );

    if (summary.n > 0) {
      anyRows = true;
      console.log("   rows older than candidate cutoff:");
      const cutoffs: CutoffRow[] = [];
      for (const days of CANDIDATE_WINDOWS_DAYS) {
        const n = await rowsOlderThan(profile.table, days);
        cutoffs.push({ cutoffDays: days, n });
      }
      for (const c of cutoffs) {
        const pct = summary.n > 0 ? ((c.n / summary.n) * 100).toFixed(1) : "0.0";
        console.log(`     > ${String(c.cutoffDays).padStart(3)}d old: ${String(c.n).padStart(8)} rows (${pct}%)`);
      }
    }
    console.log();
  }

  const unrolled = await funnelEventsUnrolled();
  console.log("── funnel_events rollup coverage ───────────────────────────");
  if (unrolled === 0) {
    console.log("   Every funnel_events row older than 3 days has a matching funnel_daily row.");
    console.log("   Archiving/deleting rows past the rollup horizon would not lose any");
    console.log("   aggregate signal — only session-level replay detail.");
  } else {
    console.log(`   ${unrolled.toLocaleString()} row(s) older than 3 days have NO matching funnel_daily`);
    console.log("   rollup — the nightly job may be behind, disabled, or these predate it.");
    console.log("   Do not archive/delete these until that's understood; they'd be lost");
    console.log("   with no aggregate to fall back on.");
  }
  console.log();

  console.log("── What this does NOT tell you ─────────────────────────────");
  console.log("   - The legally/contractually required retention floor for audit_log.");
  console.log("   - The product-analytics value threshold for funnel_events past 90 days.");
  console.log("   - Whether delivery_events feeds any support/refund workflow that reaches");
  console.log("     back further than the numbers above suggest is 'old'.");
  console.log("   Those are business decisions. Pick a cutoff from the counts above (or a");
  console.log("   different one) with the table's owner, then the actual partitioning /");
  console.log("   archive migration is separate follow-up work — a schema change on a live");
  console.log("   table, planned for a maintenance window, not run from this script.");

  if (!anyRows) {
    console.log("\nAll three tables are empty — nothing to size yet.");
  }
}

main()
  .catch((err) => {
    console.error("audit-data-retention failed:", err);
    process.exitCode = 2;
  })
  .finally(() => {
    // The pool keeps the event loop alive; a read-only audit should exit.
    void db.$client?.end?.();
  });
