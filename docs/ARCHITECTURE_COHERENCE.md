# Tanmatra — Architecture Coherence Contract

**Read this before you touch any file, whatever the task.** It is the durable half of the
engineering-agent contract: how to keep an implementation coherent with the system that
actually exists, rather than with the system the docs describe.

It deliberately does **not** cover:

| Concern | Where it lives |
|---|---|
| Branch base, one-concern-per-PR, money-path lockstep, shared-file coordination, PR hygiene | [`AGENT_WORKING_AGREEMENT.md`](./AGENT_WORKING_AGREEMENT.md) |
| The current money-path defect list (E1–E16), sync + push directives | [`ENGINEERING_AGENT_PLAN.md`](./ENGINEERING_AGENT_PLAN.md) |
| Commands, package roles, conventions | [`../CLAUDE.md`](../CLAUDE.md) — **with the corrections in §2 below** |

Everything here was verified against `origin/main` at `e14569ce`. Where a claim is a count,
the command that produced it is given so you can re-derive it instead of trusting it. Counts
drift; the shapes they describe do not, and the shapes are the point.

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

Seven packages under `artifacts/`. CLAUDE.md's table (`CLAUDE.md:56-71`) lists four.

| Package | Name | Stack | Status |
|---|---|---|---|
| `artifacts/api-server` | `@workspace/api-server` | Express 5, Drizzle, BullMQ, Socket.IO — 307 `.ts` | **The one backend.** All money authority lives here |
| `artifacts/storefront` | `@workspace/storefront` | **Next.js 16** App Router — 310 `.ts`/`.tsx` | **Serves `tanmatra.food` today.** Absent from CLAUDE.md entirely |
| `artifacts/tanmatra` | `@workspace/tanmatra` | React 19 + React Router v7 SPA on Vite — 325 `.ts`/`.tsx` under `src/` | Legacy. Still built + deployed on every change; **no user-facing domain routes to it**. The storefront's `IMAGE_UPSTREAM` points at it for `/images` |
| `artifacts/tanmatra-mobile` | `@workspace/tanmatra-mobile` | Expo 57 / expo-router — 27 files | Live, thin |
| `artifacts/agents` | `@workspace/agents` | Vite + wouter — 20 files | Internal |
| `artifacts/clinical-governance-engine` | `@tanmatra/clinical-governance-engine` | Zero-dep TS | Internal |
| `artifacts/mockup-sandbox` | `@workspace/mockup-sandbox` | Vite preview | Internal |

**Deciding where a customer-facing change goes.** Default to `artifacts/storefront` — it is
what a user hits. Change `artifacts/tanmatra` as well *only* when the task is a defect on a
surface the storefront has not yet ported, or when the plan names that file. Never port a
feature from one to the other as a side-effect of an unrelated task; that is a second
concern and belongs in its own PR.

Deployment is `workflow_dispatch`-only — the `push: branches: [main]` trigger in
`.github/workflows/deploy.yml:4-6` is **commented out**. Three Cloud Run services in
`asia-south2`: `wellness-foods` (api), `tanmatra` (SPA), `storefront`. Merging does not ship.

**Inside `artifacts/tanmatra` there is a second split.** `src/pages/*` are thin wrappers —
46 of them are pure re-exports of the real UI in `src/tanmatra-v2/*`
(e.g. `src/pages/Checkout.tsx:2` → `@/tanmatra-v2/Checkout`). Customer UI changes go in
`tanmatra-v2/`; route wiring, `<meta>`, and auth gating go in `pages/` + `routes.ts`; admin
and RD consoles are legacy and live only under `pages/`.

`src/tanmatra-v2/theme.css` is a frozen prototype port scoped to `.tnm2`, carrying raw hex,
and is **exempt from the colour lint** (`scripts/lint-colors.ts:13` skips any `*theme.css`).
Do not treat it as a token registry and do not "tidy" it. The live registry is
`src/index.css` `@theme` (lines 119-307; the Nocturnal Nourishment palette at 244-263).
For the storefront it is `lib/tokens/src/tokens.css`.

---

## 2. Where CLAUDE.md is wrong (verified)

These are not nitpicks. Each one, followed literally, produces a PR that diverges from the
entire rest of the codebase.

### 2.1 The contract-first API flow is ~90% vestigial

`CLAUDE.md:73-78` describes an OpenAPI → Orval → generated-hooks pipeline. Measured:

- **1 of 57** non-test route files consumes a genuinely generated Zod schema
  (`health.ts:3` → `HealthCheckResponse`). Three others import only helpers
  (`isServiceablePincode`, `SERVICEABLE_PINCODES`) from `@workspace/api-zod`.
  **41 hand-roll `zod` inline; 14 validate nothing.**
- `lib/api-zod/src/index.ts` is a **124-line hand-maintained file** that re-exports the
  generated output and then adds its own symbols — and imports `zod`, not `zod/v4`, in
  violation of `CLAUDE.md:119`.
- **`openapi.yaml` covers ~11%** of the server: 40 paths / 43 operations vs **378**
  `router.<verb>()` registrations. Zero of the 9 `delete` routes are specified.
  It last changed in `d9ee85a8` (2026-07-02); `routes/` has moved **134 commits** since.
- **Zero of the 27 generated React Query hooks are imported anywhere.** Exactly three files
  in the whole tree import `@workspace/api-client-react`, and all three take config helpers
  or a type, never a hook: `tanmatra/src/entry.client.tsx:4` (`setBaseUrl`),
  `tanmatra-mobile/app/_layout.tsx:17` (`setBaseUrl`, `setAuthTokenGetter`), and
  `tanmatra-mobile/lib/activity.ts:2` (a `WearableProvider` type).
  **117 files** import hand-written `lib/*Api.ts` modules instead. Three
  generated hooks were hand-reimplemented and the app consumes the copies
  (`contentApi.ts:168,172,237` ← `ChallengeDetail.tsx:5-7`).
- A **second, competing** OpenAPI document exists: `OPENAPI_SPEC_V1` at
  `routes/openApiContract.ts:33`, served at `/api/v1/openapi.json`, declaring 2 paths. Its
  own changelog claims "explicit Zod contract validation across all /api/v1/ endpoints."

**What to do:** do not run codegen, do not add to `openapi.yaml`, and do not import
generated hooks, unless *restoring the contract layer is the task you were given*. Follow
§3. If you do touch the spec, it is its own PR.

### 2.2 Other CLAUDE.md claims that do not resolve

| Claim | Reality |
|---|---|
| `CLAUDE.md:99,116` + `README.md:43` — "`/__styleguide` route (`src/pages/Styleguide.tsx`)" | **Neither exists.** The live one is `artifacts/storefront/app/styleguide/page.tsx` (no underscore — App Router treats `_`-prefixed folders as private) |
| `CLAUDE.md:56-71` package layout | Omits `storefront`, `agents`, `clinical-governance-engine` |
| `CLAUDE.md:16` — `pnpm --filter @workspace/tanmatra-mobile run dev` | No `dev` script in that package |
| `CLAUDE.md:28` — `pnpm run test` runs "all tests across the workspace" | It is `pnpm -r --if-present run test`. **Neither `tanmatra` nor `storefront` has a `test` script**, so it silently covers neither |
| `CLAUDE.md:115` — "Clinical Dark palette is locked" | `tanmatra-v2/theme.css:24-28`: "Nocturnal Nourishment is now the ONLY palette… the old Clinical-Dark hex values are deleted." Clinical accents remain locked for the **storefront** (`lib/tokens/src/tokens.css:17-23`) |
| `deploy.yml` + `storefront/Dockerfile:42` reference `docs/DOMAIN-CUTOVER.md` | Not on this checkout |

---

## 3. Follow the idiom that is dominant, not the one that is documented

For every cross-cutting decision, this is the pattern the majority of the code uses and the
file to read before you write. **Match the file you are editing first; match this table when
the file has no precedent.**

| Decision | Canonical idiom | Read this |
|---|---|---|
| Customer auth | `requireAuthUser(req, res)` — early-return helper, returns `userId` or sends 401 and returns `null` | `middlewares/requireAuth.ts:25-31`; used by 12 files, ~90 sites. Reference: `subscriptions.ts`, `wellness.ts` |
| Ops / kitchen / delivery auth | `isOpsRequest` / `requireOps` | `lib/adminGate.ts:38-51, 70-80`. Accepts `x-admin-token`, signed admin cookie, **or** `OPS_USER_IDS` membership |
| Catalog / CMS auth | `requireCatalog` / `isCatalogRequest` | `lib/adminGate.ts:54-67, 83-93` |
| Owner check | **No helper exists.** Inline comparison against the row's `userId` | `payments.ts:255, 564`. `requireOwner` does not exist — do not import it |
| Vendor webhook auth | Per-integration secret verification, never session auth | Razorpay HMAC `payments.ts:635-639`; PetPooja shared secret `lib/petpoojaClient.ts:100-117` |
| Request validation | Module-scope `const X = z.object({...})` → `X.safeParse(req.body)` → early-return 400. **Never `.parse()`, never `throw`** | `checkout.ts:31-74, 93-95`; `userAddresses.ts:11-27, 58-62` |
| Zod import | `import { z } from "zod/v4"` — 40 of 41 files | The one deviant is `userAddresses.ts:2` |
| Error response | `{ error: string }`, flat, no envelope — ~601 of ~661 sites | Add `code: "snake_case"` **only** when the client must branch on the reason (14 sites, e.g. `checkout.ts:110` `unserviceable_pincode`) |
| Status codes | 400 malformed · 401 unauthenticated · 403 scope · 404 missing · 409 state conflict · 422 well-formed-but-refused · 502 upstream gateway · 503 missing config · 429 rate-limited | `payments.ts:216` (503 no creds), `payments.ts:350` (502 gateway), `checkout.ts:221` (409 duplicate) |
| Frontend API access | Hand-written `lib/<domain>Api.ts` module exporting plain async functions. **Components stay thin** | `artifacts/storefront/lib/rdBookingApi.ts` — `checkoutAppointment` / `verifyAppointment` / `payForAppointment` at module level. This is the reference for any new payment surface |
| Tests | `node:test` + `node:assert/strict`, co-located as `<subject>.test.ts` or `<subject>.<facet>.test.ts`. **Zero vitest, zero jest** | `orders.mine.test.ts:22-35`. Route tests boot a bare `express()`, inject a fake auth middleware reading `x-test-user-id`, mount the real router, `listen(0)`, hit it with real `fetch`, clean up in `after()` |
| Test DB | Route tests hit **real Postgres** and seed with `db.insert`. No ORM mocking anywhere. `mock.method` is used only on outbound boundaries (`refunds.test.ts:22-25` shims `fetch` for `api.razorpay.com` only) | `orders.mine.test.ts:16` |
| Raw SQL | Acceptable for advisory locks, `FOR UPDATE` claims, bulk upserts, reporting aggregates — always through drizzle's `sql` tag. 19 genuinely raw statements exist | `lib/loyaltyEngine.ts:229` (`pg_advisory_xact_lock`), `routes/corporate.ts:900` |
| AI / NL-generated SQL | **Must** go through `lib/safeSql.ts` — 10 allowlisted `safe_*` views, SELECT-only validator, `safe_analytics_reader` role, read-only txn, 4s timeout, 500-row cap. Never widen the allowlist casually | `lib/safeSql.ts` (435 lines) |

**Known idiom divergences — do not "harmonise" them as a side-quest.** `fulfillment.ts`
carries four auth idioms at once; `resolveOps` is copy-pasted into `delivery.ts:269`,
`fulfillment.ts:27`, `manualOverride.ts:36`; `aiRuns.ts` / `b2bPlanner.ts` / `challenges.ts`
/ `community.ts` re-implement admin against the legacy `req.session.isAdmin` flag and
therefore accept a *different* credential set than every other admin route (no
`OPS_USER_IDS`); `b2bPlanner.ts` / `corporate.ts` / `groupOrders.ts` each shadow the name
`requireAuth` with a local function of a different return type. Each is real debt worth its
own PR. None is worth bundling into yours.

Icons are per-file, not per-app: some files import Phosphor React components
(`import { Warning }`), others use the icon font (`<i className="ph-bold ph-…" />`).
Stay with the file's own idiom.

---

## 4. Registration is manual — six places that silently no-op

Nothing in this repo auto-discovers. Every one of these fails **silently** — no error, no
warning, just a feature that does not exist.

**1. API routes.** `routes/index.ts` is a hand-written import list followed by one
hand-written `router.use(...)` per router — 57 imports and 55 mounts today, and the two
numbers are supposed to track each other. No `fs.readdir`, no glob. You must add both
lines. Declare **full paths inside the module** (`router.get("/orders/active", …)`) — the
`/api` prefix comes from `app.ts:219`. Writing `/api/foo` inside a module yields
`/api/api/foo`; that bug is live at `catalog.ts:101`. The two exceptions:
`index.ts:75` mounts `opsRouter` under `/ops`, and `manualOverride.ts` is mounted directly
on the app at `app.ts:212` (before the `/api` router, deliberately) with its own absolute
path. Body-parser limits (`app.ts:131-144`) and rate limiters (`app.ts:171-181`) are
**path-keyed** — a new upload route under an unlisted prefix silently gets the 100 kb
catch-all and 413s.

**2. Tanmatra web routes.** A new user-visible page touches, at minimum:
`src/routes.ts` · the page file · `src/lib/prerenderPaths.ts` (or it ships no static HTML)
· `components/layout/Header.tsx:32-45` — including the group's `match` prefix array, or the
tab never highlights · `components/layout/BottomNav.tsx:51` and `:118` ·
`components/CommandPalette.tsx:58-99`. Optionally `layout/Footer.tsx:5-26` and
`money-path-manifest.json` (which drives `test:ssr` — a money-path route absent from it is
never SSR-checked). The sitemap is derived from the build and cannot drift on its own, but
it only ever sees routes that made it into `prerenderPaths.ts`.

**3. Storefront routes.** File-based, so no manifest — but nav registration is centralised
in `lib/nav.ts` (a deliberate single point: "every later wave adds a route by appending ONE
entry here instead of editing Header / Footer / BottomNav JSX"). `app/sitemap.ts:24-47` is
the one hand-maintained list.

**4. CI test discovery — the highest-leverage trap in the repo, now gated.** `verify.yml`
enumerates test files **individually by name**. A test file that is not added by name to the
right job **runs nowhere** — it sits green in the tree, passes review, and reports nothing.
`pnpm run test` will not save you: it is `pnpm -r --if-present run test`, and neither web
package has a `test` script. The scale of the gap, from the gate's own output:
**161 test files exist, 91 are reachable by CI.**

Since PR #391 this failure mode is caught rather than silent. `scripts/lint-test-reach.ts`
(`pnpm run lint:test-reach`) walks `artifacts/api-server/src`, `artifacts/storefront/lib` and
`artifacts/tanmatra/src` and fails when a test file is neither named by a workflow command
nor listed in `scripts/test-reach-baseline.txt`. **That baseline is a debt register, not an
approval list** — it recorded the suites (money, auth, PHI-crypto, allergen-gate among them)
that already ran nowhere when the gate landed, so the gate could be enforced immediately
instead of after a mass triage. It may only **shrink**: wire a baselined test into a
workflow, then delete its line, because a stale entry also fails the gate. It is currently
**70** lines. Adding your new test to the baseline instead of to a workflow satisfies the
linter and defeats the point.

**5. New `orders.status` values.** `orders.ts:42-62` names every reader that must be updated
in the same change: `routes/orders.ts` (`ACTIVE_STATUSES`/`CANCELLABLE`), `routes/payments.ts`
(`PAID_STATES`), `routes/ops.ts` (KDS queue filter), `lib/dispatch.ts`
(`liveStatuses`/`partnerStatuses`), `lib/etaModel.ts` (`ACTIVE_STATUSES`),
`routes/addons.ts` (`ATTACHABLE_STATUSES`),
`artifacts/storefront/lib/orderStatus.ts` (`STATUS_LABELS`/`TRACKABLE_STATUSES`). That list
grows — treat it as the live index it is, not as a copy to trust. The column
has **no check constraint** — the type is documentation, not enforcement. The PetPooja
mappers have already invented out-of-tuple values (`"confirmed"`, `"dispatched"`) once.

**6. New schema files.** `lib/db/src/schema/index.ts` is 62 `export * from` lines. A schema
file that is not exported there is invisible to `drizzle.config.ts:9` and therefore to
migration generation.

---

## 5. Invariants that outrank any local pattern

If a local file contradicts one of these, the local file is the bug.

**Money is decided on the server.** A client-supplied amount is never authoritative. The
one place that computes what the card is charged is
`artifacts/api-server/src/lib/loyaltyEngine.ts` → `computeChargePaise`.

**Two columns, one of them authoritative** (`lib/db/src/schema/orders.ts:133-142`):

- `totalPaise` — meal subtotal after discounts/credit, **no GST, no delivery fee**. Kept for
  historical/ops continuity. The comment says it outright: *"do not use this to charge."*
- `chargePaise` — *"THE authoritative amount to charge."* Written once by `finalizeOrder`.
  Nullable so legacy and guest rows stay valid; the payment path falls back with
  `order.chargePaise ?? order.totalPaise` (`payments.ts:263, 487, 764, 788, 845, 865`).

**`orders` has no payment-status column.** The house convention is
**`status: "placed"` means created-but-UNPAID; `"preparing"` and later mean paid.**
`PAID_STATES = {"preparing","ready","out_for_delivery","delivered"}`. The paid transition is
a guarded atomic `UPDATE … WHERE id = ? AND status = 'placed'`, returning **409** on zero
rows. Never a read-then-write.

**RD consults never write an `orders` row.** They live entirely on `rd_appointments`
(`schema/rdAdvisory.ts:65-89`) with their own vocabulary,
`paymentStatus: "free" | "pending" | "paid" | "refunded"`. Nothing in `payments.ts`
reconciles them — the Razorpay webhook body has no appointment handling. Consequently the
`payWithRazorpay` idiom of resolving to `"paid"` when verification is unreachable
(`razorpayClient.ts:188-192`) is **unsafe for appointments** and must not be copied there.

**Every money column in the schema is paise.** Verified across all 62 schema files; no
column stores rupees. Two traps: `ledger_lines.amount` (`ledger.ts:137`) is the only money
column with no unit in its name and no doc comment, and `meal_credits.amount`
(`subscriptions.ts:221`) is a **meal count**, not money. Money fields inside jsonb
interfaces are unsuffixed and unenforceable (`orders.ts:90 price` is paise — asserted only
in `lib/safeSql.ts:28`).

**Status vocabularies overlap across domains — never write a helper that takes a bare
status string and switches on it without also taking the table.** `"refunded"` means three
different things (`orders.status`, `rd_appointments.paymentStatus`, `refund_requests.status`).
So does `"failed"`. `"active"` appears in four vocabularies, `"pending"` in four.
`marketplace_orders.status` allows `packed`/`shipped`, which `orders.status` does not — and
marketplace orders exist in **both** tables (`orders.orderKind = 'marketplace'`).

**Only 8 CHECK constraints exist in the entire schema.** On `orders`, `priority`,
`order_kind`, and `order_channel` are constrained; `status` — the most-read column in the
system — is not.

**Never print, log, echo, or commit a credential value.** Not in a test fixture, not in a
debug line, not in a doc. Secrets are set in GitHub Secrets / the deploy environment by the
owner; an agent's job is to read them from `process.env` and to fail closed when absent
(503, per §3) — never to supply a default.

---

## 6. Data layer: adding a column

The trap here is that the package's scripts do not describe the workflow.
`lib/db/package.json:10-13` contains **exactly two** scripts — `push` and `push-force` —
and **no `generate`, no `migrate`**. Yet `lib/db/drizzle/` holds 15 committed numbered
migrations (`0000_good_cammi.sql` … `0014_voucher_razorpay.sql`) with matching
`meta/_journal.json` entries and `meta/NNNN_snapshot.json` files. `drizzle.config.ts` does
not set `out`, so drizzle-kit's default `./drizzle` is what you see.

The procedure:

1. Edit the domain file in `lib/db/src/schema/`. If it is a new file, add
   `export * from "./X";` to `schema/index.ts`.
2. Generate the migration **directly** — no script wraps it:
   `pnpm --filter @workspace/db exec drizzle-kit generate --config ./drizzle.config.ts`
3. Commit all three artefacts: `drizzle/NNNN_*.sql`, `drizzle/meta/NNNN_snapshot.json`,
   and the `_journal.json` entry.
4. Against a **dev** database only, `pnpm --filter @workspace/db run push` syncs the schema.
   `push-force` adds `--force`, which executes data-loss statements unattended. Never point
   either at production.
5. **The migration is its own PR, with a schema review**
   ([`AGENT_WORKING_AGREEMENT.md`](./AGENT_WORKING_AGREEMENT.md) §1). Never ride one in on a UI PR.

Column conventions: `id: serial("id").primaryKey()` (105 of 120 PKs);
`createdAt` / `updatedAt` as `timestamp(..., { withTimezone: true }).notNull().defaultNow()`,
with `.$onUpdate(() => new Date())` on `updatedAt`. **Every timestamp in the schema sets
`withTimezone: true`** — there are no exceptions, so do not create the first one. There is
no soft-delete convention (`deletedAt` exists on exactly two tables) and no tenancy column
anywhere. Name money columns `*Paise`.

---

## 7. Verify: the only sequence that means anything

```bash
# 1. Typecheck — ROOT ONLY. This is not optional advice.
pnpm run typecheck        # = tsc --build (lib project refs) + every artifact package

# 2. Test reachability — run this the moment you add a *.test.ts file
pnpm run lint:test-reach  # fails if a test file is named by no workflow

# 3. Web gates (artifacts/tanmatra)
pnpm --filter @workspace/tanmatra run lint:gates      # colors && prices
pnpm --filter @workspace/tanmatra run build
pnpm --filter @workspace/tanmatra run lint:geography  # scans build/client — needs the build
pnpm --filter @workspace/tanmatra run test:ssr

# 4. Storefront gates (artifacts/storefront)
pnpm --filter @workspace/storefront run lint:filecap
pnpm --filter @workspace/storefront run lint:tokens
pnpm --filter @workspace/storefront run typecheck

# 5. Tests for what you touched — by file, from artifacts/api-server
node --test --test-force-exit --import tsx ./src/routes/<file>.test.ts
```

**Never diagnose a type error from `npx tsc` inside a single artifact package.** The lib
packages use TypeScript project references, so a package-local `tsc` reads *stale built*
lib output and will report failures that do not exist (or miss ones that do). Only the root
`pnpm run typecheck` is authoritative.

`--test-force-exit` is required: the suites hold real Postgres connections whose open
handles keep the event loop alive indefinitely. CI-equivalent env for DB-backed tests:
`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/tanmatra_test`, `NODE_ENV=test`,
`GOOGLE_API_KEY=test`, `CLINICAL_KMS_MASTER_KEY=<64 hex chars>`.

**What each gate actually forbids** (every one of these scripts lives at repo root, *not* in
`artifacts/tanmatra/scripts/`):

| Gate | Scans | Forbids | Escape hatches |
|---|---|---|---|
| `lint-colors.ts` | `artifacts/tanmatra/src` | `/(?<![a-zA-Z0-9_-])#([0-9a-fA-F]+)\b/` and `/\b(rgb\|rgba\|hsl\|hsla)\(/` | Skips `index.css` and any `*theme.css`; skips tests/fixtures; strips `//` comments; ignores matches after `href="`, `id="`, `url(` |
| `lint-prices.ts` | `artifacts/tanmatra/src` | `/₹[0-9]/` | Allowlists `rdPlans.ts` and `adapter.ts` by name; strips comments. The rupee sign followed by an *interpolation* passes by design — that is the intended way to format (`tanmatra-v2/data.ts:8`) |
| `lint-geography.ts` | `artifacts/tanmatra/build/client` — **build output, not source** | `'Bengaluru'`, `'+91 80'`, `'+9180'`, and `/(?:©\|copyright)\s*(?:\([^)]+\)\s*)?\b(2024\|2025)\b/i` | **None.** No allowlist, no comment stripping. Hard-fails if no build exists |
| `lint-tokens.ts` | `artifacts/storefront/components`, `app` | Raw hex, `rgb/hsl/oklch/lab/lch(`, palette classes, sage on interactive elements | Two named legacy files; comment stripping; `themeColor` lines. A numeric HTML entity such as `&#9888;` trips the hex regex |
| `lint-filecap.ts` | `artifacts/storefront` | Files >300 lines, `.tsx` components >150; `"use client"` without a justification comment; **`@/` alias imports inside `lib/`** | The alias rule exists because four lib modules broke `main` across five consecutive merges — the test runner cannot resolve `@/` and fails with `ERR_MODULE_NOT_FOUND` despite a clean typecheck and build |
| `lint-test-reach.ts` | `artifacts/api-server/src`, `artifacts/storefront/lib`, `artifacts/tanmatra/src` | A `*.test.ts` file named by no workflow command | `scripts/test-reach-baseline.txt` only — and it is a debt register that may only shrink, not a place to park new tests |

Reference colours as Tailwind utilities generated from the token names (`bg-nn-surface`,
`text-nn-primary`) or as `bg-[var(--tnm-action)]`; derive shades with `color-mix()`, never
with a literal `rgba()` (`Header.tsx:70`).

---

## 8. Two contradictions you must not resolve by guessing

These are **owner decisions**. Surface them; do not pick a side in a PR.

**8.1 The GST model.** [`AGENT_WORKING_AGREEMENT.md`](./AGENT_WORKING_AGREEMENT.md) §2 states
the current model is *"5% GST on the meal subtotal + 18% GST on the delivery fee; ₹50
delivery waived at/above a ₹500 subtotal."* `lib/db/src/schema/orders.ts:137` states
`chargePaise` is *"post-discount meal total + **18% GST** + delivery fee."* These cannot both
be true, and the working agreement warns that branching from the wrong base
"will re-introduce the flat-18% GST". If your task changes pricing, stop and ask; the
answer is a CA question, not an engineering one. Whichever way it resolves, the change moves
as one unit across the five files named in §2 of the working agreement.

**8.2 The branch base.** [`AGENT_WORKING_AGREEMENT.md`](./AGENT_WORKING_AGREEMENT.md) §0
says to branch off `integration/engg-plus-fixes` (PR #82). That PR merged long ago, and the
same section contradicts itself two lines later: *"Never stack new work on a branch whose PR
has already merged — start a fresh branch from `main`."* **Current practice is
`git fetch origin && git checkout -b <branch> origin/main`.** Follow the second sentence.

---

## 9. Before you open the PR

- [ ] Named the surface (§1) and confirmed it is the one the user actually hits
- [ ] Read three neighbouring files and matched their idiom, not the doc's (§3)
- [ ] Registered everywhere it must be registered — routes, nav, **`verify.yml` by filename** (§4)
- [ ] No client-supplied amount is trusted; `chargePaise` is what bills (§5)
- [ ] No new bare `status` switch that ignores which table the string came from (§5)
- [ ] Migration, if any, is in its own PR with its snapshot and journal entry (§6)
- [ ] Root `pnpm run typecheck` green — not a package-local `tsc` (§7)
- [ ] Lint gates green; geography run **after** a build (§7)
- [ ] Tests written, their filenames added to the workflow that must run them, and
      `pnpm run lint:test-reach` green — without adding a baseline line (§4, §7)
- [ ] No credential value appears in any diff, log, or doc line (§5)
- [ ] Any doc this PR proved wrong is corrected in the same PR, or filed (§0)
- [ ] One concern. If you found a second, it is a second branch.

---

*Derived from a full-tree survey. Counts are re-derivable: route files
`ls artifacts/api-server/src/routes/*.ts | grep -v test | wc -l`; route registrations
`grep -rhoE "router\.(get|post|put|patch|delete)\(" artifacts/api-server/src/routes/ | wc -l`;
test files `find artifacts/api-server/src -name "*.test.ts" | wc -l`; names in CI
`grep -rhoE "[A-Za-z0-9_./-]+\.test\.ts" .github/workflows/ | sort -u | wc -l`; test-reach
debt `grep -cvE "^\s*(#|$)" scripts/test-reach-baseline.txt`; migrations
`ls lib/db/drizzle/*.sql | wc -l`.
When a count here stops matching, this document is the thing that is out of date.*
