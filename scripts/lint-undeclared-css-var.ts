import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Undeclared-custom-property gate.
//
// WHY THIS EXISTS
// ---------------
// `padding: var(--spacing-gutter)` where `--spacing-gutter` was never declared
// is not an error anywhere. The declaration is invalid at computed-value time,
// the
// browser drops it, and the element renders exactly as it did before. No
// console warning, no build failure, no failing test — the styling simply does
// not happen, and the code reads as though it did.
//
// This repo has already paid for that once, and the account is written down in
// `artifacts/storefront/app/globals.css`: `px-gutter` was in use across five
// routes while NO `--spacing-gutter` was ever registered, so the class emitted
// no CSS at all and those five routes rendered hard against both screen edges.
// It was found by grepping the BUILT stylesheet. A typo in a token name is the
// same bug with a smaller blast radius, and it is invisible in review because
// the diff looks correct.
//
// HOW THE DECLARED SET IS BUILT
// -----------------------------
// From `app/layout.tsx`'s own CSS imports, IN ORDER — not from a hand-written
// list of stylesheets. A list would be one more thing that can drift; reading
// the imports means the gate always knows exactly which sheets ship. Anything
// imported from a package (Astryx's `astryx.css`, `@workspace/tokens`) is
// resolved and read too, so third-party tokens are not false positives.
//
// Custom properties set from JS (`style={{ "--x": … }}`) count as declared —
// they are genuinely defined at runtime, just not in a stylesheet.
//
// Usage:
//   node --experimental-strip-types scripts/lint-undeclared-css-var.ts [targetDir]

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const TARGET = path.resolve(REPO_ROOT, process.argv[2] ?? "artifacts/storefront");
const SCAN_SUBDIRS = ["app", "components", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo", "quarantine"]);

/**
 * Names the browser or the framework defines for us. `--tw-*` is Tailwind's
 * own internal register set (declared in its generated preflight, which is not
 * a file in this tree).
 */
const BUILTIN_PREFIXES = ["--tw-"];

function walk(dir: string, out: string[], exts: RegExp): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(abs, out, exts);
    } else if (exts.test(entry.name)) {
      out.push(abs);
    }
  }
}

/** Resolve one of layout.tsx's CSS import specifiers to a file on disk. */
function resolveCssImport(spec: string): string | null {
  if (spec.startsWith("./") || spec.startsWith("../")) {
    return path.resolve(TARGET, "app", spec);
  }
  if (spec.startsWith("@/")) {
    return path.resolve(TARGET, spec.slice(2));
  }
  // A workspace package resolves to the SOURCE in this checkout, not to
  // node_modules. pnpm symlinks them, so the two are normally the same file —
  // but in a git worktree with a shared node_modules the link points at the
  // other checkout, and the gate would lint this tree against another tree's
  // tokens. Reading the source means the gate always sees the tokens the diff
  // is actually adding.
  const workspace = /^@workspace\/([^/]+)\/(.+)$/.exec(spec);
  if (workspace) {
    const local = path.join(REPO_ROOT, "lib", workspace[1]!, "src", workspace[2]!);
    if (fs.existsSync(local)) return local;
  }
  // A package specifier. Try the workspace first (pnpm links these), then the
  // repo root's node_modules, then the target's own.
  const [scope, name, ...rest] = spec.split("/");
  const pkg = spec.startsWith("@") ? `${scope}/${name}` : scope!;
  const sub = spec.startsWith("@") ? rest.join("/") : [name, ...rest].join("/");
  for (const root of [TARGET, REPO_ROOT]) {
    const base = path.join(root, "node_modules", pkg);
    if (!fs.existsSync(base)) continue;
    // Honour an `exports` map when it names this subpath; fall back to the
    // literal path, which is what most token stylesheets use.
    const direct = path.join(base, sub);
    if (fs.existsSync(direct)) return direct;
    const pkgJson = path.join(base, "package.json");
    if (fs.existsSync(pkgJson)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(pkgJson, "utf8")) as {
          exports?: Record<string, unknown>;
        };
        // An exports entry is either a bare path or a condition map. Astryx
        // ships `{types, default}` for its stylesheets and points `default` at
        // `dist/`, which is NOT the literal subpath — reading only the string
        // form made the real sheet unresolvable and every Astryx token look
        // undeclared.
        const entry = manifest.exports?.[`./${sub}`];
        const file =
          typeof entry === "string"
            ? entry
            : typeof entry === "object" && entry !== null
              ? ["style", "default", "import", "require"]
                  .map((k) => (entry as Record<string, unknown>)[k])
                  .find((v): v is string => typeof v === "string") ?? null
              : null;
        if (file) return path.join(base, file);
      } catch {
        /* an unreadable manifest is not this gate's problem */
      }
    }
  }
  return null;
}

/** The stylesheets `app/layout.tsx` actually imports, in order. */
function shippedStylesheets(): { specs: string[]; files: string[]; missing: string[] } {
  const layout = path.join(TARGET, "app", "layout.tsx");
  const src = fs.existsSync(layout) ? fs.readFileSync(layout, "utf8") : "";
  const specs = [...src.matchAll(/^\s*import\s+["']([^"']+\.css)["']/gm)].map((m) => m[1]!);
  const files: string[] = [];
  const missing: string[] = [];
  for (const spec of specs) {
    const file = resolveCssImport(spec);
    if (file && fs.existsSync(file)) files.push(file);
    else missing.push(spec);
  }
  return { specs, files, missing };
}

const DECLARE_IN_CSS = /(^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g;
/** `style={{ "--x": … }}` and `element.style.setProperty("--x", …)`. */
const DECLARE_IN_JS = /["'](--[A-Za-z0-9_-]+)["']\s*[:,]/g;
const USE = /var\(\s*(--[A-Za-z0-9_-]+)/g;

/**
 * Blank comments before scanning. Prose ABOUT a property is not a use of it —
 * globals.css carries a comment saying "do not re-introduce var(--color-*)
 * reads here", and reading that as a use of a property named `--color-` is the
 * gate failing its own documentation. Newlines are preserved so reported line
 * numbers stay true.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_m, lead: string) => lead);
}

function collect(src: string, re: RegExp, group: number): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(re)) out.add(m[group]!);
  return out;
}

const { specs, files: sheets, missing } = shippedStylesheets();

const declared = new Set<string>();
for (const file of sheets) {
  for (const name of collect(fs.readFileSync(file, "utf8"), DECLARE_IN_CSS, 2)) declared.add(name);
}

const sources: string[] = [];
for (const sub of SCAN_SUBDIRS) walk(path.join(TARGET, sub), sources, /\.(tsx?|css)$/);
const scanned = sources.filter((f) => !/\.test\.tsx?$/.test(f));

// A second pass over the sources themselves: a component may declare a property
// it also reads (a CSS file under lib/themes, or an inline style object).
for (const file of scanned) {
  const src = fs.readFileSync(file, "utf8");
  for (const name of collect(src, DECLARE_IN_CSS, 2)) declared.add(name);
  for (const name of collect(src, DECLARE_IN_JS, 1)) declared.add(name);
}

interface Use {
  name: string;
  file: string;
  line: number;
}

const undeclared: Use[] = [];
for (const file of scanned) {
  const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
  stripComments(fs.readFileSync(file, "utf8"))
    .split("\n")
    .forEach((line, i) => {
      for (const m of line.matchAll(USE)) {
        const name = m[1]!;
        if (declared.has(name)) continue;
        if (BUILTIN_PREFIXES.some((p) => name.startsWith(p))) continue;
        // `var(--x, fallback)` still renders the fallback, so it is not a
        // silent no-op — the whole reason this gate exists does not apply.
        const after = line.slice((m.index ?? 0) + m[0].length);
        if (/^\s*,/.test(after)) continue;
        undeclared.push({ name, file: rel, line: i + 1 });
      }
    });
}

if (missing.length > 0) {
  console.error(
    `\n✗ CSS var gate: layout.tsx imports a stylesheet this gate could not resolve — ` +
      `every property it declares would read as undeclared:\n      ${missing.join("\n      ")}\n`,
  );
  process.exit(1);
}

if (undeclared.length > 0) {
  const byName = new Map<string, Use[]>();
  for (const u of undeclared) {
    const list = byName.get(u.name) ?? [];
    list.push(u);
    byName.set(u.name, list);
  }
  console.error(`\n✗ CSS var gate: ${undeclared.length} use(s) of a custom property nothing declares.\n`);
  console.error(
    "  An undeclared property is invalid at computed-value time: the browser\n" +
      "  drops the whole declaration and the styling silently does not happen.\n",
  );
  for (const [name, list] of byName) {
    console.error(`  ${name}`);
    for (const u of list) console.error(`      ${u.file}:${u.line}`);
  }
  console.error(
    "\n  Declare it in lib/tokens/src/tokens.css (and bridge it in globals.css if\n" +
      "  a Tailwind utility needs it), or give the use a fallback: var(--x, 1rem).\n",
  );
  process.exit(1);
}

console.log(
  `✓ CSS var gate: every custom property used is declared ` +
    `(${declared.size} declared across ${specs.length} shipped stylesheets, ${scanned.length} files scanned).`,
);
