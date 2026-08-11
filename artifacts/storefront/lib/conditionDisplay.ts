/**
 * Condition slug -> display name (D-21/D-23, TNM-CRO-01 owner ruling
 * 2026-08-11: "Fix condition display-name casing via a display map ('PCOS',
 * not 'Pcos')"). `/care/[condition]` is a free-text catch-all with no fixed
 * condition list — CSS `capitalize` on a hyphen-split slug title-cases every
 * word, which is wrong for acronyms (pcos -> "Pcos", gerd -> "Gerd"). This
 * map corrects the known acronym/clinical-term cases; anything unmapped
 * falls back to a plain per-word title case rather than crashing or
 * guessing at an acronym.
 */
const CONDITION_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  pcos: "PCOS",
  gerd: "GERD",
  glp1: "GLP-1",
  "glp-1": "GLP-1",
  diabetes: "Diabetes",
  prediabetes: "Prediabetes",
  "type-1-diabetes": "Type 1 Diabetes",
  "type-2-diabetes": "Type 2 Diabetes",
  "insulin-resistance": "Insulin Resistance",
  hypertension: "Hypertension",
  "kidney-disease": "Kidney Disease",
  celiac: "Celiac Disease",
  pregnancy: "Pregnancy",
  "high-cholesterol": "High Cholesterol",
  thyroid: "Thyroid",
  hypothyroidism: "Hypothyroidism",
};

function titleCaseWord(word: string): string {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
}

/** Display name for a `/care/[condition]` slug. Known clinical terms and
 *  acronyms resolve to their correct casing; an unmapped slug falls back to
 *  a per-word title case of its hyphen-split form — never a crash. */
export function conditionDisplayName(conditionSlug: string): string {
  const key = conditionSlug.trim().toLowerCase();
  const known = CONDITION_DISPLAY_NAMES[key];
  if (known) return known;
  return key
    .split(/[-\s]+/)
    .filter(Boolean)
    .map(titleCaseWord)
    .join(" ");
}
