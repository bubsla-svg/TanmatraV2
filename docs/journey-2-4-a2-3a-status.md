# PR A2.3a status — quote/reservation lifecycle, review follow-ups

**Filed against:** the A2.3 review (2026-08-10), which passed A2.3's delivery
and scheduling contracts *subject to CI evidence* and made five follow-up checks
a condition of closing the slice. Continues the ledger in
`docs/journey-2-4-a2-1-status.md`, `-a2-2-status.md` and `-a2-3-status.md`.

**Scope:** the five follow-up checks, the defects found while implementing them,
and the ledger corrections the review directed. **A2.4 (subscription
origination) is still NOT started.** Plan checkout stays gated. No frontend work.

---

## 1. The review was right, and one thing it did not catch was worse

The review's central judgement — that refusing to invent a custom-plan price is
an enforcement of the financial-authority boundary, not an incomplete
implementation — stands unchanged, and nothing here weakens it.

But wiring up follow-up check 1 surfaced a defect underneath the very invariant
the review was asking us to harden. A2.3's status doc claimed *"Concurrent
capacity claims cannot overbook ✅ — pinned by test"*. Re-run against real
Postgres, that test failed **two runs in three**:

```
=== run 1 ===  # pass 13  # fail 0
=== run 2 ===  not ok 12 - concurrent quotes cannot overbook the last unit of capacity
=== run 3 ===  not ok 12 - concurrent quotes cannot overbook the last unit of capacity
```

It was not flake. See DEFECT-PLAN-CAPACITY-002 below. A green suite on one run
is what let it merge; the honest reading is that "pinned by test" should never
have been written from a single pass of a concurrency test.

## 2. Defects found and fixed

### DEFECT-PLAN-CAPACITY-002 — a quote could be issued holding no capacity

**Severity: P0 for plan checkout** (it is oversold inventory: two customers, one
unit, both told yes). Fixed here; checkout was gated throughout, so no customer
was affected.

`slotIdsForSchedule()` resolved a draft's scheduled days back to slot rows *by
asking `eligibleDates()`* — the **offer list**, which by design hides any slot
with `remaining <= 0`. Correct for "what may the customer still pick"; wrong for
"which rows must I reserve". When a slot filled between the readiness re-check
and the issue transaction, the slot simply vanished from the lookup:

```
resolve → []   →   reserveSlotsForQuote(tx, quoteId, [], …)   →   failed = []
                                                              →   201 Created
```

The quote was issued, the draft moved to `quoted`, and it held **zero**
reservations. The conditional `reserved_count < capacity` increment was never
reached, so the guard everyone was relying on never ran. Whether it happened
depended on whether the winner's COMMIT landed before the loser's read — hence
2-in-3, not 3-in-3.

**Fix:** resolution now asks only *"does this (date, window) name a published
slot in this zone"* (`resolveScheduleSlots`), independent of remaining capacity,
and the issue path refuses when any day fails to resolve. Capacity is decided in
exactly one place — the conditional increment. A full slot now resolves fine and
is refused at reservation, which is the only ordering that cannot silently
under-reserve. The regression test asserts the half the old test never did:
`reserved_count` after the race, and one reservation row per day sold.

### DEFECT-PLAN-QUOTE-STALE-001 — every quote reported itself stale on issue

**Severity: P2** (no money moves; it misinforms the customer).

`POST /quote` finished with `casUpdateDraft(…, { status: "quoted" })`, which
bumps the draft version. Staleness is defined as *"the draft has moved past the
version this quote priced"* — so a quote priced at version N sat next to a draft
at N+1 and `quote-readiness` reported `stale: true` **the instant the quote
existed**. The frontend, told to render exactly what readiness returns, would
have asked the customer to re-check a plan they had just confirmed.

**Fix:** the status transition moved inside the issue transaction and no longer
bumps the version — it is still version-guarded, but issuing a quote is not an
edit to the plan it priced. As a bonus the quote row, its reservations and the
draft status now commit or roll back together.

## 3. The five follow-up checks

### 3.1 Capacity release must be idempotent ✅

Release was a `DELETE … RETURNING` plus a decrement per returned row. That is
race-safe for concurrent *releases* (the second delete returns nothing), but it
could not express the case the review flagged: **a consumed reservation must
never be releasable.** A hard delete cannot distinguish "released" from "never
existed", and nothing stopped a late sweeper handing back capacity an order
already owned.

`slot_reservations` now carries the lifecycle the review specified —
`active | consumed | released` — and the transition **is** the guard:

```sql
UPDATE slot_reservations SET status = 'released'
 WHERE plan_draft_quote_id = ? AND status = 'active'
RETURNING slot_id                       -- decrement ONLY what this claimed
```

`consumed` rows are invisible to that predicate, so they are permanently
unreleasable. Consumption deliberately does **not** decrement: the units stay
held, they change owner.

Tests: repeated release decrements once · five concurrent releasers claim one
between them · supersede-vs-expire racing one quote releases once · a consumed
reservation survives release + supersede + expire with its capacity intact.

### 3.2 Quote creation must be idempotent ✅

Not idempotent at all before this. Two problems, both fixed:

- **A retry cost the customer their slots.** A timeout on a *successful* call
  produced a second call that superseded the quote, released its capacity and
  re-reserved — and another customer could take the slot in that gap, so the
  retry turned a success into a 409. `POST /quote` now accepts an
  `Idempotency-Key` header (or `idempotencyKey` body field) and replays the
  quote already issued (`200`, `replayed: true`).
- **"At most one active quote per draft" was asserted, never enforced.** The
  schema comment claimed it; the database did not. Two concurrent requests both
  read "no active quote", both inserted, and the draft held capacity through two
  quotes. There is now a partial unique index on `(plan_draft_id) WHERE status =
  'active'`, and supersede-then-insert-then-reserve runs in **one** transaction.

The replay check deliberately runs *before* the stale-version check and compares
against the version the **caller asked for**: the key identifies a request, and
"you already have this" is only a correct answer to the same question.

Documented policies: a *different* key on an unchanged draft is a fresh offer —
the old quote is superseded and its capacity released in the same transaction
that reserves for the new one, so the draft never holds two quotes' worth. A
reused key against a different version is refused (`idempotency_key_reused`)
rather than guessed at.

Tests: retry returns the same quote and one row · four concurrent same-key
requests create exactly one quote and hold one unit · reuse against a moved
version is refused · a different key nets one unit and one active quote.

### 3.3 Quote expiry must have an actual execution path ✅

Three layers, and only the first two are correctness:

| Layer | Where | Runs |
|---|---|---|
| Read-time | `activeQuoteFor` filters `expiresAt >= now` | every readiness read |
| Settlement | `consumeQuote` claims `status='active' AND expires_at >= now` **inside the UPDATE** | every settlement attempt |
| Cleanup | `expireLapsedQuotes` in the 15-minute maintenance sweep | eventually |

The sweeper is **not** load-bearing: a quote is unpayable the instant it lapses
whether or not the sweep has run. `consumeQuote` is the A2.4 seam — A2.4 owns
everything downstream of it, but the guard lives here because "consumed capacity
is never released" is meaningless without a consumer.

Tests: an expired quote is refused for `expired` while its row still says
`active` (sweeper demonstrably not yet run) · four concurrent consumes settle
once · a superseded quote is refused · sweeping twice releases once.

### 3.4 Cutoff boundaries need exact tests ✅

The cutoff is **inclusive** at exactly 24 h. That was implicit in `gte(startsAt,
now + DELIVERY_CUTOFF_MS)`; it is now stated and pinned at one-second
granularity on both sides.

On timezones — eligibility never consulted a client's timezone and does not now:
`starts_at`/`expires_at` are `timestamptz` and the cutoff is arithmetic on
absolute instants, so a server in UTC and a server in IST admit the same slots.
A test asserts that by evaluating the same slot under four process `TZ` values.

What *was* unpinned is rendering. `windowLabel()` formatted in **UTC**, so an
08:00 IST slot was labelled `02:30-04:30` — and because that label is also what
the customer picks and what save-time validation matches, it had to be pinned to
one zone rather than to whatever `TZ` the container runs with.
`DELIVERY_OPERATIONAL_TZ = "Asia/Kolkata"` is now the single documented
operational timezone (no DST, so a constant +05:30 and no ambiguous local hour).

> **Consequence, deliberately accepted:** window labels change format for any
> draft scheduled before this lands. Labels are generated and validated by the
> same function, so the system stays self-consistent, but an in-flight draft's
> stored `deliveryWindow` will no longer match an offered one and the customer
> must re-pick. Plan checkout is gated and nothing consumes a quote yet, so the
> exposure is drafts in a test environment.

`delivery_slots.slot_date` is the operational date and must be written in this
zone by whoever publishes slots — the eligibility query groups by it verbatim
rather than re-deriving a date from the instant.

> **This paragraph was documentation-only, and the A2.3a review was right to
> refuse that.** "Must be written in this zone" bound nobody: every writer in
> the repository was producing `toISOString().slice(0, 10)` — the UTC date — and
> the seeder was additionally generating its wall-clock times in the container's
> zone, so a "19:00" dinner slot was published at 00:30 IST the next morning
> under the previous day's date. Now enforced by a database trigger, with the
> derivation in one canonical helper. See **`docs/DEFECT-PLAN-SLOT-DATE-001.md`**.

### 3.5 Catalog drift after quote creation ✅ — policy: honour until expiry

**Recorded policy:** a quote is a snapshot, not a live query. An `active`,
unexpired quote is honoured at its frozen total for its full 30-minute TTL
regardless of what the catalog does underneath it. Catalog changes take effect
on the *next* quote. A plan **withdrawn** from the catalog cannot be quoted
afresh — readiness returns `pricing_unavailable`, the same typed blocker a
custom plan gets — but an already-issued quote is still honoured for its TTL.

The review offered "typed invalidation **or** documented honour policy"; this is
the second, chosen because the TTL already bounds the exposure to 30 minutes and
invalidation would add a failure mode (a customer at the payment sheet watching
a valid offer evaporate) to remove almost nothing.

Tests: re-priced catalog leaves both the API's `activeQuote.totalPaise` and the
stored row untouched · a withdrawn plan blocks a new quote with
`pricing_unavailable` and reserves nothing.

## 4. Corrected defect ledger

| Defect ID | Status after A2.3a | Owner |
|---|---|---|
| DEFECT-PLAN-SCHEDULE-001 | **Closed.** Merged in A2.3; DB-backed CI evidence attached in §5. | — |
| DEFECT-PLAN-CONVERT-001 | **PARTIALLY RESOLVED.** Resolved: a catalog-backed PlanDraft creates an immutable QuoteSnapshot, capacity is reserved, the quote binds to the exact draft version. Remaining: the quote cannot yet create the idempotent order/subscription lifecycle; no first cycle, no delivery records. | A2.4 |
| DEFECT-PLAN-ORIGIN-001 | **Open.** No end-to-end purchasable subscription lifecycle exists. | A2.4 |
| DEFECT-CUSTOM-PRICING-001 | **Open — BLOCKED ON PRODUCT DECISION.** See `docs/DEFECT-CUSTOM-PRICING-001.md`. | Product + Finance + Nutrition Ops |
| DEFECT-PLAN-CAPACITY-002 | **Closed here.** §2. | — |
| DEFECT-PLAN-QUOTE-STALE-001 | **Closed here.** §2. | — |
| DEFECT-PLAN-SLOT-DATE-001 | **Closed** by the follow-up PR — `slot_date` enforced at the database boundary; see `docs/DEFECT-PLAN-SLOT-DATE-001.md`. It was a gate on A2.4 acceptance. | — |
| DEFECT-CUSTOM-ROUTE-001 | Open. Frontend routing. | Journey 4 FE |

A2.3's own status doc carried "DEFECT-PLAN-CONVERT-001 → Closed for
`PLAN_CATALOG` plans"; that has been struck through at the top of that file.

## 5. Verification

Real Postgres 16, schema built the way CI builds it
(`pnpm --filter @workspace/db run push-force`).

| Check | Result |
|---|---|
| `planDraftQuoteLifecycle.test.ts` (new) | **18/18** |
| `planDraftSchedule.test.ts` (A2.3) | 13/13, **5 consecutive runs** — was 12/13 on 2 of 3 before the fix |
| Full PlanDraft suite (8 files) | **112/112, 3 consecutive runs** (was 94) |
| `pnpm run typecheck` | clean |
| `pnpm run lint:test-reach` | pass — new file wired into `verify.yml` |
| Migration `0030` | applied through `scripts/src/apply-migrations.ts` on a fresh database (full 31-migration chain, clean) |

Concurrency tests are run repeatedly on purpose. A single green run of a race
test is what let DEFECT-PLAN-CAPACITY-002 through in the first place.

## 6. What A2.4 inherits

Unchanged from A2.3's §6, plus:

- `consumeQuote(quoteId, now)` — the settlement guard. Claims a quote exactly
  once, refuses `not_found` / `not_active` / `expired` from server time, and
  transitions its reservations to `consumed` without releasing capacity. A2.4
  builds PaymentAttempt → Order → Subscription → first cycle → deliveries behind
  it; the "one valid settlement → exactly one order" invariant starts here.
- An `Idempotency-Key` convention already established on the quote route, to
  carry forward onto the settlement route.
- The still-open Journey 4 pricing decision (§4, DEFECT-CUSTOM-PRICING-001).
  A2.4 should build `PLAN_CATALOG` origination only.

**`PLAN_CHECKOUT_DISABLED=1` stays set** until the controlled plan-verification
sequence passes, per the review's direction.
