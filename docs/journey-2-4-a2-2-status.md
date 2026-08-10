# PR A2.2 status — PlanDraft generation, Change Dish, and accompaniments

**Filed against:** the owner's PR A2 specification (2026-08-10), which broke PR A2
into A2.1 (domain/persistence) → **A2.2 (generation/modification)** → A2.3
(delivery/quote) → A2.4 (subscription origination). A2.1 shipped as PR #29 and is
merged. This file continues the defect ledger `docs/journey-2-4-a2-1-status.md`
opened there; read that file first for the ledger's provenance and for the
`/custom-build` route-migration plan, which A2.2 does not touch.

**Scope boundary.** A2.2 is generation and lineup modification only. No delivery
schedule, no quote, no subscription origination, and still no Journey 2/4
frontend work.

---

## 1. What A2.2 delivers

- **Generation engine** — `artifacts/api-server/src/lib/planDraftGenerator.ts`.
  Turns a draft's collected preferences into a day-by-day lineup of real,
  orderable dishes. **Deterministic — no model call** (see §3.1 for why).
- **Generation route** — `POST /plan-drafts/:id/generate`, with a persisted
  failure reason so a reload after a failure is not a dead end.
- **Change Dish** — `GET /plan-drafts/:id/candidates` (safety-filtered, macro-
  and price-differenced) and `POST /plan-drafts/:id/lineup/replace`.
- **Keep / Shuffle / Undo** — `POST /plan-drafts/:id/lineup/lock`,
  `.../shuffle`, `.../undo`.
- **Accompaniment editor** — `GET /plan-drafts/:id/accompaniment-options` and
  `POST /plan-drafts/:id/lineup/accompaniments`.
- **Schema + migration** — `lib/db/drizzle/0027_plan_draft_generation_error.sql`
  adds one nullable `generation_error` jsonb column. Hand-authored (the
  `drizzle-kit generate` blocker recorded as DEFECT-MIGRATION-DEBT-001 in the
  A2.1 status doc is still open on `main`), and verified two ways: applied
  through the real production runner `scripts/src/apply-migrations.ts` against a
  **fresh** database as part of the full 28-migration chain, and matched against
  the Drizzle schema via `psql \d plan_drafts`.
- **Shared store helpers** — `artifacts/api-server/src/lib/planDraftStore.ts`.
  A2.1's `loadLiveDraft` and its compare-and-swap were module-private to
  `routes/planDrafts.ts`; A2.2 needs the identical expire-on-read and
  optimistic-concurrency semantics, and two copies of a concurrency guard is how
  they drift. Both routers now call one implementation. A2.1's 16 tests pass
  unchanged against it.
- **Tests** — 41 new, all wired into `verify.yml`'s `money-integration` job and
  passing `lint:test-reach`:
  - `planDraftGenerator.test.ts` — 23, pure/DB-free (fixture dishes).
  - `planDraftLineup.test.ts` — 18, real Postgres + real `cookie-parser`.

## 2. Named defect status (owner's PR A2 IDs)

| Defect ID | A2.1 | A2.2 |
|---|---|---|
| DEFECT-PLAN-GEN-001 | Open | **Closed.** Generation exists, with a real `generating` → `lineup_ready`/`generation_failed` progression, a persisted machine- and human-readable failure reason, and a retry path the state machine already allowed (`generation_failed` → `ready_to_generate`). See §3.2 on what "progress" does and does not mean while generation is synchronous. |
| DEFECT-PLAN-CANDIDATE-001 | Open | **Closed.** `GET /candidates` returns the same safety-screened pool generation itself draws from, minus the dish already in the slot, each candidate carrying a per-macro delta vs. the current dish and a catalog list-price delta. `POST /lineup/replace` re-runs the full safety screen server-side — a candidate list is not a capability grant. |
| DEFECT-PLAN-OPTIONS-001 | Open | **Closed.** The accompaniment editor lists the dish's own `DishCustomGroup`s and prices a selection through `resolveCustomizations` — the *same* function à-la-carte checkout uses, so a plan slot and a cart line can never diverge on what an add-on costs. Unknown group/option is a 422, never a silently-dropped selection. |
| DEFECT-PLAN-SCHEDULE-001 | Open | Open (A2.3). Generation deliberately writes `deliveryWindow: null` and `addressId: null`; `deliveryDate` is a provisional consecutive-day sequence that exists only to give slots stable keys to edit against. |
| DEFECT-PLAN-CONVERT-001 | Open | Open (A2.3). |
| DEFECT-PLAN-ORIGIN-001 | Open | Open (A2.4) — still the load-bearing gap. |
| DEFECT-CUSTOM-ROUTE-001 | Open | Open. Frontend routing; plan prepared in the A2.1 status doc §4, not executed. |
| DEFECT-MIGRATION-DEBT-001 | Found | Still open on `main`. Hit again: 0027 was hand-authored for the same reason 0026 was. |
| DEFECT-MIGRATION-DEBT-002 | Found | Still open. Not re-triggered — 0027/0028 were verified on a genuinely fresh database, which is the branch that runs the chain rather than baselining it. |

### Defects opened and closed by A2.2H

| Defect ID | Description | Status |
|---|---|---|
| DEFECT-PLAN-GEN-LEASE-001 | Generation claim lacks attempt ownership and stale-lease recovery | **Closed** by A2.2H (§3.10). |
| DEFECT-PLAN-CLAIM-RACE-001 | Ownership claim CAS lacks deterministic race regression coverage | **Closed** by A2.2H — seam + test, verified to fail pre-fix. |
| DEFECT-PLAN-RATE-001 | Plan-draft endpoints require cost-aware rate-limit policies | **Closed** by A2.2H — five policies, typed 429 + Retry-After. |
| DEFECT-PLAN-DRAFT-RETENTION-001 | Anonymous PlanDraft retention and garbage collection undefined | **Closed** by A2.2H — per-customer stock cap + a sweep that spares quoted/converted/leased/audit rows. |

### A2.2 acceptance

| Item | State |
|---|---|
| Concurrent-edit stranding | FIXED and regression-tested (A2.2a) |
| Generation claim ownership | FIXED (A2.2H) |
| Crash / stale-lease recovery | FIXED (A2.2H) |
| Claim CAS source fix | MERGED (A2.2a) |
| Claim CAS deterministic regression | FIXED (A2.2H) |
| Rate-limit presence | MERGED (A2.2a) |
| Rate-limit policy separation | FIXED (A2.2H) |
| **A2.2** | **PASS** |

## 3. Judgment calls, recorded

These are places where the owner's spec left a real choice and A2.2 made one.
Each is reversible; none should be discovered later by reading code.

### 3.1 Generation is deterministic, not AI

The one existing generator that persists (`lib/mealPlanner.ts`) asks a model to
pick from a pre-filtered pool, validates the answer against hard constraints,
and falls back to a greedy picker when the model is unavailable or returns a
constraint-violating plan. A2.2 implements **that greedy picker without the
model leg.**

Why: a pre-purchase configuration screen is a thing the customer reviews, edits,
and then buys. The same inputs must produce the same lineup — a customer who
reloads and sees a different plan has been shown that their configuration
doesn't mean anything. It also keeps the engine testable without model
credentials, and nothing in the lineup is prose a model would be better at.

The pool-filtering, constraint-validation and greedy-rotation logic is the same
shape as `mealPlanner`'s, deliberately, so a future decision to add a model leg
has an obvious place to attach.

### 3.2 "Progress" is a status, not a percentage

Generation runs synchronously inside the request. `generating` is written to the
row before the work starts and moved off it before the response, so the status
is real and observable by a concurrent reader — but a client will not observe a
progress *fraction*, because there is nothing honest to report one from.

The status is still written (rather than skipped as a no-op) for two reasons: a
second concurrent `generate` loses the compare-and-swap and 409s instead of both
running and one silently overwriting the other's lineup; and the contract does
not change if generation later becomes asynchronous.

**Known limit, not fixed here:** if the *process* dies mid-generation, the draft
is left in `generating`, which no client transition can leave. Every in-process
failure path — including unexpected exceptions — moves the draft to
`generation_failed`, so this is narrowly a crash-recovery gap. A sweeper that
ages `generating` rows back to `ready_to_generate` belongs with the other
scheduled jobs and is out of A2.2's scope.

### 3.3 A2.2 never invents money

`priceAdjustmentPaise` is the only figure this PR can move, and it moves in
exactly one place: from `resolveCustomizations`'s server-computed
`modifierPaise`. Specifically:

- **Generation writes 0.** A `PLAN_CATALOG` plan charges its per-meal price
  whatever in-pool dish fills the slot — that is what a pool *is*. A custom
  (Journey 4) plan has no price at all until the quote step.
- **A dish swap does not change it.** Candidates carry a
  `catalogPriceDeltaPaise` for *display*, explicitly labelled as a catalog
  list-price difference and not what a swap bills.
- **Accompaniments do change it**, because a `DishCustomGroup` option's
  `priceModifier` is a real, already-shipped, server-side price component.

A test asserts that a request body carrying its own `priceAdjustmentPaise` is
ignored entirely and the stored value is the server's sum.

### 3.4 Hard allergens block; soft dislikes only re-rank

The contract-gap doc recorded that `mealPlanner.buildCandidatePool` hardcodes
`dislikedIngredients: []`, so soft dislikes have zero effect on generation
despite the field existing. A2.2 does not inherit that:

- `hardAllergens` + `hardExclusions` → `evaluateDishForPreferences(..., { strict: true })`.
  Strict mode promotes `dislikedIngredients` to an `ingredient_block`, which is
  exactly what a declared hard exclusion means. Blocked dishes are removed.
- `softDislikes` → the same evaluator, **non-strict**. A match sinks the dish to
  the bottom of the ranking and is never removed, because a dislike is a
  preference, not a safety rule.

This distinction is enforced on every path that can put a dish in a slot —
generate, shuffle, and replace — not only at generation.

### 3.5 Changing a safety answer discards the lineup it invalidates

Found while building A2.2, in A2.1's own PATCH route: `hardAllergens`,
`hardExclusions` and `dietaryPattern` could be edited *after* generation with no
effect on the already-persisted lineup. A customer who generated a plan and then
declared a dairy allergy kept a lineup full of dairy — and the symptom was
visible, because `GET /candidates` correctly refused to *offer* dairy while the
plan itself still showed it.

`PATCH /plan-drafts/:id` now discards the lineup (and its Undo snapshot and
Keep locks) whenever a field the lineup was derived from actually changes,
resetting the draft to `collecting_preferences` so it must be re-generated. The
same applies to the shape inputs (`planId`, `mealtime`, `routine`, `duration`),
where a stale lineup would be structurally wrong rather than unsafe.
Re-sending an identical value is not a change and keeps the lineup.

Nothing downstream could have charged for the unsafe lineup yet — quote (A2.3)
and origination (A2.4) do not exist — so this was reachable but not yet
exploitable. It is fixed here rather than deferred, because the fix belongs with
the code that owns the lineup, and A2.3 would otherwise inherit a persisted
lineup it has every reason to trust.

### 3.6 A plan that cannot be sold refuses to generate

`planIsSelfServiceLaunchable` and `planServesTrack` are checked before
generating. A `blocked_pending_skus` plan (`steady`, `glp1_companion`) or a diet
track a plan does not serve produces a 422 with the blockers attached, rather
than a lineup for something the kitchen cannot fill — 02e §7 / 02d §8's
zero-dead-end rule. Likewise `trial_3day` is `customizable: false` (02e §3.5's
fixed trio, no swaps): it generates, but `candidates` returns `{ fixed: true,
candidates: [] }` and every lineup edit 409s `plan_not_customizable`.

### 3.7 Variety relaxation is reported, never silent

`varietyPreference` maps to a repetition cap (`high` → 2, `standard` → 3,
`low` → 6). When the safe pool is too small to fill the lineup at the requested
cap, the cap is relaxed deterministically to `ceil(meals / poolSize)` and the
response carries `notes: ["variety_relaxed_for_pool_size"]`. Silently ignoring a
preference the customer set would be a lie about their own configuration; the
alternative — failing outright — would make a small safe pool unusable.

### 3.8 A manual pick is Keep-protected; Shuffle keeps one Undo step

`replace` sets `locked: true` on the slot it writes, so a subsequent Shuffle
cannot undo a choice the customer made by hand. It also clears
`previousLineup`, per the rebuild spec's "manual replacement clears Undo" — the
snapshot describes a lineup the customer has since edited past. `shuffle` writes
exactly one Undo snapshot; a second `undo` in a row 409s `no_undo` rather than
unwinding a stack that was never kept.

## 3.9 Post-merge review follow-ups (A2.2a)

An adversarial review pass was run against A2.2 after it merged. It found **no**
hard-allergen, money-path or ownership bypass — the safety screen, the
`priceAdjustmentPaise` provenance and the 404-not-403 ownership handling all
held up under targeted probing. It did find two concurrency defects and one
convention gap, all fixed in the follow-up PR:

1. **`generating` was escapable only in theory.** §3.2 above recorded stranding
   as a *crash-recovery* gap. That framing was wrong and too generous: the
   generate route's final write is a version CAS, and **any** concurrent write
   landing between the claim and that write — an ordinary PATCH from a second
   tab is enough — made it fail, and both failure branches returned without
   releasing the claim. The draft was then permanently unusable, with the
   process perfectly healthy. Fixed with `releaseGeneratingClaim`, which is
   guarded on `status = 'generating'` rather than on the version (the version
   has legitimately moved in exactly this case, so re-guarding on it would fail
   for the same reason). The lineup built against now-stale answers is
   discarded rather than persisted, and the caller gets a `concurrent_edit`
   reason it can retry from.
2. **`claim`'s ownership write was not a real compare-and-swap.** It guarded
   only on `userId IS NULL` while setting `version` to a number computed from an
   earlier read, so a write landing in that window could have its version bump
   rewound — which in turn could let an already-stale request pass a later CAS
   it should have failed. Now guarded on the version and incremented DB-side,
   matching the supersede statement three lines above it in the same
   transaction. **Coverage caveat:** the tests added for this pin only the
   sequential properties; there is no seam to force the interleaving through the
   HTTP surface, and a timing-dependent race would be a flaky test rather than a
   regression test. This fix is argued from the invariant, not proven by a test.
3. **No rate limit on `/api/plan-drafts`.** Every other write-heavy route family
   in `app.ts` has one. `POST /plan-drafts` needs no auth and writes a row per
   call, and A2.2 added `generate`/`shuffle` (catalog fetch + full lineup
   rewrite) to that unthrottled surface. Now `planDraftRateLimit`, 60/min.

## 3.10 A2.2H — generation lease and deterministic concurrency verification

The owner granted A2.2 a **CONDITIONAL PASS** pending this hardening package,
which closes the two gaps A2.2/A2.2a acknowledged but did not fix, plus two
policy gaps found alongside them. With A2.2H merged, **A2.2 is PASS**.

### Generation is now an attempt-owned, time-bounded lease

`status = 'generating'` said a generation was in flight but not *whose*. A2.2a
made the claim releasable by guarding on that status, which fixed stranding but
left the claim anonymous: any holder of the status could release or finalize it.

Three columns (migration `0028`) make the claim owned and bounded —
`generation_attempt_id`, `generation_started_at`, `generation_lease_expires_at`
— and every terminal write is guarded on *"…and this is still my attempt"*:

| Operation | Guard |
|---|---|
| acquire | version CAS (a fresh claim) |
| reclaim | `status = 'generating' AND lease_expires_at <= now()` — atomic, so exactly one of N racing reclaimers wins |
| finalize | `status = 'generating' AND attempt_id = mine` |
| release | `status = 'generating' AND attempt_id = mine` |

The invariant this enforces: **attempt A can complete or release only attempt
A's claim, and can never touch attempt B's newer one.** A stalled worker that
wakes after being superseded is refused on both finalize and release, and its
lineup — built from answers that may since have changed — is discarded.

**`generationFailureCode` is deliberately not a fourth column.** The code
already lives in `generation_error.code`, typed as `PlanDraftGenerationCode` and
persisted with its message and details. A second copy would be a drift hazard
with no reader that needs it.

### Crash recovery

`planDraftMaintenanceScheduler` ages out leases whose owning attempt stopped
reporting. **Selected transition: `generating → generation_failed` with
`code: generation_lease_expired`, retryable** — chosen over
`generating → ready_to_generate` because silently rewinding to "ready" hides
that anything went wrong, leaving the customer to wonder why their plan never
appeared. The state machine already permitted this edge.

A reclaimed or swept draft never keeps lineup output generated under stale
answers: the superseded attempt's finalize is refused, so that output is never
written in the first place.

### Deterministic claim-race coverage

A2.2a's claim CAS fix shipped **unproven** — the tests pinned only sequential
properties, and I said so at the time. That is now closed with an explicit test
seam (`lib/planDraftTestHooks.ts`): a hook awaited at the exact point between
claim's read and its guarded UPDATE, settable only by code that can `import` the
module, and which throws if installed with `NODE_ENV=production`. There is no
endpoint, parameter, header or env var that can reach it.

The test reproduces: A reads at version N → B's PATCH lands → A's claim runs →
A is refused with a typed 409, the version does not rewind below N+1, B's data
survives, and ownership does not transfer. **Verified to fail against the
pre-fix claim implementation** (version predicate and DB-side increment removed)
and pass with it.

### Cost-aware rate limits

One flat 60/min bucket over the whole family was wrong in both directions. Now
five policies, each env-overridable **at runtime** (re-read per request, not
frozen at import): create 10, mutate 120, generate 10, shuffle 20, read 120 —
per minute. Keyed per caller (authenticated user → guest draft cookie → IP) and
folded with the draft id for draft-specific operations, so one corporate NAT no
longer shares a bucket across unrelated customers.

Every 429 carries a typed code (`PLAN_DRAFT_CREATION_RATE_LIMITED`,
`PLAN_GENERATION_RATE_LIMITED`, `PLAN_SHUFFLE_RATE_LIMITED`, …) and
`Retry-After`. Because the limiter runs before the handler, a refused request
provably takes no generation claim and writes no lineup — both pinned by test.

### Anonymous-draft retention

`POST /plan-drafts` needs no auth and writes a row per call. Two controls: a
per-authenticated-customer ceiling on *live* drafts (`10`, refused with
`PLAN_DRAFT_LIMIT_REACHED`), and a collection sweep. Guests are deliberately not
stock-capped — a guest has no stable server-side identity to count against, so
the rate limit plus the sweep are the controls there.

The sweep **never** deletes a draft that is `quoted` or `converted` (A2.3/A2.4
will reference those), holds a live generation lease, or was superseded inside
the 30-day audit window. Only genuinely abandoned pre-quote drafts are removed.
The status filter is what keeps this correct once the referencing rows exist,
rather than something to remember to revisit.

### Lineup writes are refused during generation

`replace` / `lock` / `accompaniments` / `shuffle` / `undo` now 409
`generation_in_progress` while a draft is `generating`. Reads stay available.
`PATCH` stays available too — that is the concurrent-edit path, and it must keep
working for the invalidation rule in §3.5 to hold.

## 4. Verification

**A2.2H (all six PlanDraft suites together — 81/81):**
- `./src/lib/planDraftLease.test.ts` — 15/15 (lease acquire/reclaim/expiry,
  racing reclaimers, old-worker-cannot-finalize, old-worker-cannot-release,
  new-worker-completes, sweeper, and the four retention guarantees)
- `./src/routes/planDraftRateLimit.test.ts` — 4/4 (typed 429 + Retry-After;
  a throttled generate takes no claim; a throttled shuffle writes no lineup;
  budgets are genuinely separate)
- `./src/routes/planDrafts.test.ts` — 12/12, including the deterministic
  claim-race test, **verified to fail against the pre-fix claim**
- Migration `0028` applied through `scripts/src/apply-migrations.ts` on a fresh
  database (full 29-migration chain, clean) and matched via `psql \d plan_drafts`

**A2.2 / A2.2a:**
- `node --test --import tsx ./src/lib/planDraftGenerator.test.ts` — 23/23
- `node --test --import tsx ./src/routes/planDraftLineup.test.ts` — 18/18
- `node --test --import tsx ./src/routes/planDrafts.test.ts ./src/lib/planDraftStateMachine.test.ts` —
  16/16 (A2.1's suite, re-run unchanged against the extracted store helpers and
  the new lineup-invalidation rule)
- `pnpm run typecheck` — clean across all packages
- `node --experimental-strip-types scripts/lint-test-reach.ts` — pass, both new
  test files reachable
- `node --experimental-strip-types scripts/lint-workflow-secrets.ts` — pass
- Migration 0027 applied via `scripts/src/apply-migrations.ts` on a fresh
  database (full 28-migration chain, clean) and structurally matched with
  `psql \d plan_drafts`
