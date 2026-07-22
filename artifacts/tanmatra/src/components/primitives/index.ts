// ─────────────────────────────────────────────────────────────────────────────
// 02f component manifest — presentational primitives (roadmap slice S2).
//
// Built against the repo's existing design tokens (src/index.css) as the
// substitute for the absent IMPECCABLE.md; inferred values (chip glyph set,
// tone→token map) are flagged in logic.ts and reconciled in slice S3.
//
// Deliberately NOT built here (they presuppose the commercial model or unify a
// risky existing surface — their own roadmap slices): PlanCard, OrderBump
// (S7), DishCard, StickyBar. Per 02f these primitives share NO <Card> base.
//
// Reused, not rebuilt:
//   • DietMark  → the existing FssaiMark (regulatory §11.1 mark). Re-exported
//     here under the manifest name so callers import one place.
//   • Sheet     → the existing shadcn `@/components/ui/sheet` (Radix focus trap).
// ─────────────────────────────────────────────────────────────────────────────

export { Chip } from "./Chip";
export { Price } from "./Price";
export { MacroReadout, type MacroValues } from "./MacroReadout";
export { RdBadge } from "./RdBadge";
export { SegmentedControl, type SegmentedOption } from "./SegmentedControl";
export { StepDots } from "./StepDots";
export { DishImage } from "./DishImage";

// DietMark is the FSSAI mark under its 02f manifest name.
export { FssaiMark as DietMark } from "@/components/FssaiMark";

export {
  CHIP_GLYPHS,
  CHIP_TONES,
  chipToneStyle,
  shouldShowMacroNumerals,
  aspectRatioPaddingTop,
  PRICE_FONT_SIZE,
  type ChipGlyph,
  type ChipTone,
  type PriceSize,
} from "./logic";
