# Frontend E2E audit — what reproduces, what doesn't, and why

Run against a local production build (`next build --webpack` → `next start`),
Pixel 7 viewport, no cached data, 9 customer-reachable routes. Harness:
`artifacts/storefront/e2e/specs/frontend-audit.spec.ts` +
`e2e/support/audit/probes.ts`.

## Headline

Of the twelve defects in the brief, **the layering and spatial ones do not
reproduce on current `main`.** The accessibility ones do. Two structural
findings are real. Four could not be tested in this environment and are
listed as unverified rather than passed.

| | |
|---|---:|
| routes audited | 9 |
| findings | 39 |
| **WCAG 2.2 AA target-size failures** | **5** |
| tap targets in the 24–44px comfort band | 31 |
| trailing void | 1 |
| CTA stacking | 2 |
| permanently occluded controls | **0** |
| collapsed image boxes | **0** |

## The methodology matters more than the score

The first version of this audit reported **8 critical collisions**. Every one
was a false positive, and each class was removed only after measuring why:

| reported | reality | how it was settled |
|---|---|---|
| 5 criticals on `/menu` — sticky controls over header logo/search/filters | **animation frame.** Present 400ms after scroll-to-top, gone at 2s. The header retreat was still settling. | probed the same page at 3 settle points |
| 3 criticals on `/`, `/menu`, `/faq` — bottom nav over content | **normal fixed-nav behaviour.** A fixed bar covers whatever is under it; the customer scrolls. | scrolled each route to max and re-probed: nothing stayed covered |
| 1 critical on `/menu` — sticky top bar at max scroll | **wrong rule.** Max-scroll is the unreachability test for *bottom* chrome only. | per-element verification: centre the element, re-hit-test |
| 15 criticals on the dish drawer — overlay over the menu page | **a modal doing its job.** Background content is supposed to be inert. | scoped occlusion to inside an open dialog |

That is the substance of Phase 3 in the brief. Bounding-box intersection alone
produces noise at roughly 8:1 here. What makes it a signal is:

1. **hit-testing** the overlap centre (`elementFromPoint`) — a
   `pointer-events: none` wrapper overlaps harmlessly, and that is exactly how
   the mini-cart pill is layered;
2. **per-element verification** — scroll the candidate to viewport centre and
   re-test, so "covered right now" is distinguished from "covered at every
   scroll offset";
3. **a settle window** long enough to outlast chrome animation (2s here);
4. **modal awareness** — when a dialog is open, only its own subtree is
   audited.

An audit that skips these reports animation frames and working modals as
critical defects, which is worse than no audit: the real findings drown.

## Brief item → verdict

### 1. Spatial voids & CSS constraints

| item | verdict |
|---|---|
| The Bottomless Scroll | **Does not reproduce on product pages.** Measured trailing gap: `/menu` 181px (0.2vh), `/` 293px, `/faq` 193px, `/plans` 160px. **Real on `/cart`: 568px (0.7vh)** — the empty-cart state. |
| Missing Image Collapse | **Does not reproduce.** Zero collapsed boxes across 9 routes. Dish images already sit in fixed 104px boxes / `aspect-[4/3]`, and the branded fallback tile renders in-box when the photo fails — which in this environment is every photo. |
| Trapped negative space (macro modal) | **Not reproduced** as a measurable geometry defect. This is a visual-judgement finding; the probes measure boxes, not composition. |

### 2. Z-index & interaction collisions

| item | verdict |
|---|---|
| The Double Footer Trap | **Does not reproduce.** `MiniCartBar` is `bottom-16 z-30` inside a `pointer-events-none` wrapper; `MobileBottomNav` is `bottom-0 z-50`. They stack, they do not fight. `<main>` reserves `8rem + safe-area`, and at max scroll on every route **zero** controls remain covered. |
| CTA Cannibalization | **Reproduces, mildly.** `/menu` shows 4 "Add" buttons in one viewport — but that is one CTA per dish card, which is the intended one-tap-add design, not competing CTAs for the same object. The drawer shows "Add" + "Open full page" together. |
| The Trapdoor Sign-In | **Not reproducible here** — it needs a 401 from a live API. The pattern is deliberate (`docs`: auth-gated surfaces are islands, no `/login` redirect), but the screenshot shows it covering price and quantity with no visible dismiss. Listed unverified below. |

### 3. State management & flow failures

All four are **unverified** — they need authentication and a live API, neither
of which this environment has. Stated rather than silently omitted:

- Checkout hard-blocker at "Continue to payment"
- Post-login amnesia (location / dietary preferences)
- Layout thrashing between drawer and full page
- State hydration across the DOM after token injection

### 4. Component rendering & web-view clashes

| item | verdict |
|---|---|
| Uncanny Valley Dropdowns | **No native `<select>` found** on the 9 audited routes — the probe checks `appearance` on every `select`/`input`/`textarea` and found none unreset. |
| Broken OTP input styling | **Unverified** — the OTP field only renders after a phone-number submit against a live API. |
| Accessibility & tap targets | **Reproduces. This is the real finding.** |

## The real findings

### 5 WCAG 2.2 AA target-size failures (SC 2.5.8, 24×24 minimum)

| route | control | size |
|---|---|---|
| `/dish/:slug` | "Nutrition" tab | 380×**17** |
| `/dish/:slug` | "Ingredients" tab | 380×**17** |
| `/` | "View menu" | 81×**16** |
| `/` | "Or see monthly plans" | 328×**20** |
| `/menu?dish=` | "Open full page" | 93×**20** |

These are conformance failures, not preferences.

### 31 controls in the 24–44px band

AA-conformant but below the iOS HIG comfort figure on a mobile-first surface.
The systemic ones are global chrome, so each appears on every route: the
header logo (74×28), the search button (36×28), and the filter chips (60×30).
Fixing those three fixes 20 of the 31.

### `/cart` trailing void — 568px

The empty-cart state leaves 0.7 viewport heights of dark space below the last
element.

## Not a frontend defect, but found on the way

`pnpm exec next build` **fails on `main`** — Turbopack (the Next 16 default)
cannot resolve the `./pricing.js` / `./planCatalog.js` ESM specifiers in
`@workspace/subscription-rules`, which point at `.ts` sources. The package
script is `next build --webpack`, which works, so CI is unaffected. Anyone
running the bare command hits a wall that looks like a broken workspace.

## Running it

```bash
pnpm --filter @workspace/storefront run build
pnpm --filter @workspace/storefront exec next start -p 3111 &
E2E_BASE_URL=http://localhost:3111 pnpm exec playwright test \
  --config artifacts/storefront/e2e/playwright.config.ts \
  --project=mobile frontend-audit
node --experimental-strip-types \
  artifacts/storefront/e2e/support/audit/render-report.ts
```

`occlusion` and `image-collapse` fail the run. Everything else is written to
`e2e/audit-report/report.md` for triage — deliberately, so the gate stays
credible instead of being weakened the first time it blocks on old debt.
