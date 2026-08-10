// Static schema validation for docs/stitch/stitch-screen-manifest.json (v2).
// Validates structure and vocabulary ONLY — it makes no claim about the
// filesystem (verify-stitch-wiring.mjs) or runtime reachability
// (test:stitch-runtime). Exit 1 on any failure.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "docs/stitch/stitch-screen-manifest.json");

const ARTIFACT_TYPES = new Set([
  "route", "overlay", "drawer", "wizard-stage", "component-state",
  "loading-state", "empty-state", "error-state", "recovery-state",
  "design-system-reference",
]);
const LAYOUTS = new Set(["GlobalLayout", "FocusLayout", "B2BLayout"]);
const STATUS = new Set(["pending", "verified", "missing", "partial", "broken", "blocked", "not-applicable"]);
const PROOF_KEYS = [
  "declared", "sourceDefinition", "renderChain", "triggerDefinition",
  "transitionDefinition", "localRuntime", "containerRuntime",
  "stagingRuntime", "productionRuntime", "visualApproval", "accessibilityApproval",
];
const TRIGGER_TYPES = new Set([
  "button", "link", "route-navigation", "wizard transition", "server-response",
  "empty-data condition", "error response", "timeout", "permission result",
  "inventory result", "serviceability result",
]);
const DISPOSITIONS = new Set(["original", "approved-replacement", "temporary-replacement", "rebuild-required"]);
const THEMES = new Set(["dark", "light"]);
// v1 summary fields must NOT be stored — they are derived, not truth.
const FORBIDDEN = ["sourceStatus", "wiringStatus", "runtimeStatus", "visualStatus", "accessibilityStatus", "automatedContractStatus", "humanVisualStatus", "humanAccessibilityStatus"];

const errors = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);

const entries = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
if (!Array.isArray(entries)) { console.error("Manifest is not an array"); process.exit(1); }
if (entries.length !== 74) err("manifest", `expected exactly 74 entries, found ${entries.length}`);

const seenPrompt = new Set();
const seenScreen = new Set();

for (const e of entries) {
  const id = e.promptId ?? "<no-promptId>";
  if (e.schemaVersion !== 2) err(id, "schemaVersion must be 2");
  if (seenPrompt.has(id)) err(id, "duplicate promptId");
  seenPrompt.add(id);
  if (e.stitchScreenId) {
    if (seenScreen.has(e.stitchScreenId)) err(id, `duplicate stitchScreenId ${e.stitchScreenId}`);
    seenScreen.add(e.stitchScreenId);
  } else err(id, "stitchScreenId missing");

  for (const k of ["designName", "state", "expectedPrimaryAction", "testId", "testFile"])
    if (typeof e[k] !== "string" || !e[k]) err(id, `${k} missing/empty`);
  if (!ARTIFACT_TYPES.has(e.artifactType)) err(id, `invalid artifactType "${e.artifactType}"`);
  if (!LAYOUTS.has(e.layout)) err(id, `invalid layout "${e.layout}"`);
  if (typeof e.canonicalRoute !== "string" || !(e.canonicalRoute.startsWith("/") || e.canonicalRoute === "global"))
    err(id, `canonicalRoute must start with "/" or be "global"`);
  if (!Array.isArray(e.themes) || e.themes.length === 0 || e.themes.some((t) => !THEMES.has(t)))
    err(id, "themes must be a non-empty subset of {dark, light}");

  // trigger: structured record, always
  const t = e.trigger;
  if (!t || typeof t !== "object" || Array.isArray(t)) err(id, "trigger must be a structured record");
  else {
    if (!TRIGGER_TYPES.has(t.type)) err(id, `invalid trigger.type "${t.type}"`);
    if (typeof t.accessibleName !== "string" || !t.accessibleName) err(id, "trigger.accessibleName missing");
    if (typeof t.sourceState !== "string" || !t.sourceState) err(id, "trigger.sourceState missing");
  }

  // transition: object {from, action, to} or the literal "not-applicable"
  const tr = e.transition;
  const trObj = tr && typeof tr === "object" && !Array.isArray(tr);
  if (trObj) {
    for (const k of ["from", "action", "to"]) if (typeof tr[k] !== "string" || !tr[k]) err(id, `transition.${k} missing`);
  } else if (tr !== "not-applicable") err(id, `transition must be {from,action,to} or "not-applicable"`);
  if (["overlay", "drawer", "wizard-stage", "recovery-state"].includes(e.artifactType) && !trObj)
    err(id, `${e.artifactType} requires a structured transition`);

  if (["overlay", "drawer"].includes(e.artifactType) && (!Array.isArray(e.expectedCloseBehavior) || e.expectedCloseBehavior.length === 0))
    err(id, `${e.artifactType} requires non-empty expectedCloseBehavior`);

  if (!e.implementationArtifacts || typeof e.implementationArtifacts !== "object" || !("dark" in e.implementationArtifacts) || !("light" in e.implementationArtifacts))
    err(id, "implementationArtifacts must have {dark, light}");

  // proof block
  const p = e.proof;
  if (!p || typeof p !== "object") err(id, "proof block missing");
  else {
    for (const k of PROOF_KEYS) if (!STATUS.has(p[k])) err(id, `proof.${k} invalid or missing ("${p[k]}")`);
    for (const k of Object.keys(p)) if (!PROOF_KEYS.includes(k)) err(id, `proof has unknown key "${k}"`);
    // internal consistency
    if (p.sourceDefinition === "missing" && e.implementationComponent) err(id, "sourceDefinition=missing but implementationComponent set");
    if (p.renderChain === "verified" && !e.routeEntryPoint) err(id, "renderChain=verified requires routeEntryPoint");
    for (const rk of ["localRuntime", "containerRuntime", "stagingRuntime", "productionRuntime"]) {
      if (p[rk] === "verified") {
        const envMap = { localRuntime: "local", containerRuntime: "container", stagingRuntime: "staging", productionRuntime: "production" };
        const has = Array.isArray(e.evidence) && e.evidence.some((ev) => (ev.type ?? "").startsWith(envMap[rk]));
        if (!has) err(id, `proof.${rk}=verified but no matching evidence record`);
      }
    }
  }

  if (!Array.isArray(e.evidence)) err(id, "evidence must be an array");
  else for (const ev of e.evidence)
    for (const k of ["type", "sha", "environment", "recordedAt"])
      if (typeof ev[k] !== "string" || !ev[k]) err(id, `evidence record missing ${k}`);
  if (!Array.isArray(e.defectIds)) err(id, "defectIds must be an array");
  if (!DISPOSITIONS.has(e.designDisposition)) err(id, `invalid designDisposition "${e.designDisposition}"`);
  if (e.designDisposition !== "original") {
    const rd = e.replacementDecision;
    if (!rd || typeof rd !== "object") err(id, `${e.designDisposition} requires replacementDecision`);
    else for (const k of ["status", "reason", "decidedBy", "decidedAt"])
      if (typeof rd[k] !== "string" || !rd[k]) err(id, `replacementDecision.${k} missing`);
  }
  for (const k of FORBIDDEN) if (k in e) err(id, `forbidden stored summary field "${k}" — derive, don't store`);
}

if (errors.length) {
  console.error(`verify:stitch-manifest FAIL — ${errors.length} error(s)\n` + errors.map((x) => `  ${x}`).join("\n"));
  process.exit(1);
}
console.log(`verify:stitch-manifest PASS — ${entries.length} entries schema-valid`);
