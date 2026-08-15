import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * This page's only fetch call used a hardcoded relative path
 * (`fetch("/api/admin/audit?limit=100")`) instead of API_BASE. In production
 * API_BASE points at the wellness-foods Cloud Run origin, not tanmatra.food's
 * own origin — this page's own SPA server has no /api routes and would
 * return the 200 HTML shell instead of JSON (see lib/apiBase.ts's own
 * comment). It also omitted `credentials: "include"`, dropping the admin
 * session cookie even if the URL had been correct. Parsed rather than
 * imported/rendered, matching the pattern in AdminCatalog.test.ts.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "AdminAudit.tsx"), "utf8");

test("the audit fetch goes through API_BASE, not a hardcoded relative path", () => {
  assert.match(SRC, /import\s*\{\s*API_BASE\s*\}\s*from\s*"@\/lib\/apiBase"/);
  assert.doesNotMatch(SRC, /fetch\("\/api\/admin\/audit/);
  assert.match(SRC, /fetch\(`\$\{API_BASE\}\/admin\/audit/);
});

test("the audit fetch does not double the /api segment already in API_BASE", () => {
  assert.doesNotMatch(SRC, /\$\{API_BASE\}\/api\//);
});

test("the audit fetch sends credentials so the admin session cookie is included", () => {
  const start = SRC.indexOf("fetch(`${API_BASE}/admin/audit");
  assert.notEqual(start, -1);
  const block = SRC.slice(start, SRC.indexOf(");", start));
  assert.match(block, /credentials:\s*"include"/);
});
