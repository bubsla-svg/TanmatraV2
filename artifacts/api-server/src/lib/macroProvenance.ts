/**
 * Who owns a dish's macro claim in the merged catalog.
 *
 * THE DEFECT THIS FIXES (flipbook F-1, root cause found 2026-08-16).
 * `getMergedCatalog` builds each dish as `{...staticDish, ...dbOverrides}`.
 * `macros` is overridden by the DB row when it has any — but `macrosEstimated`
 * was NOT, so it kept arriving from the static catalog, where it describes the
 * STATIC numbers. The number and the flag that qualifies it came from
 * different sources.
 *
 * Both directions were live in production:
 *
 *   - Static `diet-coke-can` is 0/0/0/0 — correct, it is a zero-calorie soda —
 *     and carries `macrosEstimated: true` because the ingredient calculator
 *     produced it. The DB row supplies 140 kcal / 3 g P, so the card rendered
 *     "≈140 kcal · ≈3 g P": a fabricated number wearing a marker that asserts
 *     "computed from THIS dish's recipe".
 *   - 11 static dishes carry curated distinct macros and therefore
 *     `macrosEstimated: false`. A DB placeholder on one of those rendered as
 *     PLAIN FACT with no marker at all.
 *
 * The rule: whoever supplies the numbers supplies the claim.
 */

export interface MacroProvenanceInput {
  /** does the DB row carry its own macros object? */
  rowHasMacros: boolean;
  /** `menu_items.macros_are_estimate` — NOT NULL, schema default true */
  rowMacrosAreEstimate: boolean;
  /** the static catalog's flag, describing the static numbers */
  staticMacrosEstimated: boolean | undefined;
}

/**
 * `macrosEstimated` for a merged dish.
 *
 * When the row owns the numbers, `macros_are_estimate` owns the claim. That
 * column is NOT NULL with default `true`, so the failure mode is fail-soft:
 * an un-curated row reads as an estimate (renders with `≈`) rather than as
 * fact. Only an explicit `false` — someone asserting the row is curated —
 * removes the marker.
 */
export function resolveMacrosEstimated(input: MacroProvenanceInput): boolean {
  if (input.rowHasMacros) return input.rowMacrosAreEstimate;
  return input.staticMacrosEstimated === true;
}

/**
 * `macrosProvisional` for a merged dish.
 *
 * Deliberately NOT re-derived from the row: there is no DB column for it, and
 * provisional is the strongest gate (the card prints no numbers at all). The
 * static value passes through unchanged so a DB row can never LOOSEN a gate
 * the catalog already applied. A separate function rather than an inline
 * passthrough because "we considered this and chose stickiness" is the part
 * worth pinning with a test.
 */
export function resolveMacrosProvisional(
  staticMacrosProvisional: boolean | undefined,
): boolean {
  return staticMacrosProvisional === true;
}
