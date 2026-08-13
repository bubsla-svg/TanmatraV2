import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

// Stitch marker-presence gate.
//
// WHY THIS EXISTS
// ---------------
// The Stitch-74 programme's runtime contract is three DOM data attributes
// (data-ui-generation="stitch-74", data-screen-id=<manifest promptId>,
// data-screen-state=<manifest state>) emitted in production. The e2e suite
// (e2e/specs/stitch-runtime/*) keys on them — but no CI workflow runs that
// suite, so until this gate the markers had ZERO enforcement. The failure
// mode is real and has already happened: the Astryx PDP rebuild (dc80404)
// replaced the page root and silently dropped screen 5.5's markers; only a
// manually-run e2e spec caught it, one commit later (41bbd9b). A template
// adoption eats the wrapper element, the build stays green, and the screen's
// identity contract is gone. This gate makes that class of break fail the
// build statically, in seconds, with no server.
//
// WHAT IT CHECKS — and deliberately does not
// ------------------------------------------
// For every manifest entry whose proof claims the screen is implemented
// (renderChain === "verified" OR sourceDefinition === "verified" — the OR is
// load-bearing: verify-stitch-wiring's defect backstop keys on
// sourceDefinition, so gating renderChain alone could be silenced by a
// one-word manifest edit with no defect filed), the promptId's marker must
// appear in the CONCATENATED source of the entry's claimed artifacts
// (routeEntryPoint, implementationComponent, controllerComponent).
//
//  - Concatenated, not per-file: screens 12.6/12.7 put the literal id in the
//    page (`<RdPartnersLanding screenId="12.6" />`) and the attribute in the
//    shared component. Either file alone would false-positive.
//  - data-screen-id only. data-screen-state is NOT gated: state strings
//    already drift (14.2 emits "no-match", manifest says "no-matching-meals")
//    and reconciling them is manifest work, not a build blocker.
//  - One-directional (manifest → source). A reverse sweep would fail on the
//    orphan id "MOB-10-Home-Dark" (Section01ClinicalHero.tsx), which predates
//    the manifest's naming scheme. Retiring it is tracked work, not a gate.
//  - Presence-in-source only. A marker on a never-rendered branch still
//    passes; runtime reachability stays an e2e concern (stitch-runtime specs).
//
// THE BASELINE
// ------------
// Same contract as scripts/placeholder-assets-baseline.txt: entries listed in
// scripts/stitch-marker-baseline.txt are known missing markers (each should
// carry a defect ID in the manifest); the register may only SHRINK, and a
// stale entry fails as loudly as a new violation.
//
// Usage:
//   node --experimental-strip-types scripts/lint-stitch-markers.ts
//   node --experimental-strip-types scripts/lint-stitch-markers.ts --write
//     --write rewrites the baseline from the current tree. Use it when you
//     RETIRE a debt entry, never to silence a freshly dropped marker.

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const WRITE = process.argv.includes("--write");
const MANIFEST_PATH = path.join(REPO_ROOT, "docs/stitch/stitch-screen-manifest.json");
const BASELINE_PATH = path.join(SCRIPT_DIR, "stitch-marker-baseline.txt");

interface ManifestEntry {
  promptId: string;
  routeEntryPoint: string | null;
  implementationComponent: string | null;
  controllerComponent: string | null;
  proof: { sourceDefinition?: string; renderChain?: string };
}

const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

/** promptIds whose markers are genuinely missing from source. */
function findMissing(): string[] {
  const missing: string[] = [];
  for (const entry of manifest) {
    const implemented =
      entry.proof.renderChain === "verified" || entry.proof.sourceDefinition === "verified";
    if (!implemented) continue;

    const artifacts = [
      entry.routeEntryPoint,
      entry.implementationComponent,
      entry.controllerComponent,
    ].filter((p): p is string => p !== null);

    let union = "";
    for (const rel of artifacts) {
      const abs = path.join(REPO_ROOT, rel);
      // Missing-on-disk is verify-stitch-wiring's failure to report, not ours.
      if (fs.existsSync(abs)) union += fs.readFileSync(abs, "utf8");
    }

    const literal = union.includes(`data-screen-id="${entry.promptId}"`);
    // Computed sites (ternaries, props): the attribute is an expression and
    // the id a string literal somewhere in the same artifact union.
    const computed = union.includes("data-screen-id={") && union.includes(`"${entry.promptId}"`);
    if (!literal && !computed) missing.push(entry.promptId);
  }
  return missing.sort();
}

const HEADER = `# Stitch marker debt register — implemented screens whose data-screen-id
# marker is absent from their claimed source artifacts.
#
# Not an approval list. Each entry should have a matching defect ID in
# docs/stitch/stitch-screen-manifest.json. See scripts/lint-stitch-markers.ts.
#
# The list may only SHRINK: restore the marker, then delete the line. A line
# whose marker reappears fails the gate as a stale entry, so the register
# cannot drift out of date in either direction. One promptId per line.
`;

const missing = findMissing();

if (WRITE) {
  fs.writeFileSync(BASELINE_PATH, HEADER + missing.map((id) => `${id}\n`).join(""));
  console.log(
    `✓ wrote ${path.relative(REPO_ROOT, BASELINE_PATH)}: ${missing.length} entr${missing.length === 1 ? "y" : "ies"}.`,
  );
  process.exit(0);
}

const baseline = new Set(
  fs.existsSync(BASELINE_PATH)
    ? fs
        .readFileSync(BASELINE_PATH, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
    : [],
);

const problems: string[] = [];
for (const id of missing) {
  if (!baseline.has(id)) {
    problems.push(
      `  screen ${id}: data-screen-id="${id}" is in none of the manifest's claimed source artifacts.\n` +
        `      A template/refactor likely replaced the marked element. Restore the marker on the\n` +
        `      screen's root (see e2e/specs/stitch-runtime/support.ts for the contract).`,
    );
  }
}
for (const id of [...baseline].sort()) {
  if (!missing.includes(id)) {
    problems.push(
      `  screen ${id}: STALE BASELINE — the marker exists now (or the entry left the verified set).\n` +
        `      Delete this line from ${path.basename(BASELINE_PATH)}.`,
    );
  }
}

if (problems.length > 0) {
  console.error(`\n✗ stitch-marker gate: ${problems.length} problem(s):\n`);
  console.error(problems.join("\n"));
  console.error(
    `\n  Manifest: ${path.relative(REPO_ROOT, MANIFEST_PATH)}` +
      `\n  Baseline: ${path.relative(REPO_ROOT, BASELINE_PATH)}\n`,
  );
  process.exit(1);
}

const checked = manifest.filter(
  (e) => e.proof.renderChain === "verified" || e.proof.sourceDefinition === "verified",
).length;
console.log(
  `✓ stitch-marker gate: ${checked} implemented screens carry their data-screen-id` +
    (baseline.size > 0 ? ` (${baseline.size} baselined debt entr${baseline.size === 1 ? "y" : "ies"}).` : "."),
);
