# Tanmatra — Architecture Coherence Contract

**Read this before you touch any file, whatever the task.** It is the durable half of the
engineering-agent contract: how to keep an implementation coherent with the system that
actually exists, rather than with the system the docs describe.

It deliberately does **not** cover:

| Concern | Where it lives |
|---|---|
| Branch base, one-concern-per-PR, money-path lockstep, shared-file coordination, PR hygiene | [`AGENT_WORKING_AGREEMENT.md`](./AGENT_WORKING_AGREEMENT.md) |
| The money-path defect list (E1–E16), sync + push directives | [`ENGINEERING_AGENT_PLAN.md`](./ENGINEERING_AGENT_PLAN.md) |
| Commands, package roles, conventions | [`../CLAUDE.md`](../CLAUDE.md) — **with the corrections in §2 below** |
| Astryx design-system adoption: template workflow, revoked design rules, the gold caveat | [`ASTRYX-ADOPTION-RUNBOOK.md`](./ASTRYX-ADOPTION-RUNBOOK.md) |
| Which service the domain routes to, deploy-truth verification | [`DOMAIN-CUTOVER.md`](./DOMAIN-CUTOVER.md) |

Everything here was re-verified against `main` at `a7a06fda` (2026-07-27) by an 8-section
parallel audit; the previous edition (verified at `e14569ce`) had 30+ claims drift stale in
under a week, which is the strongest argument for the rule below. Where a claim is a count,
the command that produced it is given so you can re-derive it instead of trusting it.
Counts drift; the shapes they describe do not, and the shapes are the point.

---

## 0. The precedence rule

When a document and the code disagree, **the code wins and the document is a defect.**
This is not a licence to ignore docs — it is an instruction to *fix* them. If you discover
a documented convention that the code abandoned, your PR either follows the code and adds a
one-line correction to the doc, or it restores the convention as its own concern. What it
must never do is follow the doc into a pattern nothing else in the repo uses, then leave the
next agent to discover the divergence a third time.

Three questions, in this order, before you write a line:

1. **Which surface owns this?** (§1)
2. **What does the surrounding code actually do?** — read three neighbouring files, not the doc (§3)
3. **Where does this have to be registered?** (§4)

---

## 1. Orient: which surface owns your task

Seven packages under `artifacts/`. CLAUDE.md's table now lists all of them.

| Package | Name | Stack | Status |
|---|---|---|---|
| `artifacts/api-server` | `@workspace/api-server` | Express 5, Drizzle, BullMQ, Socket.IO — 348 `.ts` | The one backend. All money authority lives here |
| `artifacts/storefront` | `@workspace/storefront` | Next.js 16 App Router — 413 `.ts/.tsx` | **Serves tanmatra.food** (cutover complete — DOMAIN-CUTOVER.md). Astryx is its design system (DS-0) |
| `artifacts/tanmatra` | `@workspace/tanmatra` | React 19 + React Router v7 SPA on Vite — 327 files under `src/` | Legacy. No user-facing domain routes to it, but it is the storefront's `IMAGE_UPSTREAM` — `/images` (incl. all dish photos in `public/dishes`) serve from here |
| `artifacts/tanmatra-mobile` | `@workspace/tanmatra-mobile` | Expo / expo-router | Live, thin |
| `artifacts/agents` | `@workspace/agents` | Vite + wouter | Internal |
| `artifacts/clinical-governance-engine` | `@tanmatra/clinical-governance-engine` | Zero-dep TS | Internal |
| `artifacts/mockup-sandbox` | `@workspace/mockup-sandbox` | Vite preview | Internal |

**Deciding where a customer-facing change goes.** Default to `artifacts/storefront` — it is
what a user hits. Change `artifacts/tanmatra` as well only when the task is a defect on a
surface the storefront has not yet ported, when the change touches `/images` assets, or when
the plan names that file. Never port a feature from one to the other as a side-effect of an
unrelated task; that is a second concern and belongs in its own PR.

**Deployment: a merge to `main` SHIPS.** The push trigger in
`.github/workflows/deploy.yml` is active, and the pipeline per merge is:

```
gate        re-runs typecheck + lint gates + money suites ON THE MERGE COMMIT
migrate-db  replays committed drizzle migrations against prod (fail-closed)
deploys     path-filtered: storefront / api-server / tanmatra
```

Each deploy self-verifies (`/api/build` deploy-truth) and **rolls itself back** on failed
verification (capture-first + `--no-traffic`; the explicit Route step is the only thing that
moves traffic). Three Cloud Run services in `asia-south2`: `wellness-foods` (api),
`tanmatra` (legacy SPA + image host), `storefront` (the domain). Manual
`workflow_dispatch` still deploys all three from any ref; the `only_storefront` input rolls
just that service. What this means for you: **merging is releasing.** Check the Deploy run
after your PR merges; a red run that rolled back is the system working, not noise.

Some agent workspaces are sparse checkouts (CLAUDE.md documents the trap); this audit's
checkout had everything on disk. Before concluding a package was deleted, check
`git ls-tree -d --name-only HEAD artifacts/`.

Inside `artifacts/tanmatra` there is a second split. `src/pages/*` are thin wrappers — 46 of
the 82 delegate to the real UI in `src/tanmatra-v2/*` (meta/handle exports plus a default
export rendering the V2 component; zero business logic in the wrappers). Customer UI changes
go in `tanmatra-v2/`; route wiring, `<meta>`, and auth gating go in `pages/` + `routes.ts`;
admin and RD consoles are legacy and live only under `pages/`.

`src/tanmatra-v2/theme.css` is a frozen prototype port scoped to `.tnm2`, carrying raw hex,
and is exempt from the colour lint (`scripts/lint-colors.ts:13` skips any `*theme.css`). Do
not treat it as a token registry and do not "tidy" it. The live registry for the legacy SPA
is `src/index.css` `@theme`. For the storefront it is `lib/tokens/src/tokens.css` **plus the
Astryx theme** (`lib/themes/` — see the runbook; the token bridge in `globals.css` is
value-pinned and carries a do-not-refactor warning backed by `astryxBridge.test.ts`).

---

## 2. Where CLAUDE.md is wrong (verified)

CLAUDE.md was substantially rewritten on 2026-07-27 and most of the previous edition's
defect list is fixed (the package table is complete; the styleguide claim is corrected; the
palette section documents the DS-0 revocations). What remains:

| Claim | Reality |
|---|---|
| `pnpm --filter @workspace/tanmatra-mobile run dev` | No `dev` script in that package (scripts: start, android, ios, build, serve, typecheck, test). Use `run start` |
| The storefront-internals callout still says the storefront is a "dark preview" with "no domain mapped" and that `docs/DOMAIN-CUTOVER.md` "does not exist" | Both false since 2026-07-25: the cutover is complete, the domain serves the storefront, and the runbook exists and proves it. Correct these lines when next touching CLAUDE.md |

### 2.1 The contract-first API flow is still ~90% vestigial

CLAUDE.md describes an OpenAPI → Orval → generated-hooks pipeline. Measured at `a7a06fda`:

- `openapi.yaml` covers 40 paths / 43 operations vs 378 `router.<verb>()` registrations
  (~11% of the server), unchanged since at least the shallow-clone boundary.
- 1 of 62 non-test route files consumes a genuinely generated Zod schema
  (`health.ts` → `HealthCheckResponse`); a handful import helpers only.
- **Zero generated React Query hooks are imported anywhere.** Three files import from
  `@workspace/api-client-react` at all, and only for `setBaseUrl`-class utilities.
- `lib/api-zod/src/index.ts` remains hand-maintained on top of the generated output and
  still imports `zod`, not `zod/v4`.
- The second, competing OpenAPI document (`OPENAPI_SPEC_V1` in
  `routes/openApiContract.ts`, served at `/api/v1/openapi.json`) still declares 2 paths.

**What to do:** do not run codegen, do not add to `openapi.yaml`, and do not import
generated hooks, unless restoring the contract layer is the task you were given. Follow §3.
If you do touch the spec, it is its own PR.

---

## 3. Follow the idiom that is dominant, not the one that is documented

For every cross-cutting decision, the pattern the majority of the code uses and the file to
read before you write. Match the file you are editing first; match this table when the file
has no precedent.

| Decision | Canonical idiom | Read this |
|---|---|---|
| Customer auth | `requireAuthUser(req, res)` — early-return helper, returns userId or sends 401 and returns null | `middlewares/requireAuth.ts:25-31`; 13 route files, ~97 sites |
| Ops / kitchen / delivery auth | `isOpsRequest` / `requireOps` | `lib/adminGate.ts:38-51, 70-80` |
| Catalog / CMS auth | `requireCatalog` / `isCatalogRequest` | `lib/adminGate.ts:54-67, 83-93` |
| Owner check | No helper exists. Inline comparison against the row's userId | `payments.ts`. `requireOwner` does not exist — do not import it |
| Vendor webhook auth | Per-integration secret verification, never session auth | Razorpay HMAC in `payments.ts`; PetPooja shared secret in `lib/petpoojaClient.ts` |
| Request validation | Module-scope `const X = z.object({...})` → `X.safeParse(req.body)` → early-return 400. Never `.parse()`, never throw | `checkout.ts`, `userAddresses.ts` |
| Zod import | `import { z } from "zod/v4"` — 45 of 46 zod-importing route files | The one deviant is `userAddresses.ts:2` |
| Error response | `{ error: string }`, flat, no envelope — ~670 sites | A `success:` envelope survives at ~32 sites in 6 files; do not spread it. Add `code: "snake_case"` only when the client must branch on the reason |
| Status codes | 400 malformed · 401 unauthenticated · 403 scope · 404 missing · 409 state conflict · 422 well-formed-but-refused · 502 upstream gateway · 503 missing config · 429 rate-limited | `payments.ts`, `checkout.ts` |
| Frontend API access | Hand-written `lib/<domain>Api.ts` module exporting plain async functions over `apiClient.ts`; every client takes an injectable `fetchImpl` so its test needs no network | `artifacts/storefront/lib/rdBookingApi.ts` |
| Storefront UI composition | Astryx components/templates, verbatim where possible; a server component may render the client primitives without becoming client itself | `components/DishCard.tsx`; runbook §2 |
| Tests | `node:test` + `node:assert/strict`, co-located `<subject>.test.ts`. Zero vitest, zero jest | `orders.mine.test.ts`. Route tests boot a bare `express()`, inject fake auth via `x-test-user-id`, mount the real router, `listen(0)`, hit it with real fetch |
| Test DB | Route tests hit real Postgres and seed with `db.insert`. No ORM mocking. `mock.method` only on outbound boundaries (e.g. shimming fetch for api.razorpay.com) | `orders.mine.test.ts` |
| Raw SQL | Advisory locks, FOR UPDATE claims, bulk upserts, reporting aggregates — always through drizzle's `sql` tag | `lib/loyaltyEngine.ts`, `routes/corporate.ts` |
| AI / NL-generated SQL | Must go through `lib/safeSql.ts` — 10 allowlisted `safe_*` views, SELECT-only validator, read-only txn, 4s timeout, 500-row cap (file is now ~602 lines). Never widen the allowlist casually | `lib/safeSql.ts` |

**Known idiom divergences — do not "harmonise" them as a side-quest.** `fulfillment.ts`
carries four auth idioms at once; `resolveOps` is copy-pasted into `delivery.ts:26`,
`fulfillment.ts:27`, `manualOverride.ts:36`; `aiRuns.ts` / `b2bPlanner.ts` /
`challenges.ts` / `community.ts` re-implement admin against the legacy
`req.session.isAdmin` flag and therefore accept a different credential set than every other
admin route; `b2bPlanner.ts` / `corporate.ts` / `groupOrders.ts` each shadow the name
`requireAuth` with a local function of a different return type. Each is real debt worth its
own PR. None is worth bundling into yours.

Icons: the storefront allows Lucide **and** Heroicons (DS-0 revoked Lucide-only so Astryx
templates compile verbatim). In `artifacts/tanmatra`, icons are per-file — some import
Phosphor components, others use the icon font. Stay with the file's own idiom.

---

## 4. Registration is manual — the places that silently no-op

Nothing in this repo auto-discovers routes or nav. Most of these fail silently. The one
that used to be the worst — CI test discovery — now fails **loudly**, which is different
advice than the previous edition gave.

**1. API routes.** `routes/index.ts` is ~55 hand-written imports and ~55 hand-written
`router.use(...)` calls. No `fs.readdir`, no glob. You must add both lines. Declare full
paths inside the module (`router.get("/orders/active", …)`) — the `/api` prefix comes from
`app.ts`. Two exceptions: `opsRouter` mounts under `/ops`, and `manualOverride` is mounted
directly on the app (before the `/api` router, deliberately). Body-parser limits and rate
limiters in `app.ts` are path-keyed — a new upload route under an unlisted prefix silently
gets the 100 kb catch-all and 413s. (The `/api/api` double-prefix bug the previous edition
cited in the storefront's `catalog.ts` has been fixed; keep it that way.)

**2. Tanmatra web routes.** A new user-visible page touches, at minimum: `src/routes.ts` ·
the page file · `src/lib/prerenderPaths.ts` (or it ships no static HTML) ·
`components/layout/Header.tsx` incl. the group's match-prefix array · `BottomNav.tsx` ·
`CommandPalette.tsx`. Optionally `Footer.tsx` and `money-path-manifest.json` (which drives
`test:ssr` — a money-path route absent from it is never SSR-checked).

**3. Storefront routes.** File-based, so no manifest — but nav registration is centralised
in `lib/nav.ts` (append ONE entry instead of editing Header/Footer/BottomNav JSX), and
`app/sitemap.ts` is the one hand-maintained list. **Self-chromed routes:** the M3 homepage
ships its own nav, bottom bar and footer; `components/ChromeGate.tsx` suppresses the global
chrome there. A new route that brings its own chrome must be added to ChromeGate's route
set — and `e2e/specs/single-chrome.spec.ts` asserts exactly-one-header/footer in both
directions, so it catches over- and under-suppression alike.

**4. CI test discovery — the trap is closed; know the new rule.** `verify.yml` and
`storefront.yml` drive the web suites by **quoted glob** (`node --test --import tsx
"../storefront/lib/**/*.test.ts"` — the quotes are load-bearing; Actions bash has globstar
off, node must expand). `scripts/lint-test-reach.ts` **fails the build** on any test file no
workflow reaches (`scripts/test-reach-baseline.txt` is the shrinking legacy backlog; it only
shrinks). So: a new storefront test under `lib/**` or a tanmatra test under `src/**` is
reached automatically; an api-server test still needs its filename added to the right
`verify.yml` job — and if you forget, the reach gate goes red instead of the test silently
never running.

**5. New `orders.status` values.** `orders.ts` names every reader that must be updated in
the same change: `routes/orders.ts` (ACTIVE_STATUSES/CANCELLABLE), `routes/payments.ts`
(PAID_STATES), `routes/ops.ts` (KDS filter), `lib/dispatch.ts`, `lib/etaModel.ts`,
`artifacts/storefront/lib/orderStatus.ts`. **The column is now also constrained at the
database**: migration 0020's `orders_status_chk` (`NOT VALID`, enforced on every
INSERT/UPDATE) — a new value therefore also needs a migration altering the constraint, or
production inserts start failing. The PetPooja mappers inventing out-of-tuple values is the
incident that bought this constraint.

**6. New schema files.** `lib/db/src/schema/index.ts` is 65 `export * from` lines. A schema
file that is not exported there is invisible to `drizzle.config.ts` and therefore to
migration generation.

**7. New Cloud Run service or deploy behaviour.** `deploy.yml`'s path filters + jobs are
the registry. A new deployable surface needs its filter, its job, and the same
gate/rollback pattern the existing three carry.

---

## 5. Invariants that outrank any local pattern

If a local file contradicts one of these, the local file is the bug.

**Money is decided on the server.** A client-supplied amount is never authoritative. The one
place that computes what the card is charged is
`artifacts/api-server/src/lib/loyaltyEngine.ts` → `computeChargePaise`.

Two columns, one of them authoritative (`lib/db/src/schema/orders.ts`):

- `totalPaise` — meal subtotal after discounts/credit. The comment says it outright:
  **"do not use this to charge."**
- `chargePaise` — "THE authoritative amount to charge." Written once by `finalizeOrder`.
  Nullable so legacy and guest rows stay valid; the payment path falls back with
  `order.chargePaise ?? order.totalPaise` (six sites in `payments.ts`).

`orders` has no payment-status column. `status: "placed"` means created-but-UNPAID;
`"preparing"` and later mean paid. `PAID_STATES = {"preparing","ready","out_for_delivery",
"delivered"}`. The paid transition is a guarded atomic
`UPDATE … WHERE id = ? AND status = 'placed'`, returning 409 on zero rows. Never a
read-then-write.

**RD consults never write an `orders` row.** They live entirely on `rd_appointments` with
their own vocabulary, `paymentStatus: "free" | "pending" | "paid" | "refunded"`. Nothing in
`payments.ts` reconciles them — the Razorpay webhook body has no appointment handling. The
`payWithRazorpay` idiom of resolving to "paid" when verification is unreachable is unsafe
for appointments and must not be copied there.

**Every money column in the schema is paise.** Two traps: `ledger_lines.amount` is the only
money column with no unit in its name and no doc comment, and `meal_credits.amount` is a
meal count, not money. Money fields inside jsonb interfaces are unsuffixed and
unenforceable.

**Status vocabularies overlap across domains** — never write a helper that takes a bare
status string and switches on it without also taking the table. "refunded" means three
different things; "active" now appears in **seven** vocabularies. 13 named CHECK
constraints exist; `orders.status` is one of them (0020, `NOT VALID` — enforced on new
writes, deliberately silent about pre-existing rows; promotion via `VALIDATE CONSTRAINT`
is a documented manual follow-up, not something to fold into your PR).

**The GST model is settled** — 5% on the meal subtotal + 18% on the delivery fee, ₹50
delivery waived at/above a ₹500 subtotal. `AGENT_WORKING_AGREEMENT.md` §2 and the
`chargePaise` schema comment now agree; the previous edition's warning about their
contradiction is resolved. If your task changes pricing, it still moves as one unit across
the files named in the working agreement.

**Never print, log, echo, or commit a credential value.** Not in a test fixture, not in a
debug line, not in a doc. Secrets are set in GitHub Secrets / Secret Manager by the owner;
an agent's job is to read them from `process.env` and fail closed when absent (503, per §3)
— never to supply a default.

---

## 6. Data layer: adding a column

`lib/db/package.json` still contains exactly two scripts — `push` and `push-force` — and
both are **dev-only schema diffing**; never point either at production. The committed chain
is `lib/db/drizzle/0000_good_cammi.sql … 0022_partner_lead_fields.sql` (23 migrations) with
matching `meta/` snapshots and `_journal.json` entries.

The procedure:

1. Edit the domain file in `lib/db/src/schema/`. New file → add `export * from "./X";` to
   `schema/index.ts`.
2. Generate — no script wraps it:
   `pnpm --filter @workspace/db exec drizzle-kit generate --config ./drizzle.config.ts`
3. Commit all three artefacts: `drizzle/NNNN_*.sql`, `drizzle/meta/NNNN_snapshot.json`, the
   `_journal.json` entry.
4. Dev database only: `pnpm --filter @workspace/db run push` to sync your local.
5. The migration is its own PR, with a schema review (working agreement §1). Never ride one
   in on a UI PR.

**What happens on merge — this changed.** The deploy pipeline's `migrate-db` job replays
committed migrations against production automatically, in journal order, before the
api-server rolls (`scripts/src/apply-migrations.ts`): per-migration transactions, a
tracking table, fail-closed on any error. Two rules it enforces that you must write
migrations to respect:

- **Destructive statements** (`DROP TABLE/COLUMN`, `TRUNCATE`, `DELETE FROM`) abort the run
  unless the migration file itself carries `-- ci:allow-destructive` — put the marker in the
  file and justify it in the PR, or the deploy stays red. Data loss is a reviewed, in-diff
  decision, never a CI default.
- Statements run inside a transaction under a 60s timeout — so **no
  `CREATE INDEX CONCURRENTLY`** (cannot run in a transaction) and no long validating
  scans. Follow 0020's pattern: `NOT VALID` now, `VALIDATE CONSTRAINT` as a documented
  manual follow-up.

Column conventions: `id: serial("id").primaryKey()`; `createdAt`/`updatedAt` as
`timestamp(..., { withTimezone: true }).notNull().defaultNow()` with `.$onUpdate` on
`updatedAt`. Every timestamp in the schema sets `withTimezone: true` — do not create the
first exception. No soft-delete convention, no tenancy column. Name money columns `*Paise`.

---

## 7. Verify: the only sequence that means anything

```bash
# 1. Typecheck — ROOT ONLY. This is not optional advice.
pnpm run typecheck        # = tsc --build (lib project refs) + every artifact package

# 2. Web gates (artifacts/tanmatra)
pnpm --filter @workspace/tanmatra run lint:gates      # colors && prices
pnpm --filter @workspace/tanmatra run build
pnpm --filter @workspace/tanmatra run lint:geography  # scans build/client — needs the build
pnpm --filter @workspace/tanmatra run test:ssr

# 3. Storefront gates (artifacts/storefront)
pnpm --filter @workspace/storefront run lint:filecap
pnpm --filter @workspace/storefront run lint:tokens
pnpm --filter @workspace/storefront run typecheck
pnpm --filter @workspace/storefront run test          # the whole lib suite, DB-free

# 4. Reach gate (repo root) — every new test must be reachable by a workflow
pnpm run lint:test-reach

# 5. Tests for what you touched — by file, from artifacts/api-server
node --test --test-force-exit --import tsx ./src/routes/<file>.test.ts
```

Never diagnose a type error from `npx tsc` inside a single artifact package — the lib
packages use project references and a package-local tsc reads stale built output. Only the
root `pnpm run typecheck` is authoritative. `--test-force-exit` is required: the suites hold
real Postgres connections. CI-equivalent env for DB-backed tests:
`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/tanmatra_test`, `NODE_ENV=test`,
`GOOGLE_API_KEY=test`, `CLINICAL_KMS_MASTER_KEY=<64 hex chars>`.

The same load-bearing subset re-runs in the deploy `gate` on your merge commit — a
locally-skipped check is not "someone else's problem later", it is your merge failing to
ship twenty minutes from now.

What each gate actually forbids (all scripts at repo root):

| Gate | Scans | Forbids | Notes |
|---|---|---|---|
| `lint-colors.ts` | `artifacts/tanmatra/src` | raw hex, `rgb/rgba/hsl/hsla(` | Skips `index.css` and any `*theme.css`; strips comments |
| `lint-prices.ts` | `artifacts/tanmatra/src` | `₹` followed by a digit | Allowlists `rdPlans.ts`, `adapter.ts`; `₹${…}` passes by design |
| `lint-geography.ts` | `artifacts/tanmatra/build/client` — **build output** | 'Bengaluru', '+91 80', stale © years | No allowlist. Hard-fails if no build exists |
| `lint-tokens.ts` | `artifacts/storefront/{components,app}` | **raw colour literals only** (hex, `rgb/hsl/oklch/…(`) | Post-DS-0: the palette-class ban and sage-interactive rule are REVOKED; Astryx variants are sanctioned. `lib/themes/` is outside its reach — theme files are where colours belong. One review-level caveat survives: **gold is the only primary-action colour** (runbook §3; deliberately not a lint) |
| `lint-filecap.ts` | `artifacts/storefront` | files >300 lines; `.tsx` >**400** (raised from 150 for DS-0); `@/` alias imports inside `lib/` | The `"use client"` justification requirement is revoked. The alias rule is test-runner correctness (`ERR_MODULE_NOT_FOUND` under the bare runner) and stays |

---

## 8. One contradiction you must not resolve by guessing

**The branch base.** `AGENT_WORKING_AGREEMENT.md` §0 still says to branch off
`integration/engg-plus-fixes` (merged long ago) and, two lines later, "never stack new work
on a branch whose PR has already merged — start a fresh branch from main." Current practice
is `git fetch origin && git checkout -b <branch> origin/main`. Follow the second sentence.

(The previous edition listed the GST model here as a second unresolvable contradiction. It
is resolved — see §5.)

---

## 9. Before you open the PR

- [ ] Named the surface (§1) and confirmed it is the one the user actually hits
- [ ] Read three neighbouring files and matched their idiom, not the doc's (§3)
- [ ] Registered everywhere it must be registered — routes, nav, ChromeGate if self-chromed, api-server tests by filename in `verify.yml` (§4)
- [ ] No client-supplied amount is trusted; `chargePaise` is what bills (§5)
- [ ] No new bare status switch that ignores which table the string came from; a new status value changes the DB constraint too (§4, §5)
- [ ] Migration, if any, is its own PR and CI-applyable (§6: destructive marker if needed, no CONCURRENTLY, short locks) — and you understand it will run against production on merge
- [ ] Root `pnpm run typecheck` green — not a package-local tsc (§7)
- [ ] Lint gates green; geography run after a build; reach gate green (§7)
- [ ] Storefront UI follows the Astryx runbook (verbatim templates; gold primary actions)
- [ ] No credential value appears in any diff, log, or doc line (§5)
- [ ] Any doc this PR proved wrong is corrected in the same PR, or filed (§0)
- [ ] One concern. If you found a second, it is a second branch
- [ ] **After merge: watch the Deploy run.** Merging is releasing. A rollback is the system saving you; read the log before re-merging

---

*Derived from a full-tree audit at `a7a06fda`. Counts are re-derivable: route files
`ls artifacts/api-server/src/routes/*.ts | grep -v test | wc -l`; route registrations
`grep -rhoE "router\.(get|post|put|patch|delete)\(" artifacts/api-server/src/routes/ | wc -l`;
test files `find artifacts/api-server/src -name "*.test.ts" | wc -l`; CI reach
`pnpm run lint:test-reach` (which replaces counting workflow filenames — the gate itself is
now the source of truth). When a count here stops matching, this document is the thing that
is out of date.*
