# F-1 root cause: the number and its trust flag came from different places

Flipbook finding **F-1** said 93 live dishes share only 32 distinct macro
tuples, and that some render fabricated numbers as fact. PR #50 shipped the
render-layer safety net (a tuple shared by two dishes can never read as
verified). This is the cause underneath it, and the two fixes that follow.

## The finding

The repo's static catalog is **clean**:

| | |
|---|---:|
| static `DISHES` | 116 |
| distinct macro tuples among them | **116 — zero duplicates** |
| computed from RD-verified ingredient lists (`ESTIMATED_MACROS`) | 104 |
| curated distinct, rendered as fact (`macrosEstimated: false`) | 11 |
| gated (`macrosProvisional: true`) | 1 |

Those 104 are not guesses: `nutritionCalc.ts` parses each dish's ingredient
list against a 174-entry IFCT 2017 / USDA per-100g table, and only estimates
at **≥0.85 ingredient coverage** whose stated energy reconciles with their
macros to **within 15% (Atwater)** are kept.

So the duplication F-1 measured is not in the catalog. It is in `menu_items`,
and it reaches the customer because `getMergedCatalog` builds each dish as
`{...staticDish, ...dbOverrides}` where `macros` is overridden by the DB row.

## The proof

`diet-coke-can`, statically:

```
macros = { calories: 0, protein: 0, carbs: 0, fat: 0 }   // correct: zero-calorie soda
macrosEstimated = true
```

The flipbook captured that card rendering **`≈140 kcal · ≈3 g P`**. With the
static value at 0/0, those numbers can only have come from the DB row — while
the `≈` came from the static `true`.

That is the defect in one line: **the number came from the database and the
flag qualifying it came from the catalog.** It goes wrong in both directions.

| static flag | DB row | what shipped |
|---|---|---|
| `macrosEstimated: true` | placeholder macros | a fabricated number wearing "≈ computed from this recipe" |
| `macrosEstimated: false` (11 dishes) | placeholder macros | a placeholder rendered as **plain fact, no marker** |

The second row is the "Boiled Egg, `460 kcal · 28 g P`, unflagged" case.

There was a third hole: for CMS/POS-only dishes (a `menu_items` row with no
static counterpart) the merge never set `macrosEstimated` **at all**, so a
Petpooja-supplied macro rendered as unqualified fact.

## Fix 1 — the claim (code, shipped in this change)

`src/lib/macroProvenance.ts`, extracted pure in the mould of
`resolveAllergensReviewed`:

- **Whoever supplies the numbers supplies the claim.** If the row has macros,
  `menu_items.macros_are_estimate` decides. That column is `NOT NULL DEFAULT
  true`, so the failure mode is fail-soft: an un-curated row reads as an
  estimate and renders with `≈`, never as fact.
- **`macrosProvisional` stays sticky.** It is the strongest gate (no numbers
  at all) and has no DB column, so the static value passes through unchanged.
  A DB row can never loosen a gate the catalog already applied.
- The CMS/POS-only branch now sets the flag from its own column too.

## Fix 2 — the numbers (data, gated)

`scripts/src/backfill-catalog-macros.ts` + `.github/workflows/catalog-macro-backfill.yml`
push `ESTIMATED_MACROS` into `menu_items.macros`, flagged
`macros_are_estimate = true`.

- Plan-only by default; `apply` is a separate explicit input.
- Touches only slugs present in **both** the estimate set and `menu_items` —
  no inserts, no deletes, no slug invention.
- **R-3 honoured**: writes `macros` and `macros_are_estimate` and nothing
  else. It never reads or writes `price_paise`.
- Backs up every touched row, then re-reads and asserts convergence.
- Prints the shared-tuple census before and after, so the run's own log shows
  how many dishes stopped sharing a tuple.

## Why both, in this order

Fix 1 alone makes the payload honest — every DB-supplied macro renders with
`≈` instead of masquerading as fact — but the numbers stay wrong, and PR #50's
shared-tuple gate keeps withholding them entirely. Fix 2 alone would replace
the numbers while leaving the flag able to detach from them again on the next
CMS edit.

Together: the card shows a real ingredient-derived estimate, correctly marked
as an estimate, for every dish the calculator could reach.

## What is still not solved

- The **19 quantity-less dishes** genuinely need the kitchen; no calculator
  reaches them.
- **Nothing here makes anything RD-verified.** `≈` is the honest ceiling for a
  computed estimate; only a dietitian's sign-off earns the unmarked form.
- The **F-1 degrade target** stays an owner decision: dishes still on a shared
  tuple after the backfill render "Macros being verified" rather than a
  number.
