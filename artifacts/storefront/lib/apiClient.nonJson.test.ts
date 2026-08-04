/**
 * The transport's non-JSON guard. On flaky mobile networks a Cloud Run
 * 502/504, a CDN error page, or a captive-portal interstitial answers with
 * HTML — and an unguarded JSON.parse threw a raw SyntaxError BEFORE the
 * res.ok branch, so every caller branching on `instanceof ApiError`
 * (401 → inline sign-in, session-expired copy, checkout error copy)
 * misclassified an infrastructure blip as an unknown crash.
 * Run: node --test --import tsx ./lib/apiClient.nonJson.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { apiGet, apiPost, ApiError } from "./apiClient";

const CLOUD_RUN_502 = "<html><head><title>502 Bad Gateway</title></head><body>upstream</body></html>";

function htmlFetch(status: number, body: string, statusText = "") {
  return (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      statusText,
      text: async () => body,
    }) as Response) as unknown as typeof fetch;
}

test("an HTML 502 surfaces as ApiError(502, non_json) — not a SyntaxError", async () => {
  await assert.rejects(
    () => apiGet("/orders/x", htmlFetch(502, CLOUD_RUN_502, "Bad Gateway")),
    (e: unknown) => {
      assert.ok(e instanceof ApiError, `expected ApiError, got ${String(e)}`);
      assert.equal(e.status, 502);
      assert.equal(e.code, "non_json");
      return true;
    },
  );
});

test("an HTML 401 (proxy-injected) still lands in the ApiError 401 branch", async () => {
  // The island-auth pattern branches on `e instanceof ApiError && e.status === 401`
  // to render inline sign-in. A proxy answering 401 with an HTML page must not
  // break that branch into a crash.
  await assert.rejects(
    () => apiPost("/addresses", { label: "Home" }, htmlFetch(401, "<html>auth required</html>")),
    (e: unknown) => {
      assert.ok(e instanceof ApiError);
      assert.equal(e.status, 401);
      return true;
    },
  );
});

test("a '200' with an unparseable body is a loud ApiError(502, bad_response)", async () => {
  // Captive portals return 200 + their own HTML. Treating that as success
  // hands callers `{}` where data was promised; treating it as a crash loses
  // the ApiError branch. It is a transport failure — say so.
  await assert.rejects(
    () => apiGet("/menu", htmlFetch(200, "<html>hotel wifi login</html>")),
    (e: unknown) => {
      assert.ok(e instanceof ApiError);
      assert.equal(e.status, 502);
      assert.equal(e.code, "bad_response");
      return true;
    },
  );
});

test("valid JSON error bodies keep their exact status/code (no regression)", async () => {
  const impl = (async () =>
    ({
      ok: false,
      status: 422,
      statusText: "",
      text: async () => JSON.stringify({ error: "plan not launchable", code: "plan_not_launchable" }),
    }) as Response) as unknown as typeof fetch;
  await assert.rejects(
    () => apiPost("/subscriptions", {}, impl),
    (e: unknown) => {
      assert.ok(e instanceof ApiError);
      assert.equal(e.status, 422);
      assert.equal(e.code, "plan_not_launchable");
      return true;
    },
  );
});

test("an empty body on a 2xx still resolves to {} (no regression)", async () => {
  const impl = (async () =>
    ({ ok: true, status: 204, statusText: "", text: async () => "" }) as Response) as unknown as typeof fetch;
  const out = await apiGet<Record<string, never>>("/noop", impl);
  assert.deepEqual(out, {});
});
