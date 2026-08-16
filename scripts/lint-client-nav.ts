import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Client-navigation gate.
//
// WHY THIS EXISTS
// ---------------
// `<a href="/menu">` inside an App Router app is not a slower `<Link>`. It is a
// full document load: the router unmounts, every provider re-runs, the React
// Query cache is thrown away, scroll position is lost, and nothing is
// prefetched because there is no Link for Next to prefetch. It renders and
// behaves *almost* correctly, which is why ten of them accumulated here across
// the landing page, the cart drawer's checkout button, and the marketplace and
// recipe grids — where every card in the loop was one.
//
// Nothing in a diff distinguishes the two. `<a href="/x">` is correct HTML, it
// is correct in a plain React app, and it is correct here for EXTERNAL links.
// Only the leading `/` makes it wrong, and only in this framework.
//
// WHAT IT CHECKS
// --------------
// A JSX `<a>` whose href is an app-internal path — starts with `/`, or a
// template literal that does. External URLs, `mailto:`, `tel:`, and `#anchor`
// are all untouched: those are exactly what a raw anchor is for.
//
// ESCAPE HATCH
// ------------
// A line carrying `client-nav-allow: <reason>` is exempt. There is one real
// case and it is worth naming: an error boundary. `SegmentError.tsx` renders
// because something in the tree threw, so a client navigation would carry that
// broken tree along, back into a router that may be what broke. A full document
// load is the honest recovery there.
//
// Usage:
//   node --experimental-strip-types scripts/lint-client-nav.ts [targetDir]

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const TARGET = path.resolve(REPO_ROOT, process.argv[2] ?? "artifacts/storefront");
const SCAN_SUBDIRS = ["app", "components"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "quarantine", "e2e"]);
const ALLOW_MARKER = /client-nav-allow:/;

/** Every `<a …>` opening tag, across however many lines it spans. */
const ANCHOR = /<a\b[^>]*?>/gs;
/** An href pointing inside this app: `/menu`, `` `/dish/${slug}` ``, `{"/x"}`. */
const INTERNAL_HREF = /href=\{?["'`]\/(?!\/)/;

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(abs, out);
    } else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) {
      out.push(abs);
    }
  }
}

const files: string[] = [];
for (const sub of SCAN_SUBDIRS) walk(path.join(TARGET, sub), files);

interface Violation {
  file: string;
  line: number;
  href: string;
}

const violations: Violation[] = [];

for (const file of files) {
  const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");

  for (const m of src.matchAll(ANCHOR)) {
    const tag = m[0];
    if (!INTERNAL_HREF.test(tag)) continue;
    const start = src.slice(0, m.index ?? 0).split("\n").length;
    const end = start + tag.split("\n").length - 1;
    // The marker may sit on any line of a multi-line opening tag — the href is
    // usually on its own line, and that is where the reason belongs.
    const exempt = lines.slice(start - 1, end).some((l) => ALLOW_MARKER.test(l));
    if (exempt) continue;
    const href = /href=\{?["'`]([^"'`]*)/.exec(tag)?.[1] ?? "?";
    violations.push({ file: rel, line: start, href });
  }
}

if (violations.length > 0) {
  console.error(
    `\n✗ Client-nav gate: ${violations.length} internal link(s) bypassing the router.\n`,
  );
  console.error(
    "  A raw <a> to an app route is a FULL DOCUMENT LOAD — the router unmounts,\n" +
      "  providers re-run, the query cache is discarded, scroll position is lost,\n" +
      "  and nothing prefetches. It looks correct in a diff because it is correct\n" +
      "  HTML; only the leading `/` makes it wrong, and only in this framework.\n",
  );
  for (const v of violations) console.error(`      ${v.file}:${v.line}  → ${v.href}`);
  console.error(
    '\n  Use <Link href="…"> from next/link. If a full reload is genuinely the\n' +
      "  point (an error boundary rebuilding a broken tree), add\n" +
      "  `client-nav-allow: <reason>` to the line.\n",
  );
  process.exit(1);
}

console.log(
  `✓ Client-nav gate: every internal link goes through the router (${files.length} files scanned).`,
);
