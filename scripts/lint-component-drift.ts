import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Component-drift gate. `lint-tokens.ts` catches raw colour literals; it does
// not catch two engineers spelling the SAME token two different ways. A
// forensic UI audit (2026-07-30) found this is real, not hypothetical: the
// shadcn-alias `destructive` family (`text-destructive`, `border-destructive`,
// `bg-destructive` — all correctly bridged to `--danger` in globals.css, so
// none of this is a rendering bug) had drifted across 13 files alongside the
// direct-token spelling (`text-[var(--danger)]`, 62 uses and the documented
// convention) — two names for one signal, in a design system that otherwise
// treats "one signal, one spelling" as load-bearing. Same story for the
// `.tabular` utility (app/globals.css) already setting
// `font-family: var(--font-mono)`, paired redundantly with an explicit
// `font-mono` in 18 more call sites.
//
// This gate is deliberately narrow — only classes with an unambiguous,
// already-dominant direct-token replacement. It does not adjudicate the
// larger open questions from that audit (sage weight, eyebrow scale, CTA
// radius, ui/button.tsx adoption) — those are design decisions, not
// mechanical spelling fixes, and don't belong in a hard CI gate.
//
// Follows the baseline pattern from lint-test-reach.ts: a rule with existing
// violations at introduction time gets a baseline file instead of failing the
// whole build; the register may only shrink. Both rules below start with an
// EMPTY baseline (2026-07-30's audit fixed every existing instance) — any
// future violation is new debt and fails outright.
//
// Usage: node --experimental-strip-types scripts/lint-component-drift.ts [targetDir]

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const TARGET = path.resolve(REPO_ROOT, process.argv[2] ?? "artifacts/storefront");
const SCAN_SUBDIRS = ["components", "app"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "ui"]);
const BASELINE_FILE = path.join(SCRIPT_DIR, "component-drift-baseline.txt");

interface Rule {
  id: string;
  /** Matches the violating class token. */
  pattern: RegExp;
  message: string;
}

const RULES: Rule[] = [
  {
    id: "destructive-alias",
    // Word-boundary on both sides so `border-destructive` doesn't also match
    // as a substring of something longer, and so `text-destructive-foreground`
    // (were it ever hand-written) is caught too via the shared prefix scan.
    pattern: /\b(?:text|bg|border|ring)-destructive\b/,
    message:
      'shadcn-alias danger class — use the direct token instead: text-[var(--danger)] / bg-[var(--danger)] / border-[var(--danger)] (62 existing uses; components/ui/ may keep the alias, it IS the bridge).',
  },
  {
    id: "redundant-font-mono-tabular",
    // `.tabular` (app/globals.css) already sets font-family: var(--font-mono).
    // Only flag it paired with the CUSTOM `.tabular` class, not Tailwind's own
    // `tabular-nums` utility (which doesn't set a font-family, so pairing that
    // one with font-mono is a real, non-redundant combination).
    pattern: /\bfont-mono\s+tabular\b(?!-nums)|\btabular\s+font-mono\b/,
    message:
      "redundant with .tabular, which already sets font-family: var(--font-mono) — drop the explicit font-mono (18 existing sites fixed 2026-07-30; keep font-mono only alongside Tailwind's own tabular-nums, never the custom .tabular class).",
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

const baseline = readBaseline();
const newViolations = violations.filter((v) => !baseline.has(`${v.file}:${v.line}`));

// A baseline entry whose line no longer violates (fixed, moved, or deleted)
// is stale — same shrink-only discipline as lint-test-reach.ts.
const liveKeys = new Set(violations.map((v) => `${v.file}:${v.line}`));
const stale = [...baseline].filter((key) => !liveKeys.has(key));

if (newViolations.length > 0 || stale.length > 0) {
  if (newViolations.length > 0) {
    console.error(`\n✗ component-drift gate: ${newViolations.length} new violation(s):\n`);
    for (const v of newViolations) {
      const rule = RULES.find((r) => r.id === v.rule)!;
      console.error(`  ${v.file}:${v.line}  [${v.rule}]`);
      console.error(`    ${v.text.slice(0, 100)}`);
      console.error(`    → ${rule.message}\n`);
    }
  }
  if (stale.length > 0) {
    console.error(`✗ component-drift gate: ${stale.length} stale baseline entr(ies) — no longer violate, remove from component-drift-baseline.txt:`);
    for (const key of stale) console.error(`  • ${key}`);
  }
  console.error("");
  process.exit(1);
}

console.log(
  `✓ component-drift gate: no destructive-alias / redundant-tabular drift in components/app (${violations.length} baselined).`,
);
