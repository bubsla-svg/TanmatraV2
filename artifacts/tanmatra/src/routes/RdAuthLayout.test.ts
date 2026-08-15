import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * /rd-console's layout gate checked ONLY the admin-session cookie
 * (GET /admin/me) — the same login every admin/* console uses. But the
 * console's actual data routes (requireRdRole in rdAdvisory.ts) expect the
 * CUSTOMER/passport session of a user mapped to an rd_users row: the
 * dietitian's own account, not staff. A real RD has no admin password and
 * never will, so they could never get past this layout to reach a console
 * every downstream route already expects them, specifically, to use.
 *
 * Fix: accept EITHER the admin cookie (staff, unchanged) OR an authenticated
 * customer session that GET /rd/console/me confirms maps to a real rdSlug
 * (the dietitian themselves). Parsed rather than imported/rendered — no
 * RTL/jsdom harness exists for tanmatra pages here, matching the pattern in
 * AdminCatalog.test.ts.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "RdAuthLayout.tsx"), "utf8");

test("the auth check queries both /admin/me and /rd/console/me", () => {
  assert.match(SRC, /apiPath\("\/admin\/me"\)/);
  assert.match(SRC, /apiPath\("\/rd\/console\/me"\)/);
});

test("a successful /admin/me alone is sufficient (staff path preserved)", () => {
  const hookStart = SRC.indexOf("function useRdAuth(");
  const hookBody = SRC.slice(hookStart, SRC.indexOf("\n  return state;", hookStart));
  assert.match(hookBody, /adminRes\?\.ok/);
});

test("a successful /rd/console/me requires a non-null rdSlug, not just a 200", () => {
  const hookStart = SRC.indexOf("function useRdAuth(");
  const hookBody = SRC.slice(hookStart, SRC.indexOf("\n  return state;", hookStart));
  assert.match(hookBody, /data\.rdSlug/);
});
