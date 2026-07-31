# Web App Enhancement Plan — Tanmatra Storefront

**Date:** 2026-07-31 · **Method:** direct code inspection (12 files read in full, 6 independent
fact-check passes against live source) across `artifacts/storefront`, `artifacts/tanmatra`,
`lib/tokens`, `lib/themes`, `.github/workflows/*.yml`, and the repo's own audit corpus
(`docs/ux-ui-audit.md`, `docs/design-code-parity-audit.md`, `docs/illogical-instances-register.md`,
`docs/ASTRYX-TOKEN-MAP.md`, `docs/ASTRYX-ADOPTION-RUNBOOK.md`, `docs/DOMAIN-CUTOVER.md`,
`docs/AGENT_WORKING_AGREEMENT.md`). Every specific claim below cites the file/line it came from;
anything not directly verified is labeled **[verify]** rather than asserted.

**App type:** clinical-grade meal-subscription + on-demand food e-commerce, India (Noida NCR
delivery zone). **Primary users:** mobile-first, health/diet-conscious urban consumers ordering
on a phone, some engaging RD (registered dietitian) consultations. **Secondary users:** B2B
buyers (corporate HR leads, gym/fitness partners) hitting marketing/lead-capture surfaces, and
internal ops/kitchen/RD staff who now use a *separate* internal console (see Scope below).

---

## Scope-determining finding (read this before anything else)

**`artifacts/storefront` (Next.js 16.2 App Router) is the live customer application at
`tanmatra.food` today — not `artifacts/tanmatra`.** This directly contradicts the current text of
`CLAUDE.md`, which still says the storefront is "a dark preview" with "no domain mapped" and
that "`tanmatra.food` still resolves to the `tanmatra` service." That claim is stale:

- `docs/DOMAIN-CUTOVER.md` (last touched 2026-07-27): *"Status: complete... `tanmatra.food` and
  `www.tanmatra.food` are served by the storefront Cloud Run service"* — verified externally via
  matching `/api/build` sha **and** `builtAt`-to-the-millisecond between the domain and the
  storefront service.
- `artifacts/tanmatra/src/routes.ts` (last touched 2026-07-26) registers **only** Admin-ERP and
  RD-console routes — no `/menu`, `/cart`, `/checkout`, `/dish/:slug`. Its own CI contract test,
  `e2e/specs/erp_shell.spec.ts`, states outright: *"The consumer surface (menu/cart/checkout/orders)
  was removed from this SPA; tanmatra.food serves the Next.js storefront, and this service is an
  internal-only container for the Admin ERP and the RD console."*
- `CLAUDE.md` was itself last modified 2026-07-30 — **three days after** the cutover doc — and
  still carries the stale claim. This plan corrects the two affected `CLAUDE.md` passages as a
  small side-fix alongside this document (see the diff in this PR), so future readers (human or
  agent) aren't misled about which app is live.

**Consequence for scope:** every responsiveness/performance/design-system recommendation below
targets `artifacts/storefront`. The legacy `artifacts/tanmatra` app's ~50 customer pages and the
`tanmatra-v2` rebuild are now **orphaned, unrouted code** — not touched here, but treated as
**reference material**: that codebase already solved several UX problems (focus-trapped drawers,
mirrored motion tokens, tabular-nums, CLS-reserved skeletons) that the storefront hasn't gotten to
yet, per its own audit (`docs/ux-ui-audit.md`, dated 2026-07-21 — written when that code was still
live, now describing dormant prior art rather than production behavior). Porting proven patterns
beats re-deriving them from scratch, and is called out explicitly where relevant below. The legacy
app's new identity as an **internal Admin ERP + RD console** gets one paragraph of its own,
scoped-down guidance in the Phased Rollout section — internal tools have different UX priorities
(data density over marketing polish, desktop-first) and don't belong in a customer-responsiveness
plan. `artifacts/tanmatra-mobile` (Expo) is a different technology stack entirely and out of scope
for a *web* app plan.

---

## Executive Summary

The storefront's architecture is sound — server components, a token-bridged Tailwind v4 setup,
money-path discipline (`cache:"no-store"` on every authenticated read, server-issued Razorpay
`keyId` only), and CI lint gates (`lint:filecap`, `lint:tokens`, `lint:component-drift`) that
already prevent the kind of two-design-system drift and cross-surface pricing disagreement its own
sibling app accumulated (`docs/ux-ui-audit.md`'s H1/H2 findings; `docs/illogical-instances-register.md`'s
A1–A11). What it's missing is exactly what a fast-shipped "Phase 1" rebuild defers: **breakpoint
discipline beyond a single 768px chrome-switch, image optimization (zero `next/image` usage
anywhere, `images.unoptimized:true`), a working notch/safe-area implementation (the viewport meta
never sets `viewport-fit: cover`, so the app's own `env(safe-area-inset-bottom)` CSS is currently a
silent no-op), a user-facing dark mode (wired via `next-themes` but `enableSystem:false` and no
toggle exists), meaningful offline handling (the shipped `sw.js` is a kill-switch, not a cache),
and any performance instrumentation in CI (zero Lighthouse/bundle-budget/Core-Web-Vitals gates
exist across all ten `.github/workflows/*.yml` files).** None of this is a rewrite — every item
below is additive or a small, scoped correction, prioritized so the near-zero-risk fixes land
first and the structural ones (image CDN strategy, token-system consolidation) get their own
deliberate phase.

---

## Responsive Strategy

### Breakpoint strategy — keep Tailwind v4's default scale, use it fully

`lib/tokens/src/tokens.css` defines **no breakpoint tokens** (`--bp-*`, `--screen-*`) — all
responsive behavior rides Tailwind v4's unmodified default scale, applied via a CSS-first config
(`@import "tailwindcss"` in `app/globals.css:1`, confirmed zero `tailwind.config.{js,ts}` anywhere
in `artifacts/storefront`). In practice the app is architected around **one** breakpoint:

| Breakpoint | Width | Current real usage | What actually changes today |
|---|---|---|---|
| *(base)* | 0–639px | — | Mobile layout, `MobileBottomNav` visible, desktop nav hidden |
| `sm` | 640px | ~225 occurrences, 76 files | Micro-adjustments inside components (gap/padding tweaks) — not a layout tier |
| `md` | 768px | ~75 occurrences, 42 files | **The only architectural breakpoint**: `Header.tsx:47` desktop links (`hidden md:flex`), `MobileBottomNav.tsx:88` (`md:hidden`), `Footer.tsx:25` (`max-md:hidden`) |
| `lg` | 1024px | ~47 occurrences | Grid column-count bumps in places, no chrome/layout logic |
| `xl` | 1280px | 1 occurrence (incidental, a variant name in `button.tsx`) | Nothing |
| `2xl` | 1536px | 0 occurrences | Nothing |

**Recommendation: don't introduce a custom breakpoint scale** — that would force a rewrite of
~350 existing prefix usages for no behavioral gain. Instead, close the gap the task's own target
range (320/768/1024/1440) exposes: **the app currently has zero defined behavior above 768px
beyond incremental grid tweaks**, so a 1440–2560px viewport gets a mobile-derived layout stretched
into excess whitespace rather than a deliberate wide-desktop treatment. Concretely:

1. **Cap prose/marketing content width** at `xl` (1280px) — dish detail body copy, FAQ, landing
   sections — centered, not stretched. Never let running text approach `2xl`.
2. **Let genuinely dense surfaces earn the extra room at `lg`/`xl`** — the menu grid, order
   history, plan comparison — add real column-count increases at `lg:grid-cols-3 xl:grid-cols-4`
   rather than one fixed column count everywhere, since today `xl`/`2xl` do nothing.
3. **Adopt Tailwind v4's native container queries (`@container`, `cqw`) for card-level components**
   (`DishCard`, `PlanCard`) instead of adding more page-level breakpoints. These cards render in
   different contexts (full grid, sidebar rail, modal) — container queries let one card component
   reflow correctly in all three without a parent-aware prop. This is a genuinely new capability
   for this codebase (confirmed zero `@container` usage today) and is the correct tool for the
   "cards look wrong in a narrow sidebar" class of bug rather than another `md:` override.

**Pitfall:** don't reach for a `2xl:` prefix as the first fix for "looks empty on a big screen."
Nothing today reads that variable, so a `2xl:` class added to one component is invisible unless
the container-width strategy above lands first — you'd be styling a breakpoint the layout shell
doesn't yet respect.

### Mobile-first — already the de facto policy; make it explicit

Every signal in the repo points mobile-first, and none contradicts it: Tailwind's prefixes are
inherently min-width (mobile-first) unless a project overrides the variant direction, and no such
override exists here; `e2e/playwright.config.ts:31-33` comments the `mobile` (Pixel 7) project is
what "the wave gates run"; 44px touch targets (`.touch-target-min`, `globals.css:218-224`) and
safe-area utilities are baked into the global stylesheet, not bolted on per-component; and the
domain itself (on-demand food delivery, India) is an overwhelmingly phone-driven category. **No
in-repo analytics/telemetry exists to cite a literal device-split percentage** — don't fabricate
one — but there's no signal pointing the other way either. Recommendation: formalize "mobile-first,
desktop as a widened progressive enhancement" as written policy in `CLAUDE.md`'s storefront
section (it's currently implicit, never stated), so new component work defaults to designing the
base (mobile) styles first and layering `md:`/`lg:` on top, matching what the codebase already does.

### Touch targets, tap gestures, hover, keyboard

- **Touch targets**: `.touch-target-min` (44×44px, `globals.css:218-224`) is the storefront's
  standard — matches WCAG 2.2 AA. The legacy app's `.touch-target-48` (48dp, AAA-strength) is
  stricter than the storefront needs as a baseline; don't import it wholesale, but **do** apply
  48px to the handful of money-path-critical controls (checkout Pay button, quantity steppers) —
  the same Fitts's-law reasoning the legacy audit used to recommend a shared `<QuantityStepper>`.
- **Hover**: this is a touch-primary app; audit any `hover:` utility used to reveal essential
  information or actions (a hover-only affordance is invisible on touch). Gate decorative hover
  polish behind `@media (hover: hover) and (pointer: fine)` so it's additive on desktop, never
  load-bearing on mobile. **[verify]** — no direct evidence found of a hover-only-essential-action
  bug today; this is a standing convention to enforce going forward, not a confirmed defect.
- **Keyboard navigation**: the global focus-visible ring is a real strength — element+pseudo
  selector `a, button, input, select, textarea, [tabindex]:focus-visible` (`globals.css:162-171`)
  outranks any `outline-none` utility, and resolves to `--ring: var(--gold-text)` (the AA-safe
  4.9:1 gold variant, not raw gold, which only clears 2.1:1) so the ring itself passes WCAG
  1.4.11's 3:1 non-text-contrast minimum. A skip link exists (`app/layout.tsx:198-203`, `Skip to
  main content` → `#main`). **Gap:** `components/theme-provider.tsx` and the Header's `⌘K`
  `CommandMenu` island exist, but focus-trap behavior on the mobile account bottom-sheet
  (`MobileBottomNav.tsx:137-196`) and the `vaul`-based drawers isn't independently confirmed here
  — **[verify]**: audit that opening any sheet/drawer moves focus in and restores it on close
  (the legacy app's `useDialogA11y.ts` hook is a ready-made reference pattern for the trap+Escape+
  restore behavior if a gap is found).

### Notches, safe areas, dynamic viewport units — one confirmed bug, one confirmed gap

**Confirmed bug:** `app/layout.tsx:93-97` exports `viewport: Viewport = { width: "device-width",
initialScale: 1, themeColor: THEME_COLOR.light }` — **it never sets `viewportFit: "cover"`**.
Without that, `env(safe-area-inset-*)` resolves to `0` on notched/Dynamic-Island devices, which
means the app's own safe-area CSS (`.pb-safe`/`.mb-safe` in `globals.css`, and the fixed
`pb-[calc(4rem+env(safe-area-inset-bottom))]` on `<body>` compensating for `MobileBottomNav`) is
**currently a silent no-op on the exact devices it was written for**. This is a one-line, near-zero-risk
fix: add `viewportFit: "cover"` to the `Viewport` export.

**Confirmed gap:** grep across the whole storefront for `100vh`/`h-screen`/`min-h-screen` vs.
`dvh` variants found **18 occurrences of `min-h-screen` across 15 files** (`app/checkout/page.tsx`
alone has 3, plus `app/menu/page.tsx`, `app/dish/[slug]/page.tsx`, `app/page.tsx`, `app/login/page.tsx`,
and 10 more) and **zero** occurrences of `min-h-dvh`/`h-dvh`/`100dvh`. This is the identical defect
class the legacy app's own audit flagged as High-severity (`docs/ux-ui-audit.md` H3: "`100vh` on a
mobile-first app... iOS Safari's address bar makes `100vh` overshoot → content clips / bottom CTA
hides"). It reappeared independently in the storefront. **Fix:** mechanical sweep,
`min-h-screen` → `min-h-dvh` across the 15 files (Tailwind v4 ships `dvh` utilities natively — no
plugin needed). Verify visually on `/checkout` specifically, since 3 of the 18 sites are there and
it's the one screen where a clipped bottom CTA is a lost order, not just a cosmetic bug.

### Font scaling & image optimization

**Fonts:** `next/font/google` self-hosts IBM Plex Sans (400/500/600/700, `display:"swap"`) and
JetBrains Mono (400/500) for tabular data, exposed as CSS vars and folded into `--font-sans`/
`--font-mono` in `globals.css:74-77` — this is already correct (two families, `swap`, self-hosted,
subsetted to `latin`). The type scale (`lib/tokens/src/tokens.css:56-62`) is fixed-rem for five
sizes and `clamp()`-fluid only for the two largest (`text-2xl`, `text-3xl`). **Recommendation:**
extend fluid clamp-scaling one step further down to `text-xl`/`text-lg` — headings at those sizes
are exactly where a 320px phone and a 1440px desktop should read at visibly different scale, and
today they don't.

**Images — the largest concrete gap in this plan.** Verified: `next.config.ts:96` sets
`images: { unoptimized: true }`; there is **no `next/image` usage anywhere** in `app/` or
`components/` (three TODO comments — `DishCard.tsx:93`, `TrialStart.tsx:93`, `OrderBump.tsx:64` —
already flag this as "lands in a later phase"); every real image is a plain `<img>` with a fixed
box, `loading="lazy" decoding="async"`, and decorative `alt=""`. Dish photography (~280 JPGs,
~196MB) isn't even in the storefront's own deploy image — `next.config.ts:34-51` rewrites
`/images/:path*` to the **legacy `tanmatra` Cloud Run service's** `public/` directory at build
time, meaning the live customer app's imagery depends on keeping an internal-only admin tool
deployed and healthy. `docs/DOMAIN-CUTOVER.md` §4 already flags this as an open, undecided
question ("move the image assets and retire the [legacy] service, or keep it and say so").

**Recommendation (concrete, not a menu of options):** adopt `next/image` with a **custom loader**
targeting the existing `/images/*` rewrite path, appending width/quality query params the loader
constructs — this gets responsive `srcset`/`sizes` generation and lazy-loading-by-default without
waiting on the upstream decision. In parallel, treat the DOMAIN-CUTOVER.md open question as a
Tier-3 architectural item: move dish photography off the legacy Cloud Run service onto a real
asset host (Cloud Storage + Cloud CDN, or an image CDN) so the live customer app's imagery isn't
structurally dependent on an internal ops tool staying deployed. Sequence it that way — loader
first (unblocks perf gains immediately), asset-host migration second (removes the architectural
dependency) — rather than blocking image optimization on the bigger decision.

---

## Performance Blueprint

### Targets

| Metric | Official "Good" threshold | This plan's target |
|---|---|---|
| LCP | < 2.5s | < 2.5s |
| INP | < 200ms (Google's actual CWV "good" band) | < 100ms stretch target per this task's brief, treat 200ms as the hard floor |
| CLS | < 0.1 | < 0.1 |
| Animation frame budget | 16.6ms/frame (60fps) | same |

*(Flagging the INP nuance rather than silently restating an inaccurate number: Core Web Vitals'
published "good" INP threshold is 200ms, not 100ms. Chase 100ms as the ambition — it's achievable
given the app's interactions are mostly simple taps, not heavy client computation — but don't gate
a release on it if 150–200ms shows up on a genuinely complex screen like checkout.)*

### Current bottlenecks (verified, not estimated)

| Area | Finding | Evidence |
|---|---|---|
| Images | Zero `next/image`, no responsive `srcset`, `images.unoptimized:true` | `next.config.ts:96`; confirmed via grep across `app/`, `components/` |
| Code splitting | Exactly **one** `next/dynamic` split point in the whole app (`LocationPickerMap` behind `LocationPickerFlow.tsx:8-11`, correctly isolating `leaflet`/`react-leaflet`) | grep for `next/dynamic` and `React.lazy` across storefront |
| Route-level loading UX | **Zero** `loading.tsx` files under `app/` anywhere | `Glob app/**/loading.tsx` → no matches. Every route's data fetch blocks full-page render; the 7 files using `Suspense` do so mainly to satisfy `useSearchParams()`'s requirement, not for progressive reveal |
| Data-fetch caching | Every cookie-authed read goes through `lib/apiClient.ts`'s `apiRequest()`, which **always** sends `cache:"no-store"` (correct for personalized/session data, but means zero edge-cacheability for account/order/subscription pages by design) | `apiClient.ts:35-42` |
| Public-data caching | `catalog.ts`, `teamApi.ts`, `recipesApi.ts`, `challengesApi.ts`, `rdApi.ts` use `next:{revalidate:3600}`; ~15 `page.tsx` files export `revalidate = 3600` at the route-segment level | grep confirmed across `lib/*Api.ts` and `app/**/page.tsx` |
| Observability overhead | Sentry `tracesSampleRate: 1` (100% trace sampling, no reduction) in **all three** configs — client, server, edge | `sentry.client.config.ts:5`, `sentry.server.config.ts:5`, `sentry.edge.config.ts:5` |
| Bundle | Two icon libraries shipped simultaneously (`lucide-react` + `@heroicons/react`); `motion` (Framer Motion successor, ^12.42.2) is a full dependency used in only 2 files (`drawer.tsx`, `PlanCard.tsx`), not dynamically imported so it isn't tree-shaken out of routes that don't need it | `package.json:16-51`; grep for `from "motion"` |
| CI perf gates | **Zero** references to "lighthouse," "web-vitals," "Core Web Vitals," or a performance budget across all 10 `.github/workflows/*.yml` files. A Lighthouse script exists (`scripts/src/lighthouse-audit.mjs`) but targets `LH_BASE=http://localhost:80` and includes `/cart` — a route the storefront itself 308-redirects away from — meaning it targets the *legacy* app, is orphaned, and isn't wired into any workflow | grep across `.github/workflows/*.yml`; `lighthouse-audit.mjs:7-15` |
| CDN / caching headers | Storefront deploys as a bare Cloud Run service (`--allow-unauthenticated`, 512Mi/1cpu) with no CDN, no `Cache-Control` headers set anywhere in `deploy.yml`'s `storefront-cloud-run` job | `deploy.yml:772-786` |

### Strategy

**Lazy loading & code splitting.** Add `next/dynamic` (`ssr:false` where the component is
genuinely client-only) for: anything importing `motion`/`vaul` that renders below the fold
(drawers, plan comparison animations); any future map/chart/rich-media component, following the
`LocationPickerMap` precedent already in the codebase — it's the right pattern, just under-applied.
Add `loading.tsx` files to the highest-traffic data routes first: `/menu`, `/dish/[slug]`,
`/account/orders`, `/checkout`. Build the skeletons to reserve the exact final layout's height (the
legacy app's `.tnm2 .skel` shimmer and CLS-reserved placeholders are a proven, ready-to-port
reference — `docs/ux-ui-audit.md` calls this out as a genuine strength worth keeping).

**Asset optimization.** Follow the image plan above (custom `next/image` loader). Pick **one** icon
library for hand-authored components (audit actual usage counts first — don't guess which is more
used) and keep the other only where an Astryx template imports it verbatim (per the repo's own
DS-0 decision, both are intentionally allowed for template compatibility — this isn't a violation
to "fix," just a de-dup opportunity for non-template code).

**CSS containment & GPU compositing.** Neither `will-change` nor CSS `contain` appears once in
`globals.css` or `layers.css` today. Add `contain: content` to card-grid containers (menu grid,
plan grid) so a re-render inside one card doesn't force layout recalculation across the whole
grid. Add narrow, removed-after-use `will-change: transform` only to the handful of components
that actually animate via `motion` (2 files today) — never apply it globally, and never to
`opacity`/`transform`-only CSS transitions, which are already compositor-friendly without it.

**Offline / service worker — a narrow, money-path-safe strategy, not a full PWA rewrite.** The
shipped `public/sw.js` (19 lines) is deliberately a **kill switch**: it calls `skipWaiting()` on
install, then on activate deletes every cache, unregisters itself, and force-navigates open tabs —
its own header comment states "the rebuild storefront never registers a service worker of its
own." Contrast: the *legacy* app (`artifacts/tanmatra/public/sw.js`) has a real one — cache-first
for static assets, network-first-with-offline-fallback for navigations, **network-only for
`/api/*`** — but that app is no longer customer-facing, so that resilience is currently
inaccessible to real customers. **Recommendation: build a new, narrow service worker for the
storefront that precaches only the static shell (fonts, marketing/legal pages, icons) and an
offline fallback page — and explicitly, permanently excludes `/api/*`, `/checkout`, and
`/account/*` from any cache strategy**, mirroring the one part of the legacy SW worth keeping.
This is a hard line, not a starting point to loosen later: `docs/LIVE-CUTOVER.md` and
`docs/AGENT_WORKING_AGREEMENT.md` both establish that **the server owns every amount** and nothing
is charged client-side — a cached stale price or stale availability state on the money path is a
correctness bug, not a performance win. Pair the SW with the legacy app's `NetworkStatusToast`
pattern (a global online/offline indicator) so a dropped connection shows an honest "you're
offline" state instead of a blank screen or a stuck spinner.

**Performance CI gate.** Repoint `scripts/src/lighthouse-audit.mjs` at the storefront's real routes
(`/`, `/menu`, `/dish/[a-real-slug]`, `/checkout`, `/account`) instead of the legacy app's port-80
target, and wire it into `.github/workflows/storefront.yml` as a **non-blocking** step first (so a
baseline is established without immediately red-gating the pipeline), then flip it to blocking
once 2-3 weeks of baseline data exist. Concrete starting budgets (per this repo's own `web/performance.md`
convention): landing-style routes (`/`, marketing/partner pages) < 150KB gzipped JS / 30KB CSS;
app-style routes (`/menu`, `/checkout`, `/account/*`) < 300KB gzipped JS / 50KB CSS.

**Pitfall — don't cache the money path.** Any future change to `apiClient.ts`'s blanket
`cache:"no-store"` must stay scoped to genuinely public, non-personalized reads (menu catalog,
recipes, team/RD directory — the existing `revalidate:3600` pattern). Never relax caching on
`/checkout`, `/account`, `/orders`, or anything reading the authenticated session — this is the
same invariant `docs/AGENT_WORKING_AGREEMENT.md` §2 encodes for the pricing "lockstep" rule, just
applied to caching instead of GST math.

---

## Design System Specification

### The token architecture today is two parallel systems, bridged — consolidate toward Astryx

Two independent token sources exist and are deliberately layered together:

1. **`@workspace/tokens`** (`lib/tokens/src/tokens.css`) — the older, hand-authored system.
   Light-default (`:root`), dark opt-in (`:root[data-theme="dark"]`). Locked brand accents
   (identical both themes): `--gold:#d4af37`, `--gold-text:#8a6d1f` (4.9:1 AA-safe foreground —
   raw gold is only 2.1:1), `--blue:#6ba3c8`, `--sage:#7d9e7e`. Radii `--radius-sm:6px /
   -md:10px / -lg:16px / -xl:22px / -full:999px`. Motion `--duration-fast:150ms`,
   `--duration-normal:240ms`, `--ease-out:cubic-bezier(0.16,1,0.3,1)`. Exactly **one** spacing
   token exists: `--space-section: clamp(2.5rem, 1.5rem + 4vw, 5rem)` — everything else spacing-wise
   rides raw Tailwind utilities (`p-4`, `gap-6`), not a token.
2. **Astryx** (`lib/themes/tanmatraTheme.ts` → generated `lib/themes/tanmatra.css`, scoped via
   `@scope ([data-astryx-theme="tanmatra"])`) — the design-system-owner-decided direction
   (`CLAUDE.md`'s DS-0 decision, 2026-07-27). Light/dark accent tuples, e.g.
   `--color-accent: ['#7F6921', '#D4AF37']` — note this is a **different light-mode gold**
   (`#7F6921`, 4.96:1 AA) than `@workspace/tokens`' `#d4af37` used directly; both are individually
   AA-compliant but they are not the same value, which is exactly the kind of thing that drifts
   silently. Astryx also carries a fuller primitive scale than `@workspace/tokens` does: 3-tier
   shadows (`--shadow-low/-med/-high` vs. the older system's 2-tier `-card/-raised`), and a finer
   radius ladder (`--radius-none/-inner/-element/-container/-page`).

`app/globals.css:21-78` bridges `@workspace/tokens` onto shadcn/Radix semantic names
(`--primary: var(--gold)`, `--ring: var(--gold-text)`), and `layout.tsx:21` separately loads the
Astryx bridge (`lib/themes/tanmatraBridge.css`) *after* the Astryx sheets so its unlayered rules
outrank their layered defaults — `globals.css:80-85` carries an explicit inline warning against
re-adding `var(--color-*)` reads there, because that exact "improved" pattern previously caused
Tailwind's theme layer to override brand tokens with neutrals and ship white-on-white gold buttons
(the incident is documented in `docs/ASTRYX-ADOPTION-RUNBOOK.md` §3 as a cautionary tale). This is
a real, working system today — but it's fragile by construction (a manual, order-dependent bridge
with a documented "last-writer-wins" failure mode), and it's asking new contributors to know which
of two token systems is authoritative for a given property.

**Recommendation (one direction, not a menu): treat Astryx as canonical going forward.** It's the
system the repo owner explicitly chose for the storefront (DS-0), it has the more complete
primitive scale, and it already carries a real automated contrast test
(`tanmatraTheme.test.ts` — genuine WCAG relative-luminance math against every text-token pair in
both themes, not a lint heuristic). Scope `@workspace/tokens` down to what it's uniquely needed
for — cross-package/non-DOM consumption (JS-side animation values, anything shared with the
legacy `tanmatra` app or future native work) — rather than having it compete with Astryx for the
same DOM-facing semantic properties. Concretely: new component work reads Astryx's semantic
variables directly; don't add new entries to `@workspace/tokens` that duplicate an Astryx
primitive. Document the two-system boundary explicitly in the styleguide (it isn't today) so this
isn't tribal knowledge.

### Color palette (light/dark) — already AA-verified, just needs a real toggle

The full Astryx contrast matrix (`docs/ASTRYX-TOKEN-MAP.md`) already passes AA on every pair:

| Token | Light | Contrast | Dark | Contrast |
|---|---|---|---|---|
| Accent (gold) | `#7F6921` | 4.96:1 | `#D4AF37` | 9.12:1 |
| Blue | `#2D6A8F` | 5.14:1 | `#6BA3C8` | 7.03:1 |
| Sage | `#3D5C3E` | 5.45:1 | `#7D9E7E` | 6.45:1 |
| Warning | `#7A5E12` | 5.22:1 | `#D8B45E` | 8.11:1 |
| Danger | `#8C3214` | 5.81:1 | `#C2603F` | 4.85:1 |

**Gold is the only interactive color** — per `docs/ASTRYX-ADOPTION-RUNBOOK.md` §3, Astryx
templates and their native accent colors (status badges, colored Cards, success/warning/error
states) are adopted verbatim *except* the primary CTA, which always repoints to gold. This is
documented as a manual review caveat, deliberately not a `lint:tokens` rule (the tool can't
reliably tell a primary CTA from a secondary action) — keep enforcing it at review time, not by
trying to automate it.

**The actual gap:** dark mode has real infrastructure (`next-themes` via
`components/theme-provider.tsx`, `attribute="data-theme"`) but **no way for a user to reach it** —
`enableSystem={false}` (theme-provider.tsx:23) means OS preference (`prefers-color-scheme`) is
never read at all, `defaultTheme="light"` is hardcoded, and `layout.tsx:168` stamps
`data-theme="light"` server-side. A second, independent mechanism (`data-stitch="dark"`) forces
dark on a specific route allowlist via a client-side pathname match — deliberately not server-side,
since reading `headers()` server-side would drop the app from ~50 statically-prerendered routes to
2. **Recommendation:** flip `enableSystem: true` so OS preference is respected by default, and add
an explicit toggle (Header or Account settings) for users who want to override it — the
infrastructure to do both already exists, it's just switched off.

### Spacing, radius, shadow — don't invent a parallel scale, formalize what's already used

**Spacing:** don't build a custom 8pt token ladder — Tailwind's default spacing scale (4px
increments) is already the de facto system used everywhere in the codebase; inventing a second,
token-backed scale would just create a third thing to keep in sync. Instead, **document** "Tailwind's
default spacing scale is the spacing system" explicitly in the styleguide, and reserve custom
properties in `tokens.css` for genuinely irregular values like `--space-section`'s fluid clamp,
which Tailwind's fixed scale can't express.

**Radius:** consolidate on Astryx's finer 5-tier ladder (`-none/-inner/-element/-container/-page`)
as canonical per the token-system recommendation above; keep `@workspace/tokens`'s simpler
`-sm/-md/-lg/-xl/-full` only where a component still reads it directly, migrating opportunistically
rather than in one sweep.

**Shadow:** same call — Astryx's 3-tier `-low/-med/-high` is more complete than
`@workspace/tokens`'s 2-tier `-card/-raised`; treat the latter as deprecated for new work.

### Component-level consistency

- **Delete `components/BottomNav.tsx`.** Verified dead code: `app/layout.tsx:34,210` imports and
  renders `MobileBottomNav`, not `BottomNav`; grep across the entire storefront finds zero imports
  of `BottomNav` anywhere except the file's own `export function BottomNav()` declaration — every
  other hit is a comment or doc-string referencing it conceptually. This is a fully-built,
  functioning duplicate mobile nav that nothing renders — pure maintenance risk (a future edit to
  "the" nav has a 50% chance of hitting the wrong file) with zero behavioral cost to remove.
- **Expand the styleguide** (`app/styleguide/page.tsx`). It currently documents color swatches, the
  7-step type scale, radii, and a handful of components — but has **no breakpoint matrix, no
  motion/duration showcase, no focus-state showcase, and no dark-mode side-by-side** (the color
  swatches read live `var()` values but require manually flipping the `data-theme` attribute on
  the document — no in-page toggle). Once the dark-mode toggle above ships, wire it into the
  styleguide too.

---

## UX/UI Pattern Library Plan

### Hierarchy & scannability

Keep and extend the `.tabular` convention (`font-variant-numeric: tabular-nums` + mono font,
`globals.css:151-154`) for every price/macro/count — this is already the documented CLAUDE.md
convention; audit that every new money/data surface actually applies the class rather than relying
on default number rendering.

### Feedback & affordance — the largest UX gap alongside images

**Zero routes use Next's `loading.tsx` streaming mechanism** — confirmed via `Glob app/**/loading.tsx`
returning no matches anywhere in the app directory. Every data-dependent route (menu, dish detail,
orders, account) blocks full-page render until its `await` resolves; the handful of `Suspense`
boundaries that do exist are there to satisfy `useSearchParams()`'s hydration requirement, not to
progressively reveal content. **Fix, in priority order:** `/menu` and `/dish/[slug]` first
(highest traffic, highest bounce-risk if slow), then `/account/orders` and `/checkout`. Build
skeletons that reserve the exact final layout height — port the legacy app's CLS-reserved skeleton
pattern (`.tnm2 .skel` shimmer, fixed-height placeholder classes) rather than a generic
`animate-pulse` block, which the legacy audit specifically flagged as *not* shaped to content in
its own base `Skeleton` component.

### Navigation patterns

Fix the `BottomNav.tsx`/`MobileBottomNav.tsx` duplication (above) before touching mobile nav
further — any change to "the" bottom nav today has a real chance of landing in the dead file.
Audit the `⌘K` `CommandMenu` island's route coverage against the legacy app's `NAV_ROUTES` registry
(`CommandPalette.tsx:58-99`, ~30 routes across Eat/Plan/Track/Community/Account) as a model for
comprehensive keyboard-driven navigation — **[verify]**: no direct evidence on the storefront
`CommandMenu`'s current route coverage was gathered in this research pass; audit it against that
groupings model rather than assuming parity. **[verify]** breadcrumbs on deep nested routes
(dish detail, account sub-pages) — not directly checked; add if absent, since the app's IA has
real depth (`/account/orders`, `/account/addresses`, `/account/subscriptions`, etc.).

### Accessibility — WCAG 2.2 AA (a superset-compatible upgrade from the task's 2.1 AA floor)

**Real strengths to preserve, not rebuild:** the global focus-visible ring (element+pseudo
specificity beating utility `outline-none`, resolving to the AA-safe `--gold-text` not raw gold),
the skip link, global `prefers-reduced-motion` handling (`globals.css:175-184`, zeroing all
animation/transition durations to `0.01ms`), 299 `aria-*`/`role=` occurrences across 130 files
(broad, not token adoption), and the genuinely automated contrast test in `tanmatraTheme.test.ts`.

**Confirmed gaps:**
1. `viewport-fit: cover` missing → safe-area CSS is a no-op on notched devices (see Responsive
   Strategy — this is as much an accessibility issue as a layout one, since it can hide content
   behind a device's rounded corners/home indicator for users who can't scroll to reveal it).
2. Dark mode ignores OS preference entirely (`enableSystem:false`) — for users who set
   system-level dark mode for photosensitivity or eye-strain reasons, the app currently overrides
   that choice unconditionally.
3. **[verify]** focus-trap behavior on `vaul`-based sheets/drawers and the `MobileBottomNav`
   account bottom-sheet — not independently confirmed either way in this research pass.
4. Two icon libraries in simultaneous use raises the chance of inconsistent `aria-hidden`
   (decorative) vs. `aria-label` (icon-only-button) handling between the two — audit both for
   consistent treatment rather than assuming parity.

**Extend the automated-contrast pattern.** `tanmatraTheme.test.ts` already runs real WCAG
luminance math against Astryx token pairs — once `@workspace/tokens` is scoped down per the design
system recommendation above, make sure this test (or an equivalent) still covers any
`@workspace/tokens` pairs that remain DOM-facing, so contrast regressions can't slip in through
the token system this test doesn't currently watch.

### Forms & input

**[verify]** input-type/inputMode correctness on the storefront's forms (checkout, login/OTP,
address entry) — not directly audited in this research pass. The concrete standard to check
against: `type="tel"` + `inputMode="numeric"` for phone/OTP fields, `type="email"` for email,
explicit `autoComplete` hints (`one-time-code` for OTP via WebOTP). The legacy app's segmented OTP
input (`Login.tsx`, per `docs/design-code-parity-audit.md`) is a proven reference — WebOTP API,
numeric `inputMode`, per-box `aria-label`, paste-distribution across boxes, `role="alert"` on
error — port it rather than re-deriving, since the storefront's own login almost certainly needs
the same OTP UX (both apps share the same Firebase-phone-auth backend per `docs/LIVE-CUTOVER.md`
§2).

### Motion design

Reduced-motion is already correctly, globally honored. The `motion` package is present but
under-adopted (2 files) relative to the token infrastructure available (`--duration-fast:150ms`,
`--duration-normal:240ms`, `--ease-out`). As new interactive components are built, thread these
tokens through rather than hardcoding raw millisecond values — and consider porting the legacy
app's `lib/motion.ts` pattern of pre-built, named variant objects (`FADE_IN_UP`, `PANEL_SLIDE`,
`BACKDROP`) mirrored 1:1 with the CSS custom properties, which keeps JS-side animation values from
drifting out of sync with the token file the way ad hoc literals inevitably do.

### Empty states & edge cases

No storefront-specific empty/error/loading-state audit was performed in this research pass —
**[verify]** across the ~20+ data-backed routes (menu, orders, account hub, subscriptions,
vouchers, addresses). Recommend running the exact audit method that surfaced concrete, specific
gaps in the legacy app (`docs/ux-ui-audit.md`'s secondary-surfaces section: Orders had no
loading/error path, Appointments silently swallowed fetch errors, Vouchers rendered empty with no
loading indicator) against the storefront's equivalent routes as a Phase 2 QA pass, rather than
assuming the newer codebase is automatically better-covered.

---

## Technical Architecture

### Stack — keep it; the investment is real and working

Next.js 16 App Router (server-first, `output:"standalone"` for Cloud Run) + Tailwind v4 CSS-first
config + Astryx design system is the owner-decided direction (DS-0, 2026-07-27) and is already
load-bearing across ~150 files. **Don't introduce a competing UI framework or CSS strategy.**
Two scoped, justified additions:

1. **`next/image` via a custom loader** (Responsive Strategy, above) — closes the single largest
   gap without requiring the bigger image-hosting decision first.
2. **A client-side cache library (TanStack Query), scoped narrowly** — today there is *no*
   client-side data cache anywhere (confirmed: no TanStack Query/SWR in `package.json`). The
   blanket `cache:"no-store"` server-fetch pattern is *correct* for personalized reads, but it
   means every client-side interaction that mutates and re-reads (cart quantity, favorites) either
   re-fetches from scratch or hand-rolls optimistic state. Introduce TanStack Query **only** for
   these interactive-island mutations (cart, favorites, subscription toggles) — not as a wholesale
   replacement for the server-component fetch pattern, which should stay as-is for correctness and
   SEO.

### Component architecture / folder structure

Already reasonably healthy: components are organized by domain (`components/cart/`,
`components/address/`, `components/plans/`, `components/trial/`, `components/ui/`,
`components/styleguide/`) rather than dumped flat — keep this convention for new work. The
`.tsx` file cap (400 lines post-DS-0, raised from 150) and the 300-line cap on other files
(`scripts/lint-filecap.ts`) are already CI-enforced; the one vendored exemption
(`lib/themes/stone/stoneTheme.ts`) is correctly scoped and shouldn't be widened casually.

### Theming / CSS strategy

Keep the current architecture: CSS custom properties + Tailwind v4 CSS-first config + explicit
cascade-layer ordering (`app/layers.css`: `properties, theme, base, astryx-base, reset,
astryx-theme, components, utilities`). This layer file exists specifically because, without it,
Tailwind's Preflight reset (loaded later via `globals.css`) outranks Astryx's base layer and strips
component geometry — a real incident, not a hypothetical. **Pitfall for anyone touching global
CSS:** don't add a new stylesheet import without checking which cascade layer it needs to land in;
the layer order is load-bearing and easy to break silently (a misordered import won't error, it'll
just make a component's styles vanish or get overridden in a way that's hard to trace back to the
actual cause).

### Testing strategy for responsiveness — the current gap and the fix

Today: `e2e/playwright.config.ts` defines exactly two projects — `chromium` (Desktop Chrome
default viewport) and `mobile` (Pixel 7) — confirmed, no Firefox/WebKit, no explicit viewport
matrix. `layout-vrt.spec.ts` (visual regression) only has committed snapshots for the `chromium`
project, so it never runs against `mobile` at all. This falls short of the repo's own
`web/testing.md` rule, which recommends screenshotting 320/768/1024/1440 and testing cross-browser
on Chrome/Firefox/Safari at minimum.

**Recommendation:** add three additional Playwright *viewport* projects (not full browser
combinations, to keep CI time bounded) — 375px (small mobile), 1024px (`lg` boundary), and 1440px
(large desktop) — alongside the existing `chromium`/`mobile` pair, and extend `layout-vrt.spec.ts`'s
snapshot matrix to cover them. Add Firefox/WebKit coverage for the primary funnel spec
(`core-funnel.spec.ts`) only, run nightly rather than per-PR, to manage CI runtime — and say so
explicitly in the workflow file rather than silently expanding scope, matching this repo's own
"no silent truncation" convention (`docs/AGENT_WORKING_AGREEMENT.md` §6).

---

## Phased Rollout Plan

Modeled on this repo's own proven tiering (`docs/ux-ui-audit.md`'s Tier 1/2/3), scoped to the
storefront and re-verified against its actual code rather than assumed from the legacy app's audit.

### Tier 0 — same day, zero risk (do first, before anything else in this plan)
1. Correct `CLAUDE.md`'s stale domain-cutover claim (done alongside this document).
2. Delete `components/BottomNav.tsx` (confirmed dead code).
3. Add `viewportFit: "cover"` to `app/layout.tsx`'s `Viewport` export — un-breaks safe-area CSS
   that's currently a silent no-op.
4. Sweep `min-h-screen` → `min-h-dvh` across the 18 confirmed sites in 15 files.
5. Reduce Sentry `tracesSampleRate` from `1` to a sampled rate (e.g. `0.1`–`0.2`) in all three
   configs — cuts client/server/edge tracing overhead with no functional change.

### Tier 1 — days, near-zero risk, high payoff
6. Add `loading.tsx` + CLS-reserved skeletons to `/menu`, `/dish/[slug]`, `/account/orders`,
   `/checkout` (port the legacy app's `.skel` shimmer pattern rather than a generic pulse block).
7. Kick off the `next/image` custom-loader migration (start with the highest-traffic image
   surfaces: dish cards, hero imagery).
8. De-duplicate icon library usage in hand-authored (non-Astryx-template) components.
9. Expand the styleguide: breakpoint matrix, motion/duration showcase, focus-state showcase.
10. Audit and fix OTP/phone/email input types (`[verify]` item above) against the legacy app's
    reference pattern.

### Tier 2 — 1–2 weeks, moderate risk, high UX/perf payoff
11. Ship the dark-mode toggle: flip `enableSystem: true`, add the UI control, wire the styleguide's
    dark-mode showcase to it.
12. Build the narrow, money-path-safe service worker (static shell + offline fallback page,
    hard-excluding `/api/*`, `/checkout`, `/account/*`) + a `NetworkStatusToast`-equivalent.
13. Add `contain: content` to card grids; add scoped `will-change` to the 2 files using `motion`.
14. Wire the repointed Lighthouse script into CI as non-blocking; establish a 2-3 week baseline.
15. Add the three additional Playwright viewport projects + extend `layout-vrt.spec.ts`'s snapshot
    matrix.
16. Adopt container queries (`@container`) for `DishCard`/`PlanCard`.
17. Run the empty/loading/error-state audit across all ~20+ data-backed routes (mirroring the
    legacy app's audit method).

### Tier 3 — deliberate, structural (weeks, needs explicit sign-off before starting)
18. Resolve `docs/DOMAIN-CUTOVER.md` §4's open question: migrate dish photography off the legacy
    Cloud Run service onto a dedicated asset host, removing the live app's dependency on an
    internal-only ops tool staying deployed.
19. Token-system consolidation: Astryx canonical, `@workspace/tokens` scoped down to
    cross-package/non-DOM use only; extend the automated contrast test to cover whatever remains
    DOM-facing.
20. Introduce TanStack Query for cart/favorites/subscription-toggle interactive islands only.
21. Flip the Lighthouse CI gate from non-blocking to blocking once baselined; ratchet the bundle
    budgets down over time rather than setting them once and forgetting them.
22. Build a cross-surface pricing-invariant regression test for the storefront (card price ==
    checkout price == server charge; one trial price everywhere; discount copy matches
    `subscription-rules` constants), modeled directly on the "fix architecture" the legacy app's
    own `docs/illogical-instances-register.md` §D prescribes — a proactive measure, not a response
    to a confirmed storefront bug, since the same architectural risk (multiple competing price
    constructs with no single source of truth enforced by tests) is exactly the kind of thing that
    recurs if it isn't tested against directly.

### Separate, lighter-weight track — the legacy app's new identity as an internal tool
`artifacts/tanmatra` is now an Admin ERP + RD console, not a customer surface — it doesn't belong
in this plan's responsive/design-system scope, which is customer-facing by definition. If it gets
its own pass, scope it as an **internal-tool** UX effort: desktop-first (its actual users are ops
staff and dietitians at a workstation, not mobile shoppers), prioritizing data density and
workflow speed over the marketing polish and touch-target discipline this plan focuses on. Do not
apply this document's mobile-first breakpoint/design-token recommendations to it without
re-deriving them for that different user and context.

---

## Quality Checklist

**Responsiveness**
- [ ] Visually verified at 320, 375, 768, 1024, 1440px — no horizontal overflow, no clipped
      content, no orphaned single-column text at 1440px
- [ ] Notch/safe-area verified on a real or simulated notched device (iPhone 14/15 Pro class) —
      confirm `viewport-fit: cover` is live and `env(safe-area-inset-*)` is non-zero
- [ ] `/checkout` specifically checked on iOS Safari for `dvh`-vs-`vh` address-bar-jump behavior
- [ ] Touch targets ≥ 44px on all interactive elements; ≥ 48px on money-path-critical controls
- [ ] Hover-revealed content/actions also reachable without hover (touch, keyboard)
- [ ] Keyboard-only pass: every interactive element reachable and operable, focus order logical,
      focus visibly indicated everywhere (including inside any sheet/drawer, with trap + Escape +
      restore-on-close)

**Performance**
- [ ] LCP < 2.5s, INP < 200ms (target < 100ms), CLS < 0.1 on `/`, `/menu`, `/dish/[slug]`,
      `/checkout` — measured on throttled mid-tier mobile (Lighthouse mobile preset or equivalent)
- [ ] No layout shift from images (dimensions always explicit) or late-loading fonts
- [ ] Bundle budgets respected per route class (150KB/30KB landing, 300KB/50KB app routes, gzipped)
- [ ] Money-path routes (`/checkout`, `/account/*`) confirmed to never be served from any cache —
      service worker and any future edge cache explicitly exclude them

**Design system**
- [ ] No raw hex/color-function literals outside token files (`lint:tokens` green)
- [ ] Only gold used as an interactive/CTA color; other Astryx accent colors confined to
      status/signal use
- [ ] Both light and dark themes visually reviewed side-by-side (once the toggle ships) — not just
      contrast-tested in isolation
- [ ] File-cap and component-drift gates green (`lint:filecap`, `lint:component-drift`)

**Accessibility**
- [ ] Automated contrast check covers every DOM-facing token pair, both themes
- [ ] Screen-reader pass (VoiceOver or TalkBack) on the primary funnel: menu → dish → cart →
      checkout
- [ ] `prefers-reduced-motion` verified to actually stop/shorten animation, not just fade it
- [ ] Every icon-only button has an accessible name; every decorative icon is `aria-hidden`

**Offline / resilience**
- [ ] Airplane-mode pass: app shows an honest offline state, not a blank screen or infinite spinner
- [ ] Confirmed the service worker never serves stale data on `/api/*`, `/checkout`, `/account/*`

**CI / process**
- [ ] `pnpm --filter @workspace/storefront run typecheck`, `lint:filecap`, `lint:tokens`,
      `lint:component-drift`, and `test` all green before merge (existing gates — keep them green,
      per `docs/AGENT_WORKING_AGREEMENT.md` §5)
- [ ] Lighthouse budget step passing (once wired) or its failures explicitly acknowledged and
      tracked, never silently ignored
- [ ] Any coverage cap or sampling introduced by this plan (e.g., nightly-only cross-browser
      testing) is stated in the relevant workflow file's comments, not left implicit
