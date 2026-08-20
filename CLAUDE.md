# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Install dependencies**
```bash
pnpm install
```

**Run apps (always filter — never run `pnpm dev` at the workspace root)**
```bash
pnpm --filter @workspace/storefront run dev        # Customer web app (Next.js) — THIS is tanmatra.food; new customer work goes here
pnpm --filter @workspace/api-server run dev        # Express API server
pnpm --filter @workspace/tanmatra run dev          # Legacy SPA (Vite) — internal Admin ERP + RD console, and the /images/* origin
pnpm --filter @workspace/tanmatra-mobile run start # Expo app — NOT LIVE, not deployed anywhere (`start`, not `dev`)
```

**Type-checking and build**
```bash
pnpm run typecheck          # Full typecheck: lib project refs + all artifact packages
pnpm run typecheck:libs     # Lib packages only (tsc --build on tsconfig.json at root)
pnpm run build              # typecheck + build all packages
```

**Tests**
```bash
pnpm run test                                              # Every package that HAS a `test` script
pnpm --filter @workspace/api-server run test               # All api-server tests
# Run a single test file (from artifacts/api-server).
# NOTE: api-server tests REQUIRE a database — they abort with
# "DATABASE_URL must be set" without one, so `DATABASE_URL` must be exported
# first. CI provisions postgres://postgres:postgres@localhost:5432/tanmatra_test.
# This is not the DB-free suite; that is the storefront's, below.
node --test --import tsx ./src/lib/loyaltyEngine.checkout.test.ts
node --test --import tsx ./src/lib/dispatch.bulkhead.test.ts
node --test --import tsx ./src/lib/mealPlanner.test.ts
node --test --import tsx ./src/routes/groupOrders.test.ts
```

The storefront runs its own suite — 123 files, 968 tests, all under `artifacts/storefront/lib/`
and all DB- and network-free (every API client takes an injectable `fetchImpl`):
```bash
pnpm --filter @workspace/storefront run test     # all 968, ~21s
cd artifacts/storefront
node --test --import tsx ./lib/catalog.test.ts   # one file
```
`.github/workflows/storefront.yml` drives the same files from `artifacts/api-server`
(`node --test --import tsx ../storefront/lib/*.test.ts`). That form predates the storefront
declaring its own `tsx` and is still correct — either works.

The legacy SPA (`artifacts/tanmatra`) also has a `test` script, and `verify.yml`'s
`money-unit` job drives both packages by **glob**, not by a hand-written list:

```
node --test --import tsx "../tanmatra/src/**/*.test.ts"     # 28 tests
node --test --import tsx "../storefront/lib/**/*.test.ts"   # 968 tests
```

The quotes are load-bearing — Actions runs `run:` under bash with globstar OFF, where `**`
collapses to a single level and silently runs a subset while still going green. Let **node**
expand the glob. `scripts/lint-test-reach.ts` understands these patterns and fails the build
on any test file no workflow reaches.

**API codegen (after changing `lib/api-spec/openapi.yaml`)**
```bash
pnpm --filter @workspace/api-spec run codegen   # Regenerates React Query hooks + Zod schemas via Orval
```

**Database (dev only — requires `DATABASE_URL`)**
```bash
pnpm --filter @workspace/db run push    # Push Drizzle schema to database
```

**Evals**
```bash
pnpm run evals    # Runs api-server AI evals
```

**Repo knowledge graph — use BEFORE broad Grep/Read.** The import graph answers
"what uses this / what breaks if I change it" in a few hundred tokens instead of
a grep sweep. Full usage and honesty caveats: `.claude/skills/kg/SKILL.md`.
```bash
python3 .kg/kg_extract.py . .kg/graph.json   # build once per fresh clone (~4 s; graph.json is gitignored)
python3 .kg/kg.py context <path>             # the read-set: file + deps + callers + docs
python3 .kg/kg.py blast <path> --depth 3     # transitive dependents — run before editing anything under lib/
```

## Architecture

This is a pnpm monorepo for **Tanmatra** — a clinical-grade meal-delivery and wellness platform.

### Package layout

**Exactly three services are deployed** (`.github/workflows/deploy.yml`, three `SERVICE:` values).
Everything else in this repo is a library those three import, or tooling. If you are describing
what Tanmatra *is*, it is these three and nothing else:

| Path | Cloud Run service | Role |
|------|-------------------|------|
| `artifacts/storefront` | `storefront` | **The customer web app, and what `tanmatra.food` serves.** Next.js 16 App Router. All new customer work goes here |
| `artifacts/api-server` | `wellness-foods` | Express 5 backend, the source of truth for price and availability |
| `artifacts/tanmatra` | `tanmatra` | Legacy React 19 + Vite SPA. Customer routes removed 2026-07-26; now an internal-only Admin ERP + RD console (`src/routes.ts`). **Still load-bearing for the live site**: the storefront's `IMAGE_UPSTREAM` proxies `/images/*` through it, so deleting it 404s every dish photo. See `docs/DOMAIN-CUTOVER.md` |

Libraries, each imported by at least one deployed service:

| Path | Role |
|------|------|
| `lib/api-spec` | **OpenAPI source of truth** (`openapi.yaml`) + Orval codegen config |
| `lib/api-client-react` | Generated React Query hooks + Zod schemas (do not edit manually) |
| `lib/api-zod` | Shared Zod request/response schemas |
| `lib/db` | Drizzle ORM schema + migrations (Postgres) |
| `lib/tokens` | Design tokens — `src/tokens.css` (runtime source of truth) + a TS mirror for JS-side use |
| `lib/menu-catalog` | Shared dish/menu data types |
| `lib/preferences-match` | Shared dietary preference-matching logic |
| `lib/subscription-rules` | Pure, DB-free subscription lifecycle rules. Holds the 24 h skip/swap cutoff so the API and the UI cannot drift |
| `lib/integrations-gemini-ai` | Gemini AI integration utilities |
| `scripts/` | One-off data scripts (seeding, backfills, audits) |

**Not deployed — do not present it as part of the product:**

| Path | Status |
|------|--------|
| `artifacts/tanmatra-mobile` | **NOT LIVE.** Expo React Native app. No `eas.json`, no build or submit pipeline, not in either app store, and no CI job touches it. Retained as in-progress work (`docs/NATIVE-ONBOARDING-PORT-PLAN.md`) — it is not a shipping surface |

> **The catalogue is not in this repo.** Dish names, prices and macros live in Postgres and are
> served by `/api/menu/public`. `lib/menu-catalog` holds *types* plus a static fallback that
> `fetchMenu()` returns as `source: "fallback"` when the API is unreachable. A clone with no
> database renders the fallback, not the live menu — so never read dish content out of this repo
> and describe it as what customers see.

> **Three different dish counts appear in this repo and all three are correct.** They are not
> interchangeable, and mixing them is the single most common factual error made about this
> codebase. Say which one you mean:
>
> | Count | Meaning | Where it comes from |
> |------:|---------|---------------------|
> | **95** | Live **orderable** dishes — what a customer actually browses | `GET /api/menu/public` (verified 2026-08-20) |
> | **116** | The **static fallback** catalog — what a DB-less clone renders | `DISHES` in `lib/menu-catalog/src/index.ts` |
> | **163** | **All** DB rows, including drafted, dead and archived SKUs | `menu_items` table (counted by the Draft Thin Dishes plan, 2026-08-20) |
>
> A statement like "17 of 163 dishes cannot state their ingredients" is about the whole table;
> "95 dishes" is about the live menu. Neither is the 116 in this repo's source.
>
> **The live count was 112 until 2026-08-20**, when the data-floor apply drafted the 17 dishes
> whose `ingredients` was the placeholder `["fresh ingredients"]` — they now sit at
> `allergen_review_state = 'pending_review'`, hidden from customers and visible to staff/RD.
> They return to the live count the moment someone writes their ingredients and an RD reviews
> them, so **re-measure rather than assuming 95 is durable**. The full breakdown that run
> reported: 163 rows = 95 passing + 17 newly drafted + 18 already pending + 33 archived.

> **Agent workspaces are usually sparse checkouts.** `git sparse-checkout list` typically
> materialises only `artifacts/api-server`, `artifacts/storefront`, `lib`, `scripts`, `docs`,
> `.github` and `tasks`. The other packages above are fully tracked but absent from disk, and
> `git status` stays clean because they are marked skip-worktree. **`ls artifacts/` is therefore
> not evidence that a package was deleted** — check `git ls-tree -d --name-only HEAD artifacts/`,
> and read excluded files with `git show HEAD:artifacts/tanmatra/…`.

### Contract-first API flow

> **Read this before believing the four steps below.** Measured 2026-08-18, this pipeline is
> ~90% vestigial. It is described here because it still *exists*, not because it is how the
> system works:
>
> - **`openapi.yaml` declares 40 paths. The API server registers 441 route handlers.** The
>   "single source of truth" describes roughly 9% of the surface.
> - **The server imports exactly ONE generated schema** — `HealthCheckResponse`, for `/healthz`.
>   Everything else it takes from `@workspace/api-zod` (`AuthUser`, `isServiceablePincode`,
>   `SERVICEABLE_PINCODES`) is hand-written in that package's `src/index.ts`. Routes validate
>   with `zod/v4` schemas declared inline.
> - **Zero generated React Query hooks are imported anywhere in this repo.** Only three files
>   import `@workspace/api-client-react` at all, and all three take hand-written helpers from
>   `src/custom-fetch.ts`: the legacy SPA takes `setBaseUrl`; the (undeployed) mobile app takes
>   `setBaseUrl`, `setAuthTokenGetter`, and the `WearableProvider` type.
> - Hooks that *look* generated are not. `useJoinChallenge`, `useLeaveChallenge` and
>   `usePostToChallenge` are hand-written in `artifacts/tanmatra/src/lib/contentApi.ts`, over raw
>   `fetch` + `@tanstack/react-query` — the exact operations Orval generates and nobody imports.
>
> So: changing `openapi.yaml` propagates to almost nothing. Do not assume codegen will carry a
> contract change to any consumer — find the hand-written client and edit it.

> **There are TWO OpenAPI specs in this repo and they are disjoint.** This is the single most
> common wrong turn taken here: someone edits one believing it is "the" contract, while the other
> is the one being enforced.
>
> | | `lib/api-spec/openapi.yaml` | `OPENAPI_SPEC_V1` |
> |---|---|---|
> | Where | `lib/api-spec/` | `artifacts/api-server/src/routes/openApiContract.ts` |
> | Paths | 40 | 39 |
> | Consumed by | Orval → `lib/api-client-react`, which almost nothing imports | Served live at `GET /v1/openapi.json` |
> | Enforced by | `openApiSpecFile.test.ts` — every declared path must be a real registered route | `openApiContract.test.ts` — `validateRouterContract()` walks the live router stack and fails on any route missing from the spec (`/ops`, admin, legal) |
>
> **Overlap: zero paths.** Together they describe 79 of the ~396 routes the server registers
> (~20%). Neither references the other. Which one survives is an open product decision; until it
> is made, edit the one whose enforcement you actually want, and expect no propagation between
> them. `openApiSpecFile.test.ts` fails the build if they ever describe the same path differently.

1. Edit `lib/api-spec/openapi.yaml`.
2. Run `pnpm --filter @workspace/api-spec run codegen` — Orval regenerates `lib/api-client-react` (hooks) and `lib/api-zod` (schemas).
3. The generated output is then, in practice, almost entirely unconsumed (see above).

**The storefront is deliberately outside this flow.** It does not depend on
`@workspace/api-client-react` at all; it calls the API through hand-written typed clients in
`artifacts/storefront/lib/` (see below). Changing `openapi.yaml` therefore does *not* propagate
to the storefront — a contract change has to be mirrored into the relevant `lib/*Api.ts` client
by hand, and that client's wire test is what catches the drift.

### API server internals (`artifacts/api-server`)

- **Entry**: `src/index.ts` → `src/app.ts` (Express app) → `src/routes/index.ts` (mounts all routers).
- **Auth**: Session cookie (`authMiddleware`) with an admin token shim (`adminSessionShim`) for admin routes.
- **Rate limiting**: Per-route middleware in `src/middlewares/rateLimitMiddleware.ts` (separate limits for menu, orders, AI, payments, addresses).
- **Dispatch engine**: `src/lib/dispatch.ts` — heuristic rider assignment with priority tiers (`routine` / `urgent` / `stat`). STAT orders have a 5-minute SLA breach threshold.
- **Queue**: BullMQ + Redis (`src/lib/queue.ts`) for async order pipeline steps. Redis is optional; queuing is skipped when `REDIS_URL` is absent.
- **AI agents**: `src/lib/ai/` — agent gateway (`gateway.ts`), registry (`agentRegistry.ts`), and agents for support, ops, reorder, CMS, and coach. Each agent is defined with `definePrompt` + `defineTool` helpers.
- **Realtime**: Socket.IO (`src/lib/realtime.ts`) for live order tracking events.
- **Scheduled jobs**: `src/lib/analyticsScheduler.ts`, `mealPlanScheduler.ts`, `menuEngineeringScheduler.ts`, `loyaltyScheduler.ts`, `anomalyScheduler.ts`.

### Storefront internals (`artifacts/storefront`) — the customer app under active development

Next.js 16 App Router, server-first. It ships as its own Cloud Run service (`deploy.yml`'s
`storefront-cloud-run` job) and, since the 2026-07-25 domain cutover, **is the app `tanmatra.food`
and `www.tanmatra.food` serve** — verified by matching `/api/build` sha + `builtAt` between the
domain and the storefront service. The legacy `tanmatra` service is still deployed but is no
longer customer-facing (see the `artifacts/tanmatra` row above); it stays in the deploy graph only
because the storefront's `IMAGE_UPSTREAM` proxies `/images/*` through it. See
`docs/DOMAIN-CUTOVER.md` for the full record and the rollback procedure.

- **Routing**: directories under `app/` (`app/menu/page.tsx`, `app/dish/[slug]/`, …). No
  `routes.ts` — the filesystem *is* the route table.
- **Design tokens**: `@workspace/tokens/tokens.css` is imported in `app/layout.tsx` **before**
  `app/globals.css`, which bridges those raw tokens onto Tailwind v4 utilities and onto the
  shadcn/Radix semantic variable names. Add tokens in `lib/tokens`, never inline in a component.
- **Global chrome**: `components/Header.tsx`, `components/BottomNav.tsx`, `components/Footer.tsx`,
  `components/CommandMenu.tsx`. Note the flat paths — no `src/`, no `layout/` subdirectory.
- **Data fetching**: hand-written clients in `lib/` over `lib/apiClient.ts`
  (`apiGet/apiPost/apiPatch/apiPut/apiDelete(path, [body,] fetchImpl?)` → `${API_BASE}/api${path}`,
  `credentials: "include"`, throwing `ApiError(status, code, message)`). `fetchImpl` is injectable
  so every client is testable without a network — that is what `lib/*.test.ts` exercises.
- **Auth-gated surfaces** are islands: try the call, and on 401 render `<PhoneAuth onVerified={reload}/>`
  rather than redirecting. Admin-gated islands additionally branch on the membership role.
- **Money path**: the server owns every amount. The browser never sends a price; it receives
  `keyId` from the server's order response, and no Razorpay key is bundled.
- **Anti-rot gates (hard CI checks, `storefront.yml`)**: `lint:filecap` — `.tsx` ≤ 150 lines, every
  other file ≤ 300, and each `"use client"` must carry a justification; `lint:tokens` — no raw hex,
  no palette classes, gold is the only interactive colour and sage must never paint an interactive
  region. Both resolve paths from the repo root: `node --experimental-strip-types scripts/lint-tokens.ts artifacts/storefront`.
- **`noUncheckedIndexedAccess` is on**, and `e2e/specs/**` is typechecked — keep specs type-clean.
- **e2e**: `pnpm exec playwright test --config artifacts/storefront/e2e/playwright.config.ts`.
  `E2E_BASE_URL` targets a local prod build (`next start`) or the deployed service; the same specs
  serve both. In a sandbox, point `E2E_CHROMIUM_PATH` at the pre-installed Chromium.
- **Stale `.next` is a real trap**: clear it with an absolute path (`rm -rf /home/claude/wf/artifacts/storefront/.next`).
  A shell cwd persists between commands, so a relative path can silently no-op and leave
  cross-branch `.next/types` behind, which then fails typecheck for reasons unrelated to your change.

### Legacy web app internals (`artifacts/tanmatra`)

- **Routing**: File-based via React Router v7 (`src/routes.ts`). Admin routes are behind `AdminAuthLayout`; RD console behind `RdAuthLayout`.
- **Design system**: `src/index.css` is the single source of truth for all CSS custom properties (`@theme`): colors, type scale, radii, shadows, motion durations/easings. JS tokens are mirrored in `src/lib/motion.ts` for Framer Motion.
- **Global chrome**: `src/components/layout/Header.tsx` (desktop) and `BottomNav.tsx` (mobile). IA grouping: **Eat / Plan / Track / Community / Account**. Update both when adding customer routes.
- **Command palette**: `src/components/CommandPalette.tsx` — global ⌘K; register new customer routes here.
- **Data fetching**: hand-written TanStack Query hooks in `src/lib/` (e.g. `useMenuCatalog()` in `menuData.ts`, the challenge hooks in `contentApi.ts`) over raw `fetch` — NOT the generated `@workspace/api-client-react` hooks, which nothing imports. `useMenuCatalog()` falls back to `STATIC_DISHES` so the UI never blanks.
- **Icons**: Phosphor (`@phosphor-icons/react`) on customer surfaces; Lucide (`lucide-react`) on
  admin/RD screens. The storefront allows Lucide **and** Heroicons (`@heroicons/react`) — the
  Lucide-only rule was revoked for DS-0 so Astryx templates compile verbatim (they import Heroicons).
- **No styleguide route here any more.** It moved to the storefront (`/styleguide`,
  `app/styleguide/page.tsx`); nothing under `artifacts/tanmatra/src` matches `styleguide`.

### Database (`lib/db`)

Drizzle ORM against Postgres. Schema files live in `lib/db/src/schema/` — one file per domain (orders, auth, riders, menu items, subscriptions, etc.). Migrations are managed via `drizzle-kit`.

### Required environment variables

| Variable | Used by |
|----------|---------|
| `DATABASE_URL` | `lib/db`, `artifacts/api-server` |
| `REDIS_URL` | `artifacts/api-server` (BullMQ queue — optional) |
| `CLINICAL_KMS_MASTER_KEY` | `artifacts/api-server`, `lib/db` — AES-256-GCM key for encrypting subscription-member clinical fields at rest. **Required in production** (server fails to boot without it). 64 hex chars; aliases: `MASTER_KEY`, `DPDPA_MASTER_KEY_HEX`, `CLINICAL_MASTER_KEY_HEX`. |
| `NEXT_PUBLIC_API_BASE` | `artifacts/storefront` — client-inlined API origin. Set to `""` in the deployed image so the browser calls same-origin `/api/*` and the session cookie stays first-party (a cross-site storefront→api topology drops it under Safari/ITP). |
| `API_BASE_URL` | `artifacts/storefront` — where server components fetch the API directly, bypassing the rewrite. |
| `API_UPSTREAM` / `IMAGE_UPSTREAM` | `artifacts/storefront` — **build-time only.** They enable the `/api/*` and `/images/*` rewrites, which Next bakes into `routes-manifest.json` at `next build`. Setting them at `next start` does nothing (verified empirically); repointing either one means a rebuild, not a restart. |

## Key conventions

- **Colors**: Clinical Dark palette — `#D4AF37` (clinical-gold), `#6BA3C8` (blue), `#7D9E7E` (sage).
  Still locked for `artifacts/tanmatra` (the legacy SPA): no new base colors there without explicit approval.
  **Lifted for `artifacts/storefront`** by owner decision (2026-07-27) adopting the Astryx Design System;
  the storefront's palette is now whatever `artifacts/storefront/lib/themes/tanmatraTheme.ts` declares. That theme keeps the three
  brand hues as its dark-mode values and adds light-mode counterparts where the dark ones fail contrast —
  `#7F6921` is the light-mode gold, because `#D4AF37` measures below AA on a light background.
  Note the gate's reach: `lint:tokens` scans only `artifacts/storefront/{components,app}`, so a raw hex in
  `lib/themes/` is invisible to it. Theme files are the one place colours are meant to live; everywhere
  else the gate still catches them.
- **DS-0 rule revocations (owner decision, 2026-07-27) — storefront only.** To unblock end-to-end
  Astryx adoption, the following are REVOKED for `artifacts/storefront` (all still apply to the
  legacy SPA where stated):
  - *Sage-never-interactive*: Astryx variants (Card/Badge colour variants, success buttons, …) are
    sanctioned as shipped. `lint:tokens` now checks only raw colour literals.
  - *Tailwind palette-class ban*: removed from `lint:tokens`.
  - *150-line `.tsx` cap*: raised to 400 (`lint:filecap`) so page templates land verbatim; the
    `"use client"` justification-comment requirement is dropped for the same reason.
  - *Lucide-only icons*: see the Icons bullet.
  - *Anti-template guidance* (`.claude/rules/ecc/web/design-quality.md` and any similar rule pack):
    superseded for the storefront. Astryx templates and blocks ARE the sanctioned starting point —
    adopting them verbatim is the goal, not a smell. This file overrides the rule packs.
  **Explicitly NOT revoked** (they render nothing and never block a design system): server owns
  every amount (money path), auth-gated surfaces are islands (no `/login` redirects), PHI encryption,
  `lint:test-reach`, and the `lib/` no-`@/`-alias rule (test-runner correctness, not design).
  **One design caveat survives: gold is still the only action colour.** Adopt templates verbatim
  except their primary-CTA colour — repoint that to `--gold` / `--gold-ink`. Status badges, coloured
  Cards and success/warning/error states keep their shipped colour (signal, not action). Held in
  review, deliberately NOT re-added to `lint:tokens`: a gate here would re-create the blocker just
  removed, and it could not reliably tell a primary CTA from a secondary. See
  `docs/ASTRYX-ADOPTION-RUNBOOK.md` §3.
- **New design tokens**: storefront — add to `lib/tokens/src/tokens.css` (and its TS mirror in
  `lib/tokens/src/index.ts` if JS needs the value), bridge in `artifacts/storefront/app/globals.css`,
  and update `/styleguide`. Legacy SPA — add to `artifacts/tanmatra/src/index.css @theme`.
  Either way the value goes in a token file, never inline: the storefront's `lint:tokens` gate
  fails the build on a raw hex.
- **Tabular numerals**: Use `.text-clinical-data` / `font-variant-numeric: tabular-nums` wherever clinical data is displayed.
- **Combo cards on Menu**: Must be a single clickable card opening a Dialog listing constituent dishes (each linking to `/dish/:slug`) with an "Add Combo" CTA.
- **Zod imports**: Use `zod/v4` (`import { z } from "zod/v4"`) — not the legacy `zod` entry.
- **Package manager**: `pnpm` only. The root `preinstall` script rejects npm/yarn.

## Multi-agent working agreement

Before committing, read **`docs/AGENT_WORKING_AGREEMENT.md`** — branch base, one-concern-per-PR, the money-path lockstep rule, shared-file coordination, the no-hardcoded-path/color/price/secret lint gates, and the verify-before-push checklist.
