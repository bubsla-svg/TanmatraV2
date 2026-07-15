// ─────────────────────────────────────────────────────────────────────────────
// Derive dish allergens from the structured `ingredients[]` list — the same
// list the macro calculator reads (see nutritionCalc.ts).
//
// SAFETY DOCTRINE (this is the whole point of the module):
//   • Derivation can reliably tell you an allergen IS PRESENT. It only ever
//     ADDS warnings, so surfacing detected allergens is always safe.
//   • Derivation CANNOT certify an allergen is ABSENT. A vague ingredient
//     ("Sauce/dip of choice") can hide an allergen, and any ingredient the
//     recognizer doesn't know could too. Those are reported as `ambiguous`.
//   • The caller therefore treats a dish with ANY ambiguous ingredient as
//     UNCHECKED and fails it closed — it must never be asserted allergen-free.
//     A brand-new, unclassified ingredient fails closed by construction, which
//     is the desired behaviour (it forces a human to classify it).
// ─────────────────────────────────────────────────────────────────────────────

/** Allergen labels — matches the catalog's existing Title-Case vocabulary. */
export type DerivedAllergen =
  | "Gluten"
  | "Dairy"
  | "Eggs"
  | "Tree Nuts"
  | "Peanuts"
  | "Soy"
  | "Sesame"
  | "Fish"
  | "Shellfish"
  | "Mustard";

export interface AllergenDerivation {
  /** Allergens the ingredients guarantee are present. */
  detected: DerivedAllergen[];
  /** Raw ingredient strings that could hide an allergen and can't be classified. */
  ambiguous: string[];
}

/**
 * Ingredient substrings → the allergens they guarantee. Matched case-insensitively
 * against the FULL ingredient string (so parenthetical prep like "(battered &
 * fried)" is seen). Conservative: a token appears here only when its allergen is
 * unambiguous. Some prepared items (pesto, ranch, mayo, cheese sauce) map to the
 * allergens they almost always carry — over-warning is safe, under-warning is not.
 */
// Tokens are matched as PREFIXES (leading `\b`, no trailing boundary) so plurals
// and inflections are caught — "prawns", "chickpeas", "battered", "buttered",
// "creamy", "cheesy". Two traps get an explicit negative lookahead: `egg(?!plant)`
// and `butter(?!nut)`. Short/collision-prone tokens keep a trailing `\b`.
const ALLERGEN_RULES: ReadonlyArray<readonly [RegExp, readonly DerivedAllergen[]]> = [
  // Gluten — wheat grains and wheat-based prep. `batter`/`breaded`/`crumbed`
  // are the load-bearing catch for the fried items the old data mislabelled [].
  [/\bbatter|\bbreaded|\bcrumbed|\bbread crumb|\bpanko/, ["Gluten"]],
  [/\b(wheat|atta|maida|semolina|suji|rava|barley|rye|bulgur|couscous|seitan)/, ["Gluten"]],
  [/\b(bread|bun|pita|naan|roti|chapati|paratha|tortilla|wrap|pasta|spaghetti|penne|macaroni|noodle|vermicelli|nacho|crouton)/, ["Gluten"]],
  // Soy sauce carries BOTH soy and (fermented-wheat) gluten.
  [/\bsoy sauce|\bsoya sauce|\bteriyaki|\bhoisin/, ["Soy", "Gluten"]],
  [/\b(soya?|tofu|edamame|tempeh)\b/, ["Soy"]],
  // Sesame — tahini and hummus (tahini-based). `til` (Hindi) kept bounded.
  [/\bsesame|\btahini|\bhummus|\btil\b/, ["Sesame"]],
  // Peanuts (kept distinct from tree nuts).
  [/\bpeanut|\bgroundnut/, ["Peanuts"]],
  // Tree nuts — including nut milks/butters.
  [/\b(almond|cashew|walnut|pistachio|pista|hazelnut|pecan|macadamia|brazil nut|pine ?nut)/, ["Tree Nuts"]],
  [/\bpesto/, ["Tree Nuts", "Dairy"]],
  // Eggs — only the literal egg word (matches the dish-integrity gate's egg
  // detector, so a derived Eggs allergen never trips its egg/veg cross-checks).
  // `egg(?!plant)` so brinjal/eggplant is not an egg. Egg-bearing processed
  // dressings (mayo, ranch, caesar) carry no literal token; their unspecified
  // recipe is left AMBIGUOUS → fail closed rather than silently under/over-declared.
  [/\begg(?!plant)|\bomelette|\bomelet|\bfrittata/, ["Eggs"]],
  // Dairy — `butter(?!nut)`; `milk` excluded after a plant qualifier via lookbehind.
  [/\bwhey\b/, ["Dairy"]],
  [
    /\b(paneer|cheese|parmesan|cheddar|mozzarella|ghee|curd|yogh?urt|dahi|khoya|malai|cream|ranch)|\bbutter(?!nut)|(?<!\b(?:almond|cashew|soy|soya|oat|coconut|rice|hemp) )\bmilk/,
    ["Dairy"],
  ],
  // Named products with a well-known allergen profile (over-warning is safe;
  // these carry no literal token so the family gate never flags them either way).
  [/\bnutella/, ["Tree Nuts", "Dairy", "Soy"]],
  // Fish & shellfish. Short `cod` kept bounded.
  [/\b(fish|anchovy|tuna|salmon|sardine)|\bcod\b/, ["Fish"]],
  [/\b(prawn|shrimp|crab|lobster|shellfish|squid|calamari)/, ["Shellfish"]],
  // Mustard (an EU/India-labelled allergen; seeds and oil).
  [/\bmustard/, ["Mustard"]],
];

/**
 * Clearly-safe whole foods and staples present in the catalog, matched as
 * PREFIXES so plurals resolve. An ingredient that matches neither an allergen
 * rule nor this list is treated as AMBIGUOUS (unknown → fail closed). Kept
 * generous but conservative — nothing here carries a top allergen. A safe match
 * only clears "ambiguous"; it never removes a detected allergen, so an item that
 * hits both (e.g. peanut ⊂ "pea") is still flagged with its allergen.
 */
const SAFE_PATTERNS: ReadonlyArray<RegExp> = [
  // Vegetables & aromatics (incl. generic "veg"/"veggies", herbs, jalapeño with accent)
  /\b(onion|tomato|lettuce|cucumber|garlic|ginger|bell ?pepper|capsicum|broccoli|baby ?corn|sweet ?corn|corn|zucchini|carrot|spinach|beet|cabbage|cauliflower|pea|mushroom|potato|avocado|olive|jalape|chill?i|coriander|cilantro|parsley|basil|mint|herb|curry leaf|curry leaves|spring onion|scallion|kale|rocket|arugula|microgreen|sprout|radish|pumpkin|gourd|brinjal|eggplant|okra|bean|green|veg|veggie|vegetable|mixed veg)/,
  // Fruits
  /\b(lemon|lime|apple|banana|watermelon|melon|pomegranate|blueberr|strawberr|raspberr|cranberr|orange|pineapple|grape|date|kiwi|mango|papaya|guava|pear|peach|fig|fruit|berr|amla)/,
  // Naturally gluten-free grains, seeds & legumes
  /\b(rice|quinoa|amaranth|buckwheat|millet|barnyard|jowar|bajra|ragi|poha|oat|chia|flax|sunflower seed|pumpkin seed|chickpea|lentil|dal|daal|moong|rajma|kidney bean|black bean|besan|gram flour)/,
  // Proteins that are not themselves top allergens
  /\b(chicken|turkey)/,
  // Oils, fats, sweeteners, leavening, seasonings, liquids, sealed beverages
  /\b(olive oil|coconut oil|sunflower oil|rice bran oil|oil|salt|pepper|chill?i flake|paprika|cumin|jeera|turmeric|haldi|garam masala|masala|spice|cinnamon|cardamom|clove|bay leaf|oregano|thyme|rosemary|nutmeg|cocoa|cacao|baking powder|baking soda|yeast|charcoal|activated charcoal|honey|jaggery|sugar|stevia|vinegar|water|ice|veg stock|vegetable stock|cornstarch|corn starch|corn flour|arrowroot|tomato puree|tomato paste|passata|lemon juice|lime juice|coke|cola|pepsi|thums up|sprite|fanta|soda)/,
];

function classifyIngredient(
  raw: string,
): { allergens: DerivedAllergen[]; recognized: boolean } {
  const s = raw.toLowerCase();
  const allergens = new Set<DerivedAllergen>();
  let matchedAllergenRule = false;

  for (const [pattern, alls] of ALLERGEN_RULES) {
    if (pattern.test(s)) {
      matchedAllergenRule = true;
      for (const a of alls) allergens.add(a);
    }
  }

  const matchedSafe = SAFE_PATTERNS.some((p) => p.test(s));
  return { allergens: [...allergens], recognized: matchedAllergenRule || matchedSafe };
}

/**
 * Derive the allergen picture for a dish from its ingredient list.
 * `detected` is safe to surface (only ever adds warnings); a non-empty
 * `ambiguous` means the list can't be trusted as complete → caller fails closed.
 */
export function deriveAllergensFromIngredients(
  ingredients: readonly string[] | undefined | null,
): AllergenDerivation {
  const detected = new Set<DerivedAllergen>();
  const ambiguous: string[] = [];
  for (const raw of ingredients ?? []) {
    if (!raw || !raw.trim()) continue;
    const { allergens, recognized } = classifyIngredient(raw);
    for (const a of allergens) detected.add(a);
    if (!recognized) ambiguous.push(raw.trim());
  }
  return { detected: [...detected], ambiguous };
}
