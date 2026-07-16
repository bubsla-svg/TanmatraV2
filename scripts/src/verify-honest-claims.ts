/**
 * Honest-claims CI gate (audit T2.1 / §10 — "structurally impossible to repeat").
 *
 * Fails the build if a per-dish "RD Verified"-style trust badge is rendered
 * gated on the blanket `rdVerified` field. No dish carries a reviewer-id/date
 * record, so such a badge is an unbacked clinical claim — the non-negotiable
 * (honest rendering of health data) forbids it. `rdVerified` may still be used
 * for data/sort/filter logic; only the rendered CLAIM is banned.
 *
 * Detects:
 *   1. `rdVerified && (`  or  `rdVerified && <`   — a badge render gated on the
 *      blanket field (filters like `rdVerified && d.foo` are NOT matched).
 *   2. the literal rendered string "RD Advisory Board Verified".
 * Comment lines are ignored so the intentional NOTE in MacroOverlay is allowed.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, "..", "..", "artifacts", "tanmatra", "src");
const REPO = join(here, "..", "..");

const RENDER_GATE = /rdVerified\s*&&\s*[(<]/;
const CLAIM_STRING = /RD Advisory Board Verified/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (full.endsWith(".tsx") && !full.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

const isComment = (line: string) => {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
};

const violations: string[] = [];
for (const file of walk(SRC)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (isComment(line)) return;
    if (RENDER_GATE.test(line) || CLAIM_STRING.test(line)) {
      violations.push(`${relative(REPO, file)}:${i + 1}  ${line.trim().slice(0, 100)}`);
    }
  });
}

console.log("=== Honest-claims gate: no unbacked per-dish 'RD Verified' badge (T2.1) ===");
if (violations.length > 0) {
  console.error(
    `\n✖ ${violations.length} unbacked RD-verification badge render(s) found. ` +
      `No dish has a reviewer record — remove the visible claim (keep rdVerified for data/logic only):\n`,
  );
  for (const v of violations) console.error("  " + v);
  console.error(
    "\nIf a real per-dish review record (reviewer id + date) is added, gate the badge on THAT, not on rdVerified.",
  );
  process.exit(1);
}
console.log("✔ No unbacked per-dish RD-verification badge is rendered.");
