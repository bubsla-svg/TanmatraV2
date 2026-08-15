/**
 * TNM-MENU-01 §5 — the thirteen fixed customer menu sections, in display
 * order, plus the trailing bucket for dishes the M-3 payload hasn't
 * governed yet (no `sectionOrder`) — shown, never dropped.
 *
 * Deliberately NOT imported from `@workspace/menu-catalog`, even though
 * that package exports the same list as `MENU_SECTIONS`: its package.json
 * has no `sideEffects: false`, so importing anything from it — even one
 * constant — pulls the ~5000-line static `DISHES` seed into whichever
 * bundle does the importing. `app/menu/page.tsx` and `DishCard.tsx` already
 * pay that cost server-side on purpose; this file exists so the CLIENT
 * components (MenuGrid, PersonalizedMenu) never do. Both lists move
 * together only when the manual's §5 section order changes.
 */
export const MENU_SECTIONS: ReadonlyArray<{ order: number; name: string }> = [
  { order: 1, name: "High-Protein Meals" },
  { order: 2, name: "Bowls" },
  { order: 3, name: "Wraps & Burritos" },
  { order: 4, name: "Sandwiches" },
  { order: 5, name: "Salads" },
  { order: 6, name: "Breakfast & Eggs" },
  { order: 7, name: "Pita & Hummus" },
  { order: 8, name: "Pasta" },
  { order: 9, name: "Soups" },
  { order: 10, name: "Smoothies & Juices" },
  { order: 11, name: "Desserts" },
  { order: 12, name: "Sides & Sips" },
  { order: 13, name: "Off the Wok" },
];

/** Section 13 never gets the personalization "boost" (re-ranking by fit
 *  band) — its rows are mostly needs-macros/needs-cogs gated and unfinished,
 *  so promoting or demoting them by a fit score would surface half-verified
 *  dishes ahead of (or bury them behind) the governed catalog. Its dishes
 *  stay in their sort_rank order regardless of personalization state; they
 *  are never hidden by it either — same as every other section. */
export const NO_PERSONALIZATION_BOOST_SECTION = 13;

const UNGOVERNED_SECTION_ORDER = 14;
const UNGOVERNED_SECTION_NAME = "More dishes";

export interface Sectioned<T> {
  order: number;
  name: string;
  items: T[];
}

/**
 * Group items into the fixed §5 sections (in order), appending a trailing
 * "More dishes" bucket for anything with no `sectionOrder`. Sections with
 * no items are omitted entirely — the caller sees only what it needs to
 * render. Item order within a bucket is preserved from the input array.
 */
export function groupBySection<T>(
  items: readonly T[],
  sectionOrderOf: (item: T) => number | undefined,
): Sectioned<T>[] {
  const bySection = new Map<number, T[]>();
  for (const item of items) {
    const order = sectionOrderOf(item) ?? UNGOVERNED_SECTION_ORDER;
    const bucket = bySection.get(order);
    if (bucket) bucket.push(item);
    else bySection.set(order, [item]);
  }
  const allSections = [
    ...MENU_SECTIONS,
    { order: UNGOVERNED_SECTION_ORDER, name: UNGOVERNED_SECTION_NAME },
  ];
  return allSections
    .map((s) => ({ order: s.order, name: s.name, items: bySection.get(s.order) ?? [] }))
    .filter((s) => s.items.length > 0);
}
