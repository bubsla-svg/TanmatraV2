# PR A2.3 status — delivery eligibility, capacity, scheduling, quote readiness

**Filed against:** the owner's A2.3 authorization (2026-08-10), granted on A2.2H
merging. Continues the ledger in `docs/journey-2-4-a2-1-status.md` and
`docs/journey-2-4-a2-2-status.md`.

**Scope:** delivery serviceability, server-generated dates/windows, capacity,
schedule persistence and quote readiness. **A2.4 (subscription origination) is
NOT started.** Plan checkout stays gated. No frontend work.

---

## 1. What A2.3 delivers

- **QuoteSnapshot** — `lib/db/src/schema/planDraftQuotes.ts`, migration `0029`.
  A quote is a separate row, not more columns on the draft, because the two have
  different lifetimes: the draft keeps changing while the customer configures
  it, and a quote must not change once issued. `planDraftVersion` is the binding
  — a quote is valid only for the version it priced.
- **Serviceability** — `resolveServiceability()`: address exists, belongs to a
  serviceable pincode, resolves to a fulfilment zone. Refusals carry a
  customer-safe message *and* recovery options; an unserviceable address returns
  200 with `serviceable: false` rather than a bare error the UI has to invent
  copy for.
- **Eligible dates and windows** — `eligibleDates()`: server-generated from the
  live `delivery_slots` table, filtered by zone, the 24 h cutoff, and remaining
  capacity. The frontend renders these and nothing else.
- **Schedule persistence** — `PUT /plan-drafts/:id/delivery-schedule`: every
  assignment must match a date+window+slot the server itself offered, day count
  must match the lineup exactly, no two days may share a slot, the version is
  bumped by the usual CAS, and any active quote is superseded.
- **Capacity** — advisory during configuration, held only at quote time,
  released on supersession or expiry.
- **Quote readiness** — `GET /plan-drafts/:id/quote-readiness` returns the exact
  set of blockers, never a generic failure.
- **Quote issue** — `POST /plan-drafts/:id/quote` prices from `PLAN_CATALOG`,
  reserves capacity atomically, and moves the draft to `quoted`.
- **Tests** — 13 new (`routes/planDraftSchedule.test.ts`), real Postgres, wired
  into `verify.yml`. Full PlanDraft suite: **94/94**.

## 2. Named defect status

| Defect ID | Before | After A2.3 |
|---|---|---|
| DEFECT-PLAN-SCHEDULE-001 | Open | **Closed.** Serviceability, eligible dates/windows, cutoff and capacity all exist and are server-owned. |
| DEFECT-PLAN-CONVERT-001 | Open | **Closed for `PLAN_CATALOG` plans** — a readiness composite plus a real QuoteSnapshot. **Explicitly NOT closed for Journey 4** — see §3.1. |
| DEFECT-PLAN-ORIGIN-001 | Open | Open (A2.4). A quote is issued but nothing consumes it. |
| DEFECT-CUSTOM-ROUTE-001 | Open | Open. Frontend routing. |

## 3. Judgment calls, recorded

### 3.1 A custom (Journey 4) plan cannot be quoted — deliberately

`PLAN_CATALOG` prices a recommended plan. **There is no pricing model anywhere
in this repo for a freely-generated custom plan**, and the corpus does not
define one. Rather than invent a number, `quote-readiness` returns a typed
`pricing_unavailable` blocker for any non-catalog draft, and `POST /quote`
refuses it.

This is the single most important thing in A2.3 to review. Inventing a price
would be exactly the fabricated-money defect class this whole series exists to
remove (`journey-2-4-contract-gaps.md` §2 documents the last time it happened).
**Journey 4 needs an owner pricing decision before it can reach checkout** —
that is a product input A2.4 cannot supply for itself.

### 3.2 Closures and holidays are the absence of slots

A day the kitchen does not run simply has no `delivery_slots` rows for the zone,
so it never appears as eligible. A separate holiday calendar would be a second
source of truth operations would have to keep in sync with the slots they
already publish.

### 3.3 Capacity is advisory until a quote exists

Availability shown during configuration is explicitly flagged `advisory: true`.
Capacity is held only when a quote is issued, bounded by the quote's 30-minute
TTL, and released on supersession, expiry, or a reschedule. The alternative —
holding kitchen capacity for every browsing session — would starve real buyers.

Readiness **re-checks** capacity, because what was offered during configuration
can fill underneath the customer. Under concurrency the loser is refused for
capacity by whichever guard sees it first: the readiness re-check (422) or the
conditional reservation (409). The reservation increment is conditional on
`reserved_count < capacity` *in the UPDATE*, so two concurrent quotes cannot
both take the last unit — pinned by test.

### 3.4 No delivery fee is invented

Plan prices are GST-inclusive all-in figures (planCatalog 02c), so
`deliveryFeePaise` is `0`. If the owner introduces a separate delivery fee, it
belongs in the catalog, not here.

### 3.5 Zone resolution is a single zone today

Every serviceable pincode maps to the `"default"` zone the slot table already
ships with. The seam (`zoneForPincode`) exists so a second kitchen is a mapping
change rather than a schema change — but nothing pretends there is more than one
zone today.

## 4. A2.3 completion gate

| Requirement | State |
|---|---|
| Unserviceable address rejected with recovery guidance | ✅ |
| Eligible dates come from the server | ✅ |
| Delivery windows come from the server | ✅ |
| Capacity conflicts detected | ✅ |
| Cutoffs enforced (24 h) | ✅ |
| Schedule persistence increments version | ✅ |
| Schedule edits supersede quotes | ✅ |
| Quote readiness reports exact missing requirements | ✅ |
| Quote uses the current draft version | ✅ |
| Stale draft cannot create a quote | ✅ |
| Capacity reservation expires safely | ✅ |
| Concurrent capacity claims cannot overbook | ✅ |
| Database-backed tests pass | ✅ 94/94 |

## 5. Verification

- `node --test --import tsx ./src/routes/planDraftSchedule.test.ts` — 13/13
- Full PlanDraft suite (7 files) — **94/94**
- `pnpm run typecheck` — clean
- `lint-test-reach`, `lint-workflow-secrets` — pass
- Migration `0029` applied through `scripts/src/apply-migrations.ts` on a fresh
  database (full 30-migration chain, clean)

## 6. What A2.4 inherits

A `quoted` draft with a frozen, version-bound QuoteSnapshot and real reserved
capacity. A2.4 owns PlanDraft → QuoteSnapshot → PaymentAttempt → Order →
Subscription → first cycle → deliveries, and the invariant *one successful
settlement → one order → one subscription → one first cycle*. Two things it must
handle that A2.3 deliberately left alone: consuming a quote (marking it
`consumed` and converting its held reservations into order/subscription
reservations), and the Journey 4 pricing decision in §3.1.
