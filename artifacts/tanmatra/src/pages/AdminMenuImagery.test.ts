import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Same bug class as AdminCatalog.tsx (see AdminCatalog.test.ts): every fetch
 * on this page omitted `credentials: "include"`, and the initial load was
 * additionally gated on the legacy `x-admin-token` localStorage value, so an
 * operator signed in through the normal cookie-based /admin/login flow saw
 * an empty "Missing Primary Image" list and no admin session cookie sent on
 * any asset action. Parsed rather than imported/rendered — no RTL/jsdom
 * harness exists for tanmatra pages here (node:test has no DOM), matching
 * the pattern in adminConsoles.test.ts / AdminCatalog.test.ts.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "AdminMenuImagery.tsx"), "utf8");

test("every fetch call sends credentials so the admin session cookie is included", () => {
  const starts = [...SRC.matchAll(/fetch\(/g)].map((m) => m.index);
  assert.equal(starts.length, 6, "expected 6 fetch calls on this page");
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

test("the missing-images load effect does not gate on a manually-entered admin token", () => {
  const effectStart = SRC.indexOf("useEffect(() => {");
  const effectBody = SRC.slice(effectStart, SRC.indexOf("}, []);", effectStart));
  assert.doesNotMatch(effectBody, /if \(!adminToken\) return/);
  assert.match(effectBody, /loadMissing\(\);/);
});
