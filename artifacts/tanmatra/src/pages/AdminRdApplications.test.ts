import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * "Approve & provision" only inserts a row into `rd_users` (portal access to
 * /rd-console). The customer-facing booking directory a dietitian actually
 * needs to appear in — languages, specialties, pricing, office hours — is a
 * separate static roster (lib/rdBookingData.ts's RD_BOOKING array plus
 * lib/rdIdentity.ts), entirely disconnected from rd_users/rd_applications.
 * A newly-provisioned RD can sign into the console but will never appear in
 * /rd/directory or be bookable, with no indication of that anywhere in this
 * UI. Full dynamic wiring (schema + admin form fields for pricing/hours/
 * specialties + updating every RD_BOOKING consumer) is a feature, not a bug
 * fix; this test guards the honest disclosure that replaces the silent trap.
 * Parsed rather than imported/rendered, matching the pattern in
 * AdminCatalog.test.ts.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "AdminRdApplications.tsx"), "utf8");

test("the provisioned-RD state discloses that booking-directory listing is a separate manual step", () => {
  const start = SRC.indexOf("application.linkedRdSlug &&");
  assert.notEqual(start, -1, "expected a linkedRdSlug-gated block");
  const block = SRC.slice(start, start + 900);
  assert.match(block, /rdBookingData\.ts/);
  assert.match(block, /rd\/directory/);
});

/**
 * Found by actually clicking through the fix in a browser (not just parsing
 * source): "Mark contacted/approved/rejected" and "Approve & provision" all
 * go through the same patch() helper, which called a hardcoded
 * `/api/admin/rd-applications/:id` instead of `${API_BASE}/...` — unlike
 * this same file's load() function three lines above it. In production that
 * hits the tanmatra frontend's own origin, not the API server (same failure
 * mode as the AdminAudit.tsx / AdminForecasting.tsx bugs already fixed
 * elsewhere): every status change and every provisioning action was silently
 * broken. The disclosure text this file's other test guards was correct but
 * unreachable — the button that was supposed to trigger it never completed.
 */
test("the patch() mutation helper goes through API_BASE, not a hardcoded relative path", () => {
  const fnStart = SRC.indexOf("async function patch(");
  assert.notEqual(fnStart, -1);
  const fnBody = SRC.slice(fnStart, SRC.indexOf("\n  }", fnStart));
  assert.doesNotMatch(fnBody, /fetch\(\s*\n?\s*`\/api\//);
  assert.match(fnBody, /fetch\(\s*\n?\s*`\$\{API_BASE\}\/admin\/rd-applications/);
});
