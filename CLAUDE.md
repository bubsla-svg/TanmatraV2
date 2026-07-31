# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Install dependencies**
```bash
pnpm install
```

**Run apps (always filter — never run `pnpm dev` at the workspace root)**
```bash
pnpm --filter @workspace/api-server run dev        # Express API server
pnpm --filter @workspace/storefront run dev        # Customer web app (Next.js) — new customer work goes here
pnpm --filter @workspace/tanmatra run dev          # Legacy customer SPA (Vite) — still serves tanmatra.food
pnpm --filter @workspace/tanmatra-mobile run dev   # Expo mobile app
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
# Run a single test file (from artifacts/api-server):
node --test --import tsx ./src/lib/loyaltyEngine.checkout.test.ts
node --test --import tsx ./src/lib/dispatch.bulkhead.test.ts
node --test --import tsx ./src/lib/mealPlanner.test.ts
node --test --import tsx ./src/routes/groupOrders.test.ts
```

The storefront runs its own suite — 66 files, 372 tests, all under `artifacts/storefront/lib/`
and all DB- and network-free (every API client takes an injectable `fetchImpl`):
```bash
pnpm --filter @workspace/storefront run test     # all 372, ~8s
cd artifacts/storefront
node --test --import tsx ./lib/catalog.test.ts   # one file
```
`.github/workflows/storefront.yml` drives the same files from `artifacts/api-server`
(`node --test --import tsx ../storefront/lib/*.test.ts`). That form predates the storefront
declaring its own `tsx` and is still correct — either works.

The legacy SPA (`artifacts/tanmatra`) also has a `test` script, and `verify.yml`'s
`money-unit` job drives both packages by **glob**, not by a hand-written list:

```
node --test --import tsx "../tanmatra/src/**/*.test.ts"     # 79 tests
node --test --import tsx "../storefront/lib/**/*.test.ts"   # 372 tests
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

## Architecture

This is a pnpm monorepo for **Tanmatra** — a clinical-grade meal-delivery and wellness platform.

### Package layout

| Path | Role |
|------|------|
| `artifacts/api-server` | Express 5 backend |
| `artifacts/storefront` | **Customer web app — Next.js 16 App Router.** The rebuild; all new customer work goes here |
| `artifacts/tanmatra` | Legacy customer SPA — React 19 + React Router v7 + Vite. Customer routes were removed 2026-07-26; it is now an internal-only Admin ERP + RD console (`src/routes.ts`, `e2e/specs/erp_shell.spec.ts`). No longer mapped to `tanmatra.food` — see `docs/DOMAIN-CUTOVER.md` |
| `artifacts/tanmatra-mobile` | Expo React Native app |
| `artifacts/agents` | "Agency Agents Browser" — Vite + wouter app that browses the `lib/agency-agents` catalogue |
| `artifacts/clinical-governance-engine` | `@tanmatra/clinical-governance-engine` — zero-dependency contraindication engine, packing-station interlock, AE webhooks, WORM audit logger |
| `artifacts/mockup-sandbox` | Vite preview server for UI mockup work |
| `lib/api-spec` | **OpenAPI source of truth** (`openapi.yaml`) + Orval codegen config |
| `lib/api-client-react` | Generated React Query hooks + Zod schemas (do not edit manually) |
| `lib/api-zod` | Shared Zod request/response schemas |
| `lib/db` | Drizzle ORM schema + migrations (Postgres) |
| `lib/tokens` | Design tokens — `src/tokens.css` (runtime source of truth) + a TS mirror for JS-side use |
| `lib/menu-catalog` | Shared dish/menu data types |
| `lib/preferences-match` | Shared dietary preference-matching logic |
| `lib/subscription-rules` | Pure, DB-free subscription lifecycle rules. Holds the 24 h skip/swap cutoff so the API and the UI cannot drift |
| `lib/agency-agents` | Bundled agent content (`content/<division>/<slug>.md`) + a generated index. One-time MIT import; see its `LICENSE` |
| `lib/integrations-gemini-ai` | Gemini AI integration utilities |
| `scripts/` | One-off data scripts (seeding, backfills, audits) |

> **Agent workspaces are usually sparse checkouts.** `git sparse-checkout list` typically
> materialises only `artifacts/api-server`, `artifacts/storefront`, `lib`, `scripts`, `docs`,
> `.github` and `tasks`. The other packages above are fully tracked but absent from disk, and
> `git status` stays clean because they are marked skip-worktree. **`ls artifacts/` is therefore
> not evidence that a package was deleted** — check `git ls-tree -d --name-only HEAD artifacts/`,
> and read excluded files with `git show HEAD:artifacts/tanmatra/…`.

### Contract-first API flow

1. Edit `lib/api-spec/openapi.yaml` (single source of truth).
2. Run `pnpm --filter @workspace/api-spec run codegen` — Orval regenerates `lib/api-client-react` (hooks) and `lib/api-zod` (schemas).
3. The API server validates requests/responses using the same generated Zod schemas.
4. `artifacts/tanmatra`, `artifacts/tanmatra-mobile` and `artifacts/agents` consume the generated
   React Query hooks from `@workspace/api-client-react`.

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
- **Data fetching**: `@workspace/api-client-react` generated hooks + TanStack Query. `useMenuCatalog()` falls back to `STATIC_DISHES` so the UI never blanks.
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
  the storefront's palette is now whatever `lib/themes/tanmatra.ts` declares. That theme keeps the three
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
