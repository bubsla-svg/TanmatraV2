import { cn } from "@/lib/utils";
import { CHIP_GLYPHS, chipToneStyle, type ChipGlyph, type ChipTone } from "./logic";

interface ChipProps {
  glyph: ChipGlyph;
  label: string;
  /** Optional trailing value (e.g. "32g"). Rendered in tabular figures. */
  value?: string;
  tone?: ChipTone;
  className?: string;
}

/**
 * `<Chip>` — 02f §1 component 1. A single glyph + label (+ optional value) from
 * the closed 12-glyph set (see logic.ts `CHIP_GLYPHS`, INFERRED pending Amd 02
 * §4). Tone resolves to semantic tokens only. Max 3 chips per card is a
 * composition rule enforced by the card, not this primitive.
 *
 * Not a button: a chip is a label, never an action. It carries no `<Card>` base.
 */
export function Chip({ glyph, label, value, tone = "neutral", className }: ChipProps) {
  const toneStyle = chipToneStyle(tone);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
      style={toneStyle}
    >
      <i className={cn("ph-fill", CHIP_GLYPHS[glyph])} aria-hidden="true" />
      <span>{label}</span>
      {value != null && (
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
      )}
    </span>
  );
}
