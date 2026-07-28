import { defineTheme } from '@astryxdesign/core/theme';
import { stoneTheme } from './stone/stoneTheme';

export const tanmatraTheme = defineTheme({
  name: 'tanmatra',
  extends: stoneTheme,
  tokens: {
    /* ── Stone Theme Palette (Warm, Earthy Neutrals & Natural Sandstone) ───── */
    '--color-accent': ['#28282a', '#f3f3f5'],
    '--color-accent-ink': ['#ffffff', '#171719'],
    '--color-blue': ['#506072', '#99adc6'],
    '--color-sage': ['#4e6357', '#9bb19a'],
    '--color-success': ['#4e6357', '#9bb19a'],
    '--color-warning': ['#79693f', '#b6aa90'],
    '--color-danger': ['#775751', '#c7a39d'],

    /* ── Background & Surface Ramp ───────────────────────────────────────── */
    '--color-background-app': ['#f3f3f5', '#111015'],
    '--color-background-surface': ['#ffffff', '#1b1b1f'],
    '--color-background-raised': ['#ffffff', '#25252a'],

    /* ── Text & Ink Ramp ─────────────────────────────────────────────────── */
    '--color-text-primary': ['#28282a', '#f3f3f5'],
    '--color-text-secondary': ['#5e5e5e', '#ababb0'],
    '--color-text-tertiary': ['#84848b', '#84848b'],

    /* ── Border & Divider Ramp ───────────────────────────────────────────── */
    '--color-border': ['#d8d8db', '#343438'],
    '--color-border-strong': ['#84848b', '#5e5e5e'],

    /* ── Radii & Duration ────────────────────────────────────────────────── */
    '--radius-sm': '6px',
    '--radius-md': '10px',
    '--radius-lg': '16px',
    '--radius-xl': '22px',
    '--radius-full': '999px',
    '--duration-fast': '150ms',
    '--duration-normal': '240ms',
  } as any,
});
