import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Unloaded-icon-font gate.
//
// WHY THIS EXISTS
// ---------------
// Ligature icon fonts fail in a uniquely quiet way. `<span
// class="material-symbols-outlined">auto_awesome</span>` renders the icon ONLY
// if that font is actually loaded. If it is not, the span still renders — as
// the ligature's own name, in the page's body font. The user sees the literal
// word `auto_awesome`.
//
// That exact string shipped on `/`, the entry route, in the "Smart Match"
// card, plus five more in the meal-feedback dialog (`close`, `check`,
// `favorite`, `thumb_up`, `thumb_down`). The font was never loaded anywhere:
// globals.css imports Satoshi, layout.tsx loads JetBrains Mono via next/font,
// and nothing anywhere declares Material Symbols. Every existing gate passed —
// there is no raw hex, no unregistered Tailwind colour, no placeholder URL,
// nothing a type-checker can see. The class is simply inert and the text falls
// through, which is why this needs a gate of its own rather than a code review.
//
// WHAT IT CHECKS
// --------------
// For each known ligature icon-font family: if its class appears in a `class`
// or `className` ATTRIBUTE anywhere in the scanned tree, some CSS in the tree
// must actually load that font (an `@font-face` or an `@import` naming it).
// Usage without a load fails.
//
// Matching is scoped to attribute values, not to raw source, so prose that
// merely names the class — this comment, a changelog note, the doc-comment
// explaining why a component stopped using it — is not a violation. A
// commented-out `<span className="…">` still is: the attribute survives in the
// comment, and that is exactly the landmine waiting to be uncommented.
//
// This is deliberately conditional rather than an outright ban: a project that
// genuinely wants Material Symbols may have it, load it, and pass. What it
// forbids is the combination that renders words where icons should be.
//
// The storefront's sanctioned icon systems are `lucide-react` (the dominant
// idiom) and `@heroicons/react` — both ship SVG components, which cannot fail
// this way because there is no font to miss.
//
// Usage:
//   node --experimental-strip-types scripts/lint-icon-font.ts [targetDir]

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const TARGET = path.resolve(REPO_ROOT, process.argv[2] ?? "artifacts/storefront");
const SCAN_SUBDIRS = ["components", "app", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "quarantine"]);

interface IconFont {
  /** Human name, used in the failure message. */
  label: string;
  /** Class name that activates the font, tested against class-attribute values. */
  usage: RegExp;
  /** Evidence in CSS that the font is actually loaded. */
  loaded: RegExp;
}

/**
 * Every `class`/`className` attribute value on a line.
 *
 * Covers the three shapes this codebase writes: `className="…"`,
 * `className={'…'}` and `className={`…`}` (the static text of a template
 * literal; interpolated segments are not knowable here and are not needed —
 * an icon-font class is always written literally).
 */
const CLASS_ATTR = /\bclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*[`'"]([^`'"]*)[`'"])/g;

function classAttrValues(line: string): string[] {
  const values: string[] = [];
  for (const m of line.matchAll(CLASS_ATTR)) {
    const value = m[1] ?? m[2] ?? m[3];
    if (value) values.push(value);
  }
  return values;
}

const ICON_FONTS: IconFont[] = [
  {
    label: "Material Symbols",
    usage: /\bmaterial-symbols(-outlined|-rounded|-sharp)?\b/,
    loaded: /Material\+?\s?Symbols/i,
  },
  { label: "Material Icons", usage: /\bmaterial-icons\b/, loaded: /Material\+?\s?Icons/i },
  { label: "Font Awesome", usage: /\bfa-(solid|regular|brands|light)\b/, loaded: /font-?awesome/i },
  { label: "Bootstrap Icons", usage: /\bbi-[a-z0-9-]+\b/, loaded: /bootstrap-?icons/i },
];

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(abs, out);
    } else if (/\.(tsx?|css)$/.test(entry.name)) {
      out.push(abs);
    }
  }
}

const files: string[] = [];
for (const sub of SCAN_SUBDIRS) walk(path.join(TARGET, sub), files);

const sources = new Map<string, string>();
for (const file of files) sources.set(file, fs.readFileSync(file, "utf8"));

/** CSS anywhere in the scanned tree — where a font would be declared. */
const allCss = [...sources.entries()]
  .filter(([f]) => f.endsWith(".css"))
  .map(([, src]) => src)
  .join("\n");

const problems: string[] = [];

for (const font of ICON_FONTS) {
  const hits: string[] = [];
  for (const [file, src] of sources) {
    if (file.endsWith(".css")) continue; // a rule ABOUT the font is not a usage
    src.split("\n").forEach((line, i) => {
      if (classAttrValues(line).some((value) => font.usage.test(value))) {
        hits.push(`      ${path.relative(REPO_ROOT, file).split(path.sep).join("/")}:${i + 1}`);
      }
    });
  }
  if (hits.length === 0) continue;
  if (font.loaded.test(allCss)) continue; // used AND loaded — fine

  problems.push(
    `  ${font.label}: ${hits.length} usage(s), but no @font-face or @import loads it.\n` +
      `      Without the font these render the LIGATURE NAME as literal text.\n` +
      `      Use an SVG icon component (lucide-react / @heroicons/react), or load the font.\n` +
      hits.join("\n"),
  );
}

if (problems.length > 0) {
  console.error(`\n✗ icon-font gate: ${problems.length} unloaded icon font(s):\n`);
  console.error(problems.join("\n\n"));
  console.error("");
  process.exit(1);
}

console.log(
  `✓ icon-font gate: no ligature icon-font class renders without its font (${files.length} files scanned).`,
);
