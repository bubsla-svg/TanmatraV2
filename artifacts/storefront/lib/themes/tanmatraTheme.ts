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
    // PR-11a (docs/MOBILE-FIRST-CX-BRIEF.md "Foundations 0"): the delivered
    // revision's palette replaces the black/gold lock. `--color-accent` is the
    // ACTION token — the revision's green primary in light (6.8:1 under cream)
    // and its amber in dark. The name `--gold` is kept downstream so no class
    // or locator moves; only the value changed. Values are the README's HSL
    // triplets (docs/design-reference/storefront-revision-2026-09) as hex.
    // Historical note, kept because the tests still parse this shape:
    // Gold was the action colour — the one design caveat that survived lifting
    // the palette lock for DS-0 (owner decision; CLAUDE.md, runbook §3). Stone
    // keeps everything else, but its accent is a neutral (#28282a/#f3f3f5),
    // which made every primary CTA monochrome. These values also match
    // tanmatra.css, the generated sheet Astryx's own components read — it was
    // never regenerated for Stone, so accent had silently split in two: gold in
    // Astryx components, near-black in our Tailwind utilities. Stitch specified
    // the same pair (#D4AF37 on #111318, 8.84:1), so unifying moved nothing.
    // The light arm is restated in ./brand.ts (ACCENT_GOLD_LIGHT) for
    // surfaces that need the literal outside the CSS pipeline — Razorpay's
    // modal theme.color. astryxBridge.test.ts parses this file for literal
    // tuples, so the tuple stays literal; razorpayAdapter.test.ts pins the
    // brand.ts restatement against this line the same source-parsing way.
    // Dark arm was #d08a3e (31 61% 53%). It measured 3.32:1 as TEXT on
    // --color-background-raised (#364a45) — below AA — which is what
    // `text-primary`/`text-accent` resolve to on every raised card in dark
    // mode (measured on / and /dish/*, 2026-09-06). Lifted at the SAME hue
    // to 31 85% 65%: saturation goes up with lightness so it stays the
    // revision's amber rather than going pale. Now 4.7:1 on raised, 6.8:1
    // on surface, 7.9:1 on the canvas, and 7.9:1 for --color-accent-ink on
    // the fill — AA as both fill and text against every dark ground.
    // Same remedy as --color-danger below, for the same reason.
    '--color-accent': ['#2e5c4f', '#f2a85a'],
    '--color-accent-ink': ['#f6f1e9', '#172622'],
    '--color-blue': ['#506072', '#99adc6'],
    // Signals, never interactive. The dark stops are Stitch's, i.e. the values
    // already on screen on every redesigned route — adopting them here is what
    // makes the two palettes one, and shifts nothing that currently renders.
    // Sage is the revision's `sage-deep` (93 20% 34% / 88 25% 72%) — the one
    // sage stop that passes AS TEXT (5.4:1 on cream); the chip fill lives in
    // tanmatraBridge.css as --sage-soft. Warning is the amber at text weight
    // (31 61% 37%, 4.6:1) — the README rules the 53% amber decorative-only.
    // Dark arm lifted #b9c9a6 → #cbd8bb (2026-09-06 audit): as text on the
    // --sage-soft chip fill it measured 4.31:1; now 5.07:1, 6.3:1 on raised.
    '--color-sage': ['#556845', '#cbd8bb'],
    '--color-success': ['#556845', '#b9c9a6'],
    '--color-warning': ['#986025', '#f2a85a'],
    // Dark arm was #b0655a — 4.14:1 on --color-background-surface, below AA's
    // 4.5:1 (2026-08-13 audit). Lightened/saturated slightly at the same hue
    // (~8° red, was washed out at L 52%) to 5.1-6.2:1 across bg/surface/raised,
    // matching --color-success and --color-warning's dark-arm contrast range.
    // Light is the revision's --destructive (7 58% 46%). Its dark stop
    // (7 58% 52%) measures 3.5:1 as text on the dark canvas, so the dark arm
    // is lifted at the same hue to the first lightness that clears 4.5:1 on
    // both dark canvases.
    '--color-danger': ['#b94131', '#d97c70'],

    /* ── Background & Surface Ramp ───────────────────────────────────────── */
    // Light: Stone. Dark: Stitch's canvas / surface / container ramp.
    // Light: warm cream (38 42% 94%) / card (40 45% 97%) / secondary wash
    // (37 29% 87%). Dark: deep green (164 25% 12% / 22% 16% / 16% 25%).
    '--color-background-app': ['#f6f1e9', '#172622'],
    '--color-background-surface': ['#fbf8f4', '#20322d'],
    '--color-background-raised': ['#e7e0d4', '#364a45'],

    /* ── Text & Ink Ramp ─────────────────────────────────────────────────── */
    // Ink 164 25% 17% / cream. Secondary is the README's contrast fix:
    // --muted-foreground moves from 43% to 41% lightness to clear 4.5:1 on
    // dish descriptions (hex rounded to the side that keeps the margin).
    '--color-text-primary': ['#213630', '#f6f1e9'],
    '--color-text-secondary': ['#5d726c', '#c5bdaf'],
    // Stone neutral T45 light / T55 dark. NOT one shared #84848b (T55-ish):
    // that measures 3.71:1 on the light surface and 3.40:1 on the light app
    // background — below AA for body text, which tanmatraTheme.test.ts asserts
    // for every text token. Both stops are real Stone ramp values AND #838388
    // is also Stitch's tertiary ink, so this is the one neutral that needed no
    // repointing: light 5.38 / 4.85, dark 5.25 / 4.75 on the Stitch canvas.
    '--color-text-tertiary': ['#5e6e6a', '#b7b0a4'],

    /* ── Border & Divider Ramp ───────────────────────────────────────────── */
    // Stitch's dark rule is "zero flat borders": hairlines are white at 6% /
    // 16% so they read as edges lit by the surface underneath rather than as
    // drawn lines. Translucency is the point, so these two stops are rgba()
    // rather than hex — the only non-hex values in the map.
    // Revision hairline 35 25% 82% (decorative, 1.3:1 — boundaries that must
    // be perceived use shadow/fill); strong is held at ≥3:1 for inputs and
    // steppers. Dark arms are the revision's opaque green rules.
    '--color-border': ['#ddd3c6', '#364a45'],
    '--color-border-strong': ['#968369', '#5c7a72'],

    /* ── Radii & Duration ────────────────────────────────────────────────── */
    '--radius-sm': '12px',
    '--radius-md': '14px',
    '--radius-lg': '16px',
    '--radius-xl': '20px',
    '--radius-full': '999px',
    '--duration-fast': '150ms',
    '--duration-normal': '240ms',
  } as any,
});
