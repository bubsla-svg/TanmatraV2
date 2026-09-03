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
