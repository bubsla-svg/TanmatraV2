import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * "Approve & send" used to show a generic "send ok" regardless of whether
 * the reply actually reached the customer. The backend
 * (POST /support-tickets/:id/send) now reports emailSent/emailReason
 * (api-server's supportTriage.test.ts covers the emailTicketReply guard
 * clauses) — this test guards that the admin UI actually reads and
 * surfaces that field instead of assuming success. Parsed rather than
 * imported/rendered, matching the pattern in AdminCatalog.test.ts.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "AdminSupportTickets.tsx"), "utf8");

test('callAction branches on the "send" response\'s emailSent field instead of assuming success', () => {
  const fnStart = SRC.indexOf("async function callAction(");
  assert.notEqual(fnStart, -1);
  const fnBody = SRC.slice(fnStart, SRC.indexOf("\n  }", fnStart));
  assert.match(fnBody, /path === "send"/);
  assert.match(fnBody, /emailSent/);
  assert.match(fnBody, /emailReason/);
});
