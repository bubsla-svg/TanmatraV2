import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Placeholder-photography gate.
//
// WHY THIS EXISTS
// ---------------
// Placeholder image URLs enter a codebase during design exploration and stay,
// because nothing ever objects to them. This one shipped a landing page for a
// clinical meal business — "ISO 22000 Certified · FSSAI Verified · Dietitian
// Supervised" — illustrated with random images from picsum.photos, including a
// section titled "Proof Kitchen" showing a stranger's kitchen. For a food
// business the photography IS the pre-purchase evidence, so the gap between
// the claim and the stock image is exactly what a sceptical first-time visitor
// is looking for.
//
// Banned hosts, and why each:
//   picsum.photos            random-image API; the picture is not of anything
//   images.unsplash.com      someone else's photo of someone else's food
//   lh3.googleusercontent.com a design tool's CDN (Stitch/aida-public), which
//                            is not an asset host we control — self-host it
//
// THE BASELINE
// ------------
// This gate landed while the real photography was still blocked on a shoot
// budget, so it ships with a debt register instead of waiting: the occurrences
// that existed on the day it landed are listed in
// `scripts/placeholder-assets-baseline.txt` and do not fail the build. Anything
// NEW does, immediately. Same contract as scripts/test-reach-baseline.txt: the
// register may only SHRINK, and a stale entry fails just as loudly as a new
// violation — otherwise "we fixed nine of eleven" silently reads as done.
//
// Usage:
//   node --experimental-strip-types scripts/lint-placeholder-assets.ts [targetDir]
//   node --experimental-strip-types scripts/lint-placeholder-assets.ts [targetDir] --write
//     --write rewrites the baseline from the current tree. Use it when you
//     RETIRE placeholders, never to silence a new one.

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const ARGS = process.argv.slice(2).filter((a) => a !== "--write");
const WRITE = process.argv.includes("--write");
const TARGET = path.resolve(REPO_ROOT, ARGS[0] ?? "artifacts/storefront");
const BASELINE_PATH = path.join(SCRIPT_DIR, "placeholder-assets-baseline.txt");
const SCAN_SUBDIRS = ["components", "app"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "quarantine"]);

const BANNED_HOSTS = ["picsum.photos", "images.unsplash.com", "lh3.googleusercontent.com"];

/** Counted from the raw source, NOT comment-stripped: a placeholder URL parked
 *  in a commented-out block is still a placeholder waiting to be uncommented. */
function countIn(src: string): number {
  let total = 0;
  for (const host of BANNED_HOSTS) {
    total += src.split(host).length - 1;
  }
  return total;
}

function walk(dir: string, found: Map<string, number>): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(abs, found);
    } else if (/\.(tsx?|css)$/.test(entry.name)) {
      const n = countIn(fs.readFileSync(abs, "utf8"));
      if (n > 0) found.set(path.relative(REPO_ROOT, abs).split(path.sep).join("/"), n);
    }
  }
}

function readBaseline(): Map<string, number> {
  const baseline = new Map<string, number>();
  if (!fs.existsSync(BASELINE_PATH)) return baseline;
  for (const raw of fs.readFileSync(BASELINE_PATH, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(.+?)\s+(\d+)$/.exec(line);
    if (!match) {
      console.error(`✗ placeholder gate: unparseable baseline line: ${line}`);
      process.exit(1);
    }
    baseline.set(match[1]!, Number(match[2]));
  }
  return baseline;
}

const HEADER = `# Placeholder-photography baseline — occurrences present when the gate landed.
#
# Not an approval list. A debt register. See scripts/lint-placeholder-assets.ts.
# Every line is real photography that has not been shot yet (C-2 in the
# storefront audit: hero dish, three protocol dishes, one kitchen frame, one
# delivery frame retires most of this).
#
# The list may only SHRINK: replace a placeholder with a real asset, then lower
# the count here — or delete the line when the file reaches zero. A count that
# no longer matches the tree fails the gate in BOTH directions, so the register
# cannot drift out of date in either the forgiving or the strict direction.
#
# Sorted, "<repo-relative path> <count>" per line, so additive edits in
# different alphabetical positions merge without conflict.
`;

const found = new Map<string, number>();
for (const sub of SCAN_SUBDIRS) walk(path.join(TARGET, sub), found);

if (WRITE) {
  const body = [...found.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([f, n]) => `${f} ${n}`);
  fs.writeFileSync(BASELINE_PATH, HEADER + body.join("\n") + "\n");
  const total = [...found.values()].reduce((a, b) => a + b, 0);
  console.log(`✓ wrote ${path.relative(REPO_ROOT, BASELINE_PATH)}: ${body.length} file(s), ${total} occurrence(s).`);
  process.exit(0);
}

const baseline = readBaseline();
const problems: string[] = [];

for (const [file, count] of [...found.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const allowed = baseline.get(file);
  if (allowed === undefined) {
    problems.push(
      `  ${file}\n      NEW: ${count} placeholder URL(s) in a file the baseline does not list.\n` +
        `      Use a real asset, or an honest treatment built from the design system.`,
    );
  } else if (count > allowed) {
    problems.push(
      `  ${file}\n      GREW: ${count} placeholder URL(s), baseline allows ${allowed}.\n` +
        `      The register may only shrink.`,
    );
  } else if (count < allowed) {
    problems.push(
      `  ${file}\n      STALE BASELINE: ${count} placeholder URL(s) remain, baseline still claims ${allowed}.\n` +
        `      Debt was paid — lower the number in ${path.basename(BASELINE_PATH)} to ${count}.`,
    );
  }
}

for (const file of [...baseline.keys()].sort()) {
  if (!found.has(file)) {
    problems.push(
      `  ${file}\n      STALE BASELINE: no placeholder URLs left (or the file is gone).\n` +
        `      Delete this line from ${path.basename(BASELINE_PATH)}.`,
    );
  }
}

if (problems.length > 0) {
  console.error(`\n✗ placeholder gate: ${problems.length} problem(s):\n`);
  console.error(problems.join("\n"));
  console.error(
    `\n  Baseline: ${path.relative(REPO_ROOT, BASELINE_PATH)}` +
      `\n  Regenerate after retiring placeholders:` +
      `\n    node --experimental-strip-types scripts/lint-placeholder-assets.ts ${ARGS[0] ?? "artifacts/storefront"} --write\n`,
  );
  process.exit(1);
}

const remaining = [...found.values()].reduce((a, b) => a + b, 0);
console.log(
  remaining > 0
    ? `✓ placeholder gate: no new placeholder photography (${remaining} baselined occurrence(s) still owed real assets).`
    : "✓ placeholder gate: no placeholder photography anywhere.",
);
