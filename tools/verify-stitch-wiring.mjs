// Static wiring validation: checks the manifest's filesystem claims against
// the repository. Deliberately does NOT infer runtime reachability from file
// existence — that is test:stitch-runtime's job. Honest `missing`, `partial`,
// and `blocked` entries are not failures; contradictions are.
// Prints the §15-style wiring completion report, exits 1 on contradictions.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entries = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/stitch/stitch-screen-manifest.json"), "utf8"));

const errors = [];
const warnings = [];
const err = (id, m) => errors.push(`${id}: ${m}`);
const warn = (id, m) => warnings.push(`${id}: ${m}`);
const onDisk = (p) => p && fs.existsSync(path.join(ROOT, p));

// canonicalRoute -> expected app-router path fragment ("/plan/[planId]" -> "plan/[planId]/page.tsx")
function routeMatches(canonicalRoute, routeEntryPoint) {
  if (canonicalRoute === "global") return true; // app-level surface, owned by a layout
  if (!routeEntryPoint) return false;
  if (routeEntryPoint.endsWith("/layout.tsx")) return true; // drawer/empty-state hosts
  const frag = canonicalRoute === "/" ? "app/(global)/page.tsx" : `${canonicalRoute.slice(1)}/page.tsx`;
  return routeEntryPoint.replace(/app\/\((global|focus|b2b)\)\//, "app/").endsWith(canonicalRoute === "/" ? "app/page.tsx" : `app/${frag}`);
}

let n = { source: 0, render: 0, trigger: 0, transition: 0, local: 0, container: 0, staging: 0, production: 0, visual: 0, a11y: 0 };
const defects = { missingSource: [], unwiredSource: [], missingTrigger: [], partialStub: [], rebuildRequired: [], refMissing: [] };

for (const e of entries) {
  const id = e.promptId;
  const p = e.proof;

  // Claims of existence must be true on disk.
  if (e.implementationComponent && !onDisk(e.implementationComponent)) err(id, `implementationComponent not on disk: ${e.implementationComponent}`);
  if (e.routeEntryPoint && !onDisk(e.routeEntryPoint)) err(id, `routeEntryPoint not on disk: ${e.routeEntryPoint}`);
  if (e.controllerComponent && !onDisk(e.controllerComponent)) err(id, `controllerComponent not on disk: ${e.controllerComponent}`);

  // proof.sourceDefinition=verified must be backed by at least one artifact on disk.
  if (p.sourceDefinition === "verified" && !(e.implementationComponent || e.routeEntryPoint))
    err(id, "sourceDefinition=verified with no implementation or route entry claimed");

  // renderChain=verified must sit on a route entry that matches the canonical route.
  if (p.renderChain === "verified") {
    if (!onDisk(e.routeEntryPoint)) err(id, "renderChain=verified but routeEntryPoint missing on disk");
    else if (!routeMatches(e.canonicalRoute, e.routeEntryPoint))
      err(id, `renderChain=verified but routeEntryPoint ${e.routeEntryPoint} does not serve ${e.canonicalRoute}`);
  }

  // A runtime claim needs its test file to exist.
  if ((p.localRuntime === "verified" || p.containerRuntime === "verified") && !onDisk(e.testFile))
    err(id, `runtime verified but testFile not on disk: ${e.testFile}`);

  // Reference artifacts: warn (design sources are not committed at v1 paths).
  if (!onDisk(e.referenceArtifact)) { warn(id, `referenceArtifact not on disk: ${e.referenceArtifact}`); defects.refMissing.push(id); }

  // Tallies + defect classes
  if (p.sourceDefinition === "verified") n.source++;
  if (p.renderChain === "verified") n.render++;
  if (p.triggerDefinition === "verified") n.trigger++;
  if (["verified", "not-applicable"].includes(p.transitionDefinition)) n.transition++;
  if (p.localRuntime === "verified") n.local++;
  if (p.containerRuntime === "verified") n.container++;
  if (p.stagingRuntime === "verified") n.staging++;
  if (p.productionRuntime === "verified") n.production++;
  if (p.visualApproval === "verified") n.visual++;
  if (p.accessibilityApproval === "verified") n.a11y++;

  if (p.sourceDefinition === "missing" && e.designDisposition === "original") defects.missingSource.push(id);
  if (p.sourceDefinition === "verified" && p.renderChain === "missing") defects.unwiredSource.push(id);
  if (p.renderChain !== "missing" && p.triggerDefinition === "missing") defects.missingTrigger.push(id);
  if (p.sourceDefinition === "partial") defects.partialStub.push(id);
  if (e.designDisposition === "rebuild-required") defects.rebuildRequired.push(id);

  // An entry carrying non-verified source/render must carry defectIds or a replacementDecision.
  if (["missing", "partial", "broken"].includes(p.sourceDefinition) && e.defectIds.length === 0 && e.designDisposition === "original")
    err(id, `sourceDefinition=${p.sourceDefinition} with no defectIds`);
}

const T = entries.length;
console.log(`
STITCH ROUTE AND STATE WIRING
Manifest entries:                  ${T}/74
Source definitions:                ${n.source}/${T}
Render chains:                     ${n.render}/${T}
Triggers:                          ${n.trigger}/${T}
Transitions (incl. n/a):           ${n.transition}/${T}
Locally reachable:                 ${n.local}/${T}
Container reachable:               ${n.container}/${T}
Staging reachable:                 ${n.staging}/${T}
Production reachable:              ${n.production}/${T}
Visual approvals:                  ${n.visual}/${T}
Accessibility approvals:           ${n.a11y}/${T}
Missing source (original design):  ${defects.missingSource.join(", ") || "none"}
Unwired source:                    ${defects.unwiredSource.join(", ") || "none"}
Missing triggers:                  ${defects.missingTrigger.join(", ") || "none"}
Partial stubs:                     ${defects.partialStub.join(", ") || "none"}
Rebuild-required (replacements):   ${defects.rebuildRequired.join(", ") || "none"}
Reference artifacts absent:        ${defects.refMissing.length}/${T} (warn-only)
`);
if (warnings.length) console.log(`${warnings.length} warning(s) — first 5:\n` + warnings.slice(0, 5).map((w) => `  ${w}`).join("\n"));
if (errors.length) {
  console.error(`\nverify:stitch-wiring FAIL — ${errors.length} contradiction(s)\n` + errors.map((x) => `  ${x}`).join("\n"));
  process.exit(1);
}
console.log("verify:stitch-wiring PASS — manifest claims consistent with the repository (honest gaps declared, no contradictions)");
