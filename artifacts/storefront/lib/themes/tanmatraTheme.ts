import { defineTheme } from '@astryxdesign/core/theme';
import { stoneTheme } from './stone/stoneTheme';

export const tanmatraTheme = defineTheme({
  name: 'tanmatra',
  extends: stoneTheme,
  tokens: {
    /* ── ONE palette: Stone in the light arm, Stitch in the dark arm ───────
     * The app used to ship TWO dark palettes. Stone's dark arm lived in these
     * tuples; Stitch's dark values were pinned a second time in stitch.css, on
     * every redesigned route wrapper. Nothing ever rendered Stone's dark arm —
     * no setTheme/useTheme call exists anywhere in the app and app/layout.tsx
     * hardcodes data-theme="light" — so it was dead code whose only real effect
     * was to be free to drift from the values actually on screen.
     *
     * The dark arms below are therefore repointed at Stitch's namedColors
     * (docs/stitch/DESIGN.md: canvas #0A0A0A, surface #171717, container
     * #201F1F, hairlines white 6%/16%, ink #F5F5F4/#A3A3A3). That makes the
     * tuple the entire palette: `color-scheme: dark` alone now resolves to
     * exactly what stitch.css used to pin, which is why stitch.css no longer
     * pins anything — it is one `color-scheme` declaration.
     *
     * The LIGHT arms are untouched, deliberately. 53 routes still render them
     * and this change must not move a single pixel there.
     */

    /* ── Accents ──────────────────────────────────────────────────────────── */
    // Gold is the action colour — the one design caveat that survived lifting
    // the palette lock for DS-0 (owner decision; CLAUDE.md, runbook §3). Stone
    // keeps everything else, but its accent is a neutral (#28282a/#f3f3f5),
    // which made every primary CTA monochrome. These values also match
    // tanmatra.css, the generated sheet Astryx's own components read — it was
    // never regenerated for Stone, so accent had silently split in two: gold in
    // Astryx components, near-black in our Tailwind utilities. Stitch specified
    // the same pair (#D4AF37 on #111318, 8.84:1), so unifying moved nothing.
    '--color-accent': ['#7F6921', '#D4AF37'],
    '--color-accent-ink': ['#ffffff', '#111318'],
    '--color-blue': ['#506072', '#99adc6'],
    // Signals, never interactive. The dark stops are Stitch's, i.e. the values
    // already on screen on every redesigned route — adopting them here is what
    // makes the two palettes one, and shifts nothing that currently renders.
    '--color-sage': ['#4e6357', '#7d9e7e'],
    '--color-success': ['#4e6357', '#7d9e7e'],
    '--color-warning': ['#79693f', '#b6892f'],
    '--color-danger': ['#775751', '#b0655a'],

    /* ── Background & Surface Ramp ───────────────────────────────────────── */
    // Light: Stone. Dark: Stitch's canvas / surface / container ramp.
    '--color-background-app': ['#f3f3f5', '#0a0a0a'],
    '--color-background-surface': ['#ffffff', '#171717'],
    '--color-background-raised': ['#ffffff', '#201f1f'],

    /* ── Text & Ink Ramp ─────────────────────────────────────────────────── */
    '--color-text-primary': ['#28282a', '#f5f5f4'],
    '--color-text-secondary': ['#5e5e5e', '#a3a3a3'],
    // Stone neutral T45 light / T55 dark. NOT one shared #84848b (T55-ish):
    // that measures 3.71:1 on the light surface and 3.40:1 on the light app
    // background — below AA for body text, which tanmatraTheme.test.ts asserts
    // for every text token. Both stops are real Stone ramp values AND #838388
    // is also Stitch's tertiary ink, so this is the one neutral that needed no
    // repointing: light 5.38 / 4.85, dark 5.25 / 4.75 on the Stitch canvas.
    '--color-text-tertiary': ['#6a6a6f', '#838388'],

    /* ── Border & Divider Ramp ───────────────────────────────────────────── */
    // Stitch's dark rule is "zero flat borders": hairlines are white at 6% /
    // 16% so they read as edges lit by the surface underneath rather than as
    // drawn lines. Translucency is the point, so these two stops are rgba()
    // rather than hex — the only non-hex values in the map.
    '--color-border': ['#d8d8db', 'rgba(255, 255, 255, 0.06)'],
    '--color-border-strong': ['#84848b', 'rgba(255, 255, 255, 0.16)'],

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
