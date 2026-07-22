import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Anti-rot gate for the rebuild storefront (Phase 1). Enforces the size and
// server-first rules as CI checks, not aspirations:
//   • no file over 300 lines
//   • no component (.tsx) over 150 lines
//   • every "use client" carries a one-line justification comment
//
// Usage: node --experimental-strip-types scripts/lint-filecap.ts [targetDir]
//   (targetDir defaults to artifacts/storefront; path is relative to repo root)

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const TARGET = path.resolve(REPO_ROOT, process.argv[2] ?? "artifacts/storefront");

const FILE_CAP = 300;
const COMPONENT_CAP = 150;
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(path.join(dir, entry.name)));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

/** A "use client" line is justified if it carries a trailing comment, or the
 *  next non-blank line is a comment. */
function useClientJustified(lines: string[], idx: number): boolean {
  const line = lines[idx];
  if (/\/\//.test(line.replace(/^['"]use client['"];?/, ""))) return true;
  for (let i = idx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "") continue;
    return t.startsWith("//") || t.startsWith("/*") || t.startsWith("*");
  }
  return false;
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
    lines.forEach((line, i) => {
      if (/^\s*['"]use client['"]\s*;?\s*(\/\/.*)?$/.test(line) && !useClientJustified(lines, i)) {
        violations.push(
          `${rel}:${i + 1}: "use client" must carry a one-line justification comment.`,
        );
      }
    });
  }

  if (violations.length > 0) {
    console.error(`\n❌ file-cap lint: ${violations.length} violation(s):`);
    for (const v of violations) console.error(`  • ${v}`);
    process.exit(1);
  }
  console.log(`✅ file-cap lint pass (${walk(TARGET).length} files, ≤${FILE_CAP} lines, components ≤${COMPONENT_CAP}).`);
}

run();
