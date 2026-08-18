# Tanmatra

Therapeutic / clinical-grade meal-delivery & wellness platform. **Three services are deployed:** the customer web app (`artifacts/storefront`, which is `tanmatra.food`), an Express + Postgres backend, and an internal Admin ERP + RD console. Everything else here is a library those three import, or tooling.

> **New here?** `CLAUDE.md` is the authoritative deep-dive (commands, architecture, conventions).
> `docs/CLONE-HANDOVER.md` has the exact clone → install → verify steps for a fresh machine or external agent.

## Requirements

- **Linux x64 (glibc)** — the root `pnpm.overrides` strip all other platforms' native binaries; builds fail on macOS/Windows/arm64 by design
- **Node.js 22** (`.nvmrc`) and **pnpm 9.15.5** (`packageManager` pin; `corepack enable` gets you both)
- pnpm **only** — the root `preinstall` script rejects npm/yarn and deletes their lockfiles

## Run & Operate

```bash
pnpm install --frozen-lockfile                     # canonical, CI-proven install
```

- `pnpm --filter @workspace/api-server run dev` — Express API server (port 8080)
- `pnpm --filter @workspace/storefront run dev` — **customer web app** (Next.js 16) — all new customer work goes here
- `pnpm --filter @workspace/tanmatra run dev` — legacy SPA, now internal-only Admin ERP + RD console
- `cd artifacts/tanmatra-mobile && pnpm exec expo start` — Expo app (NOT LIVE — not deployed anywhere)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run test` — every package with a `test` script
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks + Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

Minimum env to boot the API: `DATABASE_URL` (Postgres). `CLINICAL_KMS_MASTER_KEY` is additionally
required in production; `REDIS_URL` is optional (queue is skipped without it). Full table:
`CLAUDE.md` › Required environment variables, and `docs/CLONE-HANDOVER.md` §7.

## Stack

- pnpm workspaces, Node.js 22, TypeScript ~5.9
- API: Express 5, esbuild server bundle, BullMQ + Redis (optional), Socket.IO realtime, Gemini AI agents
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) — consumed by the legacy SPA (and the non-deployed mobile app)
- Customer web: **Next.js 16 App Router** (server-first) + Tailwind v4 + shadcn/Radix, Astryx design system
- Legacy web (admin/RD): React 19 + Vite + React Router v7 + Tailwind v4, framer-motion, cmdk
- Mobile: Expo + React Native — **not deployed**, see `artifacts/tanmatra-mobile` below

## Where things live

**Three services deploy** (`.github/workflows/deploy.yml`). That is the whole of Tanmatra:

| Path | Cloud Run | Role |
|------|-----------|------|
| `artifacts/storefront` | `storefront` | **Customer web app** (Next.js 16) — serves `tanmatra.food` since the 2026-07-25 cutover (`docs/DOMAIN-CUTOVER.md`) |
| `artifacts/api-server` | `wellness-foods` | Express 5 + Drizzle API (auth, dispatch, payments, AI agents, schedulers) |
| `artifacts/tanmatra` | `tanmatra` | Legacy SPA — customer routes removed 2026-07-26; internal-only Admin ERP + RD console. Also the `/images/*` origin the storefront proxies, so it cannot simply be retired |

Everything else is a library one of those three imports, or tooling:

| Path | Role |
|------|------|
| `lib/api-spec` | OpenAPI source of truth (`openapi.yaml`) + Orval codegen config |
| `lib/api-client-react` | Generated React Query hooks + Zod schemas — never edit by hand |
| `lib/api-zod` | Shared Zod request/response schemas |
| `lib/db` | Drizzle schema + migrations (Postgres) |
| `lib/tokens` | Design tokens — `src/tokens.css` runtime source of truth + TS mirror |
| `lib/menu-catalog` | Shared dish/menu data types |
| `lib/preferences-match` | Shared dietary preference-matching logic |
| `lib/subscription-rules` | Pure, DB-free subscription lifecycle rules (24 h skip/swap cutoff) |
| `lib/integrations-gemini-ai` | Gemini AI integration utilities |
| `scripts/` | One-off data scripts (seeding, backfills, audits) + repo lint gates |

Not deployed:

| Path | Status |
|------|--------|
| `artifacts/tanmatra-mobile` | **NOT LIVE** — Expo app with no `eas.json`, no build/submit pipeline, not in either app store, and no CI job. In-progress work, not a shipping surface |

## Architecture decisions

- **Contract-first APIs — except the storefront.** The OpenAPI spec in `lib/api-spec` drives
  generated hooks/schemas for the legacy SPA, and the server validates
  with the same schemas. The storefront is deliberately outside this flow: it uses hand-written
  typed clients in `artifacts/storefront/lib/` (injectable `fetchImpl`, fully unit-tested), so
  contract changes must be mirrored there by hand.
- **Server owns every amount.** The browser never sends a price; Razorpay `keyId` comes from the
  server's order response. The money path moves as one unit (`docs/AGENT_WORKING_AGREEMENT.md`).
- **Single design-token source per app.** Storefront: `lib/tokens/src/tokens.css`, bridged in
  `app/globals.css` — enforced by the `lint:tokens` CI gate (no raw hex). Legacy SPA:
  `src/index.css @theme`, motion mirrored in `src/lib/motion.ts`.
- **Auth-gated surfaces are islands.** On 401 the storefront renders `<PhoneAuth/>` in place —
  no `/login` redirects.
- **Icons:** storefront allows Lucide + Heroicons; legacy customer surfaces use Phosphor, admin/RD
  screens use Lucide.

## Design system

- **Storefront** — Astryx design system (owner decision 2026-07-27): palette lives in
  `artifacts/storefront/lib/themes/tanmatraTheme.ts` (brand hues as dark-mode values; `#7F6921` is light-mode gold).
  One surviving caveat: **gold is the only action colour** — see `docs/ASTRYX-ADOPTION-RUNBOOK.md` §3.
  Live styleguide at `/styleguide` (`app/styleguide/page.tsx`). CI gates: `lint:filecap`
  (`.tsx` ≤ 400 lines), `lint:tokens`.
- **Legacy SPA** — Clinical Dark palette stays locked (`#D4AF37` gold, `#6BA3C8` blue, `#7D9E7E`
  sage); no new base colors without explicit approval. Global chrome in
  `src/components/layout/{Header,BottomNav}.tsx` (IA: Eat / Plan / Track / Community / Account),
  ⌘K palette in `src/components/CommandPalette.tsx`.
- **Both:** tabular numerals wherever clinical data is shown (`.text-clinical-data` /
  `font-variant-numeric: tabular-nums`). Combo cards on Menu are a single clickable card opening
  a Dialog of constituent dishes with an "Add Combo" CTA.

## Product

Customer-facing capabilities, all served by the storefront:

- Browse a curated clinical menu (single dishes + Curated Selection combos with constituent dish drill-down)
- Build a cart / checkout / track live order
- Subscribe to weekly meal plans, generate a personalized 7-day plan
- Book a registered dietitian, follow therapeutic protocols (Wellness, Performance, Clinical)
- Join cohort challenges, browse RD-curated marketplace + recipes
- Personal preferences/health profile, rewards, vouchers, premium

Operator / RD surfaces live in the legacy SPA (admin-gated `/admin/*` routes and `/rd-console`).

## Testing

- Storefront: 951 unit tests in 122 files under `artifacts/storefront/lib/`, all DB- and network-free (~21 s).
- Legacy SPA: 163 unit tests. Both suites are driven from `artifacts/api-server` with **quoted**
  globs — `node --test --import tsx "../storefront/lib/**/*.test.ts"` — the quotes are
  load-bearing (unquoted `**` silently runs a subset under bash).
- `pnpm run lint:test-reach` fails CI on any test file no workflow reaches.
- e2e: Playwright, `artifacts/storefront/e2e/playwright.config.ts` (`E2E_BASE_URL` targets a
  local prod build or the deployed service).

## Gotchas

- Do **not** run `pnpm dev` at the workspace root — there is no root `dev` script by design;
  always `pnpm --filter @workspace/<name> run dev`.
- Never regenerate `pnpm-lock.yaml` to make `--frozen-lockfile` pass — fix the cause.
- New tokens go in a token file (`lib/tokens` for the storefront, `index.css @theme` for the
  legacy SPA), never inline — `lint:tokens` fails the build on raw hex.
- Stale `.next/` from another branch breaks storefront typecheck — remove it with an absolute
  path before rebuilding.
- `API_UPSTREAM` / `IMAGE_UPSTREAM` are **build-time only** for the storefront: rewrites are
  baked at `next build`; setting them at `next start` does nothing.
- `useMenuCatalog()` (legacy SPA) falls back to `STATIC_DISHES` so the UI never blanks.

## Pointers

- `CLAUDE.md` — authoritative repo guide; overrides older docs on any conflict
- `docs/CLONE-HANDOVER.md` — exact clean-clone/bootstrap steps (external agents start here)
- `docs/AGENT_WORKING_AGREEMENT.md` — mandatory pre-commit reading (branch base, one concern per PR, verify checklist)
- `docs/DOMAIN-CUTOVER.md` — which app serves `tanmatra.food`, and the rollback procedure
- `docs/ASTRYX-ADOPTION-RUNBOOK.md` — storefront design-system adoption record
