import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Theme-blindness gate. `lint-tokens.ts` catches raw colour LITERALS (#hex,
// rgb()); `lint-component-drift.ts` catches two spellings of the same token.
// Neither can see the third failure mode: a component that opts out of the
// token system entirely by using Tailwind's built-in palette and Tailwind's
// `dark:` variant.
//
// WHY THIS IS A GATE AND NOT A STYLE PREFERENCE. components/theme-provider.tsx
// states the contract: "Components stay theme-blind — they read semantic
// tokens only, never `dark:` forks." That is not aesthetic. The storefront's
// dark palette is the dark arm of the light-dark() tuples in
// lib/themes/tanmatraBridge.css, resolved against the consuming element's
// color-scheme. A `dark:` fork is a SECOND, parallel dark palette keyed off a
// different signal (the data-theme attribute), so:
//   • it does not follow a Stitch route scope ([data-stitch="dark"] flips
//     color-scheme, not data-theme), so a forked component renders its LIGHT
//     arm on a dark route — the exact class of bug stitch.css's header
//     documents for --glass;
//   • it cannot be restyled by the theme, because the values are literals in
//     the component rather than tokens;
//   • it doubles every future palette change.
// The same argument covers `bg-slate-900` and bare `text-white`: both hardcode
// a colour that the theme can no longer reach.
//
// A 2026-08-13 design-system audit measured the damage: 662 palette-class uses
// and 132 `dark:` forks, of which 88% sit in exactly two component families
// (components/wellness/ and components/rd/) that were built outside the system.
// app/ and every other component directory are already clean, which is why this
// gate is worth having — the compliant majority is what it protects.
//
// Follows the baseline pattern from lint-component-drift.ts / lint-test-reach.ts:
// a rule with existing violations at introduction time gets a baseline instead
// of failing the build, and the register may only SHRINK. Unlike the
// component-drift gate this one does NOT start empty — migrating 794 call sites
// requires a token-mapping decision per Tailwind hue (which token replaces
// sky-900? is cyan-400 even allowed, given gold is the only action colour?),
// and that is a design call, not a mechanical rename. The baseline freezes that
// debt so no NEW component can join it while the mapping is decided.
//
// components/ui/ is exempt (SKIP_DIRS): it is the shadcn/Radix bridge layer
// where the alias-to-token mapping is DEFINED, same carve-out the
// component-drift gate makes.
//
// Usage: node --experimental-strip-types scripts/lint-dark-forks.ts [targetDir]
//        node --experimental-strip-types scripts/lint-dark-forks.ts --update-baseline

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
const BASELINE_FILE = path.join(SCRIPT_DIR, "dark-forks-baseline.txt");

// Tailwind's built-in palette families. Deliberately excludes `white`/`black`
// (no numeric scale — covered by their own rule below) and any name that is
// also one of ours: the storefront's own utilities are bg-gold / text-ink /
// border-line, none of which collide with a Tailwind hue name.
const TAILWIND_HUES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

interface Rule {
  id: string;
  pattern: RegExp;
  message: string;
}

const RULES: Rule[] = [
  {
    id: "dark-variant-fork",
    // The `dark:` variant anywhere in a class string. Matched on a word
    // boundary so `data-[state=dark]:` or a prop literally named "dark" does
    // not trip it — only Tailwind's variant prefix, which is always preceded
    // by whitespace or a quote and always followed by a utility.
    pattern: /(?:^|["'\s`])dark:[a-z[]/,
    message:
      "Tailwind `dark:` fork — the storefront has ONE dark palette (the dark arm of the light-dark() tuples in lib/themes/tanmatraBridge.css). Use a semantic token that themes itself (bg-surface, text-ink, border-line, text-[var(--ink-muted)]) and delete the fork. A dark: fork keys off data-theme, so it silently renders its LIGHT arm inside a [data-stitch=\"dark\"] route scope.",
  },
  {
    id: "tailwind-palette-class",
    // A Tailwind palette utility with a numeric scale step, optionally with an
    // opacity modifier (bg-slate-900/40) and optionally behind any variant
    // chain (hover:, sm:, group-hover:).
    pattern: new RegExp(
      `\\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|shadow|decoration|accent|caret|placeholder)-(?:${TAILWIND_HUES})-(?:50|[1-9]00|950)\\b`,
    ),
    message:
      "Tailwind palette colour — hardcodes a value the theme cannot reach, and rival hues (sky/cyan/indigo) break the one surviving DS-0 caveat that gold is the sole action colour. Use the semantic tokens: surfaces bg-bg/bg-surface/bg-surface-raised, text text-ink/text-ink-muted/text-ink-faint, edges border-line/border-line-strong, action bg-gold/text-[var(--gold-text)], signals --success/--warning/--danger/--sage.",
  },
  {
    id: "raw-white-black",
    // Bare white/black utilities, with or without an opacity modifier. These
    // are theme-invariant by construction: `text-white` stays white on a light
    // surface. `border-white/10` is the common offender — it reads as a
    // hairline only on dark, and vanishes on light.
    pattern:
      /\b(?:bg|text|border|ring|divide|fill|stroke|placeholder|outline)-(?:white|black)(?:\/\d{1,3})?\b/,
    message:
      "raw white/black — theme-invariant, so it survives a theme switch unchanged (text-white on a light surface is unreadable). Use the token that carries both arms: text-ink / bg-surface / border-line, or --gold-ink / --sage-ink for text sitting ON a filled accent.",
  },
];

interface Violation {
  file: string;
  line: number;
  rule: string;
  text: string;
}

function readBaseline(): Set<string> {
  if (!fs.existsSync(BASELINE_FILE)) return new Set();
  return new Set(
    fs
      .readFileSync(BASELINE_FILE, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("#")),
  );
}

function stripComments(src: string): string {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function scanFile(abs: string, violations: Violation[]): void {
  const rel = path.relative(REPO_ROOT, abs);
  const stripped = stripComments(fs.readFileSync(abs, "utf8"));
  stripped.split("\n").forEach((raw, i) => {
    const line = i + 1;
    for (const rule of RULES) {
      if (rule.pattern.test(raw)) {
        violations.push({ file: rel, line, rule: rule.id, text: raw.trim() });
      }
    }
  });
}

function walk(dir: string, violations: Violation[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), violations);
    } else if (/\.tsx?$/.test(entry.name)) {
      scanFile(path.join(dir, entry.name), violations);
    }
  }
}

const violations: Violation[] = [];
for (const sub of SCAN_SUBDIRS) walk(path.join(TARGET, sub), violations);

// Key on file:line:rule, not file:line — one line can hold a palette class AND
// a dark: fork (they usually travel together), and fixing only one of them must
// still leave the other accounted for rather than silently un-baselining both.
const keyOf = (v: Violation) => `${v.file}:${v.line}:${v.rule}`;

if (UPDATE_BASELINE) {
  const byRule = new Map<string, number>();
  for (const v of violations) byRule.set(v.rule, (byRule.get(v.rule) ?? 0) + 1);
  const header = [
    "# Baseline for scripts/lint-dark-forks.ts — frozen theme-blindness debt.",
    "#",
    "# Format: path/to/file.tsx:LINE:rule-id (one per line), same shrink-only",
    "# discipline as scripts/component-drift-baseline.txt.",
    "#",
    "# These entries are PRE-EXISTING debt from component families built outside",
    "# the token system, recorded so the gate can block NEW violations today",
    "# rather than waiting on the migration. Removing an entry is always correct;",
    "# adding one is only correct for a pre-existing violation discovered later.",
    "# Never add an entry for new code.",
    "#",
    `# Frozen ${violations.length} violation(s):`,
    ...[...byRule.entries()].sort().map(([r, n]) => `#   ${r}: ${n}`),
    "",
  ].join("\n");
  fs.writeFileSync(BASELINE_FILE, header + violations.map(keyOf).sort().join("\n") + "\n");
  console.log(`✓ dark-forks baseline written: ${violations.length} entr(ies) → ${path.relative(REPO_ROOT, BASELINE_FILE)}`);
  process.exit(0);
}

const baseline = readBaseline();
const newViolations = violations.filter((v) => !baseline.has(keyOf(v)));

// A baseline entry whose line no longer violates (fixed, moved, or deleted) is
// stale — the register may only shrink, so a stale entry is a failure telling
// you to delete it and bank the progress.
const liveKeys = new Set(violations.map(keyOf));
const stale = [...baseline].filter((key) => !liveKeys.has(key));

if (newViolations.length > 0 || stale.length > 0) {
  if (newViolations.length > 0) {
    console.error(`\n✗ dark-forks gate: ${newViolations.length} new violation(s):\n`);
    for (const v of newViolations) {
      const rule = RULES.find((r) => r.id === v.rule)!;
      console.error(`  ${v.file}:${v.line}  [${v.rule}]`);
      console.error(`    ${v.text.slice(0, 100)}`);
      console.error(`    → ${rule.message}\n`);
    }
  }
  if (stale.length > 0) {
    console.error(
      `✗ dark-forks gate: ${stale.length} stale baseline entr(ies) — no longer violate, remove from dark-forks-baseline.txt:`,
    );
    for (const key of stale) console.error(`  • ${key}`);
  }
  console.error("");
  process.exit(1);
}

console.log(
  `✓ dark-forks gate: no new dark:/palette/raw-white drift in components/app (${violations.length} baselined).`,
);
