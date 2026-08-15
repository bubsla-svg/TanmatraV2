# TNM-MENU-01 M-3 plan — 2026-08-15T14:38:45.487Z

> **Rehearsal run** — executed against a staging database seeded to production shape
> (116 static-seed dishes + 23 db-only rows from the slug map, all flipped available to
> mirror the F2 state). The production apply re-plans against the live database; the
> action mix and the seven STOP-AND-ASK ungoverned keeps are expected to match, row
> counts in the archive set may differ slightly (aggregator-only SKUs absent here).
> Result: applied in one transaction · re-plan converged to 0 actions · §7.1 checksum
> MATCH · §7 verify shows the single expected violation (`antioxidant-detox` carries a
> banned claim word and is an ungoverned KEEP — owner ruling required, see below).

Actions: {"update":75,"create":17,"archive":30,"seasonal":1} · blockers: 0
Expected §7.1 checksum: `8cc4c88ebc42245d2c45d1c3ac3b21fdc8ab54f0922fff8e7f940c22111fc2fd`

## Blockers — apply refuses while any exist (0)

- (none)

## Creates (Law-8 gated: unavailable until M-6 macros) (17)

- `paneer-meal-120-g-paneer-veggies-rice` ← "Paneer Meal — 120 g paneer + veggies + rice" · High-Protein Meals #4 · 24900p · veg
- `veggie-meal-100-g-veg-150-g-rice` ← "Veggie Meal — 100 g veg + 150 g rice" · High-Protein Meals #7 · 19900p · veg
- `tuscan-chicken-with-bread-rice` ← "Tuscan Chicken with Bread/Rice" · High-Protein Meals #8 · 24900p · non-veg
- `marry-me-mushroom-with-bread-rice` ← "Marry Me Mushroom with Bread/Rice" · High-Protein Meals #9 · 21900p · veg · New
- `spinach-corn-sandwich` ← "Spinach & Corn Sandwich" · Sandwiches #6 · 14900p · veg · New
- `edamame-corn-salad` ← "Edamame & Corn Salad" · Salads #7 · 24900p · veg · New
- `turkish-eggs-lb-r-2-pc` ← "Turkish Eggs — Çılbır (2 pc)" · Breakfast & Eggs #9 · 19900p · egg · New
- `egg-oats-banana-pancakes-4-pc` ← "Egg Oats Banana Pancakes (4 pc)" · Breakfast & Eggs #10 · 17900p · egg · New
- `egg-shakshuka` ← "Egg Shakshuka" · Breakfast & Eggs #13 · 17900p · egg
- `make-your-own-omelette-2-eggs` ← "Make Your Own Omelette (2 eggs)" · Breakfast & Eggs #14 · 11900p · egg · New
- `pumpkin-soup` ← "Pumpkin Soup" · Soups #6 · 12900p · veg · New
- `sirka-pyaaz` ← "Sirka Pyaaz" · Sides & Sips #2 · 4900p · veg
- `chilli-paneer-dry-tossed` ← "Chilli Paneer — Dry Tossed" · Off the Wok #1 · 19900p · veg · New
- `chilli-chicken-dry-tossed` ← "Chilli Chicken — Dry Tossed" · Off the Wok #2 · 21900p · non-veg · New
- `hakka-noodles-choose-your-protein` ← "Hakka Noodles — Choose Your Protein" · Off the Wok #3 · 14900p · veg · New
- `wok-fried-rice-choose-your-protein` ← "Wok Fried Rice — Choose Your Protein" · Off the Wok #4 · 14900p · veg · New
- `lemon-chicken-dry-tossed` ← "Lemon Chicken — Dry Tossed" · Off the Wok #5 · 21900p · non-veg · New

## Updates (field diffs only) (75)

- `grilled-chicken-sauteed-veg-mash-potato`: name: "Grilled Chicken With Sautéed Vegetable And Mash Potato High Protein" → "Grilled Chicken with Veggies & Mash" · pricePaise: 33300 → 29900 · sectionOrder: null → 1 · sortRank: null → 1 · vegClass: null → "non-veg" · badge: null → "Bestseller"
- `grilled-chicken-breast-single-serve`: name: "Grilled Chicken Breast [Single Serve]" → "Chicken Meal — 150 g grilled chicken + veggies + rice" · pricePaise: 36000 → 29900 · sectionOrder: null → 1 · sortRank: null → 2 · vegClass: null → "non-veg"
- `stuffed-chicken-with-mashed-potato-saut-ed-green-beans`: pricePaise: 24000 → 29900 · sectionOrder: null → 1 · sortRank: null → 3 · vegClass: null → "non-veg" · isVeg: true → false · badge: null → "New"
- `grilled-paneer-with-sauteed-veggies`: pricePaise: 24000 → 19900 · sectionOrder: null → 1 · sortRank: null → 5 · vegClass: null → "veg"
- `boiled-chicken-breast-single-serve`: name: "Boiled Chicken Breast [Single Serve]" → "Boiled Chicken Breast (150 g)" · pricePaise: 28900 → 19900 · sectionOrder: null → 1 · sortRank: null → 6 · vegClass: null → "non-veg"
- `barbeque-grilled-chicken-rice-bowl`: name: "Barbeque Grilled Chicken Rice Bowl" → "Chicken Burrito Bowl — choose your sauce" · pricePaise: 24900 → 29900 · sectionOrder: null → 2 · sortRank: null → 1 · vegClass: null → "non-veg"
- `chilli-chipotle-paneer-rice-bowl`: name: "Chilli Chipotle Paneer Rice Bowl" → "Paneer Burrito Bowl — choose your sauce" · pricePaise: 19900 → 24900 · sectionOrder: null → 2 · sortRank: null → 2 · vegClass: null → "veg"
- `crispy-mushroom-rice-bowl`: name: "Crispy Mushroom Rice Bowl" → "Mushroom Burrito Bowl — choose your sauce" · pricePaise: 22900 → 19900 · sectionOrder: null → 2 · sortRank: null → 3 · vegClass: null → "veg"
- `quinoa-khichdi`: pricePaise: 9900 → 17900 · sectionOrder: null → 2 · sortRank: null → 4 · vegClass: null → "veg"
- `barbeque-chicken-burrito-wrap`: name: "Barbeque Chicken Burrito Wrap" → "BBQ Chicken Tikka Wrap" · pricePaise: 22900 → 19900 · sectionOrder: null → 3 · sortRank: null → 1 · vegClass: null → "non-veg" · badge: null → "Trending"
- `healthy-whole-wheat-chicken-tikka-wrap`: name: "Healthy Whole Wheat Chicken Tikka Wrap" → "Chicken Tikka Wrap (Whole Wheat)" · pricePaise: 21900 → 19900 · sectionOrder: null → 3 · sortRank: null → 2 · vegClass: null → "non-veg"
- `paneer-tikka-burrito-wrap`: name: "Paneer Tikka Burrito Wrap" → "Paneer Tikka Wrap" · pricePaise: 19900 → 17900 · sectionOrder: null → 3 · sortRank: null → 3 · vegClass: null → "veg"
- `falafal-hummus-wrap`: name: "Falafal Hummus Wrap" → "Falafel Hummus Wrap" · pricePaise: 19900 → 17900 · sectionOrder: null → 3 · sortRank: null → 4 · vegClass: null → "veg"
- `crispy-mushroom-burrito-wrap`: name: "Crispy Mushroom Burrito Wrap" → "Mushroom Wrap — choose your sauce" · pricePaise: 19900 → 15900 · sectionOrder: null → 3 · sortRank: null → 5 · vegClass: null → "veg"
- `healthy-whole-wheat-paneer-wrap`: name: "Healthy Whole Wheat Paneer Wrap" → "Paneer Wrap (Whole Wheat)" · pricePaise: 19900 → 17900 · sectionOrder: null → 3 · sortRank: null → 6 · vegClass: null → "veg"
- `grilled-veggie-sandwich-ranch-yoghurt`: name: "Grilled Veggie Sandwich With Ranch Yoghurt" → "Grilled Veggie Sandwich with Ranch Yoghurt" · pricePaise: 26000 → 16900 · sectionOrder: null → 4 · sortRank: null → 1 · vegClass: null → "veg"
- `grilled-chicken-club-sandwich`: pricePaise: 24000 → 19900 · sectionOrder: null → 4 · sortRank: null → 2 · vegClass: null → "non-veg" · isVeg: true → false
- `chicken-tikka-sandwich-with-ranch-yoghurt`: pricePaise: 21900 → 18900 · sectionOrder: null → 4 · sortRank: null → 3 · vegClass: null → "non-veg"
- `grilled-paneer-sandwich-with-ranch-yoghurt`: pricePaise: 24000 → 17900 · sectionOrder: null → 4 · sortRank: null → 4 · vegClass: null → "veg"
- `grilled-veg-club-sandwich`: pricePaise: 24000 → 16900 · sectionOrder: null → 4 · sortRank: null → 5 · vegClass: null → "veg" · badge: null → "New"
- `mushroom-caramelised-onion-sandwich`: pricePaise: 24000 → 15900 · sectionOrder: null → 4 · sortRank: null → 7 · vegClass: null → "veg"
- `falafel-garden-salad`: pricePaise: 15900 → 19900 · sectionOrder: null → 5 · sortRank: null → 1 · vegClass: null → "veg"
- `broccoli-lemon-chicken-salad`: pricePaise: 21900 → 24900 · sectionOrder: null → 5 · sortRank: null → 2 · vegClass: null → "non-veg"
- `chicken-caesar-story-salad`: name: "Chicken Caesar Story Salad" → "Chicken Caesar Salad" · pricePaise: 26900 → 24900 · sectionOrder: null → 5 · sortRank: null → 3 · vegClass: null → "non-veg"
- `grilled-paneer-salad`: pricePaise: 24000 → 19900 · sectionOrder: null → 5 · sortRank: null → 4 · vegClass: null → "veg"
- `roasted-vegetable-quinoa-salad`: pricePaise: 24000 → 19900 · sectionOrder: null → 5 · sortRank: null → 5 · vegClass: null → "veg" · badge: null → "New"
- `fruity-sprout-salad`: pricePaise: 15900 → 19900 · sectionOrder: null → 5 · sortRank: null → 6 · vegClass: null → "veg"
- `grilled-chicken-salad`: pricePaise: 24000 → 24900 · sectionOrder: null → 5 · sortRank: null → 8 · vegClass: null → "non-veg" · isVeg: true → false
- `veg-caesar-story-salad`: name: "Veg Caesar Story Salad" → "Veg Caesar Salad" · pricePaise: 18900 → 19900 · sectionOrder: null → 5 · sortRank: null → 9 · vegClass: null → "veg"
- `avocado-toast`: pricePaise: 24000 → 29900 · sectionOrder: null → 6 · sortRank: null → 1 · vegClass: null → "veg" · badge: null → "Bestseller"
- `avocado-toast-with-sunny-side-up`: name: "Avocado Toast with Sunny Side Up" → "Avocado Toast with Sunny Side Up (2 pc)" · pricePaise: 28000 → 31900 · sectionOrder: null → 6 · sortRank: null → 2 · vegClass: null → "egg"
- `moong-dal-chilla-with-curd`: name: "Moong Dal Chilla with Curd" → "Moong Dal Chilla with Curd (2 pc)" · pricePaise: 10900 → 12900 · sectionOrder: null → 6 · sortRank: null → 3 · vegClass: null → "veg"
- `boiled-3-egg-with-saut-ed-veggies`: pricePaise: 24000 → 12900 · sectionOrder: null → 6 · sortRank: null → 4 · vegClass: null → "egg" · isVeg: true → false
- `high-protein-chicken-omelette`: name: "High Protein Chicken Omelette" → "High Protein Chicken Omelette (2 eggs)" · pricePaise: 16900 → 14900 · sectionOrder: null → 6 · sortRank: null → 5 · vegClass: null → "non-veg"
- `english-breakfast`: pricePaise: 24000 → 24900 · sectionOrder: null → 6 · sortRank: null → 6 · vegClass: null → "egg" · isVeg: true → false
- `smoked-chicken-cheese-omelette`: name: "Smoked Chicken Cheese Omelette" → "Smoked Chicken & Cheese Omelette" · pricePaise: 17500 → 17900 · sectionOrder: null → 6 · sortRank: null → 7 · vegClass: null → "non-veg"
- `classic-french-toast-with-butter`: pricePaise: 24000 → 14900 · sectionOrder: null → 6 · sortRank: null → 8 · vegClass: null → "veg" · badge: null → "New"
- `spinach-mushroom-omelette`: name: "Spinach Mushroom Omelette" → "Spinach Mushroom Omelette (2 eggs)" · pricePaise: 13900 → 15900 · sectionOrder: null → 6 · sortRank: null → 11 · vegClass: null → "egg"
- `veg-loaded-bread-omelette-2-egg`: name: "Veg Loaded Bread Omelette (2 Egg)" → "Veg Loaded Omelette (2 eggs)" · sectionOrder: null → 6 · sortRank: null → 12 · vegClass: null → "egg"
- `classic-bread-omelette-2-egg`: name: "Classic Bread Omelette (2 Egg)" → "Bread Omelette — Classic / Masala" · pricePaise: 8900 → 12900 · sectionOrder: null → 6 · sortRank: null → 15 · vegClass: null → "egg"
- `plain-omelette`: name: "Plain Omelette" → "Plain Omelette (2 eggs)" · pricePaise: 11900 → 9900 · sectionOrder: null → 6 · sortRank: null → 16 · vegClass: null → "egg"
- `exotic-egg-bhurji`: name: "Exotic Egg Bhurji" → "Exotic Egg Bhurji (2 eggs)" · pricePaise: 10900 → 11900 · sectionOrder: null → 6 · sortRank: null → 17 · vegClass: null → "egg"
- `classic-vegetable-poha`: pricePaise: 10900 → 12900 · sectionOrder: null → 6 · sortRank: null → 18 · vegClass: null → "veg"
- `four-boiled-egg`: pricePaise: 24000 → 1500 · sectionOrder: null → 6 · sortRank: null → 19 · vegClass: null → "egg" · isVeg: true → false
- `hummus-pita-classic`: name: "Hummus Pita Classic" → "Classic Hummus Pita" · pricePaise: 6900 → 17900 · sectionOrder: null → 7 · sortRank: null → 1 · vegClass: null → "veg"
- `hummus-pita-with-falafel`: pricePaise: 19900 → 21900 · sectionOrder: null → 7 · sortRank: null → 2 · vegClass: null → "veg"
- `chicken-pita-pockets-with-hummus`: name: "Chicken Pita Pockets with Hummus" → "Chicken Pita Pocket with Hummus" · pricePaise: 16900 → 24900 · sectionOrder: null → 7 · sortRank: null → 3 · vegClass: null → "non-veg"
- `falafal-pita-pockets-with-hummus`: name: "Falafal Pita Pockets with Hummus" → "Falafel Pita Pocket with Hummus" · pricePaise: 19900 → 21900 · sectionOrder: null → 7 · sortRank: null → 4 · vegClass: null → "veg"
- `aglio-olio-pasta-v`: pricePaise: 24000 → 19900 · sectionOrder: null → 8 · sortRank: null → 1 · vegClass: null → "veg"
- `arrabbiata-veg`: name: "Arrabbiata - Veg" → "Arrabbiata Pasta" · pricePaise: 17900 → 19900 · sectionOrder: null → 8 · sortRank: null → 2 · vegClass: null → "veg"
- `alfredo-pasta-veg`: name: "Alfredo Pasta - Veg" → "Alfredo Pasta" · pricePaise: 22900 → 19900 · sectionOrder: null → 8 · sortRank: null → 3 · vegClass: null → "veg"
- `pesto-pasta-veg`: name: "Pesto Pasta (Veg)" → "Pesto Pasta" · pricePaise: 22900 → 19900 · sectionOrder: null → 8 · sortRank: null → 4 · vegClass: null → "veg"
- `mutton-paya-soup`: pricePaise: 24000 → 19900 · sectionOrder: null → 9 · sortRank: null → 1 · vegClass: null → "non-veg" · isVeg: true → false
- `cream-of-mushroom`: name: "Cream of Mushroom" → "Cream of Mushroom Soup" · pricePaise: 14500 → 14900 · sectionOrder: null → 9 · sortRank: null → 2 · vegClass: null → "veg"
- `hot-n-sour-soup-veg`: name: "Hot n Sour Soup (Veg)" → "Hot & Sour Soup" · pricePaise: 13900 → 7900 · sectionOrder: null → 9 · sortRank: null → 3 · vegClass: null → "veg"
- `manchow-soup-veg`: name: "Manchow Soup (Veg)" → "Manchow Soup" · pricePaise: 13900 → 7900 · sectionOrder: null → 9 · sortRank: null → 4 · vegClass: null → "veg"
- `tomato-basil-soup`: pricePaise: 13900 → 12900 · sectionOrder: null → 9 · sortRank: null → 5 · vegClass: null → "veg"
- `mix-berry-smoothie-high-protein`: pricePaise: 24000 → 14900 · sectionOrder: null → 10 · sortRank: null → 1 · vegClass: null → "veg"
- `dates-banana-smoothie`: pricePaise: 13900 → 12900 · sectionOrder: null → 10 · sortRank: null → 2 · vegClass: null → "veg"
- `blueberry-smoothie`: pricePaise: 23000 → 14900 · sectionOrder: null → 10 · sortRank: null → 3 · vegClass: null → "veg"
- `power-house-smoothie`: name: "Power House Smoothie" → "Powerhouse Smoothie — Oats & Banana" · pricePaise: 11900 → 12900 · sectionOrder: null → 10 · sortRank: null → 4 · vegClass: null → "veg"
- `peanut-butter-banana-smoothie`: pricePaise: 11900 → 12900 · sectionOrder: null → 10 · sortRank: null → 5 · vegClass: null → "veg"
- `apple-cinnamon-smoothie`: pricePaise: 15000 → 14900 · sectionOrder: null → 10 · sortRank: null → 6 · vegClass: null → "veg"
- `abc-juice`: pricePaise: 24000 → 12900 · sectionOrder: null → 10 · sortRank: null → 7 · vegClass: null → "veg"
- `hydrating-watermelon-juice`: name: "Hydrating Watermelon Juice" → "Watermelon Juice" · pricePaise: 6900 → 12900 · sectionOrder: null → 10 · sortRank: null → 8 · vegClass: null → "veg"
- `lemon-mint-ice-tea-smoothie`: name: "Lemon Mint Ice Tea Smoothie" → "Lemon Mint Iced Tea" · pricePaise: 11900 → 9900 · sectionOrder: null → 10 · sortRank: null → 9 · vegClass: null → "veg"
- `zero-calorie-mint-mojito`: name: "Zero Calorie Mint Mojito" → "Zero-Calorie Mint Mojito" · pricePaise: 10900 → 9900 · sectionOrder: null → 10 · sortRank: null → 10 · vegClass: null → "veg"
- `fruity-greek-yogurt`: pricePaise: 24000 → 14900 · sectionOrder: null → 11 · sortRank: null → 1 · vegClass: null → "veg"
- `ragi-dates-eggless-brownie`: pricePaise: 24000 → 9900 · sectionOrder: null → 11 · sortRank: null → 2 · vegClass: null → "veg"
- `healthy-tiramisu-box`: pricePaise: 24000 → 17900 · sectionOrder: null → 11 · sortRank: null → 3 · vegClass: null → "veg"
- `garlic-bread`: pricePaise: 24000 → 8900 · sectionOrder: null → 12 · sortRank: null → 1 · vegClass: null → "veg"
- `watermelon-mint-cooler`: pricePaise: 24000 → 11900 · sectionOrder: null → 12 · sortRank: null → 3 · vegClass: null → "veg"
- `aam-panna`: pricePaise: 24000 → 11900 · sectionOrder: null → 12 · sortRank: null → 4 · vegClass: null → "veg"
- `diet-coke-can`: name: "Diet Coke Can" → "Diet Coke" · pricePaise: 10900 → 6000 · sectionOrder: null → 12 · sortRank: null → 5 · vegClass: null → "veg"
- `thums-up-can`: name: "Thums Up Can" → "Thums Up" · pricePaise: 10900 → 6000 · sectionOrder: null → 12 · sortRank: null → 6 · vegClass: null → "veg"

## Archived as merge-sources (maps_from continuity) (10)

- `chipotle-grilled-chicken-rice-bowl` → barbeque-grilled-chicken-rice-bowl
- `crispy-peri-peri-chicken-rice-bowl` → barbeque-grilled-chicken-rice-bowl
- `crispy-peri-peri-mushroom-rice-bowl` → crispy-mushroom-rice-bowl
- `chilli-chipotle-paneer-burrito-wrap` → paneer-tikka-burrito-wrap
- `signature-quinoa-salad` → roasted-vegetable-quinoa-salad
- `masala-bread-omelette-2-egg` → classic-bread-omelette-2-egg
- `alfredo-pasta-chicken` → alfredo-pasta-veg
- `hot-n-sour-soup-chicken` → hot-n-sour-soup-veg
- `manchow-soup-chicken` → manchow-soup-veg
- `coke-can` → thums-up-can

## Archived by the disable set (CUT/MERGE/DELIST, soft only) (20)

- `cheesy-delight-nachos` — CUT in the menu rationalization (§8; soft only)
- `crispy-peri-peri-mushroom-burrito-wrap` — CUT in the menu rationalization (§8; soft only)
- `crispy-peri-peri-potato-rice-bowl` — CUT in the menu rationalization (§8; soft only)
- `peri-peri-paneer-burrito-wrap` — CUT in the menu rationalization (§8; soft only)
- `nutella-toast-white-bread` — CUT in the menu rationalization (§8; soft only)
- `exotic-fruit-bowl` — DELIST in the menu rationalization (§8; soft only)
- `smokey-chicken-salad` — DELIST in the menu rationalization (§8; soft only)
- `quinoa-upma` — DELIST in the menu rationalization (§8; soft only)
- `almond-chicken-salad` — DELIST in the menu rationalization (§8; soft only)
- `classic-nachos` — DELIST in the menu rationalization (§8; soft only)
- `chicken-amigos-sandwich` — DELIST in the menu rationalization (§8; soft only)
- `chicken-hummus-pita` — DELIST in the menu rationalization (§8; soft only)
- `fruity-yogurt` — DELIST in the menu rationalization (§8; soft only)
- `veg-amigos-sandwich` — DELIST in the menu rationalization (§8; soft only)
- `exotic-amaranth-blueberry-yogurt` — DELIST in the menu rationalization (§8; soft only)
- `healthy-whole-wheat-tofu-wrap` — DELIST in the menu rationalization (§8; soft only)
- `creamy-egg-white-sandwich` — DELIST in the menu rationalization (§8; soft only)
- `lebanese-hummus-salad` — DELIST in the menu rationalization (§8; soft only)
- `chickpea-peanut-tabbouleh-salad` — DELIST in the menu rationalization (§8; soft only)
- `millets-bread-loaf` — DELIST in the menu rationalization (§8; soft only)

## Seasonal (unavailable, not archived — winter return) (1)

- `broccoli-almond-soup`

## STOP-AND-ASK — ungoverned KEEP rows (in the rationalization keep set but absent from the payload; left untouched) (7)

- Chipotle Chicken Burrito Wrap [KEEP-A]
- Mushroom Omelette (2 Egg) [KEEP-B]
- French Omelette (Sweet/Savoury) (2 Egg) [KEEP-B]
- Cheese Omelette (2 Egg) [KEEP-B]
- Veg Quesadilla [KEEP-C]
- Antioxidant Detox [KEEP-C]
- Crispy Peri Peri Chicken Burrito Wrap [KEEP-C]

## STOP-AND-ASK — expected rows missing from DB (0)

- (none)

## Disable-set rows with no matching DB row (informational) (76)

- Cheese Tomato Omelette (2 Egg) [CUT]
- Chilli Garlic Chicken Fried Rice (500 Ml [Serves 1-2]) [CUT]
- Beetroot Salad With Balsamic Dressing [CUT]
- Crispy Peri Peri Potato Burrito Wrap [CUT]
- Lichi Cooler [CUT]
- Peri Peri Paneer Rice Bowl [CUT]
- Chicken Fried Rice (750 Ml [Serves 3- 4]) [CUT]
- Veg Pan Fry Noodles (500 Ml [Serves 1-2]) [CUT]
- Guava Chilli Cooler [CUT]
- Mutton Paya [CUT]
- Chia Lemonade Detox [CUT]
- Kurkure Veg Momos [6 Pcs] [CUT]
- Egg Chicken Noodle (500 Ml [Serves 1-2]) [CUT]
- Egg Fried Rice (500 Ml [Serves 1-2]) [CUT]
- Chicken Hakka Noodles (500 Ml [Serves 1-2]) [CUT]
- Non Veg Quesadilla [CUT]
- Gond Ka Tira Cooler [CUT]
- Veg Manchurian Gravy (500 Ml [Serves 2]) [CUT]
- Veg Manchurian Dry (500 Ml [Serves 2]) [CUT]
- Kiwi Mint Cooler [CUT]
- Chilli Garlic Veg Fried Rice (750 Ml [Serves 3- 4]) [CUT]
- Chicken Fried Rice (500 Ml [Serves 1-2]) [CUT]
- Chicken Butter Garlic Noodles (500 Ml [Serves 1-2]) [CUT]
- Chilli Garlic Chicken Noodles (500 Ml [Serves 1-2]) [CUT]
- Tomato Basil Omelette (2 Egg) [CUT]
- Veg Noodle (500 Ml [Serves 1-2]) [CUT]
- Pesto Millets Pasta (Chicken) [CUT]
- Mango Mint Cooler [CUT]
- Pesto Millets Pasta (Prawns) [CUT]
- French Toast With Nutella [CUT]
- Arrabbiata Millets Pasta (Chicken) [CUT]
- Classic Protein Shake [CUT]
- Arrabbiata Millets Pasta (Prawns) [CUT]
- Aglio Olio Millets Pasta (Prawns) [CUT]
- Basa Fish [CUT]
- Blueberry Shake [CUT]
- Veg Lemon Coriander Soup [CUT]
- Arabitta Pasta [CUT]
- Mix Sauce Pasta [CUT]
- Virjin Mojito [CUT]
- Turmeric Tea Latte [WKC] [CUT]
- Paneer Tikka Wrap [CUT]
- Mint Honey Cooler [CUT]
- Paneer Tikka Sandwich [CUT]
- Chocolate Shake [CUT]
- Masala Chai [WKC] [CUT]
- Doodh Mein Patti [WKC] [CUT]
- Pine Apple Mojito [CUT]
- Avocado Poched Egg Toast [DELIST]
- Power Breakfast [DELIST]
- Tanmatra Special Breakfast [DELIST]
- Grilled Veg Cube Sandwich [DELIST]
- Grilled Chicken With Brown Rice And Veggies [DELIST]
- Blueberry Banana Overnight Soaked [DELIST]
- Beetroot Ginger Juice [DELIST]
- Broccoli Sweetcorn Tomato Salad [DELIST]
- Grilled Paneer With Brown Rice And Veggies [DELIST]
- Greek Veg Salad [DELIST]
- Roast Chicken Russian (2 Egg) [DELIST]
- Greek Chicken Salad [DELIST]
- Mr . Breakfast [DELIST]
- Healthy Breakfast [DELIST]
- Activated Charcoal Detox [DELIST]
- Chicken Rice Ball [DELIST]
- Spaghetti With Meatballs [DELIST]
- Paneer Parath [DELIST]
- Crispy Peri Peri Mushroom Pita Pocket [DELIST]
- Brownie [DELIST]
- Loaded Garlic Bread [DELIST]
- Peri Peri Fries [DELIST]
- Vegetable Maggi [DELIST]
- Cheese Maggi [DELIST]
- Avocado Toast With Poached Boiled Egg (2 Egg) [MERGE]
- Avocado Toast With Sunny Side Up (2 Egg) [MERGE]
- Cream Of Chicken Soup [SEASONAL]
- Cream Of Broccoli Soup [SEASONAL]

## Rows untouched by every pass (informational) (33)

- activated-charcoal-smoothie
- aglio-olio-veg
- aglio-olio-chicken
- aglio-olio-prawns
- alfredo-pasta-prawns
- aliya-viral-beetroot-curd
- amaranth-porridge-with-blueberry-sauce
- antioxidant-detox
- arrabbiata-chicken
- arrabbiata-prawns
- avocado-toast-with-poached-boiled-egg
- barbeque-paneer-fiesta-rice-bowl
- broccoli-babycorn-tomato-salad
- cheese-omelette
- cheese-tomato-omelette
- chia-lemonade-smoothie
- chipotle-chicken-burrito-wrap
- cream-of-broccoli
- cream-of-chicken
- crispy-peri-peri-chicken-burrito-wrap
- french-omelette-sweet-savoury
- greek-roman-chicken-salad
- greek-roman-veg-salad
- healthy-liver-juice
- millets-poha-barnyard
- mushroom-omelette
- nutella-toast-brown-bread
- peri-peri-paneer-fiesta-rice-bowl
- pesto-pasta-chicken
- pesto-pasta-prawns
- roast-chicken-russian
- tomato-basil-omelette
- two-boiled-eggs

## §7 verification — VIOLATIONS (1)

- §7.3 banned claim word active: antioxidant-detox ("Antioxidant Detox")
