import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Two bugs on this page:
 *
 * 1. loadOrders() gated on `if (!token) return`, reading only the legacy
 *    `x-admin-token` localStorage value — kdsFetch() already sends
 *    `credentials: "include"`, so the server-side gate (requireOps, router-
 *    level on /ops) would happily accept the standard admin session cookie.
 *    An operator who only ever logged in via /admin/login and never pasted
 *    a legacy token saw the board silently render "All orders cleared" —
 *    indistinguishable from an empty kitchen. Same bug class as
 *    AdminCatalog.tsx's original `if (!adminToken) return`.
 *
 * 2. handleSimulateDelay() discarded the response body and unconditionally
 *    showed "CRM Delay Alert SMS sent to customer!" — but the server
 *    (ops.ts's /kds/orders/:id/simulate-delay) returns
 *    `{ok:true, smsSent:false, reason:"no transactional SMS provider
 *    configured", ...}` whenever no SMS provider is wired (true in this
 *    environment), and only `smsSent:true` when a message actually sent.
 *    The UI claimed success regardless.
 *
 * Parsed rather than imported/rendered — no RTL/jsdom harness exists for
 * tanmatra pages here, matching the pattern in AdminCatalog.test.ts.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "AdminKds.tsx"), "utf8");

test("loadOrders does not gate on a manually-entered admin token", () => {
  const fnStart = SRC.indexOf("const loadOrders = useCallback(async () => {");
  assert.notEqual(fnStart, -1);
  const fnBody = SRC.slice(fnStart, SRC.indexOf("}, [token]);", fnStart));
  assert.doesNotMatch(fnBody, /if \(!token\) return/);
});

test("handleSimulateDelay reflects the server's smsSent flag instead of always claiming success", () => {
  const fnStart = SRC.indexOf("const handleSimulateDelay = async");
  assert.notEqual(fnStart, -1);
  const fnBody = SRC.slice(fnStart, SRC.indexOf("\n  };", fnStart));
  assert.match(fnBody, /result\.smsSent/, "must branch on the response's smsSent field");
  assert.match(fnBody, /toast\.warning/, "must warn when smsSent is false");
});
