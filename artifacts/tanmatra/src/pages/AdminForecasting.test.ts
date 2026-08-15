import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * downloadPoCsv() used a hardcoded relative path
 * (`/api/forecasting/purchase-orders/${id}/export.csv`) instead of
 * API_BASE, unlike every other fetch in this file. In production API_BASE
 * points at the wellness-foods Cloud Run origin; a relative path instead
 * hits the tanmatra SPA's own origin, which has no /api routes — the "export
 * CSV" button was a dead click. Parsed rather than imported/rendered,
 * matching the pattern in AdminCatalog.test.ts.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "AdminForecasting.tsx"), "utf8");

test("downloadPoCsv goes through API_BASE, not a hardcoded relative path", () => {
  const fnStart = SRC.indexOf("const downloadPoCsv = async");
  assert.notEqual(fnStart, -1);
  const fnBody = SRC.slice(fnStart, SRC.indexOf("\n  };", fnStart));
  assert.doesNotMatch(fnBody, /fetch\(\s*\n?\s*`\/api\//);
  assert.match(fnBody, /fetch\(\s*\n?\s*`\$\{API_BASE\}\/forecasting\/purchase-orders/);
});

test("no fetch on this page doubles the /api segment already in API_BASE", () => {
  assert.doesNotMatch(SRC, /\$\{API_BASE\}\/api\//);
});
