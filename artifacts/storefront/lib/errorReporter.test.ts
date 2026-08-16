/**
 * Client error reporting (plan item 3.5).
 *
 * The reporter runs inside an error boundary, which makes its failure modes
 * unusual: throwing turns a recoverable page error into a blank screen, and
 * over-claiming turns a crash into a lie the customer can't check. Both are
 * pinned here.
 *
 * Run: node --test --import tsx ./lib/errorReporter.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { reportBody, reportClientError, reportedCopy } from "./errorReporter";

const NOW = Date.parse("2026-08-16T12:00:00Z");
const URL_ = "https://tanmatra.food/menu";

/** The reporter is window-gated; these tests are the browser case. */
function withWindow<T>(fn: () => T): T {
  const g = globalThis as { window?: unknown };
  const had = "window" in g;
  if (!had) g.window = { location: { href: URL_ } };
  try {
    return fn();
  } finally {
    if (!had) delete g.window;
  }
}

function stubFetch(impl: (body: unknown) => Response): { calls: unknown[]; fetchImpl: typeof fetch } {
  const calls: unknown[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const body: unknown = JSON.parse(String(init.body));
    calls.push({ url: String(url), method: init.method, body, keepalive: init.keepalive, init });
    return impl(body);
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const ok = () => new Response("{}", { status: 201, headers: { "content-type": "application/json" } });

test("a report reaches the endpoint the api-server actually serves", async () => {
  const { calls, fetchImpl } = await withWindow(async () => {
    const s = stubFetch(ok);
    await reportClientError(new Error("boom"), { fetchImpl: s.fetchImpl, url: URL_, now: NOW });
    return s;
  });
  const call = calls[0] as { url: string; method: string; keepalive?: boolean };
  assert.match(call.url, /\/api\/v1\/error-reports$/);
  assert.equal(call.method, "POST");
  // Without keepalive the request is cancelled if the boundary's page unloads
  // — which is exactly what a customer does when a page has just crashed.
  assert.equal(call.keepalive, true);
});

test("the reporter never throws, whatever the network does", async () => {
  // It runs inside an error boundary. A reporter that throws turns a
  // recoverable page error into a blank screen.
  await withWindow(async () => {
    const boom = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    assert.equal(await reportClientError(new Error("x"), { fetchImpl: boom, url: URL_ }), false);

    const nonJson = (async () => new Response("<html>502</html>", { status: 502 })) as unknown as typeof fetch;
    assert.equal(await reportClientError(new Error("x"), { fetchImpl: nonJson, url: URL_ }), false);
  });
});

test("a non-2xx is reported as not-sent, not as success", async () => {
  // The whole point of the return value is that the boundary's copy depends on
  // it. Returning true on a 500 would put the old lie back.
  await withWindow(async () => {
    const five = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    assert.equal(await reportClientError(new Error("x"), { fetchImpl: five, url: URL_ }), false);
  });
});

test("the server-component digest survives into the message", () => {
  // On a server-component error the message is React's generic production
  // string; the digest is the only handle on the real stack in the server log.
  // Dropping it makes the report unactionable.
  const body = reportBody(
    { name: "Error", message: "An error occurred in the Server Components render.", digest: "3892041" },
    URL_,
    NOW,
  );
  assert.match(body.errorMessage, /3892041/);
  assert.match(body.errorMessage, /Server Components/);
});

test("an error with nothing on it still produces a usable report", () => {
  // A thrown string, a rejected undefined — the boundary hands us whatever it
  // caught, and a report of empty strings is worse than useless in a log.
  const body = reportBody({}, URL_, NOW);
  assert.equal(body.errorName, "UnknownClientError");
  assert.equal(body.errorMessage, "No error message provided");
  assert.equal(body.stackTrace, undefined);
  assert.equal(body.url, URL_);
});

test("an unbounded stack is clamped before it is sent", () => {
  // A recursion loop produces megabytes of one repeated frame. The endpoint is
  // unauthenticated, so this client should not be the reason anyone discovers
  // that; and the useful part of a recursive trace is the top of it.
  const body = reportBody({ stack: "at recurse\n".repeat(100_000) }, URL_, NOW);
  assert.ok(body.stackTrace);
  assert.ok(body.stackTrace.length <= 4000, `sent ${body.stackTrace.length} chars`);
  assert.match(body.stackTrace, /^at recurse/);
});

test("the copy claims a report only when one was sent", () => {
  assert.match(reportedCopy(true), /notified/i);
  assert.doesNotMatch(reportedCopy(false), /notified/i);
  // And the failure case still gives the customer something to do — the whole
  // reason it is not just the true sentence with the claim deleted.
  assert.match(reportedCopy(false), /tell us/i);
});

// ── Wiring ────────────────────────────────────────────────────────────────────

test("both recovery boundaries report through this module", () => {
  // They each had their own inline Sentry call guarded by a DSN that is set in
  // no workflow, so both were silent in production.
  for (const rel of ["../components/SegmentError.tsx", "../app/global-error.tsx"]) {
    const src = fs.readFileSync(new URL(rel, import.meta.url), "utf8");
    assert.match(src, /reportClientError/, rel);
    assert.doesNotMatch(
      src,
      /import\("@sentry\/nextjs"\)\.then/,
      `${rel} still has the uncaught dynamic import`,
    );
  }
});

test("neither boundary states the claim unconditionally", () => {
  for (const rel of ["../components/SegmentError.tsx", "../app/global-error.tsx"]) {
    const src = fs.readFileSync(new URL(rel, import.meta.url), "utf8");
    assert.match(src, /reportedCopy\(/, rel);
    // The old literal, in any of its wordings, would be a claim the code can no
    // longer back up.
    assert.doesNotMatch(src, /we&rsquo;ve been notified|we've been notified/i, rel);
  }
});
