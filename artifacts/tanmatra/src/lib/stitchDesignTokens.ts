/**
 * Stitch Design System Token Map: "Clinical Vitality"
 * Source Project: Stitch (Project ID: 8786878931922736855)
 * Visual Style: Modern Corporate / Sterile & Appetizing
 */

export const STITCH_DESIGN_SYSTEM = {
  id: "projects/8786878931922736855",
  title: "Tanmatra Reimagined UX/UI",
  themeName: "Clinical Vitality",
  colors: {
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
  },
  cardGrid: {
    mediaAspect: "60%",  // Top 60% cropped high-res media
    dataAspect: "40%",   // Bottom 40% structured data ribbon
  },
} as const;

export function getMacroRibbonClass(): string {
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
  };
}
