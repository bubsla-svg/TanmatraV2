import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Found by actually sending a chat message on /admin/ops-agent against a
 * live api-server with no AI provider configured: the backend correctly
 * streams an `error` event followed by a `finish` event carrying an
 * operator-readable fallback ("Sorry, the Ops Agent ran into an error.
 * Try again."), and `sendInner` correctly calls `setError(event.message)`
 * on that error event. But immediately after the stream ends, `sendInner`
 * unconditionally called `loadAudit()` — whose own success path
 * unconditionally calls `setError(null)` — wiping the error banner before
 * the operator ever saw it. Confirmed live: after a failed chat, the DOM
 * had no `.text-destructive` node anywhere even though the raw stream
 * (verified via curl) carried both the wrapping error and the finish
 * fallback text.
 *
 * Parsed rather than imported/rendered, matching the pattern in
 * opsAgentWiring.test.ts (importing this page pulls in import.meta.env
 * via apiBase.ts, which node:test does not provide).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(HERE, "AdminOpsAgent.tsx"), "utf8");

function sendInnerBody(): string {
  const start = SRC.indexOf("const sendInner =");
  assert.notEqual(start, -1, "expected a sendInner function");
  const end = SRC.indexOf("\n  };", start);
  assert.notEqual(end, -1);
  return SRC.slice(start, end);
}

test("a stream error is tracked so the post-stream refresh doesn't wipe it", () => {
  const body = sendInnerBody();
  assert.match(
    body,
    /streamHadError\s*=\s*true/,
    "the error event handler must record that the stream failed",
  );
});

test("loadAudit (which clears `error` on success) is skipped after a failed stream", () => {
  const body = sendInnerBody();
  const auditCallIndex = body.search(/void loadAudit\(\)/);
  assert.notEqual(auditCallIndex, -1, "expected a loadAudit() refresh call");
  const guardWindow = body.slice(Math.max(0, auditCallIndex - 120), auditCallIndex);
  assert.match(
    guardWindow,
    /if\s*\(\s*!streamHadError\s*\)/,
    "loadAudit() must be gated on the stream NOT having errored, since its " +
      "own success path calls setError(null) and would clobber a just-set " +
      "chat-failure message",
  );
});

test("loadLiveQueue still refreshes unconditionally (it never touches error state)", () => {
  const body = sendInnerBody();
  assert.match(body, /void loadLiveQueue\(\);/);
});
