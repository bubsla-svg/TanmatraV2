/**
 * Stitch Design System Token Map: "Clinical Vitality"
 * Source Project: Stitch (Project ID: 8786878931922736855)
 * Visual Style: Modern Corporate / Sterile & Appetizing
<<<<<<< HEAD
=======
 *
 * Every value is an alias onto the LOCKED Clinical Dark palette + type scale
 * already defined in `src/index.css` (`@theme`) — no new base colors or fonts
 * are introduced (see CLAUDE.md: "Clinical Dark palette is locked ... No new
 * base colors without explicit approval"). `boneText`, `primarySaffron`, and
 * `alertError` below are exact hex matches to existing tokens
 * (`--text-primary`, `--color-clinical-gold`, `--color-error`); the rest are
 * the closest existing tier in the same surface/text/border hierarchy.
>>>>>>> origin/main
 */

export const STITCH_DESIGN_SYSTEM = {
  id: "projects/8786878931922736855",
  title: "Tanmatra Reimagined UX/UI",
  themeName: "Clinical Vitality",
  colors: {
<<<<<<< HEAD
    background: "#101416",
    surfaceContainer: "#121517",
    surfaceRaised: "#1C2022",
    surfaceHigh: "#272B2C",
    primarySaffron: "#F4C430",
    statusSage: "#88AA84",
    boneText: "#E9ECEE",
    mutedText: "#9A907A",
    alertError: "#DC8773",
    borderOutline: "rgba(255, 255, 255, 0.07)",
    borderStrong: "rgba(255, 255, 255, 0.13)",
  },
  typography: {
    headlineFont: "Manrope, system-ui, sans-serif",
    bodyFont: "Work Sans, system-ui, sans-serif",
    dataFont: "JetBrains Mono, ui-monospace, monospace",
  },
  radii: {
    button: "0.25rem",   // 4px - clinical precision
    card: "0.5rem",      // 8px - standard container
    chip: "0.75rem",     // 12px - status indicators
    pill: "9999px",
=======
    background: "var(--color-clinical-dark)",
    surfaceContainer: "var(--color-clinical-surface)",
    surfaceRaised: "var(--color-clinical-surface-elevated)",
    surfaceHigh: "var(--color-clinical-surface-elevated)",
    primarySaffron: "var(--color-clinical-gold)",
    statusSage: "var(--color-clinical-sage)",
    boneText: "var(--text-primary)",
    mutedText: "var(--color-clinical-zinc)",
    alertError: "var(--color-error)",
    borderOutline: "var(--color-clinical-border)",
    borderStrong: "var(--color-clinical-border)",
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
>>>>>>> origin/main
  },
  cardGrid: {
    mediaAspect: "60%",  // Top 60% cropped high-res media
    dataAspect: "40%",   // Bottom 40% structured data ribbon
  },
} as const;

export function getMacroRibbonClass(): string {
<<<<<<< HEAD
  return "font-mono font-semibold tracking-tight text-xs text-[#E9ECEE]";
}

export function getHealthFitChipStyle(isHighFit: boolean): { bg: string; color: string; border: string } {
  if (isHighFit) {
    return {
      bg: "rgba(136, 170, 132, 0.16)",
      color: "#88AA84",
      border: "1px solid rgba(136, 170, 132, 0.4)",
    };
  }
  return {
    bg: "rgba(244, 196, 48, 0.14)",
    color: "#F4C430",
    border: "1px solid rgba(244, 196, 48, 0.4)",
=======
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
    bg: "var(--color-clinical-gold-light)",
    color: "var(--color-clinical-gold)",
    border: "1px solid var(--color-clinical-gold)",
>>>>>>> origin/main
  };
}
