import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Found by actually clicking "Scan now" on /admin/ops against a live api
 * server: the panel defined its own `const apiBase = "/api"` instead of
 * importing the shared API_BASE (lib/apiBase.ts). In production the
 * tanmatra frontend and the API server are different origins — API_BASE
 * resolves to the wellness-foods Cloud Run URL there specifically so
 * requests don't fall back to the tanmatra SSR server's own (nonexistent)
 * /api routes, which return 200 HTML rather than a 404. A bare "/api"
 * hits that HTML page, and `await r.json()` throws
 * "Unexpected token '<'..." — the exact error observed live. Same bug
 * class as AdminRdApplications.tsx / AdminAudit.tsx / AdminForecasting.tsx
 * / AdminCatalog.tsx, parsed rather than imported/rendered per the
 * pattern in adminConsoles.test.ts and opsAgentWiring.test.ts (importing
 * this component pulls in import.meta.env via apiBase.ts, which
 * node:test does not provide).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "AnomaliesPanel.tsx"), "utf8");

test("AnomaliesPanel imports the shared API_BASE rather than hardcoding one", () => {
  assert.match(SRC, /import\s*\{\s*API_BASE\s*\}\s*from\s*"@\/lib\/apiBase"/);
  assert.doesNotMatch(
    SRC,
    /const\s+apiBase\s*=\s*["'`]\/api["'`]/,
    "a locally-hardcoded apiBase bypasses the origin-switching logic in lib/apiBase.ts",
  );
});

test("every fetch in AnomaliesPanel goes through API_BASE", () => {
  const fetchCalls = [...SRC.matchAll(/fetch\(\s*`([^`]*)`/g)].map((m) => m[1]);
  assert.ok(fetchCalls.length >= 4, "expected the load/act/scan fetch calls");
  for (const url of fetchCalls) {
    assert.match(
      url ?? "",
      /^\$\{API_BASE\}\//,
      `fetch target "${url}" must start with \${API_BASE}/, not a bare relative path`,
    );
  }
});

test("the scan action specifically calls POST ${API_BASE}/ops/anomalies/scan", () => {
  const fnStart = SRC.indexOf("const runScan =");
  assert.notEqual(fnStart, -1);
  const body = SRC.slice(fnStart, SRC.indexOf("};", fnStart));
  assert.match(body, /fetch\(\s*`\$\{API_BASE\}\/ops\/anomalies\/scan`/);
  assert.match(body, /credentials:\s*"include"/);
});
