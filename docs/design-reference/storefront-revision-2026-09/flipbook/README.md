# PR-11 flipbooks — 393×852

Evidence for the tokens sub-PR (`docs/MOBILE-FIRST-CX-BRIEF.md` "Foundations 0").
Same seven states before and after, captured at the brief's 393px source-of-truth
width (iPhone 15 Pro) against a `next build` + `next start` of each tree, with the
API upstream unreachable so the static fallback catalog renders (`fetchMenu()`
`source: "fallback"`). 1x viewport frames; nothing was restyled — only tokens moved,
so "after" is the whole app in the delivered revision's palette and type, unrestyled.

- `before/`, `after/` — the app's real default: no stored theme choice, so the Stitch
  scope forces the **dark arm** on redesigned routes (`components/StitchScope.tsx`).
- `after-light/` — the same states with a stored `theme=light` choice (next-themes key,
  unchanged), because the README's two contrast fixes (`--muted-foreground` → 41 %,
  amber text/fills → 37 %) live in the light arm. No `before-light/`: producing it
  needs a production build of the base tree, and the dark default is the customer's
  first render.

| # | State | Route |
|---|-------|-------|
| 01 | Home | `/` |
| 02 | Menu grid | `/menu` |
| 03 | Dish PDP | `/dish/quinoa-khichdi` |
| 04 | Plans | `/plans` |
| 05 | Cart drawer open (after "Add") | `/menu` |
| 06 | À-la-carte checkout | `/checkout?mode=alacarte` |
| 07 | QR start | `/start` |

Regenerate: `scratch/flipbook.mjs` pattern = `e2e/specs/stitch-runtime/*-flipbook.spec.ts`
(goto → role-first readiness → deterministic shot). Re-baseline `layout-vrt` separately.

## PR-11b — primitives

`Rail`, `Disclosure`, `QuantityStepper`, `StickyAction` and their migrated call sites.
The "before" for 11b is the merged 11a tree, i.e. `after/` and `after-light/` above —
no separate copy. `11b/after/` and `11b/after-light/` are the same seven states on the
11b tree. What to compare: the dish-card and PDP steppers, the cart-drawer rows, the
checkout order-summary rows, the pay bar, the mini-cart pill, the section chip bar and
the pantry rail. Every state present before is present after; only the skin moved.

## PR-11c — CUJ 1+2: home, menu, dish sheet/PDP, cart drawer

`11c/reference/` — the delivered revision itself rendered at 393×852 (light), from the
exported `src/` under a minimal Vite runner (the export ships no `main.tsx`; `App.tsx`
imports two files that were not exported). These are the pixel-match targets the brief's
execution order step 4 asks for. `11c/after/` and `11c/after-light/` are the production
storefront on the 11c tree; the "before" is the merged 11b tree (`11b/after*`).

### Divergence ledger (reference trait → what production renders, and why)

| Reference | Production (11c) | Rule |
|---|---|---|
| CSS `dish-art` plate on every card, hero and PDP | real photography via `DishImage`/`SafeImage`, with the branded fallback tile | README override; brief CUJ 1 §11 |
| Card without macros, hard-coded `4.8 ★`, "Fresh today" chip on every card | macros row on every card; stars only from the payload; badges only from the payload | Law 8; README override |
| Add button 40 px, solid primary on every card | 44 px outline-gold Add (in-cart face: 48 px stepper) — one solid action colour per viewport | one-gold rule (`one-gold.spec.ts`), 48 px money-path floor |
| Menu page title block ("Good food, well considered.") + search box | no visible title block; the sr-only h1 stays | owner decision 2026-08-16 (first product above the fold); search removed earlier |
| Category chips solid primary when selected | primary tint (`bg-primary/10`) when selected | selection is never the action colour |
| Ticker, hamburger grid nav, `/cart` route, favourites heart | header/tab-bar/drawer shell unchanged; no favourites feature | README override; brief scope rule 5 |
| Cart summary as a dark `bg-primary` panel with an amber CTA | summary on the sheet surface, Checkout in the action colour | the CTA must stay the one action colour, and gold-on-green vanishes |
| Hero eyebrow "Nutrition, without the noise", stats "24g+ / 1 kitchen" | eyebrow rule with no invented copy; the three trust lines as the stats row | no new copy, no unsourced numbers |
| Amber accent as text (`text-accent` eyebrows at 53 %) | `--accent` is the 37 % amber (4.6:1) | README contrast fix (PR-11a) |

Two menu-chrome changes travel with the card, both presentation and both forced by the
card's height (≈3× the old row):

- The sticky control cluster used to paint over the header whenever both pinned, so the
  header's location trigger, search and theme toggle were unreachable on `/menu` after the
  first scroll (the theme-toggle e2e only passed because Playwright crawled the shorter page
  back to the top). It now pins just below the header while the header is revealed, off the
  same `useScrollHide` stream the header and tab bar share — Law 1.
- `cv-auto-row` (`content-visibility: auto` with a 192 px placeholder) came off the grid
  items: the placeholder would mis-size every unrendered card and shift the document as rows
  materialise, and Chromium's lazy render left most of the grid unlaid-out for seconds after
  load. The horizontal rails keep `.cv-auto`, where item sizes are fixed.

## PR-11d — CUJ 5: checkout, plan leg, order confirmed

`11d/after/` and `11d/after-light/` are the mandated seven frames on the 11d tree, taken the
way CI builds the storefront (`NEXT_PUBLIC_LIVE_CHECKOUT` unset, no API, fallback catalog);
the "before" is the merged 11c tree (`11c/after*`). Of the seven only `06-checkout-alacarte`
belongs to this PR, and without an API it can only show the guest form with an estimated
subtotal — so the surfaces 11d actually restyles are evidenced separately:

`11d/mock-before*` and `11d/mock-after*` — fifteen states per arm the sandbox cannot reach on
its own, captured off a `NEXT_PUBLIC_LIVE_CHECKOUT=1` build with placeholder Firebase public
config (without it `PlanIdentityGate` never mounts the session probe), the browser seams
stubbed with `page.route()` exactly as `e2e/specs/stitch-runtime/checkout.spec.ts` and
`checkout-doubletap.spec.ts` stub them, the same stub Razorpay modal, and a scratchpad mock
answering the server-side `GET /api/orders/:id/status`. **Every figure on these frames is
fixture data** (`₹3,442` plan quote, `₹104` à-la-carte quote, `#ORD_FLIP_…` ids, `TNM7K2X`
referral code) — not the live catalogue, not real orders. The mock never enters the repo.

| Frame | State | How it is reached |
|---|---|---|
| `p0` | plan serviceability gate | `/checkout?plan=desk_fuel` |
| `p1`, `p2`, `p2b` | plan details: top, consent + total card, manual address | PIN `201301` cleared, stubbed session, address typed through the picker's manual fallback |
| `p3` | plan payment-processing (14.6) | verify held open after the stub modal resolves |
| `p4` | plan payment-unresolved (14.7) | verify 503 through `verifyWithRetry`'s bounded attempts |
| `a1`, `a2`, `a3` | à-la-carte form with an active quote and a bookable window; summary open; consent + pay bar | quote, slots, session and address stubbed |
| `a4` | inline error after a real attempt | street line cleared, CTA tapped |
| `a5`, `a6` | à-la-carte 14.6 / 14.7 | as `p3` / `p4` |
| `c1` | order confirmed, on-demand (`preparing`, ETA) | mock status endpoint |
| `c2` | order confirmed, scheduled plan order (window, perks, claim, referral) | mock status + sessionStorage perks |
| `c3` | order not found | mock 404 |

### Choices without a reference screen (what changed → why)

The revision has no checkout route; these follow the 11c grammar and its ledger.

| Before 11d | Production (11d) | Rule |
|---|---|---|
| Selected delivery-day segment as a solid gold fill beside a solid gold pay CTA | the 11c selection tint (`bg-primary/10`) | one solid action colour per viewport (`one-gold.spec.ts`) |
| Totals and unit prices in gold text | data face (`.font-data`) in the primary ink | amounts are data; gold is the action colour, not a highlighter |
| Plan pay bar as its own `fixed … bg-[var(--glass)]` markup | `StickyAction` (the 11b primitive) | one sticky base, spelled once |
| Fields on the page background with a hairline focus edge | fields on the surface fill, primary focus edge, 50 px minimum height | 48 px money-path floor; a perceivable boundary |
| Section questions as 14 px labels | display face (Fraunces) at 20 px; field labels stay small | the reference's hierarchy: display titles, quiet labels |
| Eyebrows in gold text (`Order confirmed`, `Next steps…`) | the 37 % amber `text-accent` eyebrow | README contrast fix (PR-11a) |
| `rounded-3xl` / `rounded-xl` cards | `rounded-2xl` throughout | the 11c card radius |
| Reference's dark summary panel with an amber CTA (from `/cart`) | not adopted | Checkout stays the one action colour; gold-on-green vanishes |
| Breeze fallback (`CheckoutFlow` …), `EveningAddOffer`, `PhoneAuth` | untouched | 11h / 11g; the fallback is local-dev parity only, never the checkout |

Noticed while capturing, not changed (product shape is frozen): on the plan leg a saved
address never seeds `PlanDetails` — the serviceability gate's PIN seed mounts the step first
and the once-only prefill has already fired when `/api/addresses` lands. The manual-address
frames above are how every returning customer currently gets through.
