# The 121 ingredient names that resolve to no inventory item

Generated from `scripts/data/kitchen-data-collection.json` (the RD master sheet
`seed-ops-data.ts` writes from), by replicating that script's own row filters
and `loadDynamicRecipeCosts`' matching algorithm rather than approximating it.

## Why this list exists

`menuEngineering.loadDynamicRecipeCosts` costs a recipe by matching each
free-text ingredient name against `inventory_items.product` with a two-way
substring test (`product.includes(name) || name.includes(product)`) and taking
the first `Array.find` hit. Of **198 distinct ingredient names across 116
dishes**, only **77 match**. The other 121 are listed below, and each one
contributes **zero** to its dish's food cost.

That silence is the problem. The function warns only when a recipe's total
comes to zero, so a dish where four of six ingredients fail still produces a
confident, low, unflagged number — and that number feeds the margin axis of
the star/plowhorse/puzzle/dog matrix.

## The shortcut in the data

**105 of the 121 are already in `lib/menu-catalog/src/nutritionTable.ts`** —
the 174-entry per-100g IFCT 2017 / USDA reference the ingredient→macro
calculator uses, which resolves ingredient names by exact normalised key and
covers 172 of the same 198 names.

So the naming problem is largely solved already, just on the nutrition side
rather than the cost side. Mapping these 121 to `inventory_item_id` is not 121
open-ended research questions; for 105 of them there is a canonical name in the
repo to map through. **16 names are in neither** and are the only ones needing
a decision from scratch — they are marked **no** in the table.

## What each row needs

One of three verdicts:

1. **Map to an existing inventory item** — the name is a variant of something
   already stocked. `Eggs` (14 dishes) against `EGG 2 UNITS` is the largest
   single case: neither string contains the other, so eggs are currently free.
2. **Genuinely no cost** — `Salt & pepper` (31 dishes), `Ice cubes` (10),
   `Water`. Record deliberately so it stops reading as a miss.
3. **Missing inventory row** — the kitchen buys it but it is not on the
   INVENTORY tab. This is the answer that changes COGS most.

Sorted by ingredient-row count, so the top of the table is where the money is.

| # | ingredient | rows | dishes | in nutrition table? | example quantities |
|---:|---|---:|---:|:--:|---|
| 1 | Salt & pepper | 31 | 31 | yes | to taste |
| 2 | Eggs | 14 | 14 | yes | 2 · 3 |
| 3 | Grilled chicken | 13 | 13 | yes | 100 g (sliced) · 100 g (shredded) · 120 g |
| 4 | Ice cubes | 10 | 10 | yes | 4–5 · 3–4 · 4 |
| 5 | Green chili | 9 | 9 | yes | 1 (chopped) · 1 |
| 6 | Parsley | 7 | 7 | yes | 1 tbsp (chopped) · 1 tbsp · 20 g (chopped) |
| 7 | Almond milk | 5 | 5 | yes | 200 ml |
| 8 | Chili flakes | 5 | 5 | yes | ½ tsp |
| 9 | Grilled chicken breast | 5 | 5 | yes | 100 g (sliced strips) · 120 g (cubed) · 120 g |
| 10 | Mushrooms | 5 | 5 | yes | 100 g (battered & fried) · 120 g (battered & fried) · 120 g (crispy fried, peri peri spiced) |
| 11 | Black pepper | 4 | 4 | **no** | ¼ tsp |
| 12 | Bread slices | 4 | 4 | yes | 2 |
| 13 | Chili paste | 4 | 4 | yes | ½ tsp |
| 14 | Cornstarch slurry | 4 | 4 | yes | 1 tbsp |
| 15 | Falafel | 4 | 4 | yes | 3 pcs · 2 pcs each · 4 pcs (crumbled) |
| 16 | Soy sauce | 4 | 4 | yes | 1 tsp |
| 17 | Vinegar | 4 | 4 | yes | 1 tsp |
| 18 | Almonds | 3 | 3 | yes | 20 g (toasted) · 10 pcs (soaked & peeled) · 6 pcs (soaked) |
| 19 | Avocado | 3 | 3 | yes | 1 medium (mashed, ~100 g) · 100 g (mashed) · 100 g |
| 20 | Basil pesto | 3 | 3 | yes | 2 tbsp |
| 21 | BBQ sauce | 3 | 3 | yes | 2 tbsp |
| 22 | Blueberries | 3 | 3 | yes | 50 g (fresh/frozen) · 70 g (fresh/frozen) · 50 g |
| 23 | Chipotle sauce | 3 | 3 | yes | 2 tbsp |
| 24 | Fresh cream | 3 | 3 | yes | 100 ml |
| 25 | Milk/cream | 3 | 3 | yes | 100 ml |
| 26 | Multigrain bread | 3 | 3 | yes | 2 slices |
| 27 | Penne pasta | 3 | 3 | yes | 120 g (boiled) |
| 28 | Pita bread | 3 | 3 | yes | 1 |
| 29 | Pomegranate | 3 | 3 | yes | 30 g |
| 30 | Quinoa | 3 | 3 | yes | 80 g (washed) · 80 g · 80 g (cooked) |
| 31 | Salsa | 3 | 3 | yes | 30 g · 2 tbsp |
| 32 | Spaghetti pasta | 3 | 3 | yes | 120 g (boiled al dente) |
| 33 | Tomato puree | 3 | 3 | yes | 100 g |
| 34 | Whole grain bread | 3 | 3 | yes | 2 slices |
| 35 | Amaranth seeds | 2 | 2 | yes | 50 g · 50 g (cooked) |
| 36 | Beetroot | 2 | 2 | yes | 80 g (boiled & grated) · 80 g |
| 37 | Bell peppers | 2 | 2 | yes | 40 g |
| 38 | Caesar dressing | 2 | 2 | yes | 2 tbsp |
| 39 | Capsicum | 2 | 2 | yes | 30 g · 20 g |
| 40 | Cheese sauce | 2 | 2 | yes | 50 g |
| 41 | Chia seeds | 2 | 2 | yes | 1 tsp · 2 tsp (soaked in water 15 min) |
| 42 | Chicken stock | 2 | 2 | **no** | 200 ml |
| 43 | Chicken tikka | 2 | 2 | yes | 100 g (boneless pieces) · 120 g |
| 44 | Cinnamon powder | 2 | 2 | yes | a pinch · ¼ tsp |
| 45 | Coriander leaves | 2 | 2 | yes | 1 tbsp (chopped) · 1 tsp |
| 46 | Croutons | 2 | 2 | yes | 20 g |
| 47 | Fried noodles | 2 | 2 | yes | 20 g · 20 g (for garnish) |
| 48 | Jalapeños | 2 | 2 | yes | 20 g |
| 49 | Mini pita breads | 2 | 2 | yes | 2 |
| 50 | Mixed veggies (cabbage, carrot, beans) | 2 | 2 | yes | 80 g |
| 51 | Nachos chips | 2 | 2 | yes | 100 g |
| 52 | Nutella | 2 | 2 | yes | 2 tbsp |
| 53 | Peri peri mayo | 2 | 2 | yes | 1 tbsp · 2 tbsp |
| 54 | Ranch/mayo | 2 | 2 | yes | 1 tbsp |
| 55 | Romaine lettuce | 2 | 2 | yes | 80 g |
| 56 | Smoked chicken | 2 | 2 | yes | 80 g (sliced) · 120 g (sliced) |
| 57 | Steamed veggies | 2 | 2 | yes | 70 g |
| 58 | Veg stock | 2 | 2 | **no** | 200 ml |
| 59 | Whole wheat flour | 2 | 2 | yes | 50 g · 20 g |
| 60 | Yogurt | 2 | 2 | yes | 100 g |
| 61 | Yogurt dressing | 2 | 2 | yes | 1 tbsp |
| 62 | Almond milk / low-fat milk | 1 | 1 | **no** | 200 ml |
| 63 | Barnyard millet poha | 1 | 1 | yes | 100 g |
| 64 | Boiled chickpeas | 1 | 1 | yes | 80 g |
| 65 | Brown bread | 1 | 1 | yes | 2 slices |
| 66 | Button mushrooms | 1 | 1 | yes | 100 g (sliced) |
| 67 | Carrot & beans | 1 | 1 | yes | 50 g (chopped) |
| 68 | Chicken strips | 1 | 1 | yes | 120 g (fried, peri peri spiced) |
| 69 | Chickpeas | 1 | 1 | yes | 50 g (boiled) |
| 70 | Cocoa powder | 1 | 1 | yes | 15 g |
| 71 | Crispy peri peri chicken | 1 | 1 | yes | 120 g |
| 72 | Crispy peri peri mushrooms | 1 | 1 | yes | 120 g |
| 73 | Dates puree | 1 | 1 | yes | 50 g |
| 74 | Diet Coke can | 1 | 1 | yes | 1 (chilled) |
| 75 | Dry red chili flakes | 1 | 1 | yes | ½ tsp |
| 76 | Egg whites | 1 | 1 | yes | 3 (boiled, chopped) |
| 77 | Flattened rice (poha) | 1 | 1 | yes | 100 g |
| 78 | Garlic herb seasoning | 1 | 1 | **no** | — |
| 79 | Grapes | 1 | 1 | yes | 30 g |
| 80 | Green apple | 1 | 1 | yes | 1 small |
| 81 | Green tea (brewed & cooled) | 1 | 1 | yes | 200 ml |
| 82 | Herb seasoning | 1 | 1 | **no** | — |
| 83 | Herbs | 1 | 1 | yes | 1 tsp |
| 84 | High-fiber bread slices | 1 | 1 | **no** | 2 |
| 85 | Lettuce, cucumber, tomato | 1 | 1 | yes | 50 g (mixed) |
| 86 | Light salt | 1 | 1 | **no** | — |
| 87 | Mayo/yogurt dip | 1 | 1 | yes | 1 tbsp |
| 88 | Millet flour | 1 | 1 | yes | 200 g |
| 89 | Moong sprouts | 1 | 1 | yes | 80 g |
| 90 | Orange segments | 1 | 1 | yes | 30 g |
| 91 | Papaya | 1 | 1 | yes | 50 g |
| 92 | Paprika | 1 | 1 | yes | a pinch |
| 93 | Peanuts | 1 | 1 | yes | 20 g (roasted) |
| 94 | Peri peri mayo/sauce | 1 | 1 | **no** | 2 tbsp |
| 95 | Peri peri sauce | 1 | 1 | yes | 2 tbsp |
| 96 | Poached egg | 1 | 1 | yes | 1 |
| 97 | Ragi flour | 1 | 1 | yes | 80 g |
| 98 | Ranch yogurt dip | 1 | 1 | yes | 2 tbsp |
| 99 | Ranch yogurt dressing | 1 | 1 | yes | 2 tbsp |
| 100 | Rice (optional) | 1 | 1 | **no** | 50 g |
| 101 | Salt & black pepper | 1 | 1 | yes | to taste |
| 102 | Salt & turmeric | 1 | 1 | yes | to taste |
| 103 | Salt, pepper | 1 | 1 | **no** | to taste |
| 104 | Sauce/dip of choice | 1 | 1 | yes | 2 tbsp |
| 105 | Soda water | 1 | 1 | yes | 200 ml |
| 106 | Sour cream | 1 | 1 | yes | 20 g |
| 107 | Spaghetti/Fettuccine pasta | 1 | 1 | **no** | 120 g (boiled al dente) |
| 108 | Steamed broccoli & carrots | 1 | 1 | yes | 70 g |
| 109 | Steamed vegetables | 1 | 1 | yes | 70 g |
| 110 | Stevia/sugar-free | 1 | 1 | **no** | 1 sachet |
| 111 | Thums Up can | 1 | 1 | yes | 1 (chilled) |
| 112 | Tofu | 1 | 1 | yes | 100 g (grilled) |
| 113 | Turmeric | 1 | 1 | **no** | ¼ tsp |
| 114 | Veg stock / water | 1 | 1 | yes | 200 ml |
| 115 | Veggies | 1 | 1 | yes | 70 g |
| 116 | Warm water | 1 | 1 | yes | 120 ml |
| 117 | Water/veg stock | 1 | 1 | **no** | 200 ml |
| 118 | Watermelon cubes | 1 | 1 | yes | 200 g |
| 119 | Whey protein | 1 | 1 | yes | 1 scoop |
| 120 | White bread | 1 | 1 | yes | 2 slices |
| 121 | Yogurt / almond milk | 1 | 1 | **no** | 200 ml |

## The 16 in neither list

These have no inventory match and no nutrition-table entry. Most are compound
or optional tokens rather than true ingredients, which suggests splitting or
normalising them rather than sourcing a price:

`almond milk / low-fat milk` · `yogurt / almond milk` · `water/veg stock` ·
`spaghetti/fettuccine pasta` · `peri peri mayo/sauce` · `stevia/sugar-free` ·
`rice (optional)` · `salt, pepper` · `light salt` · `black pepper` ·
`turmeric` · `herb seasoning` · `garlic herb seasoning` ·
`high-fiber bread slices` · `chicken stock` · `veg stock`

The slash-separated ones are two ingredients in one string — the recipe offers
a choice. Neither the cost path nor the nutrition path can resolve those
without a rule for which side to price.

## Separately: the unit parse drops 371 of 667 rows

Not a naming problem, but it compounds this one. `parseGrams` is
`/(\d+)\s*g/i`, so any quantity not written in grams reads as zero grams and
therefore zero cost regardless of whether the name matched:

| unit | ingredient rows |
|---|---:|
| g | 297 |
| tbsp | 97 |
| tsp | 83 |
| ml | 31 |
| pcs | 7 |
| clove | 4 |
| pinch | 3 |
| cup | 2 |

Per dish: **5** fully gram-parsed, **96** partially parsed, **15** unparsed.

`lib/menu-catalog/src/nutritionCalc.ts` already solves this properly —
`parseQuantity` handles unicode fractions (`½`), ranges (`6–8`), and
`UNIT_FIXED` / `SPOON_DRY` / `SPOON_LIQUID` conversion tables. The cost path
should call it rather than keep its own weaker regex.

## Also worth adjudicating: 25 weak matches

These 25 names DO match, on a fragment shorter than half the name. Some are
fine, some are wrong:

```
"whole wheat tortilla"  →  "TILL"   @ ₹215/kg   ← torTILLa contains "till" (sesame seeds)
"tortilla/pita"         →  "TILL"   @ ₹215/kg
"mashed potato"         →  "POTATO" @ ₹15.46/kg ← raw price for a prepared item
"zucchini, bell peppers, broccoli" → "ZUCCHINI" ← one of three, priced as all
"ranch yogurt/mint chutney"        → "MINT" @ ₹9.5/kg
"lemon juice"           →  "LEMON"  @ ₹81/kg    ← reasonable
```

A wrong match is worse than no match: no match costs zero and is at least
visible as an absence, while a wrong match produces a plausible number nobody
questions.
