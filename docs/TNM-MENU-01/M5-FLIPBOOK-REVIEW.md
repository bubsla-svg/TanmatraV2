# M-5 flipbook review — 2026-08-16

Reviewed: the 26 committed §5 flipbook shots in
`artifacts/audit/stitch-integration/screenshots/5.5-*`, captured against the
live 112-dish production catalog, plus corroboration against
`https://tanmatra.food/api/menu/public`.

## What this was reviewed against

The manual names an **"Experience Contract — ten laws"** document as the gate
for this review. That document does not exist anywhere in this repository
(verified by exhaustive grep across four separate PRs). Rather than fabricate
compliance with an absent standard, this review is conducted against rules
that DO exist in the repo and are enforceable:

- M-5 directive §3.4 (macro claims must be supported), §3.5 (a dish image is
  a real photo of THAT dish, or the branded tile — nothing else), §3.7 (the
  trust strip claims only what the payload supports), §4.2 (no placeholder
  signatures, no duplicate names).
- The partial law meanings the directive itself uses: Law 5 (one truth),
  Law 8 (numbers are the brand), Law 9 (always a next action), Law 10 (no
  voids).

**Owner action item, now five PRs old:** either supply the ten-laws document
or declare this rubric the standard. Until then "flipbook reviewed" cannot
mean what the manual says it means.

---

## F-1 — CRITICAL. 78 of 112 dishes display fabricated macros

The placeholder-macro problem is roughly five times larger than the single
bucket PR-A's `macroTrust` gate was built for.

Measured on production, 2026-08-16:

| | dishes |
|---|---|
| served | 112 |
| sharing a macro tuple with ≥1 other dish | **93** |
| …caught by `macroTrust` (the 460/18/45/14 stub → "Macros being verified") | 15 |
| …**rendering numbers anyway** | **78** |

Only **32 distinct macro tuples** exist across 112 dishes. The largest
copy-pasted buckets:

| macros | dishes | examples |
|---|---|---|
| 460 / 18P / 45C / 14F | 15 | Aam Panna, ABC Juice, Garlic Bread, French Toast — *gated* |
| 140 / 3P / 22C / 4F | 13 | Diet Coke, Thums Up, Watermelon Juice, every smoothie |
| 460 / 28P / 45C / 14F | 10 | Boiled Egg (1 pc), English Breakfast, Chicken Pita Pocket |
| 340 / 20P / 22C / 14F | 9 | every omelette |
| 260 / 12P / 22C / 14F | 6 | Poha, Quinoa Khichdi, Nutella Toast |

Two of these are not merely imprecise — they are false on their face:

- **Diet Coke — `≈140 kcal · ≈3 g P`.** Diet Coke is 0 kcal and 0 g protein.
- **Boiled Egg (1 pc) — `460 kcal · 28 g P`, rendered with NO `≈`.** A boiled
  egg is ~78 kcal / ~6 g protein. This is ~6× overstated **and presented as a
  verified figure**, because `macrosEstimated` is unset on that row, so
  `macroTrust()` falls through to `"verified"`.

**Why the gate misses them.** `hasStubMacros` matches one hard-coded tuple
(460/18/45/14). Every other copy-pasted bucket passes, and any row whose
`macrosEstimated` is unset is promoted to `"verified"` — the strongest claim
the card can make. The gate's own premise ("a fabricated number is worse than
an absent one", DishCard.tsx) is not being met for 78 dishes.

**Recommended fix (display layer, ours):** a macro tuple shared by unrelated
dishes can never be `"verified"`. Generalise `macroTrust` from "equals the
known stub" to "is this tuple non-unique across the catalog", degrading to
`"unverified"`. That is a ~70%-of-catalog visible change, so the degrade
target is an owner call, not mine — see Decisions below.

**Data-layer fix (kitchen's):** these are 32 real recipes' worth of numbers
spread over 112 rows. M-6 already blocks on kitchen macros; this widens that
blocker from 17 rows to ~93.

## F-2 — HIGH. Two unrelated dishes serve the same photograph

`Thums Up` and `Activated Charcoal Smoothie` both point at
`images.unsplash.com/photo-1570696516188-…`. A cola and a charcoal smoothie
render the identical stock image.

This is defect **S-5** ("a card must not show another dish's food"), which
PR-A closed *for the fallback tile* by construction — a tile cannot show
another dish's food. It was never closed for real photo paths. Note also that
M-0's finding "every image path resolves to the legacy SPA shell" is not
universally true: some rows carry remote Unsplash URLs.

## F-3 — HIGH. A third image state exists: the empty box

`5.5-section-13-dark.png` shows Thums Up, Activated Charcoal Smoothie and
Aglio Olio - Chicken each rendering an **empty rounded rectangle** — no
photo, no branded tile, no letter. §3.5 permits exactly two states.

Correlation: all three carry remote Unsplash URLs. PR-C's fix covers images
that **fail** (`complete && naturalWidth === 0`) and images that fire
`onError`. It does not cover a request that **never resolves** — `complete`
stays false, no error fires, and the `<img>` box stays empty indefinitely.

*Environment caveat:* this sandbox blocks browser egress to third-party hosts
(proven separately — Chromium cannot reach `example.com`), so the hang is
induced here. But the same state is reachable for a real customer on a slow
or filtered network, and it is the one image state the directive forbids. A
load timeout that falls back to the tile would close it.

## F-4 — MEDIUM. Dish names truncate at one line

`5.5-section-01-dark.png`: "Grilled Chicken with Veggies **…**",
"Chicken Meal — 150 g grilled **…**". `DishCard` clamps the title to
`maxLines={1}`.

The name is the card's primary identifier, and the truncated tail is often
the distinguishing part (portion size, protein, preparation). The summary
line below it was widened to 3 lines in the ergonomics pass; the title was
not. Two lines for the title would resolve nearly all of these.

## F-5 — MEDIUM. 35 dishes (31%) remain ungoverned

The trailing "More dishes · 35" bucket holds 31% of the served catalog —
dishes with no `section_order` from the M-3 payload. They render (Law 10, no
voids — correct) but they are outside the §5 taxonomy, so the chip bar cannot
route to them meaningfully and merchandising order is undefined.

## F-6 — MEDIUM. The flipbook's light-theme half is not real *(defect in our own evidence)*

All 13 `5.5-section-NN-light.png` files are **byte-identical** to their
`-dark` counterparts, as is `5.5-grid-top-light.png`. The flipbook claims
both-theme coverage it does not have.

Cause: `menu-image-integrity.spec.ts`'s `setTheme()` writes `data-theme` on
`documentElement` and to `localStorage`, then screenshots 150 ms later.
next-themes re-asserts its own value over that write. `/menu` is *not* a
forced-dark route (live HTML is `<html data-theme="light">` with only one
component-scoped `data-stitch`), so light shots are achievable — the helper
is simply wrong. `theme-toggle.spec.ts` already does this correctly by
driving the real toggle and asserting the **painted** `color-scheme`.

Until fixed, treat the light half as absent, not as passing.

## F-7 — LOW. At rest, the first card still begins ~45% down

The ergonomics pass fixed the *scrolling* state (chrome 181px → 64px; 15% →
8% blocked). At rest the preamble is still title + "112 dishes · order today"
+ the ≈ legend + search + diet chips + section chips before any product.
Confirmed in `5.5-section-01-dark.png`.

Not a regression — an honest remaining gap against the original complaint.

---

## What the flipbook shows working

- Gold-outline Add reads unambiguously as the purchase action, one per card,
  with the solid-gold cart bar still the only filled gold element (§4.2 / D-08).
- Section headers carry truthful visible counts ("High-Protein Meals · 5"),
  and the counts sum to rendered cards.
- The chip bar tracks the section in view and is reachable in one tap.
- Tri-state veg marks render on every card (green dot / red triangle).
- Macro chips use tabular numerals; the `≈` legend appears exactly once.
- The trust strip claims only "112 dishes · order today" — no RD-reviewed
  claim, which is correct given the payload (PR-A).

## Decisions needed

1. **F-1 degrade target.** Shared-bucket macros must stop reading as
   verified. Blank them ("Macros being verified", ~78 cards) or show them as
   estimates with a stronger caveat? Blanking is the honest option and the
   one consistent with the existing gate's premise; it is also a large
   merchandising change, so it is your call.
2. **Ten-laws document.** Supply it, or ratify this rubric as the standard.

## Fixes I can ship without a decision

- **F-6** — repair the flipbook's theme switch (drive the real toggle, assert
  painted `color-scheme`) so the light half is genuine.
- **F-3** — add a load timeout to `ImgWithFallback` so a never-resolving
  request degrades to the branded tile.
- **F-4** — allow the dish title two lines.
