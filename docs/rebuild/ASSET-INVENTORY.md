# Asset Inventory — TNM-UIF-P0, reconciled against repo reality

**Status:** Owner-adjudicated 2026-07-23. This is the Step 1 veto checkpoint from the
TNM-UIF-P0 scaffold brief, executed as evidence-first reconnaissance (5 independent
read-only audits) against `main` @ `350f9a3f`.

## ⚠️ Flags — read these first (the surprises the brief's veto clause asks for)

1. **HALT-2 fired: the shell already substantially satisfies TNM-UIF-01 §3–§7.**
   The brief's headline deliverable — a fresh Next.js app assembled from transplanted
   domain modules — already exists as `artifacts/storefront` (Next 16 App Router,
   menu/PDP/checkout/plans surfaces, money-path `lib/*` with tests, `/styleguide`,
   Dockerfile + Cloud Run deploy job). TNM-UIF-01 **Phase 0 merged as retrofit-in-place
   in PR #302** (commit `cc705f0d`): token bridge, IBM Plex Sans + JetBrains Mono,
   `next-themes` light-default, shadcn `ui/{button,card,badge,skeleton}`, §3.4 token
   gate (green), `/styleguide` proof set.
2. **HALT-1 fired: the `.tnm2` / IMPECCABLE verified-palette contract does not exist
   in-repo.** No `IMPECCABLE.md`, no `.tnm2` contract file, no `docs/design/`
   (`PLAN-CROSSCHECK.md` §1.2 and `IMPLEMENTATION-PLAN.md` both list it as a
   missing owner input). In-repo, "`.tnm2`" actually names the **legacy dark
   "Nocturnal Nourishment" skin** of `artifacts/tanmatra` (saffron `#fbbf24` /
   cyan `#34daff` — non-locked colors), *not* a "verified light + clinical-ink dark"
   contract. No palette value was ever invented: Phase 0 bound to the committed
   `@workspace/tokens`.
3. **The brief's target topology is fictional here.** There is no `apps/` and no
   `packages/`; the repo is already a mature pnpm workspace over `artifacts/*`
   (apps) + `lib/*` (packages). The domain layer the brief wants "extracted into
   `packages/*`" is already extracted.
4. **The deploy premise is wrong.** Zero Vercel footprint — a prior commit
   (`6a81ac0e`, branch `chore/remove-vercel`) deliberately removed Vercel config:
   "Cloud Run is the deploy target." The storefront ships via Cloud Build → Cloud Run
   (project `brand-tanmatra-tmg`, region `asia-south2`, service `storefront`);
   `tanmatra.food` is a Cloud Run domain mapping on the `tanmatra` service.
   Deploys are currently **manual-only** (`0d7898ca` commented out the push trigger).
5. **The E2E harness lives inside the "legacy" app.** The Playwright CMP +
   storefront-audit specs (`storefront_checkout_audit`, `cuj_money_paths`,
   `pixel_fidelity`) are at `artifacts/tanmatra/e2e`. Freezing/relocating legacy
   naively would strand the new storefront's own test harness.
6. **The brief's 3-slot shape has no home for real workspace members**: the Expo
   mobile app (`artifacts/tanmatra-mobile`, actively shipping — PRs #300/#301),
   the entire money-path Express backend (`artifacts/api-server`), the agents
   runtime, the clinical-governance engine, or the mockup sandbox.

## Owner decisions (2026-07-23, session adjudication)

| Question | Decision |
|---|---|
| Repo path (spec §10.3) | **Continue retrofit-in-place** on `artifacts/storefront` + Cloud Run. Keep merged #302. Finish TNM-UIF-01 (component batch, Vaul, motion, RHF+zod checkout, `/api/build`, `sw.js`) on the existing app. No `apps/`/`packages/` re-homing, no Vercel migration. |
| Palette source (HALT-1) | **`lib/tokens` (`@workspace/tokens`) is the realized source of truth** — Clinical gold/blue/sage, light-default + dark override, radius + type scale, AA-annotated. `docs/design/IMPECCABLE.md` may be backfilled later *from these shipped tokens*; until then no token work invents values. |

## Inventory

Classifications are against the brief's vocabulary, reconciled to the retrofit
decision: **KEEP** = stays exactly where it is · **ALREADY-PACKAGE** = the
"extract to packages/*" work the brief planned is already done · **FINISH** =
exists, has real remaining TNM-UIF-01 work · **SUPERSEDED-BY-REALITY** = the
brief step has no artifact to act on / reality already resolved it · **N/A** =
premise doesn't exist in this repo.

| Module | Classification | Location (actual) | Rationale |
|---|---|---|---|
| `apps/` + `packages/` topology | N/A | does not exist | Workspace is `artifacts/*` + `lib/*` (`pnpm-workspace.yaml`); re-homing is churn with no functional gain. |
| `lib/menu-catalog` (RAW_DISHES) | ALREADY-PACKAGE | `@workspace/menu-catalog` | Single catalog source, own tests, already consumed by storefront as a workspace dep. Nothing to extract. |
| `lib/tokens` (design tokens) | ALREADY-PACKAGE · **source of truth** | `@workspace/tokens` (`src/tokens.css`) | Verified light palette (AA annotations), clinical dark override (`:root[data-theme="dark"]`), radius + clamp type scale. This *is* the DS contract, as code. |
| `lib/subscription-rules` (plans/pricing) | ALREADY-PACKAGE | `@workspace/subscription-rules` | Plan catalog + pricing rules, tested, consumed by storefront. |
| `lib/api-zod`, `lib/api-spec`, `lib/api-client-react` | ALREADY-PACKAGE | `@workspace/*` | Contract-first OpenAPI → Orval codegen chain, already packaged. |
| `lib/db` (Drizzle schema) | ALREADY-PACKAGE | `@workspace/db` | Shared infra, per-domain schema files, unaffected by any UI path. |
| `lib/preferences-match`, `lib/integrations-gemini-ai`, `lib/agency-agents` | ALREADY-PACKAGE | `@workspace/*` | Already extracted; no action. |
| `artifacts/storefront` (Next.js shell) | **FINISH** | `@workspace/storefront` | Phase 0 foundation merged (#302). Remaining vs TNM-UIF-01: §2.3 component batch (4/≈16 present), §4.2/4.3 Vaul PDP/cart sheets, §5 motion (`motion` installed, zero imports), §4.5 RHF+zod checkout (currently hand-rolled `useState`), `/api/build`, `public/sw.js`. |
| `artifacts/api-server` money routes (payments/refunds/subscriptions/auth) | KEEP | `@workspace/api-server` | Server price authority (`paymentIntegrity`, `payments.ts`) — the invariant everything rests on. CI-gated by verify.yml money jobs. Untouched by UI work. |
| `artifacts/api-server/src/lib` money math (subscriptionPricing, bundlePricing, cartMath, geocode, loyaltyEngine) | KEEP (extraction optional, deferred) | inside api-server | The one place the brief's "extract to a package" idea partially holds — but the storefront deliberately has its own display-side `lib/moneyPath.ts` and the server stays authoritative. Extraction is a refactor decision for later, not a Phase 0 gate. |
| `artifacts/api-server/src/lib/ai` (coach/support/ops/cms prompts) | KEEP | inside api-server | Server-side agent layer; out of scope for the UI foundation. |
| Analytics events (`serverEvents.ts` server-side; `lib/funnel.ts` storefront client) | KEEP | split server/client | Already wired; storefront funnel exists — further evidence the shell is built, not pending. |
| `artifacts/tanmatra` (legacy Vite SPA) | KEEP (live prod; do not freeze yet) | `@workspace/tanmatra` → Cloud Run `tanmatra` (tanmatra.food) | The brief's `apps/legacy` freeze is a cutover-era event (spec §9.5), owner-gated. Still receives changes; hosts the E2E harness. |
| E2E harness (CMP + storefront audit + pixel fidelity) | KEEP (relocation = separate PR, cutover-era) | `artifacts/tanmatra/e2e` | Most valuable test asset in the repo; validates the *new* storefront. Do not strand it when legacy is eventually frozen. |
| `artifacts/tanmatra-mobile` (Expo) | KEEP | `@workspace/tanmatra-mobile` | Actively shipping (#300/#301); no slot in the brief's shape — untouched. |
| `docs/design/IMPECCABLE.md` | SUPERSEDED-BY-REALITY (backfill later) | absent | No source contract exists to land it from (HALT-1). Its payload ships as `lib/tokens`. Backfill as documentation *of* the shipped tokens when desired — never as a source that could contradict them. |
| Vercel project `tanmatra-web` + Vercel domain flip | SUPERSEDED-BY-REALITY | no Vercel; Cloud Run | Deploy = Cloud Build → Cloud Run service `storefront`; cutover = Cloud Run domain-mapping move (deploy.yml comments), instantly reversible. §9.5 reframed onto Cloud Run. |
| `/api/build` deploy-truth endpoint | **FINISH (this PR)** | legacy has it (`artifacts/tanmatra/server/static-server.mjs:192`); storefront lacked it | Landed at `artifacts/storefront/app/api/build/route.ts` + `BUILD_SHA` env in the storefront deploy job. |
| `public/sw.js` kill switch (§9.5) | **FINISH (this PR)** | was absent (no `public/`) | Landed verbatim from spec §9.5; inert until a legacy-SW browser arrives. Dockerfile now copies `public/` into the standalone runtime. |
| §3.4 CI gates | **FINISH (this PR)** | `scripts/lint-tokens.ts` (raw-color gate, green; red/green proven in #302) | Extended with the sage-never-interactive check. Saffron-exclusivity beyond raw-hex is a review rule (a grep cannot judge "is this a CTA"); raw `#d4af37` literals are already blocked by the hex gate. |

## HALT record (per the brief's protocol — a clean halt is a success state)

- **HALT-1** (contract source inaccessible) — fired; resolved by owner decision:
  proceed on `lib/tokens`, backfill the doc later.
- **HALT-2** (inventory contradicts the fresh-scaffold premise) — fired; evidence
  presented; owner re-argued the call and chose **retrofit-in-place**.
- HALT-3 (workspace conversion breaks legacy) — never reached; no conversion needed.
- HALT-4 (would touch legacy service/pipeline/domain) — respected; only the
  `storefront-cloud-run` job in `deploy.yml` is touched (the new app's own job),
  never the `cloud-run` (api) / `frontend-cloud-run` (tanmatra) jobs, DNS, or domain.
