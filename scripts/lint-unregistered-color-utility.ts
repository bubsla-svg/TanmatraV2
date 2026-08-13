import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Unregistered-color-utility gate. `lint-tokens.ts` catches raw colour
// LITERALS; `lint-dark-forks.ts` catches Tailwind's own built-in palette and
// `dark:`. Neither catches the third shape: a bare colour-family utility
// (`text-ink-on-gold`, `bg-surface-canvas`) whose name was never registered
// as a `--color-*` custom property in app/globals.css's `@theme` block.
// Tailwind v4 only emits a rule for a name it was told about — an
// unregistered name compiles to NOTHING, so the class is silently inert and
// the element falls through to whatever colour it inherits. No raw hex, no
// `dark:` fork, nothing `lint-tokens`/`lint-dark-forks` can see: the element
// just quietly stops being styled.
//
// WHY THIS IS A GATE, NOT A TYPO NOBODY WILL REPEAT. A 2026-08-13 audit
// found ONE instance by sampling rendered pixels (`text-ink-on-gold` on the
// home page, 2.76:1/1.93:1 contrast — below AA in both themes). Chasing the
// same shape by hand then found NINE more, unrelated to that one and to each
// other: `text-ink-primary`/`text-ink-secondary` (52 sites — a whole legacy
// naming generation that predates the plain `ink`/`ink-muted` rename),
// `bg-surface-canvas`/`-container`/`-muted` (20 sites), `border-sage-strong`
// (5), `text-gold-ink` (1), plus the paired size/weight classes
// `text-headline-md`/`text-label-caps`/`text-body-lg` and
// `font-headline-md`/`font-label-caps` that never had a CSS rule either —
// meaning several page H1s and CTAs were rendering with NO explicit size or
// weight since the day they shipped. One-off inspection does not scale
// against a failure mode this quiet; a gate does.
//
// HOW REGISTRATION IS CHECKED. Only names declared as `--color-<name>:`
// inside app/globals.css's `@theme inline { ... }` block generate a bare
// Tailwind utility (`bg-<name>`, `text-<name>`, …) — this file reads that
// block itself rather than hard-coding the list, so it can never drift from
// what the app actually ships. A raw custom property declared only in
// tokens.css or tanmatraBridge.css (`--gold-ink`, `--danger`, `--sage-ink`,
// `--scrim`, `--glass`, …) is real but NOT bare-utility-usable — it must be
// consumed as `text-[var(--gold-ink)]`, which this gate does not flag
// (bracket syntax always resolves; only bare names can go phantom).
//
// SCOPE. Checks `bg-`, `text-`, `border-`, `ring-` only — the four prefixes
// that are BOTH a Tailwind colour-utility family AND overloaded with
// same-named non-colour utilities (text-xs is a font-size, border-t is a
// side, ring-offset-2 is a width). NON_COLOR_SUFFIX is the allowlist for
// exactly those collisions, built empirically against this codebase's actual
// usage rather than guessed from memory — extend it if a legitimate new
// Tailwind utility trips a false positive, but verify the class first
// (`grep -oE '\.<class>\{[^}]*\}' .next/static/css/*.css` after a build).
// Tailwind's own palette-with-shade names (`slate-900`, `sky-400`, …) are
// deliberately OUT of scope: that is lint-dark-forks's job, and this gate
// would only double-report the same line under a different name.
//
// Follows the baseline pattern from lint-dark-forks.ts / lint-test-reach.ts:
// a rule with existing violations at introduction time gets a baseline
// instead of failing the build, and the register may only SHRINK. This gate
// ships with an EMPTY baseline — the 2026-08-13 sweep fixed every instance
// found — so any violation from here is new debt and fails outright.
//
// components/ui/ is exempt (SKIP_DIRS): it is the shadcn/Radix bridge layer
// where the alias-to-token mapping is DEFINED, same carve-out lint-dark-forks
// and lint-component-drift make.
//
// Usage: node --experimental-strip-types scripts/lint-unregistered-color-utility.ts [targetDir]
//        node --experimental-strip-types scripts/lint-unregistered-color-utility.ts --update-baseline

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const ARGS = process.argv.slice(2);
const UPDATE_BASELINE = ARGS.includes("--update-baseline");
const TARGET = path.resolve(
  REPO_ROOT,
  ARGS.find((a) => !a.startsWith("--")) ?? "artifacts/storefront",
);
const SCAN_SUBDIRS = ["components", "app"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "ui"]);
const BASELINE_FILE = path.join(SCRIPT_DIR, "unregistered-color-utility-baseline.txt");
const GLOBALS_CSS = path.join(TARGET, "app/globals.css");

const PREFIXES = ["bg", "text", "border", "ring"];

// Tailwind's own always-valid colour keywords for these prefixes. `white`/
// `black` are deliberately excluded — those are lint-dark-forks's job, and
// permitting them here would let a `dark-forks`-baselined line go quiet
// under this gate's different name instead of actually being fixed.
const ALWAYS_VALID = new Set(["transparent", "current", "inherit"]);

// Empirically-derived non-colour utilities that share these four prefixes.
// Each entry is checked as `<prefix>-<suffix>`.
const NON_COLOR_SUFFIX = new Set([
  // font-size (text- is overloaded between colour and size)
  "3xs", "2xs", "xs", "sm", "base", "lg", "xl",
  "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl",
  // text-align / text-transform-adjacent utilities
  "left", "center", "right", "justify", "start", "end",
  "ellipsis", "clip",
  // border side / width / style
  "t", "b", "l", "r", "x", "y",
  "solid", "dashed", "dotted", "double", "none", "hidden",
  "collapse", "separate",
  // ring width / offset (ring-offset-<n> is width, not colour — a colour
  // ring-offset would be ring-offset-<token>, which the registered-set check
  // below still covers)
  "offset",
]);
// Numeric or arbitrary-looking suffixes (border-2, ring-4, text-[10px], any
// bracket) are filtered structurally in the scan, not via this set.

// Compound suffixes: the greedy suffix capture swallows a second hyphenated
// segment (border-b-2 → suffix "b-2", ring-offset-2 → "offset-2"), so a flat
// Set membership check can't cover them — verified against Tailwind v4's own
// utility list (node_modules/tailwindcss/dist/lib.js) rather than guessed.
const BORDER_SIDE_WIDTH = /^[tblrxy]-\d+$/; // border-b-2, border-x-4, …
const RING_OFFSET_WIDTH = /^offset-\d+$/; // ring-offset-2, ring-offset-8
const BG_GRADIENT_DIRECTION = /^gradient-to-(t|tr|r|br|b|bl|l|tl)$/; // bg-gradient-to-br, …

// A string literal being *compared*, not used as a className — the AI SDK
// streaming event-type discriminants (coachApi.ts's UIMessage stream parts:
// "text-delta", "text-start", "text-end", …) collide with the text- prefix
// purely by coincidence of vocabulary. Scoped narrowly to the comparison
// shape itself (===/!==/==/!=/case immediately before the opening quote) so
// it can't also swallow a real `className={cond === x ? "text-ink" : ...}`
// ternary, where the class sits AFTER the operator's right-hand value, not
// immediately after the operator.
const COMPARISON_STRING_CONTEXT = /(?:===|!==|==|!=|\bcase)\s*["'`]$/;

function extractRegisteredColorNames(): Set<string> {
  const css = fs.readFileSync(GLOBALS_CSS, "utf8");
  const themeMatch = css.match(/@theme\s+inline\s*\{/);
  if (!themeMatch) {
    throw new Error(`Could not find "@theme inline {" in ${GLOBALS_CSS} — has the token bridge moved?`);
  }
  // Slice from the @theme block open brace to its matching close (simple
  // depth counter — the block contains nested @keyframes braces).
  let depth = 0;
  let start = themeMatch.index! + themeMatch[0].length - 1;
  let end = start;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  const block = css.slice(start, end);
  const names = new Set<string>();
  for (const m of block.matchAll(/--color-([a-z0-9-]+):/g)) names.add(m[1]!);
  return names;
}

interface Violation {
  file: string;
  line: number;
  rule: string;
  text: string;
}

function readBaseline(): Set<string> {
  if (!fs.existsSync(BASELINE_FILE)) return new Set();
  return new Set(
    fs.readFileSync(BASELINE_FILE, "utf8")
      .split("\n").map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("#")),
  );
}

function stripComments(src: string): string {
  // Blank comments line-for-line (not delete) so reported line numbers stay
  // real and the baseline stays stable against unrelated comment edits — see
  // lint-dark-forks.ts, which had this bug until the same 2026-08-13 sweep.
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  return noBlock.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function scanFile(abs: string, registered: Set<string>, violations: Violation[]): void {
  const rel = path.relative(REPO_ROOT, abs);
  const stripped = stripComments(fs.readFileSync(abs, "utf8"));
  const linePattern = new RegExp(`\\b(${PREFIXES.join("|")})-([a-zA-Z][a-zA-Z0-9-]*)\\b`, "g");
  stripped.split("\n").forEach((raw, i) => {
    const line = i + 1;
    for (const m of raw.matchAll(linePattern)) {
      const [, prefix, suffix] = m as unknown as [string, string, string];
      if (ALWAYS_VALID.has(suffix)) continue;
      if (NON_COLOR_SUFFIX.has(suffix)) continue;
      if (BORDER_SIDE_WIDTH.test(suffix)) continue;
      if (RING_OFFSET_WIDTH.test(suffix)) continue;
      if (BG_GRADIENT_DIRECTION.test(suffix)) continue;
      // ring-offset-<color> (e.g. ring-offset-background): split off the
      // "offset-" and check the remainder as a colour, not the compound.
      if (prefix === "ring" && suffix.startsWith("offset-")) {
        const colorPart = suffix.slice("offset-".length);
        if (ALWAYS_VALID.has(colorPart) || registered.has(colorPart)) continue;
      }
      // Tailwind's built-in palette-with-shade (slate-900, sky-400, …) is
      // lint-dark-forks's territory — skip so a line isn't double-reported.
      if (/^(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|[1-9]00|950)$/.test(suffix)) continue;
      if (registered.has(suffix)) continue;
      if (COMPARISON_STRING_CONTEXT.test(raw.slice(0, m.index))) continue;
      violations.push({ file: rel, line, rule: `${prefix}-${suffix}`, text: raw.trim() });
    }
  });
}

function walk(dir: string, registered: Set<string>, violations: Violation[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), registered, violations);
    } else if (/\.tsx?$/.test(entry.name)) {
      scanFile(path.join(dir, entry.name), registered, violations);
    }
  }
}

const registered = extractRegisteredColorNames();
const violations: Violation[] = [];
for (const sub of SCAN_SUBDIRS) walk(path.join(TARGET, sub), registered, violations);

const keyOf = (v: Violation) => `${v.file}:${v.line}:${v.rule}`;

if (UPDATE_BASELINE) {
  const header = [
    "# Baseline for scripts/lint-unregistered-color-utility.ts.",
    "#",
    "# Format: path/to/file.tsx:LINE:prefix-suffix (one per line), same",
    "# shrink-only discipline as scripts/dark-forks-baseline.txt.",
    "#",
    "# Empty by design: the 2026-08-13 sweep that introduced this gate fixed",
    "# every instance found (10 distinct phantom class names, ~137 sites,",
    "# spanning bg/text/border AND their paired font- weight classes), so the",
    "# gate starts at zero debt. Add an entry ONLY for a pre-existing",
    "# violation discovered later that isn't being fixed in the same change —",
    "# never for new code.",
    "",
  ].join("\n");
  fs.writeFileSync(BASELINE_FILE, header + violations.map(keyOf).sort().join("\n") + (violations.length ? "\n" : ""));
  console.log(`✓ unregistered-color-utility baseline written: ${violations.length} entr(ies) → ${path.relative(REPO_ROOT, BASELINE_FILE)}`);
  process.exit(0);
}

const baseline = readBaseline();
const newViolations = violations.filter((v) => !baseline.has(keyOf(v)));
const liveKeys = new Set(violations.map(keyOf));
const stale = [...baseline].filter((key) => !liveKeys.has(key));

if (newViolations.length > 0 || stale.length > 0) {
  if (newViolations.length > 0) {
    console.error(`\n✗ unregistered-color-utility gate: ${newViolations.length} new violation(s):\n`);
    for (const v of newViolations) {
      console.error(`  ${v.file}:${v.line}  [${v.rule}]`);
      console.error(`    ${v.text.slice(0, 100)}`);
      console.error(`    → "${v.rule}" has no matching --color-${v.rule.split("-").slice(1).join("-")} in app/globals.css's @theme block, so Tailwind emits NO rule for it — the class is silently inert. Register the token, or use the closest existing one (bg/text-ink, -ink-muted, -surface, -surface-raised, -surface-subtle, -gold, -sage, …).\n`);
    }
  }
  if (stale.length > 0) {
    console.error(`✗ unregistered-color-utility gate: ${stale.length} stale baseline entr(ies) — no longer violate, remove from unregistered-color-utility-baseline.txt:`);
    for (const key of stale) console.error(`  • ${key}`);
  }
  console.error("");
  process.exit(1);
}

console.log(
  `✓ unregistered-color-utility gate: no bare bg-/text-/border-/ring- class resolves to an unregistered token (${violations.length} baselined, ${registered.size} tokens registered).`,
);
