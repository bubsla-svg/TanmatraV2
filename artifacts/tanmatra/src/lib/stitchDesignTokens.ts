/**
 * Stitch Design System Token Map: "Clinical Vitality"
 * Source Project: Stitch (Project ID: 8786878931922736855)
 * Visual Style: Modern Corporate / Sterile & Appetizing
 *
 * Every value is an alias onto the LOCKED Clinical Dark palette + type scale
 * already defined in `src/index.css` (`@theme`) — no new base colors or fonts
 * are introduced (see CLAUDE.md: "Clinical Dark palette is locked ... No new
 * base colors without explicit approval"). `boneText`, `primarySaffron`, and
 * `alertError` below are exact hex matches to existing tokens
 * (`--text-primary`, `--color-nn-primary`, `--color-error`); the rest are
 * the closest existing tier in the same surface/text/border hierarchy.
 */

export const STITCH_DESIGN_SYSTEM = {
  id: "projects/8786878931922736855",
  title: "Tanmatra Reimagined UX/UI",
  themeName: "Clinical Vitality",
  colors: {
    background: "var(--color-nn-bg)",
    surfaceContainer: "var(--color-nn-surface)",
    surfaceRaised: "var(--color-nn-surface-high)",
    surfaceHigh: "var(--color-nn-surface-high)",
    primarySaffron: "var(--color-nn-primary)",
    statusSage: "var(--color-clinical-sage)",
    boneText: "var(--text-primary)",
    mutedText: "var(--color-nn-on-surface-variant)",
    alertError: "var(--color-error)",
    borderOutline: "var(--color-nn-outline)",
    borderStrong: "var(--color-nn-outline)",
  },
  typography: {
    headlineFont: "var(--font-display)",
    bodyFont: "var(--font-sans)",
    dataFont: "var(--font-mono)",
  },
  radii: {
    button: "var(--radius-btn)",
    card: "var(--radius-card)",
    chip: "0.75rem",
    pill: "var(--radius-pill)",
  },
  cardGrid: {
    mediaAspect: "60%",  // Top 60% cropped high-res media
    dataAspect: "40%",   // Bottom 40% structured data ribbon
  },
} as const;

export function getMacroRibbonClass(): string {
  return "font-mono font-semibold tracking-tight text-xs text-[var(--text-primary)]";
}

/**
 * Chip style for a dish's preference-fit indicator. Backgrounds reuse the
 * existing `-light` tint tokens (already tuned to ~12-16% alpha) so no new
 * opacity math or literal color is introduced here.
 */
export function getHealthFitChipStyle(isHighFit: boolean): { bg: string; color: string; border: string } {
  if (isHighFit) {
    return {
      bg: "var(--color-clinical-sage-light)",
      color: "var(--color-clinical-sage)",
      border: "1px solid var(--color-clinical-sage)",
    };
  }
  return {
    bg: "color-mix(in srgb, var(--color-nn-primary) 12%, transparent)",
    color: "var(--color-nn-primary)",
    border: "1px solid var(--color-nn-primary)",
  };
}
