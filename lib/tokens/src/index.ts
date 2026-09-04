/**
 * @workspace/tokens — TypeScript mirror of the design tokens in `tokens.css`.
 *
 * The CSS file is the runtime source of truth (it powers theme switching via
 * `data-theme`). This module exposes the *static* values (accents, type scale,
 * radii, motion) for anywhere a token is needed in JS — e.g. a Framer Motion
 * transition or an inline SVG fill — so those never drift from the stylesheet.
 * Theme-dependent neutrals are intentionally NOT exported: read them from the
 * CSS custom properties (`var(--bg)`, …) so the active theme always wins.
 */

/** Locked Clinical accent palette (CLAUDE.md — no new base colours). */
export const ACCENTS = {
  gold: "#2e5c4f",
  goldInk: "#f6f1e9",
  blue: "#506072",
  sage: "#556845",
  sageInk: "#313f27",
} as const;

export const STATUS = {
  success: "#556845",
  warning: "#986025",
  danger: "#b94131",
} as const;

/** Motion tokens — mirror `--duration-*` / `--ease-*` for JS-driven animation. */
export const MOTION = {
  durationFast: 150,
  durationNormal: 240,
  easeOut: [0.16, 1, 0.3, 1] as const,
} as const;

export const RADII = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export type ThemeName = "light" | "dark";

/** The default theme the storefront server-renders (no flash). */
export const DEFAULT_THEME: ThemeName = "light";
