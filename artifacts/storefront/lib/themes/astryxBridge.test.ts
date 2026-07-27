/**
 * Guards the Astryx token bridge (DS-0).
 *
 * The bridge is cooperating facts spread across three files, NONE visible to
 * typecheck, lint:tokens or lint:filecap — break one and the app still builds,
 * just with the wrong palette (or, for the scope attribute, no palette). So
 * they are asserted here as text.
 *
 *   1. layout.tsx puts `data-astryx-theme="tanmatra"` on <html> — Astryx wraps
 *      its tokens in @scope on that attribute.
 *   2. layout.tsx imports, in order: astryx.css (base) → tanmatra.css (theme)
 *      → tanmatraBridge.css (our bridge) → globals.css.
 *   3. tanmatraBridge.css pins each raw token to a concrete light-dark()
 *      tuple. Concrete on purpose: the first bridge read Astryx's --color-*
 *      names, and Tailwind's own theme layer emits :root definitions for the
 *      SAME names mapped to our neutrals — layer order put Tailwind last, so
 *      --gold resolved to surface-raised and every .bg-gold painted
 *      white-on-white. A shared name is one late :root away from that.
 *
 * The tuples' source of truth is tanmatraTheme.ts; the sync test below parses
 * both files so the bridge cannot drift from the theme.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
const globals = readFileSync(path.join(root, "app/globals.css"), "utf8");
const bridge = readFileSync(path.join(root, "lib/themes/tanmatraBridge.css"), "utf8");
const themeTs = readFileSync(path.join(root, "lib/themes/tanmatraTheme.ts"), "utf8");

test("<html> carries the Astryx scope attribute", () => {
  assert.match(
    layout,
    /data-astryx-theme="tanmatra"/,
    "Astryx scopes its tokens to [data-astryx-theme]; without this attribute no theme CSS applies",
  );
});

test("stylesheets are imported in dependency order", () => {
  const order = [
    "@workspace/tokens/tokens.css",
    "@astryxdesign/core/astryx.css",
    "@/lib/themes/tanmatra.css",
    "@/lib/themes/tanmatraBridge.css",
    "./globals.css",
  ].map((s) => ({ s, i: layout.indexOf(s) }));
  for (const { s, i } of order) assert.ok(i >= 0, `${s} must be imported by layout.tsx`);
  for (let k = 1; k < order.length; k++) {
    assert.ok(
      order[k - 1]!.i < order[k]!.i,
      `${order[k - 1]!.s} must be imported before ${order[k]!.s} — base → theme → bridge → globals`,
    );
  }
});

test("the bridge outranks the layered theme it overrides", () => {
  assert.match(
    bridge,
    /:root\[data-astryx-theme="tanmatra"\]\s*\{/,
    "must be an UNLAYERED :root[...] block — layered rules lose to Tailwind's theme layer",
  );
  assert.doesNotMatch(bridge, /@layer/, "wrapping the bridge in a layer re-opens the shadowing bug");
});

// ── Value sync: bridge tuples must equal the theme's tuples ────────────────
// tanmatraTheme.ts writes tokens as  '--name': ['#light', '#dark'],
// tanmatraBridge.css writes          --raw: light-dark(#light, #dark);
// This maps each raw token to its theme source and compares the pair.
function themeTuple(name: string): [string, string] {
  const m = themeTs.match(new RegExp(`'${name}':\\s*\\['(#[0-9a-fA-F]{3,8})',\\s*'(#[0-9a-fA-F]{3,8})'\\]`));
  assert.ok(m, `${name} not found as a tuple in tanmatraTheme.ts`);
  return [m![1]!.toLowerCase(), m![2]!.toLowerCase()];
}
function bridgeTuple(raw: string): [string, string] {
  const m = bridge.match(new RegExp(`${raw}:\\s*light-dark\\((#[0-9a-fA-F]{3,8}),\\s*(#[0-9a-fA-F]{3,8})\\)`));
  assert.ok(m, `${raw} not found as light-dark() in tanmatraBridge.css`);
  return [m![1]!.toLowerCase(), m![2]!.toLowerCase()];
}

const PAIRS: ReadonlyArray<readonly [string, string]> = [
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

test("every bridge tuple matches its tanmatraTheme.ts source", () => {
  for (const [raw, themeName] of PAIRS) {
    assert.deepEqual(
      bridgeTuple(raw),
      themeTuple(themeName),
      `${raw} must carry the same light/dark pair as ${themeName} — edit the theme, then mirror here`,
    );
  }
});

test("the bridge (and globals) no longer read Astryx --color-* names", () => {
  // Strip comments first — both files EXPLAIN the forbidden pattern in prose,
  // and an over-broad regex fails on its own documentation.
  const bridgeCode = bridge.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(
    bridgeCode,
    /var\(--color-/,
    "reading a shared --color-* name re-opens the Tailwind-shadowing bug this file exists to close",
  );
  // globals.css may DEFINE --color-* inside @theme (that is Tailwind's
  // namespace); what it must not do is consume Astryx's via var() outside it.
  const themeBlock = globals.slice(globals.indexOf("@theme inline"));
  const beforeTheme = globals.slice(0, globals.indexOf("@theme inline"));
  assert.doesNotMatch(beforeTheme, /var\(--color-(accent|background|text|border)\b/, "globals.css must not read Astryx system tokens");
  assert.ok(themeBlock.length > 0, "@theme inline block expected in globals.css");
});
