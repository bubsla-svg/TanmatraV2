import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Same bug class as AdminCatalog.tsx: every fetch on this page omitted
 * `credentials: "include"`, and the initial load was additionally gated on
 * the legacy `x-admin-token` localStorage value, so an operator signed in
 * through the normal cookie-based /admin/login flow never saw compliance
 * logs load at all. Parsed rather than imported/rendered, matching the
 * pattern in AdminCatalog.test.ts.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "AdminCompliance.tsx"), "utf8");

test("every fetch call sends credentials so the admin session cookie is included", () => {
  const starts = [...SRC.matchAll(/fetch\(/g)].map((m) => m.index);
  assert.equal(starts.length, 3, "expected 3 fetch calls (load, tamper-edit, tamper-delete)");
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : SRC.length;
    const block = SRC.slice(start, end);
    assert.match(
      block,
      /credentials:\s*"include"/,
      `fetch call #${i + 1} must send credentials: "include"`,
    );
  }
});

test("loadLogs does not gate on a manually-entered admin token", () => {
  const fnStart = SRC.indexOf("const loadLogs = useCallback(async () => {");
  const fnBody = SRC.slice(fnStart, SRC.indexOf("}, [token]);", fnStart));
  assert.doesNotMatch(fnBody, /if \(!token\) return/);
});
