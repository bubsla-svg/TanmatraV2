import { defineTheme } from '@astryxdesign/core/theme';
import { stoneTheme } from './stone/stoneTheme';

export const tanmatraTheme = defineTheme({
  name: 'tanmatra',
  extends: stoneTheme,
  tokens: {
    /* ── Stone Theme Palette (Warm, Earthy Neutrals & Natural Sandstone) ───── */
    // Gold is the action colour — the one design caveat that survived lifting
    // the palette lock for DS-0 (owner decision; CLAUDE.md, runbook §3). Stone
    // keeps everything else, but its accent is a neutral (#28282a/#f3f3f5),
    // which made every primary CTA monochrome. These values also match
    // tanmatra.css, the generated sheet Astryx's own components read — it was
    // never regenerated for Stone, so accent had silently split in two: gold in
    // Astryx components, near-black in our Tailwind utilities.
    '--color-accent': ['#7F6921', '#D4AF37'],
    '--color-accent-ink': ['#ffffff', '#111318'],
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
    // Stone neutral T45 light / T55 dark. NOT one shared #84848b (T55-ish):
    // that measures 3.71:1 on the light surface and 3.40:1 on the light app
    // background — below AA for body text, which tanmatraTheme.test.ts asserts
    // for every text token. Both stops below are real Stone ramp values, so the
    // palette stays on-ramp: light 5.38 / 4.85, dark 5.02 / 4.55.
    '--color-text-tertiary': ['#6a6a6f', '#838388'],

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
