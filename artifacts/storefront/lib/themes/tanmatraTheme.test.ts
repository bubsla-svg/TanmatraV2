import test from 'node:test';
import assert from 'node:assert/strict';
import { tanmatraTheme } from './tanmatraTheme';

function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  const bigint = parseInt(cleanHex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [rs, gs, bs] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test('Astryx Theme Token Contrast Audit — Light Mode (AA >= 4.5:1 for body text)', () => {
  const inputTokens = (tanmatraTheme as unknown as { __inputTokens: Record<string, [string, string]> }).__inputTokens;
  const bgApp = inputTokens['--color-background-app']![0];
  const bgSurface = inputTokens['--color-background-surface']![0];

  const textTokens = [
    '--color-accent',
    '--color-blue',
    '--color-sage',
    '--color-success',
    '--color-warning',
    '--color-danger',
    '--color-text-primary',
    '--color-text-secondary',
    '--color-text-tertiary',
  ];

  for (const token of textTokens) {
    const lightVal = inputTokens[token]![0];
    const ratioApp = contrastRatio(lightVal, bgApp);
    const ratioSurface = contrastRatio(lightVal, bgSurface);

    assert.ok(
      ratioApp >= 4.5 || ratioSurface >= 4.5,
      `Token ${token} light value ${lightVal} fails WCAG AA contrast (app: ${ratioApp.toFixed(2)}, surface: ${ratioSurface.toFixed(2)})`
    );
  }
});

test('Astryx Theme Token Contrast Audit — Dark Mode (AA >= 4.5:1 for body text)', () => {
  const inputTokens = (tanmatraTheme as unknown as { __inputTokens: Record<string, [string, string]> }).__inputTokens;
  const bgApp = inputTokens['--color-background-app']![1];
  const bgSurface = inputTokens['--color-background-surface']![1];

  const textTokens = [
    '--color-accent',
    '--color-blue',
    '--color-sage',
    '--color-success',
    '--color-warning',
    '--color-danger',
    '--color-text-primary',
    '--color-text-secondary',
    '--color-text-tertiary',
  ];

  for (const token of textTokens) {
    const darkVal = inputTokens[token]![1];
    const ratioApp = contrastRatio(darkVal, bgApp);
    const ratioSurface = contrastRatio(darkVal, bgSurface);

    assert.ok(
      ratioApp >= 4.5 || ratioSurface >= 4.5,
      `Token ${token} dark value ${darkVal} fails WCAG AA contrast (app: ${ratioApp.toFixed(2)}, surface: ${ratioSurface.toFixed(2)})`
    );
  }
});

test('Astryx Theme Button Fill Ink Contrast Audit — Both Modes (AA >= 4.5:1 on gold fill)', () => {
  const inputTokens = (tanmatraTheme as unknown as { __inputTokens: Record<string, [string, string]> }).__inputTokens;
  const lightGold = inputTokens['--color-accent']![0];
  const darkGold = inputTokens['--color-accent']![1];
  const lightInk = inputTokens['--color-accent-ink']![0];
  const darkInk = inputTokens['--color-accent-ink']![1];

  const lightRatio = contrastRatio(lightInk, lightGold);
  const darkRatio = contrastRatio(darkInk, darkGold);

  assert.ok(
    lightRatio >= 4.5,
    `Light mode gold fill label contrast fails WCAG AA: ${lightRatio.toFixed(2)}`
  );
  assert.ok(
    darkRatio >= 4.5,
    `Dark mode gold fill label contrast fails WCAG AA: ${darkRatio.toFixed(2)}`
  );
});
