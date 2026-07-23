import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// TNM-UIF-01 §3.4 — token-enforcement gate. Components and pages must consume
// the semantic token utilities only (bg-primary, text-muted-foreground,
// border-border, text-sage…). Forbidden in artifacts/storefront/{components,app}:
//   • raw colour values:  #rrggbb / #rgb / rgb() / rgba() / hsl() / oklch()
//   • Tailwind numbered-palette classes: bg-orange-500, text-green-600, …
// globals.css is the sanctioned bridge and is not scanned (it's not .ts/.tsx).
// Comments are stripped first so PR refs like "#287" don't false-positive; the
// one legitimate raw literal — `themeColor` browser-chrome metadata, which the
// Next metadata API requires as a literal — is allow-listed per line.
//
// Usage: node --experimental-strip-types scripts/lint-tokens.ts [targetDir]
//   (targetDir defaults to artifacts/storefront; path is relative to repo root)

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const TARGET = path.resolve(REPO_ROOT, process.argv[2] ?? "artifacts/storefront");
const SCAN_SUBDIRS = ["components", "app"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo"]);

const PALETTE =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";
const PALETTE_CLASS = new RegExp(
  `\\b(bg|text|border|ring|ring-offset|from|to|via|fill|stroke|outline|decoration|divide|accent|caret|shadow)-(${PALETTE})-\\d{2,3}\\b`,
);
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_FN = /\b(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/;

/** Strip block + line comments so PR refs / prose don't false-positive. */
function stripComments(src: string): string {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "");
  // Strip `// …` only when not part of a URL scheme (`://`).
  return noBlock.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface Violation {
  file: string;
  line: number;
  rule: string;
  text: string;
}

function scanFile(abs: string, violations: Violation[]): void {
  const rel = path.relative(REPO_ROOT, abs);
  const stripped = stripComments(fs.readFileSync(abs, "utf8"));
  stripped.split("\n").forEach((raw, i) => {
    const line = i + 1;
    if (PALETTE_CLASS.test(raw)) {
      violations.push({ file: rel, line, rule: "tailwind-palette-class", text: raw.trim() });
    }
    // `themeColor` metadata must be a literal hex — allow it.
    if (RAW_HEX.test(raw) && !/themeColor/.test(raw)) {
      violations.push({ file: rel, line, rule: "raw-hex", text: raw.trim() });
    }
    if (RAW_FN.test(raw)) {
      violations.push({ file: rel, line, rule: "raw-color-fn", text: raw.trim() });
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

if (violations.length > 0) {
  console.error(`\n✗ token gate: ${violations.length} violation(s) — use semantic token utilities, not raw colours:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.text.slice(0, 100)}`);
  }
  console.error("");
  process.exit(1);
}
console.log("✓ token gate: no raw colours or palette classes in components/app.");
