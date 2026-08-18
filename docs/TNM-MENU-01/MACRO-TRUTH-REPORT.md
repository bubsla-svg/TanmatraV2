# Macro truth report — live catalogue vs computed

Generated against `GET https://tanmatra.food/api/menu/public` (112 live dishes) using
`computeCatalogMacrosFromIngredients()` from `lib/menu-catalog` — the engine already in this
repo, with its bundled 168-entry per-100 g reference table.

## Summary

| | dishes |
|---|---:|
| Live dishes | 112 |
| Computable (ingredient list with quantities) | 95 |
| &nbsp;&nbsp;of which **high** confidence (coverage ≥ 85%) | **91** |
| &nbsp;&nbsp;of which low confidence | 4 |
| Not computable — `ingredients: ["fresh ingredients"]` | **17** |
| High-confidence dishes whose LIVE macros are wrong by ≥ 40% | **33** |
| High-confidence dishes with no live calories at all | 1 |

## The live macros are stamped buckets, not measurements

88% of the catalogue (98/112) shares a macro block with at least one other dish — only **34
distinct macro tuples across 112 dishes**. `macrosProvisional` is `false` on all 112, so every
one of them renders as plain fact.

Clearest single proof: **Diet Coke** carries the smoothie bucket — 140 kcal, 3 g protein,
22 g carbs. A diet soda has none of those.

## Worst 25 divergences (high-confidence dishes only)

| Dish | live kcal | computed | Δ | live P/C/F | computed P/C/F |
|---|---:|---:|---:|---|---|
| Antioxidant Boost Smoothie | 140 | 484 | +246% | 3/22/4 | 15/96/5 |
| Powerhouse Smoothie — Oats & Banana | 140 | 446 | +219% | 15/22/4 | 34/46/16 |
| Ragi & Dates Brownie (eggless) | 240 | 713 | +197% | 6/30/10 | 14/116/26 |
| Cream of Chicken | 140 | 347 | +148% | 6/14/10 | 41/8/16 |
| Peanut Butter Banana Smoothie | 140 | 327 | +134% | 3/22/4 | 10/38/18 |
| Moong Dal Chilla with Curd (2 pc) | 260 | 527 | +103% | 12/22/14 | 32/76/10 |
| Diet Coke | 140 | 0 | -100% | 3/22/4 | 0/0/0 |
| Zero-Calorie Mint Mojito | 140 | 4 | -97% | 3/22/4 | 0/1/0 |
| Lemon Mint Iced Tea | 140 | 21 | -85% | 3/22/4 | 0/6/0 |
| Blueberry Smoothie | 140 | 249 | +78% | 3/22/4 | 8/43/8 |
| Grilled Veggie Sandwich with Ranch Yoghurt | 268 | 61 | -77% | 11/38/8 | 2/7/3 |
| Falafel Garden Salad | 220 | 382 | +74% | 12/12/14 | 10/27/27 |
| Manchow Soup | 140 | 242 | +73% | 6/14/6 | 13/19/12 |
| Dates Banana Smoothie | 140 | 241 | +72% | 3/22/4 | 3/56/3 |
| Alfredo Pasta | 480 | 801 | +67% | 14/65/22 | 18/48/60 |
| Mixed Berry Protein Smoothie | 460 | 769 | +67% | 18/45/14 | 44/125/11 |
| Chia Lemonade Smoothie | 140 | 48 | -66% | 3/22/4 | 1/8/2 |
| Classic Vegetable Poha | 260 | 421 | +62% | 12/22/14 | 8/83/7 |
| Millets Poha Barnyard | 260 | 421 | +62% | 12/22/14 | 8/79/8 |
| Chicken Caesar Salad | 320 | 514 | +61% | 26/12/14 | 46/17/28 |
| Two Boiled Eggs | 340 | 143 | -58% | 20/22/14 | 13/1/10 |
| Watermelon Juice | 140 | 62 | -56% | 3/22/4 | 1/16/0 |
| Paneer Tikka Wrap | 380 | 587 | +54% | 16/45/18 | 27/45/33 |
| Classic Hummus Pita | 380 | 196 | -48% | 16/45/14 | 6/22/10 |
| Paneer Wrap (Whole Wheat) | 380 | 557 | +47% | 16/45/18 | 26/42/31 |

## 17 dishes that cannot be computed — no ingredient data

Their `ingredients` array is the literal string `["fresh ingredients"]`. These need content
work, not computation. On a site with an allergen filter and a Diabetic Safe filter, they
answer "what is in this?" with nothing.

- 3 Boiled Eggs with Sautéed Veggies
- Aam Panna
- ABC Juice — Apple Beet Carrot
- Aglio Olio Pasta
- Boiled Egg (1 pc)
- Classic French Toast with Butter
- English Breakfast
- Fruity Greek Yogurt
- Garlic Bread
- Grilled Paneer with Sautéed Veg
- Grilled Veg Club Sandwich
- Mushroom & Caramelised Onion Sandwich
- Roasted Veg Quinoa Salad
- Special Mutton Paya
- Stuffed Chicken with Beans & Mash
- Tiramisu Box
- Watermelon Mint Cooler

## Recommended `macroTrust` assignment

| Bucket | Count | `macroTrust` | UI treatment |
|---|---:|---|---|
| computed, high confidence | 91 | `estimated` | render with ≈ |
| computed, low confidence | 4 | `unverified` | withhold the number |
| no ingredient data | 17 | `unverified` | withhold the number |

**Nothing here earns `verified`.** That tier should require a lab result or a named RD sign-off
per dish. `rdVerified` is `true` on 112/112 and is therefore not evidence of review (finding F5).

## Also found

- **Chicken Meal — 150 g grilled chicken + veggies + rice** (₹299): ingredients list only
  `Grilled chicken breast – 120 g, Olive oil – 1 tsp, Herb seasoning`; macros say 0 g carbs and
  0 g fibre. The title sells rice and vegetables the data does not contain, at ₹100 over the
  plain chicken breast — and a customer filtering Diabetic Safe sees 0 g carbs on a rice dish.
- **Boiled Chicken Breast (150 g)**: ingredients say 120 g. The title states the exact quantity
  a macro-counting customer relies on, and it disagrees with the recipe.
- **77 of 112 descriptions are mechanically derived** from the ingredient list rather than
  written; one (`Activated Charcoal Smoothie`) leaks the glycaemic-index value into the copy:
  "Almond milk / low".

