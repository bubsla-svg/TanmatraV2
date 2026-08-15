/**
 * TNM-MENU-01 M-4 — the §6 option groups, derived from payload flags (pure).
 *
 * The manual's §6 table is the spec; every price is a server-side integer
 * paise modifier against the row's base price. Deterministic output — the
 * plan engine deep-compares against the stored jsonb, so builders must emit
 * byte-stable structures for idempotency.
 *
 * Required groups always carry a `default` option: the checkout resolver
 * (api-server lib/dishCustomizations.ts) auto-applies the default when no
 * selection arrives, so shipping the data ahead of the M-5 chooser UI can
 * never block a checkout. §6 totals pinned by menuOptionGroups.test.ts:
 * pasta base 19900 + chicken 4000 = 23900 · soup 7900 + NV 4000 = 11900 ·
 * wok base 14900 + egg 3000 = 17900 / + chicken 5000 = 19900.
 */
export interface OptionGroup {
  groupName: string;
  type: "single" | "multiple";
  required?: boolean;
  options: Array<{ name: string; priceModifier: number; default?: boolean }>;
}

const SAUCE_GROUP: OptionGroup = {
  groupName: "Choose your sauce",
  type: "single",
  required: true,
  options: [
    { name: "Cilantro Lime", priceModifier: 0, default: true },
    { name: "Tandoori", priceModifier: 0 },
    { name: "Chipotle", priceModifier: 0 },
    { name: "BBQ", priceModifier: 0 },
    { name: "Peri Peri", priceModifier: 0 },
  ],
};

const BURRITO_UPGRADE_GROUP: OptionGroup = {
  groupName: "Make it a burrito",
  type: "single",
  options: [{ name: "Burrito upgrade", priceModifier: 2000 }],
};

const OMELETTE_ADDONS_GROUP: OptionGroup = {
  groupName: "Omelette add-ons",
  type: "multiple",
  options: [
    { name: "Mushroom", priceModifier: 3000 },
    { name: "Spinach", priceModifier: 3000 },
    { name: "Tomato & Cheese", priceModifier: 3000 },
  ],
};

const PASTA_BASE_GROUP: OptionGroup = {
  groupName: "Pasta base",
  type: "single",
  required: true,
  options: [
    { name: "Penne", priceModifier: 0, default: true },
    { name: "Spaghetti", priceModifier: 0 },
  ],
};

// §6: "+Chicken → total 23900" against the 19900 payload base. The stale
// notebook flag protein-choice-chicken-220 is superseded by chicken-239
// (manual §6 is the execution law).
const PASTA_PROTEIN_GROUP: OptionGroup = {
  groupName: "Add protein",
  type: "single",
  options: [{ name: "Chicken", priceModifier: 4000 }],
};

// §6: veg 7900 → NV 11900.
const SOUP_NV_GROUP: OptionGroup = {
  groupName: "Make it chicken",
  type: "single",
  options: [{ name: "Chicken", priceModifier: 4000 }],
};

// §6 wok protein ladder against the 14900 veg base: Egg 17900 · Chicken
// 19900 · Paneer 19900 (noodles only — the rice row's flag omits paneer).
function wokProteinGroup(includePaneer: boolean): OptionGroup {
  return {
    groupName: "Choose your protein",
    type: "single",
    required: true,
    options: [
      { name: "Veg", priceModifier: 0, default: true },
      { name: "Egg", priceModifier: 3000 },
      { name: "Chicken", priceModifier: 5000 },
      ...(includePaneer ? [{ name: "Paneer", priceModifier: 5000 }] : []),
    ],
  };
}

const SCHEZWAN_GROUP: OptionGroup = {
  groupName: "Schezwan style",
  type: "single",
  options: [{ name: "Schezwan sauce", priceModifier: 0 }],
};

// Interpretive rendering of the payload's two-variant-one-line flag (Bread
// Omelette — Classic / Masala): a required ₹0 style chooser is the only
// faithful reading of one line carrying two named variants. Zero money
// impact; flagged in the M-4 PR for review.
const TWO_VARIANT_STYLE_GROUP: OptionGroup = {
  groupName: "Style",
  type: "single",
  required: true,
  options: [
    { name: "Classic", priceModifier: 0, default: true },
    { name: "Masala", priceModifier: 0 },
  ],
};

/**
 * Groups for one payload row, derived from its flags (plus the pasta base
 * group for every section-8 row via the base-choice flag). Order is stable:
 * required choosers first, then priced add-ons.
 */
export function buildOptionGroups(flags: readonly string[]): OptionGroup[] {
  const groups: OptionGroup[] = [];
  const has = (f: string) => flags.includes(f);

  if (has("sauce-chooser")) groups.push(SAUCE_GROUP);
  if (has("base-choice")) groups.push(PASTA_BASE_GROUP);
  const wokFlag = flags.find((f) => f.startsWith("protein-choice-egg-179-chicken-199"));
  if (wokFlag) groups.push(wokProteinGroup(wokFlag.includes("paneer")));
  if (has("two-variant-one-line")) groups.push(TWO_VARIANT_STYLE_GROUP);
  if (has("burrito-upgrade")) groups.push(BURRITO_UPGRADE_GROUP);
  if (has("addon-group")) groups.push(OMELETTE_ADDONS_GROUP);
  if (has("chicken-239")) groups.push(PASTA_PROTEIN_GROUP);
  if (flags.some((f) => f.startsWith("nv-variant-119"))) groups.push(SOUP_NV_GROUP);
  if (has("schezwan-sauce-option")) groups.push(SCHEZWAN_GROUP);

  return groups;
}
