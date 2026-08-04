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
 *   4. Those tuples are the ONLY palette. Their dark arm is Stitch; stitch.css
 *      re-declared ~20 of them with the same values until the two palettes were
 *      merged, and is now one `color-scheme: dark`. A re-declaration there
 *      would fork the palette again silently, so it is asserted against too.
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
const generated = readFileSync(path.join(root, "lib/themes/tanmatra.css"), "utf8");
const stitch = readFileSync(path.join(root, "lib/themes/stitch.css"), "utf8");

test("<html> carries the Astryx scope attribute", () => {
  assert.match(
    layout,
    /data-astryx-theme="tanmatra"/,
    "Astryx scopes its tokens to [data-astryx-theme]; without this attribute no theme CSS applies",
  );
});

test("stylesheets are imported in dependency order", () => {
  const order = [
    // Must be literally first: layer rank is fixed at first declaration, and
    // this bare @layer statement is what stops Tailwind's Preflight (declared
    // inside globals.css, last) from outranking Astryx's base layer — see
    // app/layers.css. Moving it later silently reopens that bug; CI would stay
    // green on every other check here since none of them touch layer order.
    "./layers.css",
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
      `${order[k - 1]!.s} must be imported before ${order[k]!.s} — layers → base → theme → bridge → globals`,
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
// tanmatraTheme.ts writes tokens as  '--name': ['light', 'dark'],
// tanmatraBridge.css writes          --raw: light-dark(light, dark);
// This maps each raw token to its theme source and compares the pair.
// An arm is a hex OR an rgb()/rgba(): Stitch's dark hairlines are translucent
// white, which no hex can express without inventing an opaque approximation.
const ARM = String.raw`#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)`;
const norm = (v: string) => v.toLowerCase().replace(/\s+/g, "");
function themeTuple(name: string): [string, string] {
  const m = themeTs.match(new RegExp(`'${name}':\\s*\\['(${ARM})',\\s*'(${ARM})'\\]`));
  assert.ok(m, `${name} not found as a tuple in tanmatraTheme.ts`);
  return [norm(m![1]!), norm(m![2]!)];
}
function bridgeTuple(raw: string): [string, string] {
  const m = bridge.match(new RegExp(`${raw}:\\s*light-dark\\((${ARM}),\\s*(${ARM})\\)`));
  assert.ok(m, `${raw} not found as light-dark() in tanmatraBridge.css`);
  return [norm(m![1]!), norm(m![2]!)];
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

// ── Bridge-only tokens: no Astryx counterpart, but still two-armed ─────────
// These name things Astryx's system has no token for, so tanmatraTheme.ts
// cannot be their source and PAIRS above cannot cover them. What still has to
// hold is that they are TUPLES. A one-armed token is the --glass bug: it was
// declared only inside [data-stitch="dark"], so the shared sticky bars that
// paint bg-[var(--glass)] — the buy bars, the mini-cart, the planner footer —
// resolved it to nothing on the 53 light routes and rendered no fill at all.
// bridgeTuple() throws unless the token is present as light-dark(a, b), so
// calling it IS the tuple assertion.
test("bridge-only tokens are light/dark tuples, not one-armed values", () => {
  for (const raw of ["--sage-ink", "--sage-soft", "--glass"]) {
    const [light, dark] = bridgeTuple(raw);
    assert.notEqual(light, dark, `${raw} paints a surface — its two arms must differ`);
  }
});

test("--scrim is dark in BOTH arms", () => {
  // The deliberate exception to "the arms differ". A scrim is not a surface,
  // it is the absence of one, and Radix portals it to document.body — outside
  // every [data-stitch] wrapper. If it flipped with scope, a dialog opened
  // from a dark route would get a white veil.
  for (const arm of bridgeTuple("--scrim")) {
    const channels = arm.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [];
    assert.equal(channels.length, 3, `--scrim arm ${arm} must be an rgb()/rgba()`);
    assert.ok(Math.max(...channels) < 64, `--scrim arm ${arm} is not dark`);
  }
});

// ── One palette: stitch.css must not re-declare what the bridge themes ─────
// Stitch's values used to be pinned here AND carried as the dark arm of the
// bridge tuples — two dark palettes, ~90% identical, free to fork on any edit.
// They are one now, so a colour token declared in both files is by definition
// the fork re-opening. Declarations are matched on the raw property name; the
// bridge is the allow-list, so this also catches a NEW token being introduced
// in the scope file instead of as a tuple.
function declaredTokens(css: string): string[] {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...code.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]!);
}

test("stitch.css re-declares no token the bridge already supplies", () => {
  const fromBridge = new Set(declaredTokens(bridge));
  const forked = declaredTokens(stitch).filter((t) => fromBridge.has(t));
  assert.deepEqual(
    forked,
    [],
    "these are pinned in stitch.css AND tupled in tanmatraBridge.css — one palette, so drop the pin (or, if the value genuinely differs, it belongs in the tuple's dark arm)",
  );
});

test("the Stitch scope still flips color-scheme", () => {
  assert.match(
    stitch,
    /\[data-stitch="dark"\]\s*\{[^}]*color-scheme:\s*dark/,
    "this one declaration IS the dark theme now — light-dark() resolves against the consuming element's color-scheme, so without it every redesigned route silently renders light",
  );
});

// ── Generated-sheet sync: tanmatra.css must agree with the theme too ───────
// The bridge test above pins tanmatraBridge.css to tanmatraTheme.ts, but
// tanmatra.css — the generated Astryx sheet that Astryx's OWN components read
// for --color-accent — was outside every check. The Stone-theme merge edited
// the theme and the bridge without regenerating it, so accent split in two:
// Astryx buttons stayed gold while .bg-gold went near-black, live, invisibly.
// Accent is the pair that matters (it paints actions); if a future theme change
// regenerates the sheet, this fails until the theme is updated to match.
function generatedTuple(name: string): [string, string] {
  const m = generated.match(new RegExp(`${name}:\\s*light-dark\\((#[0-9a-fA-F]{3,8}),\\s*(#[0-9a-fA-F]{3,8})\\)`));
  assert.ok(m, `${name} not found as a light-dark() pair in tanmatra.css`);
  return [m![1]!.toLowerCase(), m![2]!.toLowerCase()];
}

test("the generated Astryx sheet carries the same accent as the theme", () => {
  for (const name of ["--color-accent", "--color-accent-ink"]) {
    assert.deepEqual(
      generatedTuple(name),
      themeTuple(name),
      `tanmatra.css and tanmatraTheme.ts disagree on ${name} — regenerate the sheet, or fix the theme to match it`,
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
