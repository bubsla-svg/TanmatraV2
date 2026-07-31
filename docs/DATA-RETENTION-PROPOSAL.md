# Data Retention & Partitioning Proposal

Status: **proposal — not implemented.** Nothing in this document has been executed against
any table. It exists to turn `TODO_optimization-auditor.md`'s **OA-MED-1.11** into a decision
someone can actually approve, rather than a guess baked into a migration.

## The problem

Three tables grow without bound and have no retention or partitioning:

| Table | Growth | Current safeguard |
|---|---|---|
| `delivery_events` | one row per dispatch/refund/rider-sim event, per order | none |
| `funnel_events` | one row per client/server funnel beacon | nightly rollup into `funnel_daily` (`funnelRollupScheduler.ts`) — **source rows are never deleted after rollup** |
| `audit_log` | one row per sensitive action (RD patient reads, admin moderation, clinical overrides) | none — and it's WORM by design (`lib/db/src/schema/auditLog.ts`: "Rows are INSERT-only; no UPDATE or DELETE is ever issued") |

Get current numbers for all three — row counts, size on disk, age distribution, and how many
`funnel_events` rows genuinely lack a rollup — with:

```bash
pnpm --filter @workspace/scripts run audit-data-retention
```

It's read-only. Re-run it whenever this proposal needs fresh numbers; the counts below will be
stale the moment real production data starts flowing.

## Why this is a proposal, not a migration

Two of the three tables need a business decision this codebase cannot supply on its own:

- **`audit_log`'s retention floor is whatever compliance/DPDPA/contractual commitment the
  business has actually made.** The table's own docstring says it covers PHI-adjacent access
  (RD patient reads) and clinical override submissions. Guessing a number here risks either
  destroying a record a regulator or a legal hold expects to exist, or keeping PII far longer
  than the DPDPA's storage-limitation principle allows. This is not a number to infer from the
  code — it needs the same sign-off any other compliance control gets.
- **`funnel_events` past the rollup horizon has real analytical value the daily aggregate
  throws away** — session-level replay, per-user funnel debugging, cohort re-analysis with a
  metric nobody had defined yet when the row was written. How long that's worth keeping live
  (vs. archived vs. gone) is a product-analytics tradeoff, not a technical one.

`delivery_events` is the least contentious of the three — it's an operational timeline, not a
compliance record — but a wrong guess still deletes real order-tracking/support history, and it
shares infrastructure (partitioning approach, archive destination) with the other two. Rolling
it out alone first and inventing a different mechanism for the other two later would be the
worse outcome.

So: numbers and a recommended shape below, execution gated on explicit sign-off.

## Recommended approach (pending sign-off)

### `delivery_events` and `funnel_events` — partition by month on `created_at`

Both are high-write, append-only, time-ordered tables queried almost exclusively by recent
`created_at` (the order-tracking timeline, the nightly rollup's lookback window). Postgres
native declarative partitioning (`PARTITION BY RANGE (created_at)`, monthly ranges) gives two
things a plain retention job doesn't:

1. **Dropping old data becomes `DETACH PARTITION` + drop, an O(1) metadata operation** — not a
   row-by-row `DELETE` that generates WAL/vacuum pressure proportional to the rows removed.
2. Query planning on recent data (the overwhelmingly common case for both tables) benefits from
   partition pruning without needing to touch old partitions at all.

Converting an existing non-partitioned table to partitioned in Postgres is **not** an in-place
`ALTER TABLE` — it requires creating a new partitioned table, backfilling in batches, and a
cutover (rename or view swap) that needs a maintenance window and a rollback plan. That's a
separate, reviewable migration PR once a retention window is picked — not something to bundle
into this proposal or run unattended.

**Recommended retention** (subject to the sign-off above):
- `delivery_events`: 180 days live, archived (not deleted) beyond that — order-tracking
  disputes and support escalations can reach back further than 90 days.
- `funnel_events`: 90 days live, matching the audit's own suggestion and the fact that
  `funnel_daily` already preserves the aggregate signal indefinitely. Confirm the "unrolled
  rows" count from the audit script is zero before archiving any window — a nonzero count means
  the rollup is behind or was disabled for a stretch, and archiving those rows would lose
  signal with no aggregate to fall back on.

### `audit_log` — detach-and-archive, never delete

Per the table's own WORM contract, retention here means partitioning by month and detaching
(then exporting to cold storage — e.g. an archival bucket) old partitions once they're past
whatever floor compliance sets, not issuing a `DELETE`. The partitioning mechanics are the same
as above; the difference is entirely in what "past retention" means: cold storage, not deletion.

**No retention number is proposed here.** This section stays a placeholder until the actual
requirement is confirmed with whoever owns the DPDPA/compliance relationship.

## Open questions (block implementation until answered)

1. What is `audit_log`'s actual required retention floor? (Regulatory minimum, contractual
   commitment, or "indefinite" — any of these is a valid answer, but it has to come from an
   owner, not a default.)
2. Is there a legal-hold process that can extend retention past whatever floor is set? If so,
   the partition-detach step needs a hold-check gate, not just a date cutoff.
3. For `funnel_events`, is 90 days the right live-analytics window, or does an existing
   cohort-analysis or attribution workflow reach back further?
4. For `delivery_events`, does the support/refund process ever need to pull an event history
   older than the numbers the audit script reports as "current oldest row"? (Today's dataset is
   too young to tell — re-run the script once there's real production history.)
5. Where does "archived" mean, concretely — a separate cold-storage table in the same database,
   an export to object storage, or something else? This determines the detach step's actual
   destination, not just its trigger.

## What ships today

- `scripts/src/audit-data-retention.ts` (`pnpm --filter @workspace/scripts run audit-data-retention`) —
  read-only reporting: row counts, size on disk, age distribution against candidate cutoffs
  (30/90/180/365 days), and `funnel_events` rollup-coverage verification. Safe to run anytime,
  including in production, against a read replica if one exists.
- This document.

Nothing else. The partitioning migration and the archive-destination wiring are follow-up work
once the open questions above have owners and answers.
