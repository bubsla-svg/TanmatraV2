import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Ops-console ↔ ops-endpoint wiring.
 *
 * The Admin Ops dashboard once streamed its chat from /support-agent/chat.
 * That endpoint gates on a CUSTOMER session (`requireAuthUser`), while an
 * operator signed in through /admin/login carries only the signed admin
 * cookie — so every message 401'd, and the hook's catch-all rendered
 * "Ops Agent connection failed. Please retry or escalate to on-call
 * engineer." for a working, healthy backend. The gate mismatch was
 * invisible in types and in CI: both endpoints speak the same NDJSON
 * protocol, so nothing but the URL was wrong.
 *
 * These assertions parse the source rather than import it (queries.ts pulls
 * in import.meta.env via apiBase.ts, which node:test does not provide —
 * and adminConsoles.test.ts already establishes the parse-don't-duplicate
 * pattern for exactly this kind of drift guard).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(HERE, "..", "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}

test("ops chat client streams from /ops-agent/chat, not the support agent", () => {
  const queries = read("lib/queries.ts");
  const fnStart = queries.indexOf("export async function streamOpsAgentChat");
  assert.notEqual(fnStart, -1, "streamOpsAgentChat must exist in lib/queries.ts");
  // The fetch target lives within the function body; scan a bounded window
  // past the signature so an unrelated later occurrence cannot satisfy this.
  const body = queries.slice(fnStart, fnStart + 1200);
  assert.match(body, /\/ops-agent\/chat/);
  assert.doesNotMatch(body, /\/support-agent\/chat/);
});

test("useOpsAgent consumes the ops stream client", () => {
  const hook = read("components/ops/useOpsAgent.ts");
  assert.match(hook, /streamOpsAgentChat/);
  assert.doesNotMatch(
    hook,
    /streamSupportAgentChat|\/support-agent\/chat/,
    "the ops hook must not reach the customer-session support endpoint",
  );
});

test("no admin ops surface reaches the customer support-agent endpoint", () => {
  // The support endpoint requires a customer session; nothing under the
  // admin-only ops surfaces can authenticate against it.
  const opsDir = path.join(SRC_ROOT, "components", "ops");
  for (const f of fs.readdirSync(opsDir)) {
    if (!/\.(ts|tsx)$/.test(f) || f.endsWith(".test.ts")) continue;
    const src = fs.readFileSync(path.join(opsDir, f), "utf8");
    assert.doesNotMatch(
      src,
      /\/support-agent\/chat/,
      `components/ops/${f} must not call the support-agent endpoint`,
    );
  }
});
