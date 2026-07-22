// ─────────────────────────────────────────────────────────────────────────────
// Pure, JSX-free logic for the 02f component primitives (roadmap slice S2).
// Kept separate from the .tsx components so it is unit-testable without a DOM.
//
// INFERRED VALUES (per the "proceed on existing tokens" decision, because
// IMPECCABLE.md and Amendment 02 §4 — which define the canonical chip glyph set
// and tone→token map — are not yet in the repo). Every inferred item is flagged
// INFERRED and must be reconciled when those docs land (see IMPLEMENTATION-PLAN
// slice S3). Colours resolve to existing design tokens only — no raw hex, so the
// lint:colors gate stays green.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * INFERRED 12-glyph closed set (02f §1 cites "Amd 02 §4", which is absent).
 * A closed set on purpose — a Chip may only carry one of these semantic
 * glyphs, never an arbitrary icon. Values are Phosphor icon-font classes
 * (the app already ships the Phosphor web font; see SoftGate.tsx).
 */
export const CHIP_GLYPHS = {
  goal: "ph-target",
  protein: "ph-barbell",
  calories: "ph-flame",
  low_gi: "ph-pulse",
  meal_card: "ph-wallet",
  rd_reviewed: "ph-seal-check",
  prep_time: "ph-clock",
  spice: "ph-pepper",
  fiber: "ph-leaf",
  proof: "ph-medal",
  delivery: "ph-truck",
  veg: "ph-plant",
} as const;

export type ChipGlyph = keyof typeof CHIP_GLYPHS;

/**
 * INFERRED tone → semantic-token map (02f §1: "Tone maps to semantic tokens
 * only"). A closed tone set; each resolves to CSS custom properties defined in
 * src/index.css. No raw colours here.
 */
export const CHIP_TONES = {
  neutral: { fg: "var(--color-ink-500)", bg: "var(--color-ink-800)" },
  sage: { fg: "var(--color-sage-300)", bg: "var(--color-sage-900)" },
  saffron: { fg: "var(--color-saffron-300)", bg: "var(--color-saffron-900)" },
  protein: { fg: "var(--color-macro-protein)", bg: "var(--color-ink-800)" },
  carbs: { fg: "var(--color-macro-carbs)", bg: "var(--color-ink-800)" },
  fat: { fg: "var(--color-macro-fat)", bg: "var(--color-ink-800)" },
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

export interface ChipToneStyle {
  color: string;
  backgroundColor: string;
}

/** Resolve a tone to its foreground/background token pair (falls back to neutral). */
export function chipToneStyle(tone: ChipTone): ChipToneStyle {
  const t = CHIP_TONES[tone] ?? CHIP_TONES.neutral;
  return { color: t.fg, backgroundColor: t.bg };
}

/**
 * Brief A5 macro gate: numeric macro values are shown only when the dish's
 * macros are verified. Unverified → labels without numerals. This mirrors the
 * repo's existing `macrosEstimated`/`macrosProvisional` markers (a dish is
 * "verified" for display when it is neither estimated nor provisional).
 */
export function shouldShowMacroNumerals(verified: boolean): boolean {
  return verified === true;
}

/** Named size scale for <Price> — maps to a font-size token/step (no hex). */
export type PriceSize = "sm" | "md" | "lg" | "display";

export const PRICE_FONT_SIZE: Record<PriceSize, string> = {
  sm: "0.8125rem",
  md: "1rem",
  lg: "1.375rem",
  display: "2rem",
};

/**
 * Aspect-ratio → CSS `padding-top` percentage for the reserved-space box that
 * holds a dish image before it loads (IMPECCABLE §12/§15: reserve dimensions to
 * prevent CLS). Accepts "W:H"; defaults to 1:1 on a malformed value.
 */
export function aspectRatioPaddingTop(ratio: string): string {
  const [w, h] = ratio.split(":").map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return "100%";
  }
  return `${((h / w) * 100).toFixed(4)}%`;
}

/** Clamp a StepDots position into range and expose a stable index array. */
export function stepDotIndices(total: number): number[] {
  const n = Math.max(0, Math.floor(total));
  return Array.from({ length: n }, (_, i) => i);
}

export function clampStep(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(1, Math.floor(current)), Math.floor(total));
}
