# Storefront route-parity port — program plan & tracker

**Scope:** port the ~43 customer-facing routes that exist on the legacy `tanmatra`
app (React Router v7 SSR) but are missing on the new `storefront` (Next.js 16 App
Router) — **natively**, as real RSC pages in the Clinical Dark design system, not
proxied.

This is a **program**, not a single change. It ships in risk-ordered waves, **one
PR per wave**, per the one-concern-per-PR rule in
[`AGENT_WORKING_AGREEMENT.md`](./AGENT_WORKING_AGREEMENT.md). Waves A–C are pure
presentation and move fast; D–H touch the money path or PHI and get the full
lockstep + DB-test treatment.

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

## 1 · Excluded from scope (override if wrong)

- **`admin/*`** — 18 internal console routes, behind admin auth. Separate app.
- **`/cart`** — the storefront uses a cart **drawer** by design, not a page.
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
consolidated plan surfaces — they need **redirects**, not new pages:

| Legacy path | Storefront path |
|---|---|
| `/orders` | `/account/orders` |
| `/rewards` | `/account/loyalty` |
| `/preferences` | `/account/preferences` |
| `/subscriptions` | `/account/subscriptions` |
| `/track` (bare) | `/track/:orderId` only (no index) |
| `/subscribe`, `/subscription-plans` | `/plans` + `/plan/:id` + `/trial` (Wave H reconciles) |

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

## 6 · Open decisions

1. **Admin `/admin/*` (18 routes)** — confirmed **out of scope**? (recommend: yes)
2. **`/cart`** — keep as drawer (recommend) or add a page?
3. **Renamed paths** — redirect legacy → `/account/*` (recommend), or also expose
   bare aliases?
4. **Money-path waves (D/E/F/H)** — port UI against **existing** api-server
   endpoints only, or are new/changed endpoints in scope? (recommend: reuse
   existing, flag gaps)
5. **Order** — strict A→H, or pull a business-priority domain forward?

---

## 7 · Changelog

- _(unreleased)_ — initial program plan authored; wave backlog created
  (tasks #54–#61). Branch `claude/storefront-parity-content` cut for Wave A.
