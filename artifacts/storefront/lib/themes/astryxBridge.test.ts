/**
 * Guards the Astryx token bridge (DS-0).
 *
 * The bridge is three cooperating facts spread across two files, and NONE of
 * them is visible to typecheck, lint:tokens or lint:filecap. Break any one and
 * the app still compiles, still passes every other gate, and renders with the
 * wrong palette — or, in the `data-astryx-theme` case, with unresolved custom
 * properties and no colour at all. So they are asserted here as text.
 *
 *   1. layout.tsx puts `data-astryx-theme="tanmatra"` on <html>. Astryx wraps
 *      its tokens in `@scope ([data-astryx-theme="tanmatra"])`; without the
 *      attribute the --color-* properties are never defined anywhere.
 *   2. layout.tsx imports the theme CSS between tokens.css and globals.css.
 *   3. globals.css re-points every raw token at its Astryx counterpart.
 *
 * Rendered-output correctness (contrast, per-mode values) is covered against a
 * real browser by the e2e suite; this is the cheap structural tripwire.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
const globals = readFileSync(path.join(root, "app/globals.css"), "utf8");

test("<html> carries the Astryx scope attribute", () => {
  assert.match(
    layout,
    /data-astryx-theme="tanmatra"/,
    "Astryx scopes its tokens to [data-astryx-theme]; without this attribute no --color-* resolves",
  );
});

test("the theme CSS is imported after the raw tokens and before globals", () => {
  const tokens = layout.indexOf('@workspace/tokens/tokens.css');
  const theme = layout.indexOf('@/lib/themes/tanmatra.css');
  const globalsImport = layout.indexOf('./globals.css');
  assert.ok(tokens >= 0 && theme >= 0 && globalsImport >= 0, "all three stylesheets must be imported");
  assert.ok(
    tokens < theme && theme < globalsImport,
    "order is load-bearing: globals.css breaks the specificity tie with tokens.css by coming last",
  );
});

// Every raw token the app paints with has to be re-pointed, or that one colour
// silently stays on the pre-Astryx value while everything around it moves.
const BRIDGED: ReadonlyArray<readonly [string, string]> = [
  ["--bg", "--color-background-app"],
  ["--surface", "--color-background-surface"],
  ["--surface-raised", "--color-background-raised"],
  ["--ink", "--color-text-primary"],
  ["--ink-muted", "--color-text-secondary"],
  ["--ink-faint", "--color-text-tertiary"],
  ["--line", "--color-border"],
  ["--line-strong", "--color-border-strong"],
  ["--gold", "--color-accent"],
  ["--gold-text", "--color-accent"],
  ["--gold-ink", "--color-accent-ink"],
  ["--sage", "--color-sage"],
  ["--sage-text", "--color-sage"],
  ["--blue", "--color-blue"],
  ["--success", "--color-success"],
  ["--warning", "--color-warning"],
  ["--danger", "--color-danger"],
];

test("every raw token is re-pointed at its Astryx counterpart", () => {
  for (const [token, astryx] of BRIDGED) {
    const re = new RegExp(`${token}:\\s*var\\(${astryx}\\)`);
    assert.match(globals, re, `${token} must resolve to var(${astryx})`);
  }
});

test("the bridge outranks the dark-mode block it has to override", () => {
  assert.match(
    globals,
    /:root\[data-astryx-theme="tanmatra"\]\s*\{/,
    "must be :root[...] — a bare :root loses to tokens.css's :root[data-theme=\"dark\"] on specificity",
  );
});

// Astryx's own Tailwind bridge defines --color-accent/--color-muted/--color-surface
// with meanings opposite to ours (its accent is the gold; ours is a neutral
// panel). Importing it would silently repaint `bg-accent` across the app.
test("Astryx's Tailwind bridge is NOT imported — its namespace collides with ours", () => {
  // Match a real import, not a mention: globals.css documents this decision in
  // a comment, and an over-broad pattern fails on the explanation itself.
  assert.doesNotMatch(
    layout + globals,
    /(?:^|\n)\s*(?:@import\s+|import\s+)["'][^"']*@astryxdesign\/core\/tailwind-theme\.css/,
    "would flip bg-accent from a neutral surface to saffron everywhere it appears",
  );
});
