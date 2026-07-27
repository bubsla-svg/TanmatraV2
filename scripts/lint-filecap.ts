import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Anti-rot gate for the rebuild storefront (Phase 1). Enforces the size and
// server-first rules as CI checks, not aspirations:
//   • no file over 300 lines (non-component)
//   • no component (.tsx) over 400 lines — raised from 150 for DS-0 (owner
//     decision, 2026-07-27): Astryx page templates run ~300 lines and are
//     sanctioned for verbatim adoption; 400 leaves headroom for real data
//     wiring. Decomposition is still good practice, no longer a gate.
//   • ("use client" justification requirement REVOKED same decision —
//     injected Astryx templates carry a bare directive.)
//   • no "@/" path-alias imports inside lib/ (see ALIAS_NOTE below)
//
// Usage: node --experimental-strip-types scripts/lint-filecap.ts [targetDir]
//   (targetDir defaults to artifacts/storefront; path is relative to repo root)

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const TARGET = path.resolve(REPO_ROOT, process.argv[2] ?? "artifacts/storefront");

const FILE_CAP = 300;
const COMPONENT_CAP = 400;
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo"]);

// ALIAS_NOTE — why lib/ may not use the "@/*" alias.
//
// CI executes the storefront's lib tests with the plain node test runner:
//   working-directory: artifacts/api-server
//   node --test --import tsx ../storefront/lib/*.test.ts
// That runner resolves imports off the filesystem; it does NOT apply the
// "@/*" -> "./*" tsconfig path mapping the way `next build` and `tsc` do.
// So an aliased import inside lib/ typechecks, builds, and then dies at test
// time with ERR_MODULE_NOT_FOUND "Cannot find package '@/lib'" — which is how
// four lib modules silently broke main across five consecutive merges.
//
// Scope is deliberately lib/-only: app/ and components/ are compiled by Next
// (never executed by this runner), where the alias resolves correctly and is
// used in ~150 files.
const ALIAS_DIR = "lib";
const ALIAS_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']@\//;

function walk(dir: string, includeTests = false): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(path.join(dir, entry.name), includeTests));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      (includeTests || !/\.(test|spec)\.(ts|tsx)$/.test(entry.name))
    ) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

/** Line is a comment, so an "@/" inside it is prose (or a counter-example),
 *  not a real import the runner would try to resolve. */
function isComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

function run(): void {
  if (!fs.existsSync(TARGET)) {
    console.error(`file-cap lint: target not found at ${TARGET}`);
    process.exit(1);
  }
  const violations: string[] = [];

  for (const file of walk(TARGET)) {
    const rel = path.relative(REPO_ROOT, file);
    const lines = fs.readFileSync(file, "utf8").split("\n");
    const count = lines.length;
    const isComponent = file.endsWith(".tsx");
    const cap = isComponent ? COMPONENT_CAP : FILE_CAP;
    if (count > cap) {
      violations.push(
        `${rel}: ${count} lines exceeds the ${isComponent ? "component" : "file"} cap of ${cap} — split it.`,
      );
    }
  }

  // Path-alias guard for the runner-executed lib/ tree. Tests are included
  // here (unlike the size walk) because the runner executes them directly, so
  // an aliased import in a *.test.ts fails exactly the same way. See ALIAS_NOTE.
  const aliasDir = path.join(TARGET, ALIAS_DIR);
  let aliasScanned = 0;
  if (fs.existsSync(aliasDir)) {
    for (const file of walk(aliasDir, true)) {
      aliasScanned++;
      const rel = path.relative(REPO_ROOT, file);
      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (!isComment(line) && ALIAS_IMPORT.test(line)) {
            violations.push(
              `${rel}:${i + 1}: "@/" path alias in ${ALIAS_DIR}/ — the test runner cannot resolve it ` +
                `(ERR_MODULE_NOT_FOUND at test time, despite a clean typecheck/build). Use a relative import.`,
            );
          }
        });
    }
  }

  if (violations.length > 0) {
    console.error(`\n❌ file-cap lint: ${violations.length} violation(s):`);
    for (const v of violations) console.error(`  • ${v}`);
    process.exit(1);
  }
  console.log(
    `✅ file-cap lint pass (${walk(TARGET).length} files, ≤${FILE_CAP} lines, components ≤${COMPONENT_CAP}; ` +
      `${aliasScanned} ${ALIAS_DIR}/ files free of "@/" imports).`,
  );
}

run();
