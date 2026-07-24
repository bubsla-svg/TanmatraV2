# Storefront route-parity port — program plan & tracker

**Scope:** port the ~43 customer-facing routes that exist on the legacy `tanmatra`
app (React Router v7 SSR) but are missing on the new `storefront` (Next.js 16 App
Router) — **natively**, as real RSC pages in the Clinical Dark design system, not
proxied.

This is a **program**, not a single change. It is optimised for **shortest
wall-clock**: waves run as **parallel tracks**, not a strict A→H chain — see
**§7 Execution acceleration**. Independent routes touch disjoint files, so multiple
agents work concurrently; the only shared surfaces (nav, redirect map, sitemap) are
front-loaded once (Track 0) so waves never collide. Only two human checkpoints
remain — money-path sign-off and PHI review — everything else runs autonomously.

> Source of truth for the legacy inventory: `artifacts/tanmatra/src/routes.ts`
> (86 route lines). Source of truth for what already exists on the storefront:
> `artifacts/storefront/app/**/page.tsx`.

---

## 0 · Framework delta (why these aren't drop-in)

| | `tanmatra` (legacy) | `storefront` (target) |
|---|---|---|
| Framework | React Router v7 (Vite SSR) | Next.js 16 App Router (RSC) |
| Icons | lucide + react-icons + `ph-*` | Phosphor (`@phosphor-icons/react`) |
| Design | legacy `tnm2` / `--tnm-*` classes | locked Clinical Dark `@theme` tokens |
| Data | `@workspace/api-client-react` hooks | RSC `await` + the same hooks |

A React Router route module cannot be mounted as a Next `page.tsx` unchanged. The
**backend is shared**, though: every legacy route is already backed by an
api-server endpoint, so this migration ports **presentation only** — never
data or business logic.

---

## 1 · Excluded from scope (decided)

- **`admin/*`** — 18 internal console routes, behind admin auth (decision 1: **out**).
  They mix a different trust boundary (`AdminAuthLayout`/`RdAuthLayout`, operator
  sessions) and heavy operator tooling (KDS, forecasting, AI-run inspectors) that
  has no place in the customer IA. If admin ever moves to Next it is its own
  program with its own auth layer, not part of this port.
- **`/cart`** — the storefront uses a cart **drawer** + mini-bar by design, not a
  page (decision 2: **stay a drawer**). `/checkout` already serves the review step,
  and `/group/:code` (Wave E) covers the one shareable-cart need. Revisit only if a
  concrete share-a-cart requirement appears.
- **`stitch/*`**, **`rd-console`** — prototype / internal.

---

## 2 · Per-route port recipe (apply identically to every route)

This checklist is what keeps 43 pages consistent.

1. Read legacy `pages/X.tsx` (meta wrapper) + `tanmatra-v2/X.tsx` (real content).
2. Create `app/<route>/page.tsx` as an **RSC**; push interactivity into small
   `"use client"` islands.
3. **Router swap:** `react-router` `Link` / `useNavigate` / `useParams` / `meta`
   → `next/link` + `useRouter` + RSC `params` + `generateMetadata`.
4. **Data:** reuse the shared `@workspace/api-client-react` hooks or server
   `await` against `/api`; never re-derive backend logic; **server owns all
   amounts** (no client-sent prices).
5. **Design:** legacy `tnm2` / `--tnm-*` / `ph-*` markup → storefront `@theme`
   tokens + Tailwind; icons → Phosphor components; `tabular-nums` on clinical
   data (`.text-clinical-data`).
6. **SEO:** `metadata` / `generateMetadata`; add to `app/sitemap.ts`;
   `StructuredData` where relevant.
7. **IA wiring:** slot into `Header` / `BottomNav` / footer (Eat · Plan · Track ·
   Community · Account) **and** register in the `⌘K` `CommandPalette`.
8. **Redirects:** legacy → new path redirects in `next.config.ts` (e.g.
   `/orders` → `/account/orders`) so existing links and SEO survive.
9. **Gates (all green before PR):** file-cap (`scripts/lint-filecap.ts`,
   components ≤150 / files ≤300 — split sections) · color/price/token lint ·
   `pnpm run typecheck` · tests · storefront prod build.
10. **Tests:** content pages → render/route test; money-path pages → DB-backed
    test registered in the `money-integration` job of `.github/workflows/verify.yml`.

---

## 3 · Wave sequencing & tracker

Status legend: ⬜ not started · 🟡 in progress · ✅ merged & deployed.

| Wave | Status | Routes | Count | ⚠ Hazard | Task |
|---|---|---|---|---|---|
| **A** Static content | ⬜ | `about` · `terms` · `privacy` · `refunds` · `faq` | 5 | none | #54 |
| **B** Marketing/landing | ⬜ | `metabolic` · `premium` · `care/:condition` · `partners/gyms` · `partners/fitness-clubs` · `corporate-wellness` · `subscription-plans` · `wellness` · `performance` · `clinical` | ~10 | `wellness` is data-heavy (421 lines, live queries) | #55 |
| **C** Community | ⬜ | `recipes(/:slug)` · `challenges(/:slug)` · `team(/:slug)` | 6 | light api data | #56 |
| **D** RD directory + booking | ⬜ | `rd` · `rd/:slug` · `plans/:slug` · `appointments` · **`checkout-appointment`** · `rd-partners` · `rd-partners/apply` | 7 | **MONEY PATH** | #57 |
| **E** Corporate / group | ⬜ | `corporate/:slug` · `corporate/invite/:token` · `corporate/:slug/lunch-planner` · `office-lunch/:id` · `group/:code` | 5 | **MONEY PATH** + token/code validation | #58 |
| **F** Marketplace | ⬜ | `marketplace` · `marketplace/:slug` | 2 | **MONEY PATH** | #59 |
| **G** Account extras | ⬜ | `account/billing` · **`account/health-information`** · `account/plan` · `vouchers` · `profile`→redirect | 5 | **PHI (`CLINICAL_KMS`)** + billing money | #60 |
| **H** Planning | ⬜ | `subscription/bridge` · `meal-planner` · reconcile `subscribe` / `plan-v2` vs existing `/plans`+`/plan/:id`+`/trial` | 3+ | **MONEY PATH** | #61 |

**Total ≈ 43 routes.**

### Path-rename map (already-built storefront equivalents)
These legacy paths already have a storefront home under `/account/*` or the
consolidated plan surfaces — they get **permanent (308) redirects** (decision 3),
not new pages or bare aliases. One canonical URL each → SEO/link-equity
consolidates, no duplicate-content risk. Centralised in `next.config.ts`
`redirects()` (baked at build → adding one is a redeploy).

| Legacy path | Redirect target (308) |
|---|---|
| `/orders` | `/account/orders` |
| `/rewards` | `/account/loyalty` |
| `/preferences` | `/account/preferences` |
| `/subscriptions` | `/account/subscriptions` |
| `/track` (bare — legacy order list) | `/account/orders` (the storefront keeps only `/track/:orderId`) |
| `/subscribe`, `/subscription-plans` | `/plans` + `/plan/:id` + `/trial` (Wave H reconciles) |

### Backend readiness (grounds decision 4)

Audit of `artifacts/api-server/src/routes/`: **most waves already have backend
routes to port against** — reuse existing endpoints by default; the client never
fabricates pricing.

| Wave | Backend already present | Gap → new endpoint (money-path lockstep + DB test) |
|---|---|---|
| C community | `recipes.ts` · `challenges.ts` · `community.ts` · `teamProfiles.ts` | — |
| E corporate/group | `groupOrders.ts` (+ `groupOrders.test.ts`) · `corporate.ts` · `b2bPlanner.ts` | verify `office-lunch`/`lunch-planner` coverage under `b2bPlanner`/`groupOrders` |
| F marketplace | `marketplace.ts` | — |
| H planning | `mealPlans.ts` · `subscriptions.ts` | — |
| B / D premium+RD | `premium.ts` · `wellness.ts` · `rdPartners.ts` · `rdAdvisory.ts` | — |
| **D appointments** | — | **no `appointment` route** → new booking + appointment-order endpoint (the one clear new-endpoint build; prerequisite slice before its UI) |
| **G vouchers** | — | no `voucher` route → build one or map onto `loyalty.ts` |
| **G billing** | `payments.ts` + `orders.ts` + `subscriptions.ts` | read-only aggregation; likely no new endpoint |
| **G health-information (PHI)** | `health.ts` is *liveness*, not PHI | identify the real CLINICAL_KMS-encrypted read/write endpoint (on subscription members) with PHI care |

**Rule:** reuse existing endpoints; when a wave hits a genuine gap, carve out a
separate api-server slice under the money-path lockstep (server owns every amount,
DB-backed test in `verify.yml`) — never let a UI port invent client-side money math.

---

## 4 · Cross-cutting workstreams (do once, every wave benefits)

- **IA / nav refactor** — extend `Header` / `BottomNav` / footer + `CommandPalette`
  to hold a real *Community* group and the new account tabs.
- **Central redirect map** in `next.config.ts` for all renamed paths.
- **SEO** — dynamic-route sitemap entries; canonical / OG per page.
- **Shared data** — legacy pages read local `@/lib/*` (teamData, protocols,
  rdPlans, rdBookingData); decide extract-to-workspace-lib vs copy per case.

---

## 5 · Definition of done

**Per route:** resolves `200` on the deployed dark-preview URL · matches Clinical
Dark · nav + `⌘K` + sitemap wired · legacy path redirects in place · test present
· all gates green.

**Per wave:** single PR · CI green · deployed to the dark-preview `storefront`
service · spot-checked on the live URL (the deploy-truth discipline: assert
`/api/build` sha, then curl the new routes).

---

## 6 · Resolved decisions

1. **Admin `/admin/*` (18 routes) — OUT of scope.** Separate trust boundary and
   operator tooling; stays on the legacy SPA. See §1.
2. **`/cart` — stays a drawer**, not a page. `/checkout` covers review;
   `/group/:code` covers shareable carts. See §1.
3. **Renamed paths — permanent (308) redirects**, one canonical URL each, no bare
   aliases. See the path-rename map in §3.
4. **Money-path waves — reuse existing api-server endpoints by default**; carve
   out a new endpoint slice (money-path lockstep + DB test) only where the audit
   shows a genuine gap. See the backend-readiness table in §3. Known new-endpoint
   work: **appointments (Wave D)**; open questions: vouchers + health-information
   PHI (Wave G).
5. **Sequencing — parallel tracks, not a serial chain** (see §7). The shared infra
   (nav / redirect map / sitemap) is front-loaded once as Track 0 to unblock and
   de-conflict everything; presentation waves then run concurrently and
   autonomously. Business priority only re-orders which parallel work starts
   first (RD? Corporate? Community/content for SEO?) — it does not serialise them.

---

## 7 · Execution acceleration (parallel tracks)

Optimised for **shortest wall-clock**. Waves are **not** a serial A→H chain — they
run as concurrent tracks. Independent routes touch disjoint files, so multiple
agents work in parallel; the only shared surfaces are front-loaded once so waves
never collide on them.

- **Track 0 — shared infra (first, once; unblocks & de-conflicts everything):**
  IA/nav refactor (`Header` · `BottomNav` · footer · `CommandPalette` to hold a
  *Community* group + new account tabs), central `redirects()` map, `sitemap.ts`
  plumbing. One PR. **Doing this first is the single biggest accelerator** — it
  stops every later wave from re-editing (and conflicting on) the nav files.
- **Track 1 — presentation waves A · B · C (parallel, autonomous):** pure leaf
  pages, no money, no PHI. Split across agents; branch/PR per wave (or per route);
  CI runs concurrently. **Pre-authorised — no per-wave approval.**
- **Track 2 — backend gap slices (start now, in parallel):** the long-pole
  dependencies — appointment booking+order endpoint (Wave D), voucher endpoint
  (Wave G). api-server, server owns amounts, DB test. Starting now keeps them off
  the UI critical path.
- **Track 3 — money-path UI waves D · E · F · H (once their backend is ready):**
  E/F/H reuse existing endpoints; D consumes the Track-2 appointment slice.
  **One checkpoint: money-path integration sign-off before merge.**
- **Track 4 — PHI route (`account/health-information`, Wave G):** decoupled so it
  never blocks the other ~42 routes. **One checkpoint: clinical / DPDPA review.**

**Checkpoints reduced to exactly two** (money-path sign-off · PHI review).
Everything else executes autonomously — no per-wave gating.

### Skip vs honour (so the agent wastes zero time)

**Removed friction — skip:** strict A→H ordering · per-wave "await go" pauses ·
one-wave-at-a-time serialisation · waiting for a green wave before starting the
next. Run concurrently on separate branches; let CI parallelise.

**Non-negotiable — honour (these are pro-speed, not ceremony; skipping them makes
delivery slower via rework / incidents / rollback):**
- **Server owns every amount; the client never sends a price.**
- **Money-path DB tests wired into `verify.yml`** (catch billing regressions
  pre-merge).
- **PHI encryption via `CLINICAL_KMS`** on `health-information` (a leak is a DPDPA
  breach, not a bug fix).
- **CI gates** (file-cap · typecheck · color/price/token lint · build) — enforced
  by CI regardless of this doc; honouring them up front avoids red-CI rework.

## 8 · Changelog

- _(unreleased)_ — execution acceleration (§7): reframed from a serial A→H chain
  to **parallel tracks** — Track 0 shared infra first (de-conflicts nav), Track 1
  presentation waves autonomous, Track 2 backend gap slices started in parallel,
  money-path and PHI decoupled behind exactly **two** checkpoints. Added an
  explicit skip-vs-honour list: process friction removed (serial ordering,
  per-wave approval pauses); safety guardrails kept (server-owns-price, money-path
  DB tests, PHI encryption, CI gates) because skipping them costs more time via
  rework/incidents than it saves.
- _(unreleased)_ — resolved the five open decisions (§6): admin **out**, cart
  stays a **drawer**, **308 redirects** for renamed paths, **reuse existing
  endpoints** (backend-readiness audit added to §3, appointment/voucher/PHI gaps
  flagged), and **Wave A first → then reorder B–H by business priority**.
- _(unreleased)_ — initial program plan authored; wave backlog created
  (tasks #54–#61). Branch `claude/storefront-parity-content` cut for Wave A.
