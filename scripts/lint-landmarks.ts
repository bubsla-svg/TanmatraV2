import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Landmark-enforcement gate.
//
// WHY THIS EXISTS
// ---------------
// A blind `<div>` → `<main>` find/replace once put THIRTEEN <main> elements
// into app/(global)/page.tsx alone — card rails, decorative blur divs, even a
// one-word eyebrow label ("SUBSCRIPTION") all became main landmarks — on a
// route whose layout already opens the real one. It was invisible in review
// because it renders identically: <main> and <div> are both display:block, so
// nothing moved by a pixel. Only a screen reader could tell, and it announced
// twenty main regions on the entry route while the skip link landed on the
// wrong one. The replace even rewrote the comment that warned against it, so
// the file ended up reading "A <main>, not a <main>".
//
// Nothing in the toolchain objected: it is valid TSX, valid React, and passes
// typecheck, the token gate and the file-cap gate. That is precisely the shape
// of rot a static gate is for.
//
// THE RULE, in two parts:
//   1. At most ONE <main> per file. More than one is never right — a document
//      has a single main region.
//   2. <main> may only appear in a file that OWNS a rendering root:
//        • any app/**/layout.tsx           — one per route group, correct
//        • app/error.tsx                   — root recovery boundary: it mounts
//          app/not-found.tsx                 inside the ROOT layout, which
//          app/global-error.tsx              renders no <main> of its own, so
//                                            these must bring one or the
//                                            root layout's unconditional
//                                            skip link (href="#main") is a
//                                            dead anchor.
//        • app/offline/page.tsx            — the sw.js OFFLINE_URL fallback.
//                                            Same reasoning as the three
//                                            above (it sits outside every
//                                            route group, so nothing above it
//                                            renders <main>), but it can't
//                                            satisfy the flat app/<file>.tsx
//                                            shape those get matched by:
//                                            Next.js requires a NAMED route's
//                                            file to be <segment>/page.tsx,
//                                            never app/<segment>.tsx. Listed
//                                            explicitly (ROOT_OWN_PAGES)
//                                            rather than widening the rule to
//                                            "any ungrouped page.tsx", so a
//                                            careless page landing outside
//                                            every group by accident still
//                                            has to earn its way onto this
//                                            list instead of silently passing.
//      Everything else — pages, components, and the GROUP-level error.tsx
//      boundaries (which mount inside their own layout's <main id="main">) —
//      inherits a landmark from above and must not open a second.
//
// Usage: node --experimental-strip-types scripts/lint-landmarks.ts [targetDir]
//   (targetDir defaults to artifacts/storefront; path is relative to repo root)

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const TARGET = path.resolve(REPO_ROOT, process.argv[2] ?? "artifacts/storefront");
const SCAN_SUBDIRS = ["components", "app"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "quarantine"]);

/** Next.js special files that render OUTSIDE any route-group layout's <main>,
 *  and so are the one place besides a layout that must open its own. Matched
 *  only at the immediate root of app/ — a group-level error.tsx does mount
 *  inside its layout and is therefore NOT exempt. */
const ROOT_OWN_LANDMARK = new Set(["error.tsx", "not-found.tsx", "global-error.tsx"]);

/** Named routes (page.tsx, necessarily >2 segments — Next.js has no flat
 *  app/<name>.tsx form for these) that ALSO sit outside every route group,
 *  by exact relative path. Kept as an explicit allow-list, not a rule, so a
 *  page landing outside every group by accident still fails this gate. */
const ROOT_OWN_PAGES = new Set(["app/offline/page.tsx"]);

/** `<main` followed by a tag boundary — space, newline, `>` or `/`. Keeps
 *  `<mainNavigation>` and the like from matching. */
const MAIN_TAG = /<main(?=[\s/>])/g;

/** Strip block + line comments so prose ABOUT the rule (this repo comments its
 *  landmark decisions heavily, and those comments quote `<main id="main">`)
 *  does not count as markup. */
function stripComments(src: string): string {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface Violation {
  file: string;
  rule: string;
  detail: string;
}

/** True when this file is allowed to render exactly one <main>. */
function mayOwnLandmark(relFromTarget: string): boolean {
  const segments = relFromTarget.split(path.sep);
  if (segments[0] !== "app") return false;
  const basename = segments[segments.length - 1]!;
  if (basename === "layout.tsx") return true;
  // Root-level special file: app/<name>.tsx, i.e. exactly two segments.
  if (segments.length === 2 && ROOT_OWN_LANDMARK.has(basename)) return true;
  return ROOT_OWN_PAGES.has(segments.join("/"));
}

function scanFile(abs: string, violations: Violation[]): void {
  const relFromRoot = path.relative(REPO_ROOT, abs);
  const relFromTarget = path.relative(TARGET, abs);
  const count = (stripComments(fs.readFileSync(abs, "utf8")).match(MAIN_TAG) ?? []).length;
  if (count === 0) return;

  if (count > 1) {
    violations.push({
      file: relFromRoot,
      rule: "multiple-main",
      detail: `${count} <main> elements in one file — a document has exactly one main region`,
    });
    return;
  }
  if (!mayOwnLandmark(relFromTarget)) {
    violations.push({
      file: relFromRoot,
      rule: "main-outside-layout",
      detail: "the surrounding layout already opens <main id=\"main\"> — use <div>, or a list element for a card rail",
    });
  }
}

function walk(dir: string, violations: Violation[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), violations);
    } else if (/\.tsx$/.test(entry.name)) {
      scanFile(path.join(dir, entry.name), violations);
    }
  }
}

const violations: Violation[] = [];
for (const sub of SCAN_SUBDIRS) walk(path.join(TARGET, sub), violations);

if (violations.length > 0) {
  console.error(`\n✗ landmark gate: ${violations.length} violation(s) — one <main> per rendered document:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}  [${v.rule}]`);
    console.error(`      ${v.detail}`);
  }
  console.error("");
  process.exit(1);
}
console.log("✓ landmark gate: <main> only in route-group layouts and the root error/not-found boundaries.");
