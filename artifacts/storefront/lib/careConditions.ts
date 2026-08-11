/**
 * Curated condition list for /care's ConditionRail (D-05B). No condition
 * data source exists anywhere in the corpus — /care/[condition] is a
 * free-text catch-all with no fixed list, and the ruling forbids a new fetch
 * surface here ("plans from the plan catalog; no new fetch surface"). This
 * is a pure, static, first-cut list of the conditions with a real display
 * name (lib/conditionDisplay.ts) — every slug here resolves to its correct
 * casing, not a title-cased guess.
 */
export interface CareCondition {
  slug: string;
  name: string;
}

export const CARE_CONDITIONS: readonly CareCondition[] = [
  { slug: "pcos", name: "PCOS" },
  { slug: "type-2-diabetes", name: "Type 2 Diabetes" },
  { slug: "prediabetes", name: "Prediabetes" },
  { slug: "hypertension", name: "Hypertension" },
  { slug: "insulin-resistance", name: "Insulin Resistance" },
  { slug: "gerd", name: "GERD" },
];

/**
 * /care/[condition] stays a free-text catch-all per the ruling above (no
 * notFound(), no new fetch surface) — this only decides whether that route's
 * copy is allowed to sound clinical. An arbitrary slug must not render the
 * same "RD-crafted therapeutic meal plan" framing a real condition gets.
 */
export function isCareConditionKnown(slug: string): boolean {
  const key = slug.trim().toLowerCase();
  return CARE_CONDITIONS.some((c) => c.slug === key);
}
