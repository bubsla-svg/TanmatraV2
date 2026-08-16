/**
 * Bounds on an unauthenticated intake (plan item 3.5).
 *
 * `POST /api/v1/error-reports` cannot require a session — a beacon fires from a
 * page that has just crashed — so everything it retains is a public write.
 * These are the caps that keep a loop of oversized posts from being an OOM on
 * the process that also serves checkout.
 *
 * Run: node --test --import tsx ./src/lib/errorReportIntake.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  LIMITS,
  MAX_RETAINED_REPORTS,
  normalizeReport,
  retain,
} from "./errorReportIntake";

const NOW = Date.parse("2026-08-16T12:00:00Z");

test("the retained window is bounded, and keeps the newest", () => {
  // It used to be `storedErrorReports.push(record)` with nothing draining it.
  const window: number[] = [];
  for (let i = 0; i < MAX_RETAINED_REPORTS * 3; i += 1) retain(window, i);
  assert.equal(window.length, MAX_RETAINED_REPORTS);
  assert.equal(window.at(-1), MAX_RETAINED_REPORTS * 3 - 1);
  assert.equal(window[0], MAX_RETAINED_REPORTS * 2);
});

test("retain mutates the array it was given", () => {
  // The window is a module-level export the audit route reads by reference.
  // Returning a fresh array would leave that route looking at an empty one
  // forever, and it would look like the feature simply did not work.
  const window: number[] = [];
  const returned = retain(window, 1);
  assert.equal(returned, window);
});

test("every string field is clamped", () => {
  const huge = "x".repeat(5_000_000);
  const r = normalizeReport(
    { errorName: huge, errorMessage: huge, stackTrace: huge, url: huge },
    NOW,
  );
  assert.equal(r.errorName.length, LIMITS.errorName);
  assert.equal(r.errorMessage.length, LIMITS.errorMessage);
  assert.equal(r.stackTrace?.length, LIMITS.stackTrace);
  assert.equal(r.url.length, LIMITS.url);
  assert.equal(r.truncated, true);
});

test("a replay trace is capped from the END", () => {
  // The events just before a crash are the ones that explain it. Slicing from
  // the front would keep the least useful part of an over-long session.
  const trace = Array.from({ length: LIMITS.traceEvents * 4 }, (_, i) => ({ i }));
  const r = normalizeReport({ sessionReplayTrace: trace }, NOW);
  assert.equal(r.sessionReplayTrace.length, LIMITS.traceEvents);
  assert.deepEqual(r.sessionReplayTrace.at(-1), { i: LIMITS.traceEvents * 4 - 1 });
  assert.equal(r.truncated, true);
});

test("a report that fits is not marked truncated", () => {
  // `truncated` tells whoever debugs from a stack whether they are looking at
  // all of it. A flag that is always true says nothing.
  const r = normalizeReport(
    { errorName: "TypeError", errorMessage: "x is not a function", stackTrace: "at f", url: "https://tanmatra.food/menu" },
    NOW,
  );
  assert.equal(r.truncated, false);
});

test("junk in every field still yields a usable record", () => {
  // The body is unvalidated JSON from anywhere. Nothing here may throw, and
  // nothing may leave a field as an object that a log formatter then renders
  // as [object Object].
  for (const junk of [null, undefined, 42, {}, [], true] as unknown[]) {
    const r = normalizeReport(
      { errorName: junk, errorMessage: junk, stackTrace: junk, url: junk, sessionReplayTrace: junk },
      NOW,
    );
    assert.equal(typeof r.errorName, "string");
    assert.equal(typeof r.errorMessage, "string");
    assert.equal(typeof r.url, "string");
    assert.ok(Array.isArray(r.sessionReplayTrace));
    assert.equal(r.stackTrace, undefined);
  }
});

test("an unparseable client timestamp is replaced, not stored", () => {
  // It is client-supplied, so it is not evidence. But a garbage string in a
  // timestamp field makes a log unsortable, which costs exactly when it is
  // being read in anger.
  assert.equal(normalizeReport({ timestamp: "not-a-date" }, NOW).timestamp, new Date(NOW).toISOString());
  assert.equal(normalizeReport({ timestamp: {} }, NOW).timestamp, new Date(NOW).toISOString());
  // A real one is kept — the client clock is still the best record of when the
  // customer actually saw the crash.
  const real = "2026-08-16T11:59:30.000Z";
  assert.equal(normalizeReport({ timestamp: real }, NOW).timestamp, real);
});

test("a rage-click burst is still detected after the trace is capped", () => {
  // The flag drives a different log level. Capping the trace must not be able
  // to silence the alert it exists to raise.
  const trace = [
    ...Array.from({ length: LIMITS.traceEvents * 2 }, () => ({ type: "click" })),
    { type: "rage_click" },
  ];
  assert.equal(normalizeReport({ sessionReplayTrace: trace }, NOW).isRageClickAlert, true);
});
