# DEFECT-PLAN-SLOT-DATE-001 — slot writers could persist a non-operational `slot_date`

| | |
|---|---|
| **Title** | Delivery-slot writers can persist a `slot_date` inconsistent with the Asia/Kolkata operational date |
| **Severity** | **P1** before plan-checkout activation · **P2** while checkout remains gated |
| **Status** | **CLOSED** — enforced at the database boundary |
| **Filed** | 2026-08-10, by the A2.3a review, as a required gate on A2.4 acceptance |
| **Found in** | A2.3a left this documentation-only; the review correctly refused that |

## The invariant

For every row of `delivery_slots`:

```
slot_date = the Asia/Kolkata calendar date of starts_at
```

## Why it could go wrong

`starts_at` is `timestamptz` — an absolute instant. `slot_date` is `date` — a
calendar day with no zone. **Nothing in either type ties them together**, and
the obvious way to derive the second from the first silently yields the *UTC*
date:

```ts
startsAt.toISOString().slice(0, 10)   // ← every writer in the repo did this
```

For a lunch slot (12:00 IST = 06:30 UTC) the two agree and the bug is invisible.
From 18:30 UTC onwards they differ by a day, and the customer is shown their
delivery on the wrong date.

### The seeder was worse than "the date is wrong"

`ensureSlots()` in `artifacts/api-server/src/routes/fulfillment.ts` mixed two
timezones inside one function:

```ts
today.setHours(0, 0, 0, 0);              // container-local
start.setHours(h, m, 0, 0);              // container-local
const dateStr = day.toISOString()...;    // UTC
```

Cloud Run runs UTC. So the "19:00" dinner window was published at **19:00Z —
00:30 the next morning in Noida** — and stamped with the *previous* day's
`slot_date`. Both the time and the day were wrong, and the two errors partially
masked each other.

## Fix

**One canonical derivation**, in `lib/db/src/operationalDate.ts` beside the table
it constrains, so a writer cannot import the table without the right helper
being in reach:

- `deriveOperationalDate(instant)` → the `YYYY-MM-DD` operational date.
- `operationalInstant(date, hour, minute)` → the inverse; how a publisher says
  "19:00" and means 19:00 where the food is delivered.

Both resolve through the IANA zone `Asia/Kolkata`, not a hardcoded `+05:30`.
India observes no DST today, so the offset happens to be constant — encoding
that as a number would turn a future zone change into silent data corruption
rather than a one-line configuration change.

**Enforced in the database**, because documentation and a helper cannot stop a
raw `INSERT`, a migration, or the next writer who has read neither:

```sql
CREATE TRIGGER trg_delivery_slot_operational_date
BEFORE INSERT OR UPDATE OF slot_date, starts_at ON delivery_slots
FOR EACH ROW EXECUTE FUNCTION delivery_slot_operational_date_guard();
```

A trigger rather than a `CHECK`: `starts_at AT TIME ZONE 'Asia/Kolkata'` is
STABLE, not IMMUTABLE (it reads the timezone database), and Postgres refuses
non-immutable expressions in `CHECK`. It raises `23514` (check_violation) so
callers can tell this apart from any other write failure.

**Existing rows** are corrected by migration `0031`, ordered before the trigger
is created so the repair is not rejected by the thing repairing it.

### The CI gap this also closed

`drizzle-kit push` — how CI builds its test database — models tables, columns
and indexes, and **knows nothing about triggers**. Migration-only enforcement
would have existed in production and not in CI, which is the one place a
constraint can never tell you that you broke it. The DDL therefore lives in
`lib/db/ddl/*.sql`, and `pnpm --filter @workspace/db run push` applies that
directory immediately after pushing. Migration `0031` keeps its own copy on
purpose: a shipped migration must never change, so it cannot read a file that
might.

## Writers routed through the canonical helper

| Writer | Status |
|---|---|
| `ensureSlots()` — the rolling seeder | Fixed: IST wall-clock instants, derived date |
| `planDraftSchedule.ts` | Reads only; re-exports the shared constant |
| `planDraftSchedule.test.ts` · `planDraftQuoteLifecycle.test.ts` | Fixtures use `deriveOperationalDate` |
| `loyalty.checkout.test.ts` · `marketplace.checkout.test.ts` | Fixtures use `deriveOperationalDate` |
| Any future admin API, kitchen importer, migration or seed script | Rejected by the trigger unless correct |

## Tests

`artifacts/api-server/src/routes/deliverySlotOperationalDate.test.ts` — 13,
real Postgres:

- 08:00 IST, 00:30 IST and 23:30 IST slots file under the correct IST date
- the IST day boundary is exactly 18:30 UTC, to the millisecond
- `operationalInstant` round-trips as the exact inverse, and 19:00 IST is 13:30 UTC
- the derivation is unchanged across four process `TZ` values
- **a UTC-dated slot is rejected** — the exact `toISOString().slice(0,10)` mistake
- an `UPDATE` cannot move `starts_at` away from its `slot_date`, or vice versa
- a raw SQL `INSERT` bypassing the ORM is rejected too
- the mismatch sweep finds nothing once the guard is installed
- the guard DDL references exactly one timezone, and it is `DELIVERY_OPERATIONAL_TZ`
  (the SQL must hard-code the zone, so this is the seam that would otherwise drift)
- installing the guard twice is idempotent

## Related: schedules chosen before the timezone was pinned

A window label that read `02:30-04:30` under the old UTC rendering does not
denote the same time of day now. Those selections are **not silently
reinterpreted**. Migration `0031` marks every already-scheduled, non-terminal
draft:

```
plan_drafts.schedule_reconfirm_reason = 'delivery_window_timezone_updated'
```

`quote-readiness` then returns a typed blocker, and the draft cannot be quoted
until the customer picks again:

```json
{
  "code": "schedule_requires_reconfirmation",
  "message": "Delivery windows were updated. Please choose your delivery times again.",
  "detail": { "reason": "delivery_window_timezone_updated" }
}
```

The schedule `PUT` clears it — re-picking against the windows the server offers
now *is* the reconfirmation.
