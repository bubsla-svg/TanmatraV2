# Cart drawer — dynamic add-on rail (2026-09-05)

Owner's brief: *the add-on rail should be dynamic in nature; no part of the order may be overridden.*

## What changed

- **Compact carousel.** The rail is one horizontal row of fixed-width cards on the shared
  `Rail` primitive (trailing fade as the continuation cue). Its height is the same for one
  candidate or three — 118px measured, against a 273px three-item vertical stack before.
- **Measured placement.** `useUpsellRailFit` measures the room left under the order in the
  drawer's scroll region and `lib/upsell.ts#upsellRailSpacerPx` decides where the rail sits:
  - room for the whole rail → **inline**, whole;
  - room for its header only → the header (label) **peeks** above the fold as the cue that
    add-ons sit below, and the card row starts exactly at the fold;
  - not even that → the whole rail starts at the fold.
  Either way the rail never takes a pixel from the order lines, the fee hint, the subtotal or
  Checkout, and no card is ever cut. Re-measured before paint on every order / candidate change
  and on region, list and viewport resizes (fee hint appearing, keyboard, rotation).
- **Container split.** `CartDrawer` owns the catalog query (same key as `MarketplaceGrid`,
  fetched only while the sheet is open — the drawer is mounted on every page);
  `CartUpsellRail` is presentation only.

## Frames (393×667 unless named; mocked 3-item catalog carrying the live item names)

| before | after |
|---|---|
| `before/drawer-2-lines-stacked-rail-starving-667.png` — pre-#125 production: the stacked rail starves the two order lines to a 19px sliver | `after/drawer-2-lines-rail-inline-667.png` — the row fits under two lines; every line whole |
| `before/drawer-2-lines-stacked-rail-cut-by-fold-667.png` — #125 production: the order is back, but the stacked rail is cut through a card by the subtotal | `after/drawer-3-lines-rail-peeks-667.png` — three lines leave room for the header only: the label peeks, the cards start at the fold |
| | `after/drawer-3-lines-scrolled-rail-whole-667.png` — scrolled to the end, the rail is whole above the pinned footer |
| | `after/drawer-2-lines-after-add-667.png` — "+ Add" moved an item into the order; the rail re-measured itself out of the way |
| | `after/drawer-2-lines-320x568.png` — smallest supported viewport |

## Invariant harness

Eight viewport × line-count scenarios (393×667 with 1–4 lines, 393×852 with 2–3, 320×568, 430×932),
each asserting at rest: every order line that can fit is whole; the rail is wholly in view or its
card row is wholly below the fold; scrolled to the end the rail is whole; and after "+ Add" the
invariant still holds. All pass. The pure placement rule is pinned by `lib/upsell.test.ts`,
including a sweep over 600 combinations.
