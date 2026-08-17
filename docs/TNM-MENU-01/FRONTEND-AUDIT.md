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

## Re-run after PR #64 (`/menu` title + search removal)

Everything above was measured before #64 merged. That change removed the
`/menu` H1, the dish-count trust strip and the inline search box, and gave
the diet chips `min-h-9` — so the numbers this document reports for `/menu`
went stale about an hour after they were taken. Re-run against merged `main`
plus this harness, same instrument, same 9 routes, same Pixel 7 viewport:

| | before #64 | after #64 |
|---|---:|---:|
| findings | 39 | **37** |
| **WCAG 2.2 AA failures** | 5 | **5** (identical set) |
| tap targets in the 24–44px band | 31 | **29** |
| trailing void | 1 (`/cart`, 568px) | **1** (`/cart`, 568px) |
| CTA stacking | 2 | 2 |
| **permanently occluded controls** | 0 | **0** |
| **collapsed image boxes** | 0 | **0** |

**The two hard-gate classes stayed at zero, and the AA failure set did not
change** — same five controls, same sizes. #64 introduced no layering or
conformance regression, which is the question worth asking of a chrome change
that shipped straight to `main`.

The band dropped by two because the inline search input left the measured set
and the diet chips grew. The chips are no longer `60×30` as reported above —
they now measure `55×36`, `61×36` and `82×36`. They are still under the 44px
comfort floor, so they remain band findings; the "three global-chrome fixes
clear 20 of them" arithmetic also survives, now as **20 of 29** (header logo
74×28 ×7, header search 36×28 ×7, diet chips ×6).

One number moved the wrong way: the dish drawer now reports **6** stacked CTAs
rather than the "Add + Open full page" pair described above, because removing
~90px of `/menu` chrome pulls more dish cards into the viewport behind the
open drawer. That is a consequence of the density win, not a defect in the
drawer.

## Global-chrome resize + the gate goes live

Owner answered the two remaining questions: do the resizes, wire it in.

**The three global-chrome controls are fixed**, and because they are chrome
each one was counted on every route it appears on — so three class changes
removed twenty findings:

| control | before | after | rows cleared |
|---|---|---|---:|
| header wordmark (`Header.tsx`) | 74×28 | 90×44 | 7 |
| header search trigger (`CommandMenu.tsx`) | 36×28 | 44×44 | 7 |
| diet chips (`MenuControls.tsx`) | 55–82×36 | ×44 | 6 |

All three use the existing `.touch-target-min` (44px) from `globals.css`
rather than a new token. There was already one answer to "how big must a
target be"; a second, parallel one is worse than either alone.

**The chip resize cost zero vertical space, measured rather than assumed.**
That row is `flex items-center` and already contained the 44px filter
trigger, so its height was `max(36, 44) = 44` either way — the chips were
simply sitting short inside a box that height already. `/menu`'s first card
top measured 301px before the change and 301px after, on the same build and
viewport. The density work is untouched.

The wordmark needed one structural change: `.touch-target-min` makes the
anchor `inline-flex`, and `text-overflow: ellipsis` needs a block container,
so the truncation moved to an inner `<span>`. Left as an inline-flex anchor
with the classes in place, the clipping would have silently stopped working
— a bug that only appears for a brand name longer than "Tanmatra".

| | after #70 | **after the resize** |
|---|---:|---:|
| findings | 34 | **14** |
| WCAG 2.2 AA failures | 0 | **0** |
| tap targets in the 24–44px band | 31 | **11** |
| trailing void | 1 | 1 (`/cart`, 568px) |
| CTA stacking | 2 | 2 |
| occluded controls / collapsed images | 0 / 0 | **0 / 0** |

Those numbers were re-verified against `main` at `518a9ff5` — after #71 made
internal navigation client-side, which touched the landing page, `MenuGrid`,
`GoalRouter` and the header's `DeliveryAddressBar` (global chrome, therefore
every audited route). Identical: 14 / 0 / 11 / 0. Re-run because rendered
markup on audited routes changed, not because `main` moved.

### The audit is now a merge gate

`storefront.yml` runs it on its own `next start` (port 3200, following the
Lighthouse step's self-contained precedent) with `RUN_FRONTEND_AUDIT=1`, and
the report uploads as an artifact on **every** run, not only on failure — the
band findings are the point of the report even when it is green, and a gate
whose evidence only appears when it fails teaches people to fear it rather
than read it.

**What gates, and what does not.** `occlusion` and `image-collapse` gated
from the start. **WCAG AA target size now gates too** — added at the moment
its count reached zero, which is the only honest time to add a gate. The
original argument for not gating everything was that a check which blocks on
pre-existing debt gets weakened rather than obeyed; that argument expires
when the debt does. The 24–44px comfort band stays report-only precisely
because it is still 11 findings, which is exactly the debt that argument was
about.

`lib/tapTargets.test.ts` (from #70) pins the same five controls by *source*
and runs without a browser. It can only check that a class is still written;
it cannot see a control that regresses through a changed utility, a new
wrapper, or a font-size change. This gate measures rendered pixels. They are
complements, not duplicates.

## Re-run after PR #70 — the AA failures are fixed

**All five WCAG 2.2 AA target-size failures are gone.** #70 fixed exactly the
controls this audit measured — its own test header names them as "the five
controls the frontend audit measured under 24 CSS px" — so the table at the
top of this document now describes a state that no longer exists. Re-measured
against post-#70 `main`, same instrument, same 9 routes:

| | first run | after #65 | **after #70** |
|---|---:|---:|---:|
| findings | 39 | 37 | **34** |
| **WCAG 2.2 AA failures** | 5 | 5 | **0** |
| tap targets in the 24–44px band | 31 | 29 | 31 |
| trailing void | 1 | 1 | 1 (`/cart`, 568px) |
| CTA stacking | 2 | 2 | 2 |
| permanently occluded controls | 0 | 0 | **0** |
| collapsed image boxes | 0 | 0 | **0** |

Read the band figure carefully — it went UP, and that is the fix working, not
a regression. Of the five controls that were below 24px, three now clear 44px
entirely and leave the report altogether; the other two cleared 24px and
landed in the 24–44 comfort band. Total tap-target findings fell 34 → 31. A
control moving from "AA violation" to "band finding" is a promotion.

That leaves the open questions on this PR at two, not three: the global-chrome
resize and the CI gate. The AA item is answered — in code, by someone else,
which is the outcome an audit is for.

**Re-verified again after PR #65** (dish-page branded tile + removal of the
unearned "RD reviewed" badge), which touches `/dish/:slug` — one of the nine
audited routes. Every number above is unchanged: 37 findings, the same five
AA failures, 29 in the band, zero hard gates. That is the expected result
rather than a lucky one: the badge is a `<span>`, which is not in the
probe's interactive selector, and the branded tile and the generic glyph
both render a `<div>` rather than an `<img>`, so neither the tap-target nor
the image probes can see the difference. Recorded because "I re-ran it and
nothing moved" is worth as much as a delta, and costs the next reader a
re-run to find out.

The sub-threshold per-route trailing gaps quoted earlier (`/menu` 181px, `/`
293px, `/faq` 193px, `/plans` 160px) were **not** re-measured — they sit below
the probe's reporting threshold, and an ad-hoc re-measurement returned a
figure that disagreed with the probe's own computation, so it is not recorded
here rather than published unverified. The probe's own trailing-void finding
(`/cart`, 568px) is unchanged.

## Running it

```bash
pnpm --filter @workspace/storefront run build
pnpm --filter @workspace/storefront exec next start -p 3111 &
RUN_FRONTEND_AUDIT=1 E2E_BASE_URL=http://localhost:3111 pnpm exec playwright test \
  --config artifacts/storefront/e2e/playwright.config.ts \
  --project=mobile frontend-audit
node --experimental-strip-types \
  artifacts/storefront/e2e/support/audit/render-report.ts
```

`RUN_FRONTEND_AUDIT=1` is required — without it every route skips. See the
opt-in note in `frontend-audit.spec.ts` for why this is not a standing gate.

`occlusion` and `image-collapse` fail the run. Everything else is written to
`e2e/audit-report/report.md` for triage — deliberately, so the gate stays
credible instead of being weakened the first time it blocks on old debt.
