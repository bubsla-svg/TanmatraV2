# PANTS integration plan

Follows `NUTRITION-INTEGRATION-SCOPE.md`. That document concluded PANTS is a
**design reference, not a dependency** (Django app, Apache-2.0, WIP REST API).
This is the plan for adopting the idea — rewritten after reading our own
schema, because what I found there changes both the design and the priority.

## What changed after reading our own schema

The scope doc proposed parsing the free-text `ingredients[]` strings and
looking each up in USDA FDC. That is the wrong design, but not for the reason
I first wrote down. We do not have *one* ingredient model to extend. **We have
three parallel truths about what a dish is made of, and they disagree.**

| # | model | populated? | consumed by |
|---|---|---|---|
| 1 | `menu_items.ingredients[]` — free text | yes | the storefront card + drawer |
| 2 | `recipes` + `recipe_ingredients` — free text `ingredient` / `quantityText` / `rawText`, plus hand-entered nutrition columns and a `foodCostPaise` fallback | yes, from the RD master sheet | `menuEngineering.loadDynamicRecipeCosts` → the margin axis of the star/plowhorse/puzzle/dog matrix |
| 3 | `dish_bom_components` — structured `inventoryItemId` + numeric `quantityNeeded` + normalised `unit` | **no writer exists** (see below) | `bomEngine` (order depletion, PO drafting, morning prep brief), `marginGuardrailEngine` (wholesale spike → pricing suggestions) |

**PANTS' core insight is that one ingredient row carries BOTH cost and
nutrition, and recipes compose from quantity-bearing ingredient rows.** Model 3
is exactly that shape — and it is the one nothing populates. Model 2 is
populated and is the one doing the costing, via free-text fuzzy matching.

So the integration is not "add nutrition to the ingredient table". It is
**collapse three models onto the structured one, then hang nutrition off it.**

### `dish_bom_components` has three readers and no writer

Verified across `artifacts/`, `lib/` and `scripts/`: every reference is a
`SELECT`.

- `bomEngine.ts:49` and `:197` — both guarded by `if (!bomRows.length) return [];`
- `marginGuardrailEngine.ts:78` — empty `bomRows` yields `affectedDishes: []`
  and `pricingSuggestionsCreated: 0`

`seed-ops-data.ts` seeds `inventory_items`, `packaging_items`, `recipes` and
`recipe_ingredients` — **not** `dish_bom_components`. Migration `0018` creates
the table and inserts nothing.

If the table is empty in production, then real-time inventory depletion, the
4 AM prep brief, automatic PO drafting, and the entire wholesale-spike margin
guardrail are **silent no-ops** — each returns early on an empty read rather
than raising. I cannot prove the production table is empty from here (a row
could have been inserted out of band); a single `count(*)` settles it, and
that is the first thing Phase 0 asks.

## What the RD master sheet already contains

`scripts/data/kitchen-data-collection.json` is in-repo and is what
`seed-ops-data.ts` writes from. Measured directly, replicating the script's
own row filters and parsers rather than eyeballing:

| | |
|---|---|
| dishes | **117** (116 with ingredient rows; `Coke Can` has none) |
| ingredient rows | **667** |
| distinct ingredient names | **198** |
| `inventory_items` actually seeded | **122** (2 blank spacer rows are skipped at `seed-ops-data.ts:110`) |

**122 is the FDC lookup count** — not the ~560 the scope doc estimated from
per-dish-ingredient strings. Match review is the whole risk control, so
shrinking it 4.6× is the point, and it makes the reviewed mapping a
one-afternoon job rather than a project.

## The COGS defect this surfaced

Not a nutrition finding, but it is the strongest argument for the structured
model, so it belongs here. `loadDynamicRecipeCosts` costs a recipe by
fuzzy-matching each free-text ingredient name to an inventory product and
multiplying grams by price-per-kg. Both halves leak, measured on the seeded
data:

**The match** — two-way substring, `Array.find`, first wins:

```
77 / 198 distinct ingredient names match an inventory row.
121 / 198 match nothing at all → they contribute zero cost.
```

Among the 77 that do match, 25 match on a fragment shorter than half the
ingredient name. Some are benign (`"lemon juice"` → `LEMON`). Some are not:

```
"whole wheat tortilla"  →  "TILL"  @ ₹215/kg     (torTILLa — sesame seeds)
"tortilla/pita"         →  "TILL"  @ ₹215/kg
"mashed potato"         →  "POTATO" @ ₹15.46/kg  (raw potato price for a prepared item)
"zucchini, bell peppers, broccoli" → "ZUCCHINI" @ ₹76/kg  (one of three, priced as all)
```

**The unit parse** — `parseGrams` is `/(\d+)\s*g/i`, so anything not
denominated in grams reads as **zero grams and therefore zero cost**:

```
296 / 667 ingredient rows yield grams.
371 / 667 yield zero — every tbsp (97), tsp (83), ml (31), pcs (7), cup (2), clove (4), pinch (3).
```

Per dish, that lands as:

| | dishes |
|---|---|
| every ingredient gram-parsed | **5** |
| **partially parsed — cost silently understated** | **96** |
| nothing parsed → falls back to `foodCostPaise` | 15 |

The 96 are the problem. `loadDynamicRecipeCosts` warns only when a recipe's
total is zero, so those 96 produce a confident, low, unflagged food cost. The
golden test guarding this function states the stakes itself: a different match
winner "means a different food cost, which feeds the margin axis of the
star/plowhorse/puzzle/dog matrix and can move a real price."

`dish_bom_components` has no such failure mode by construction — an explicit
`inventoryItemId` foreign key instead of substring matching, and a numeric
`quantityNeeded` with a normalised `unit` instead of a regex over prose. The
structured table is the fix for a live costing defect, independent of anything
nutrition-related.

## CORRECTION — the recipes table is NOT contaminated by F-1

**This section previously claimed the opposite, and it was wrong.** Recorded
here rather than deleted, because the mistake is instructive: it read one line
of the seed without following what fed it.

`seed-ops-data.ts:226` does set the recipe nutrition columns from
`cat?.macros`:

```ts
caloriesKcal: m?.calories ?? null,
proteinG:     m?.protein  ?? null,
```

But `catByName` is built from **`DISHES`**, not from the raw seed rows — and
`DISHES` (`lib/menu-catalog/src/index.ts:4667`) already overlays
`ESTIMATED_MACROS` on top of every dish whose seed macros were a duplicated
placeholder. So `cat.macros` is the *good* ingredient-derived estimate for the
104 dishes that have one. Measured: the static catalog is **116 dishes with
116 distinct tuples — zero duplicates.**

The real conclusion is the reverse of what was written here, and more useful:

> The clean numbers already exist in the repo, and the F-1 duplication lives
> **only** in the `menu_items` DB rows, which `getMergedCatalog` lets override
> the static catalog.

That reframes the whole problem from "compute nutrition" to "serve the
nutrition we already computed" — see `docs/TNM-MENU-01/MACRO-PROVENANCE.md`
for the root cause and the two fixes that follow from it.

## Phase 0 — confirm the two unknowns (read-only, gates everything)

Two questions, one read-only run through the `workflow_dispatch` pattern
`menu-catalog-v2.yml` already uses against Cloud SQL:

1. `select count(*) from dish_bom_components` — and the distinct `dish_slug`
   count. This decides whether Phase 1 is a backfill or a repair.
2. `select count(*) from recipes where calories_kcal is not null` — how far
   the F-1 macros actually propagated.

Also worth reporting in the same run: distinct `inventory_items` referenced by
BOM rows, the unit vocabulary present, and any BOM row with `quantityNeeded`
of 0 or null.

**Gate:** if the BOM table is empty (expected, given no writer exists), Phase 1
is the backfill below. If it has partial data, Phase 1 becomes a reconcile and
the backfill must not clobber hand-entered rows.

## Phase 1 — populate `dish_bom_components` from the RD master sheet

The single highest-value step, and it pays off before any nutrition work: it
turns three dead engines on and replaces fuzzy-matched costing with explicit
foreign keys.

Source is the sheet already in-repo — 667 ingredient rows across 116 dishes
against 122 inventory items. The work is the two things the current path does
badly:

- **Resolve ingredient name → `inventory_item_id` explicitly.** 198 decisions,
  emitted as a reviewed in-repo CSV, not a substring match at runtime. The 121
  currently matching nothing and the 25 weak matches are exactly the rows a
  human must adjudicate. Some will legitimately resolve to nothing (`"Salt - to
  taste"`, `"Ice cubes"`) and should be recorded as deliberate no-cost rows
  rather than silent misses.
- **Normalise quantity → `{quantityNeeded, unit}`.** The 371 non-gram rows need
  real conversion, not a regex. `usda_fdc_python` (MIT) is worth reading first
  for its conversion tables. Density-dependent volumes (`"1 cup vegetables"`)
  route to the kitchen rather than being guessed; oil by tbsp is fine.

Plan-then-apply, the pattern M-3 proved: propose → reviewed CSV → human
accepts/corrects → apply behind `workflow_dispatch` → re-plan and assert
convergence.

## Phase 2 — give ingredients nutrition

Additive columns on `inventory_items`, same additive-migration discipline M-2
used:

```
nutrition_per_100g   jsonb    { kcal, proteinG, carbsG, fatG }
fdc_id               integer
fdc_match_note       text     -- which FDC food, and why it was accepted
nutrition_source     varchar  -- 'usda_fdc' | 'kitchen' | 'supplier_label'
```

A `lib/nutrition-usda` workspace package: a typed FDC client (~200 lines,
matching the hand-written client style in `artifacts/storefront/lib/`) plus
unit conversion shared with Phase 1.

Population is the same plan-then-apply loop, and it is **122 reviewed rows**
rather than 560. Indian-specific items (paneer, besan, jaggery, ghee, poha) are
where FDC is weakest; those should be expected to fail matching and route to
`nutrition_source = 'kitchen'` rather than be forced into a bad match.

## Phase 3 — compute dish macros from the BOM

`computeDishMacros(dishSlug)` in `artifacts/api-server/src/lib/`, reusing the
traversal `executeBomExplosion` already performs.

Rules, non-negotiable:

- Writes `macros` and `macrosAreEstimate: true`. **Never** `rdVerified`. RD
  sign-off remains the only thing that earns the word "verified" — this
  respects the `macroTrust` ladder instead of routing around it.
- A dish with incomplete BOM coverage yields **no macros**, not partial ones.
  A half-summed dish is a fabricated number with extra steps, which is the
  defect being fixed. Note this is the same trap the COGS path fell into: 96
  dishes silently understated because partial data was treated as complete.
- Emits a plan diffing computed vs. stored before anything is written — and
  that diff, against `recipes.calories_kcal`, is the measurement of how wrong
  F-1 made the ops tables.

## Phase 4 — close F-1 at the display layer regardless

Independent of all the data work, and **shippable first**: generalise
`macroTrust` from "equals the one hard-coded stub" to "is this macro tuple
non-unique across the catalog". A tuple shared by unrelated dishes can never
read as `verified`.

This is the safety net. Even if Phases 0–3 slip, no customer sees a fabricated
number presented as fact. **The degrade target is still an owner decision**
(see the review's Decisions section) — blanking ~78 cards is a merchandising
call, not an engineering one.

## Phase 5 — the payoff PANTS actually demonstrates

Once an ingredient row carries cost *and* nutrition:

- **One source of truth.** A recipe change moves macros and COGS together.
  Today they are independent truths that can silently disagree.
- **Margin and nutrition stop being separate systems.**
  `marginGuardrailEngine` and the macro path read the same rows — and the
  guardrail starts firing at all.
- **Recursive recipes** — the one PANTS idea we genuinely lack. PANTS lets a
  recipe be an ingredient of another recipe. Our combos and bundles do not
  compose their constituents' BOMs, so a combo's macros and cost are not
  derived from the dishes in it. Worth adopting *after* Phases 1–3, because it
  is only meaningful once the leaf nodes carry both numbers.

## Explicitly not taking from PANTS

- The Django application, its ORM, its templates, its WIP REST API.
- Diary and Targets — Tanmatra already has wellness logging and plan targets.
- Any **code**. Apache-2.0 would permit it with attribution, but the value here
  is the model, and the model is a join table we already have plus four columns
  we can add natively.

## Sequencing recommendation

**Phase 4 first** — small, no dependencies, closes a live customer-facing
defect. Then **Phase 0** (one read-only run, cheap, decides the rest), then
**Phase 1**, which is worth doing on the COGS argument alone even if the
nutrition work never happens. Then 2 → 3 → 5.

## Open items

1. **BOM row count in production** — Phase 0. Everything downstream is
   contingent, and if it is zero, four shipped engines are no-ops today.
2. **F-1 degrade target** — owner call, still outstanding.
3. **FDC API key** — free, needs to exist as a secret before Phase 2.
4. **The 121 unmatched ingredient names** — needs a kitchen/RD pass to say
   which are genuinely no-cost and which are missing inventory rows.
