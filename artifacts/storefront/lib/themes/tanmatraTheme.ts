import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral';

export const tanmatraTheme = defineTheme({
  name: 'tanmatra',
  extends: neutralTheme,
  tokens: {
    /* ── Locked brand accents & semantic status (light, dark tuples) ────── */
    '--color-accent': ['#7F6921', '#D4AF37'],
    '--color-accent-ink': ['#ffffff', '#111318'],
    '--color-blue': ['#2D6A8F', '#6BA3C8'],
    '--color-sage': ['#3D5C3E', '#7D9E7E'],
    '--color-success': ['#3D5C3E', '#7D9E7E'],
    '--color-warning': ['#7A5E12', '#D8B45E'],
    '--color-danger': ['#8C3214', '#C2603F'],

    /* ── Background & Surface Ramp ───────────────────────────────────────── */
    '--color-background-app': ['#fbfaf7', '#0e0f11'],
    '--color-background-surface': ['#ffffff', '#17191c'],
    '--color-background-raised': ['#ffffff', '#1e2125'],

    /* ── Text & Ink Ramp ─────────────────────────────────────────────────── */
    '--color-text-primary': ['#1a1c1e', '#e9ecee'],
    '--color-text-secondary': ['#5c6367', '#8b9398'],
    '--color-text-tertiary': ['#6b7378', '#7f878c'],

    /* ── Border & Divider Ramp ───────────────────────────────────────────── */
    '--color-border': ['#e7e3da', '#262a2e'],
    '--color-border-strong': ['#d8d3c7', '#333940'],

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
