import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Token-enforcement gate, post-DS-0. Astryx is the storefront's design system
// by owner decision (2026-07-27); its templates and non-semantic palette
// variants (Card variant="blue", Badge colours, …) are sanctioned as-is, so
// the former palette-class ban and the sage-never-interactive rule are
// REVOKED for the storefront. What remains forbidden in
// artifacts/storefront/{components,app} is the one thing Astryx never needs
// and rot always wants:
//   • raw colour values:  #rrggbb / #rgb / rgb() / rgba() / hsl() / oklch()
// Colours live in theme files (lib/themes/, lib/tokens) — components reference
// tokens or Astryx variants, never literals.
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
console.log("✓ token gate: no raw colour literals in components/app (Astryx variants + tokens only).");
