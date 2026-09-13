# "Tem Menu" import — parse result and blocking gaps

**Source** — Google Sheet `1ZcGjwDWmWpNrAFW87GospOAGHGRGLslIbClI4O6RjFY` (tab `gid=1481348867`,
title *Tem Menu*, 104 rows), supplied 2026-09-13 with the instruction to replace the existing
menu and add the corresponding images.

**Payload** — `tem-menu-import-payload.csv` (93 dishes, one row each). It is a *parse result*,
not an applied change: nothing in this commit alters any catalogue, and no dish content was
invented to fill a column the sheet left empty.

---

## 1. What the sheet contains

| | |
|---|---|
| Columns | `Category`, `Item`, `Veg`, `Non Veg` (+ `Prawns`, Pasta only) |
| Rows that parse to a priced dish | **93** |
| Rows excluded | **10** (listed in §4) |
| Distinct sheet categories | 16 |
| Dishes with more than one price | 11 |
| Price range | ₹20 – ₹350 |

Every field the catalogue needs beyond name / price / category is **absent from the sheet**:
no description, ingredients, allergens, macros, glycaemic index, sugar per serving, portion
size, prep time, kitchen, or image reference.

## 2. Overlap with the current catalogue: zero

No sheet item matches any existing dish by name. This is not an edit of the current menu — it
is a different menu. The current catalogue is clinical meal-delivery (rice bowls, khichdi,
high-protein omelettes, RD-reviewed macros); the sheet is café à-la-carte (burgers, mojitos,
Hakka noodles, `Soft Drinks(MRP) — Diet Coke/Coke/Thums Up/Energy Drink`).

## 3. Images: 2 of 93

Dish photography lives at `artifacts/tanmatra/public/images/dishes/` (63 distinct slugs ×
200/400/800 + base `.jpg`), reached by the storefront through `IMAGE_UPSTREAM` and
`lib/catalog.ts#toProxiedImage` (`/dishes/<slug>.jpg` → `/images/dishes/<slug>.jpg`).

| | |
|---|---|
| Exact slug match | **2** — `hummus-pita-classic`, `hummus-pita-with-falafel` |
| No image | **91** |

Eleven further items are *near* an existing slug (`Chicken Wrap` ≈ `barbeque-chicken-burrito-wrap`,
`Paneer Wrap` ≈ `paneer-tikka-burrito-wrap`, `Boiled Egg` ≈ `four-boiled-egg`, …). These are
**not** recorded as matches. They are different dishes at different prices, and attaching one
dish's photograph to another misrepresents what the customer is buying. `lib/menu-catalog`
already carries this rule in its own source: *"reconciled separately, never fuzzy-matched
(per the E1.1 lesson)."*

Photographs for the remaining 91 have to be supplied — they cannot be derived from the sheet.

## 4. Rows excluded from the payload, and why

| Sheet row | Content | Reason |
|---|---|---|
| 15 | `Penne / Veg / Non Veg / Prawns` | column-label sub-header, not a dish |
| 42 | `English Breakfast` | no price; reads as a section label above the breakfast items |
| 48–52 | `Egg style- … (Choose Any 1)`, `Toppings- … (Choose Any 2)`, `Nonveg- … (Choose Any 1)`, `Mashed Potato/Hash Brown (Choose Any 1)`, `2 Bread Slices` | unpriced modifier rows — these are the option groups for `Make Your Breakfast` (₹299), not five separate dishes |
| 71 | `Soft Drinks(MRP) — Diet Coke/Coke/Thums Up/Energy Drink` | category header with no item rows and no price ("MRP") |

Rows 53–55 (`Exotic Vegetable Poha` ₹199, `Moong Daal Chila` ₹180, `Boiled Egg` ₹20) carry the
dish name in the `Category` column with the price shifted one column left. They **are** included,
read as Breakfast items, and flagged in the payload.

## 5. The `Veg` column is not a veg marker — 24 rows

From `Wraps` onward the sheet stops using the `Non Veg` column and puts every price in `Veg`,
including for unambiguously non-vegetarian dishes:

> Chicken Wrap ₹220 · Chicken Pita Pocket ₹280 · Chicken Bowl ₹299 · Chilli Chicken ₹269 ·
> Chicken Manchurian (Dry) ₹249 · Chicken Lollipop ₹229 · Chicken 65 ₹229 · Chicken Fried Rice ₹199 ·
> Chicken Box ₹299 · Buffalo Chicken Wings ₹249 · Loaded Chicken Nachos ₹199 — and 13 more.

Taking the column at face value would mark 24 meat and egg dishes vegetarian, which feeds the
veg mark on the card and dietary-preference matching. The payload therefore derives
`veg_class` from the **dish name**, not the column, and flags every row where the two disagree
(`veg-column-conflict-resolved-from-name`). The sheet should be corrected at source.

## 6. Why this is a payload and not an applied change

Two gates stand between this CSV and a customer-visible menu.

**The catalogue is not in this repository.** Dish rows live in Postgres and are served by
`GET /api/menu/public`. `lib/menu-catalog`'s `DISHES` is the static fallback a database-less
clone renders — rewriting it would change nothing a customer sees. Applying this payload means
writing `menu_items` rows.

**Clinical fields cannot be invented.** `ingredients`, `allergens` and `macros` are safety data
here, not description. `allergensReviewed: false` makes the checkout gate refuse a dish
(`unchecked_allergens`), and a dish at `rdReviewState: "pending_review"` is filtered out of the
public menu until an RD signs off. So a dish imported with these columns blank is hidden from
customers and refused at checkout, and a dish imported with these columns guessed is a false
allergen disclosure on a meal-delivery platform. Neither is a menu replacement. Every row in
the payload therefore carries `rd_review_state=pending_review` and an explicit `blocking_gaps`
list, and the fields stay empty.

## 7. What the payload needs before it can be applied

1. Ingredients per dish (93) — the input allergen derivation and macro estimation both run from.
2. RD allergen review (93) — required for checkout to accept the dish.
3. Macros (93) — estimable from ingredients once (1) exists; `macrosEstimated: true`.
4. Photographs (91).
5. A decision on whether these 93 dishes **replace** the current catalogue or are added
   alongside it — the two menus have no dish in common and describe different propositions.
6. Correction of the 24 `Veg`-column rows at source (§5).
