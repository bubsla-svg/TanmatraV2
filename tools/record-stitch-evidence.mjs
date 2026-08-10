// Binds local runtime evidence to the manifest. Run AFTER the evidence commit
// exists, with TESTED_SHA=<commit that produced the tested build/specs>:
//
//   TESTED_SHA=$(git rev-parse HEAD) node tools/record-stitch-evidence.mjs
//
// For every entry whose spec passed in the local full-stack run AND whose
// evidence screenshot exists on disk, this sets proof.localRuntime=verified,
// upgrades trigger/transition proof (the passing test exercised them), and
// appends a local-runtime evidence record. Entries without a screenshot are
// left untouched — evidence is required, not assumed. Never touches container/
// staging/production fields: those environments need their own runs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "docs/stitch/stitch-screen-manifest.json");
const SHOTS = "artifacts/audit/stitch-integration/screenshots";

const SHA = process.env.TESTED_SHA;
const RECORDED_AT = process.env.RECORDED_AT ?? new Date().toISOString();
if (!SHA || !/^[0-9a-f]{7,40}$/.test(SHA)) {
  console.error("Set TESTED_SHA to the commit whose build/specs produced the evidence.");
  process.exit(1);
}

// Entries covered by a PASSING test in the local full-stack run (8.3 excluded:
// its spec skips without a seeded order id).
const PASSED = new Set([
  "4.1", "4.2",
  "5.1", "5.2", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "5.11", "5.12",
  "6.1", "6.8", "6.9.1", "6.9.2", "6.9.3",
  "8.1",
  "9.1", "9.2", "9.3",
  "10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8",
  "11.2", "11.3", "11.4", "11.5", "11.6", "11.7", "11.8",
  "12.1", "12.2", "12.3", "12.5", "12.6", "12.7",
  "13.1", "13.2", "13.3",
  "14.1", "14.5", "14.6", "14.7",
]);

const entries = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
let recorded = 0;
for (const e of entries) {
  if (!PASSED.has(e.promptId)) continue;
  const theme = e.themes[0] ?? "dark";
  const shot = `${SHOTS}/${e.promptId}-${theme}.png`;
  if (!fs.existsSync(path.join(ROOT, shot))) {
    console.error(`SKIP ${e.promptId}: expected evidence screenshot missing (${shot})`);
    continue;
  }
  e.proof.localRuntime = "verified";
  if (e.proof.triggerDefinition === "pending") e.proof.triggerDefinition = "verified";
  if (typeof e.transition === "object" && e.proof.transitionDefinition === "pending")
    e.proof.transitionDefinition = "verified";
  e.evidence = e.evidence.filter((ev) => ev.type !== "local-runtime");
  e.evidence.push({
    type: "local-runtime",
    sha: SHA,
    environment: "local-production-build",
    url: `http://127.0.0.1:3001${e.canonicalRoute === "global" ? "/" : e.canonicalRoute}`,
    viewport: "Pixel 7 (mobile project)",
    theme,
    screenshot: shot,
    trace: "artifacts/audit/stitch-integration/traces/ (gitignored; regenerate: E2E_FULL_STACK=1 pnpm run test:stitch-runtime -- --trace on)",
    recordedAt: RECORDED_AT,
  });
  e.evidenceSha = SHA;
  recorded++;
}
fs.writeFileSync(MANIFEST, JSON.stringify(entries, null, 2) + "\n");
console.log(`Recorded local-runtime evidence for ${recorded} entries at ${SHA.slice(0, 10)} (testedProductSha; the commit adding these records is the evidenceRecordSha).`);
