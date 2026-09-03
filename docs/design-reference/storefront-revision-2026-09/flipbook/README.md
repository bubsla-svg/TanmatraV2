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
