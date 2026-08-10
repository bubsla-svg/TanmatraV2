# PR A2.1 status — PlanDraft domain and persistence

**Filed against:** the owner's PR A2 specification (2026-08-10), which accepted
`docs/journey-2-4-contract-gaps.md` (PR #27, `claude/journey2-4-contract-gaps`,
**not yet merged** at the time this file was written) and authorized PR A2,
broken into A2.1 (domain/persistence) → A2.2 (generation/modification) → A2.3
(delivery/quote) → A2.4 (subscription origination).

**Why this is a separate file instead of an edit to `journey-2-4-contract-gaps.md`:**
that document does not exist on `main` yet — it ships in an open, unmerged PR.
Editing it here would create a merge collision with that PR's own history. This
file stands alone and should be folded into the contract-gap record (or linked
from it) once PR #27 merges. It uses the same named defect IDs the owner's PR
A2 specification assigned to `journey-2-4-contract-gaps.md`'s §3/§4 gap tables,
inferred here from the ID naming against that document's content (the owner's
message that assigned these IDs is chat-only and not itself a repo artifact).

**Scope boundary — per the owner's explicit instruction:** "Stop after A2.1."
Nothing past domain schema, persistence, ownership, versioning, status
transitions, migration, and tests for the draft lifecycle is in this PR.
A2.2–A2.4 and all Journey 2/4 frontend work remain unstarted.

---

## 1. What A2.1 delivers

- **Domain schema** — `lib/db/src/schema/planDrafts.ts`: `PlanDraft` /
  `PlanDraftDay` / `PlanDraftMealSlot` and the full `PlanDraftStatus` enum,
  explicitly distinct from Subscription / Order / QuoteSnapshot /
  PaymentAttempt. Day-level lineup data is JSONB on the parent row (matches
  `subscriptionsTable.dayPlan` / `mealPlansTable.days` precedent), not child
  tables.
- **Migration** — `lib/db/drizzle/0026_plan_drafts.sql` + journal entry.
  Hand-authored (see §3 below for why) and verified two ways: applied
  clean via the real production runner (`scripts/src/apply-migrations.ts`)
  against a fresh database, and matched column-for-column against the schema
  via `psql \d plan_drafts`.
- **Ownership** — `artifacts/api-server/src/lib/planDraftAuth.ts`. A draft's
  `id` is an opaque 32-byte token (mirrors `sessionsTable.sid`) carried in an
  httpOnly `plan_draft_id` cookie — never in `localStorage`/`sessionStorage`,
  per the owner's "do not store the draft identity broadly in browser
  storage" instruction. A claimed draft (`userId` set) is owned by the
  authenticated session only; the cookie is never consulted again for it.
  Ownership failures return 404, not 403, so a probe request cannot
  distinguish "not yours" from "doesn't exist."
- **Versioning** — every `planDraftsTable` row carries `version`. PATCH is a
  compare-and-swap (`WHERE id = :id AND version = :version`); an empty
  `.returning()` means a stale write, reported as 409 `stale_version`. This is
  a genuinely new pattern for this codebase (existing tables CAS on `status`,
  not a counter) — introduced because a draft's edits span many independent
  screens over a long-lived session in a way status-CAS doesn't fit.
- **Status state machine** —
  `artifacts/api-server/src/lib/planDraftStateMachine.ts`: the full status
  graph is declared (so A2.2–A2.4 extend it rather than re-deriving it), but
  only `collecting_preferences` and `ready_to_generate` are reachable from a
  client PATCH today (`CLIENT_SETTABLE_STATUS_VALUES`). Everything from
  `generating` onward belongs to engines A2.1 does not build.
- **Routes** — `artifacts/api-server/src/routes/planDrafts.ts`:
  `POST /plan-drafts` (create, guest or authenticated),
  `GET /plan-drafts/:id` (restore), `PATCH /plan-drafts/:id` (versioned
  preference update), `POST /plan-drafts/:id/claim` (guest → authenticated
  transfer; supersedes any other live draft the claiming user already holds
  in the same journey, keeping "at most one live draft per journey per
  customer").
- **Tests** — 16 passing: `planDraftStateMachine.test.ts` (7, pure/DB-free,
  exercises the full status graph including illegal transitions the route
  layer can never reach) and `planDrafts.test.ts` (9, real-Postgres
  integration, real `cookie-parser`): create guest draft; restore gated by
  cookie; versioned update; stale-version rejection; engine-only-status
  rejection; claim requires auth; claim requires the guest cookie (id alone
  is not enough); claim transfers ownership and blocks the former cookie and
  any other authenticated user; claim supersession. Wired into
  `.github/workflows/verify.yml`'s `money-integration` job (the shared
  real-Postgres integration bucket) and passes `lint:test-reach`.

## 2. Named defect status (owner's PR A2 IDs)

All seven remain **open** — A2.1 is domain/persistence only. What changed for
each is noted; none of them ship functionality in this PR.

| Defect ID | Gap (contract-gaps §3/§4) | A2.1 status |
|---|---|---|
| DEFECT-PLAN-GEN-001 | Plan Generation (loading/progress/error recovery) does not exist | Open. `generating` / `lineup_ready` / `generation_failed` are reserved states in the schema and state machine; no generator exists (A2.2). |
| DEFECT-PLAN-CANDIDATE-001 | Change Dish: no pre-purchase safety-filtered, price-differenced candidates | Open (A2.2). `PlanDraftMealSlot.priceAdjustmentPaise` and `.locked` exist as fields a future candidate/replace endpoint will write. |
| DEFECT-PLAN-OPTIONS-001 | Accompaniment Editor does not exist at any lifecycle stage | Open (A2.2). `accompanimentSelections` / `addOns` are reserved fields on `PlanDraftMealSlot`; no options-listing endpoint. |
| DEFECT-PLAN-SCHEDULE-001 | No pre-purchase delivery capacity/eligible-dates/serviceability endpoint | Open (A2.3). `PlanDraftDeliverySchedule` is a reserved shape on the draft row; no endpoint reads or writes it yet. |
| DEFECT-PLAN-CONVERT-001 | No `PLAN_CATALOG`-aware quote-readiness composite | Open (A2.3). `ready_for_quote` / `quoted` are reserved states; no quote endpoint. |
| DEFECT-PLAN-ORIGIN-001 | No path from a generated/configured plan to a new subscription | Open (A2.4) — the load-bearing gap. A2.1 builds the piece origination depends on: draft ownership + claim + per-journey supersession ("at most one live draft") is the plumbing "one successful quote/payment → at most one order → at most one subscription" needs upstream of it, but the actual convert-to-subscription step does not exist. |
| DEFECT-CUSTOM-ROUTE-001 | `/custom-build` serves a live, unrelated, working feature | Open. Migration plan prepared, not executed — see §4. |

## 3. New defects found while building A2.1

### DEFECT-MIGRATION-DEBT-001 — `drizzle-kit generate`/`push` cannot run non-interactively on `main`

`patientBiomarkersTable` (`lib/db/src/schema/rdAdvisory.ts`, backing the live
production route `routes/rdAdvisory.ts`) and a `fasting_logs` table both have
no migration file ever committed for them. The last snapshot
(`lib/db/drizzle/meta/0025_snapshot.json`) also carries an orphaned
`admin_role_assignments` entry matching no current schema file. Any of these
alone makes `drizzle-kit generate` (and `push`/`push-force` when they hit the
same diff) stop on an interactive "is this a rename?" prompt that cannot be
answered non-interactively — confirmed by reproducing the hang locally and by
reading the snapshot JSON directly.

This is why `0026_plan_drafts.sql` was hand-authored rather than generated,
and is pre-existing, unrelated to PlanDraft. It blocks `drizzle-kit generate`
for **any** future schema change on `main` until someone with prod-schema
visibility reconciles the three tables against a real migration history.

### DEFECT-MIGRATION-DEBT-002 — `apply-migrations.ts`'s baseline detection can silently skip a real migration on a `push`-seeded database

`scripts/src/apply-migrations.ts` treats an empty `ci_applied_migrations`
tracking table plus "public.orders exists" plus three frozen currency probes
(pinned to the 0020–0022 chain tip) as proof the database is "hand-migrated
and current" — and on that basis marks **every** journal entry, including
ones newer than the probes, as applied without executing them. This is
documented behavior for the runner's intended case (a genuinely hand-migrated
database), but it also fires on a database that was schema-synced via
`drizzle-kit push`/`push-force` and had simply never run this specific
runner before — which is exactly the state of the local `tanmatra_test`
database used to verify A2.1: it had `0000`–`0025` applied via `push-force`,
zero tracking rows, so the first `apply-migrations` run recorded
`0026_plan_drafts` as "applied" without creating the table. Recovered with a
manual `DELETE FROM ci_applied_migrations WHERE tag = '0026_plan_drafts'` and
a re-run.

Not a regression from this PR, and today's `money-integration` CI job uses
`push-force` (schema diffing), not `apply-migrations.ts`, so it isn't
exposed to this failure mode currently. It becomes live risk the moment CI
or a deploy step switches a `push`-seeded database over to
`apply-migrations.ts` for the first time — the exact scenario
`docs/runbook-prod-migration-baseline.md` addresses for `drizzle-kit migrate`
and its own `drizzle.__drizzle_migrations` ledger; this is the same class of
problem against `apply-migrations.ts`'s separate `ci_applied_migrations`
ledger, not something that runbook covers. Recorded here rather than fixed —
out of A2.1's scope and the probes are deliberately frozen by design, so
changing them needs the same care as the original design decision.

## 4. `/custom-build` route migration plan (prepared, not executed)

Per the owner's decision: `/custom-build` becomes the canonical Journey 4
wizard route; the existing single-dish customization feature moves to
`/dish/[slug]`.

**Current state at `/custom-build`** (`artifacts/storefront/app/(focus)/custom-build/page.tsx`):
renders `CustomBuildHub` — pick one dish from the live menu, configure its own
customization groups (bread/sauce/portion type), preview-price it, add to
cart. Real, working, server-repriced at checkout. No goal/routine/wearable/
intensity/duration input of any kind (contract-gaps §4).

**Confirms the owner's routing decision independently:** the Stitch route
registry (`artifacts/storefront/lib/stitchRoutes.ts:205-210`) already maps
`/custom-build` to screen title *"Build Your Own Plan: Goal Selection"* —
i.e. the design system's own route table already expects `/custom-build` to
be the wizard, not the dish customizer. The current feature is squatting on
the wizard's intended URL, not the reverse.

**Inbound references to `/custom-build`** (all must be updated when the
wizard actually lands there — enumerated now so A2.2/A2.3-era frontend PRs
don't have to rediscover them):

| File | Reference |
|---|---|
| `app/sitemap.ts:48` | Sitemap entry, priority 0.8 |
| `components/landing/Section04ProtocolsGrid.tsx:198` | Landing-page CTA: *"Customize your macros… in our Custom Plan Builder"* |
| `components/primitives/Headers.tsx:53` | Primary nav button, label "Custom Build" |
| `lib/nav.ts:62` | Command menu (⌘K) entry, "Custom build hub" |
| `lib/stitchRoutes.ts:73,205-210` | Route registry — already names the *wizard*, not the current feature (see above) |
| `lib/dishCustomizations.ts:7` | Comment referencing `/custom-build`'s label list — implementation detail of the *current* feature, moves with it |

**Migration requirements** (from the owner's PR A2 spec, restated against the
above inventory):

1. **Preserve dish-config logic.** `CustomBuildHub.tsx`'s customization-group
   logic (bread/sauce/portion, preview pricing, server re-price at checkout —
   the file's own header comment: *"must never invent its own price
   arithmetic that lands in the cart"*) is real and tested. It moves to
   `/dish/[slug]` as-is; nothing about its pricing discipline changes.
2. **No random-dish redirects.** A bare `/custom-build` visit today has no
   dish preselected — `CustomBuildHub` receives the full `dishes` list and
   the customer picks one inside the page. Moving to `/dish/[slug]` means
   every *existing* inbound link that currently lands on `/custom-build`
   expecting to then pick a dish needs a landing page at the old URL's
   replacement, not a redirect to an arbitrary/first dish — the owner's
   instruction is explicit that an identifier-less deep link must not
   auto-select a dish on the customer's behalf.
3. **Migration landing page.** For any inbound link that cannot carry a
   dish slug (the four references in the table above that link to bare
   `/custom-build` with no dish context — sitemap, landing CTA, nav button,
   command menu), the plan is: once the wizard occupies `/custom-build`,
   these become the wizard's real entry points (their copy already reads as
   Journey-4-appropriate: "Customize your macros, calorie targets, and
   dietary preferences"), not broken links — they were pointing at the
   wizard's intended destination the whole time, per the Stitch registry
   finding above. No interim redirect page is needed for them. What *does*
   need one: any link elsewhere in the codebase that reaches
   `/custom-build` expecting today's dish-picker behavior specifically
   (none found in this inventory — `dishCustomizations.ts`'s reference is
   a comment, not a link) would need a short-lived landing page pointing
   the customer at `/menu` to pick a dish, then on to `/dish/[slug]`. Since
   no such link currently exists, this step is a contingency, not
   required work, unless A2.2/A2.3-era frontend work introduces one.
4. **Sequencing.** This migration executes in the PR that actually builds
   the Journey 4 wizard's frontend (A2.2/A2.3-era, per PR C in the
   contract-gaps sequencing) — not before, since moving `CustomBuildHub` off
   `/custom-build` before the wizard exists would leave the route dark.

---

_Evidence: `lib/db/src/schema/planDrafts.ts`, `lib/db/drizzle/0026_plan_drafts.sql`,
`artifacts/api-server/src/lib/planDraftAuth.ts`,
`artifacts/api-server/src/lib/planDraftStateMachine.ts`,
`artifacts/api-server/src/routes/planDrafts.ts`; tests green locally
(`planDraftStateMachine.test.ts` 7/7, `planDrafts.test.ts` 9/9) and wired into
CI (`verify.yml` `money-integration`, `lint:test-reach` passes). Exact
commit SHA recorded in the PR that carries this file._
