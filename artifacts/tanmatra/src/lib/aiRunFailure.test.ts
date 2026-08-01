import test from "node:test";
import assert from "node:assert/strict";
import { summariseAiFailure, dominantFailure } from "./aiRunFailure.js";

/**
 * These cover the classifier that turns a stored ai_runs.error into an
 * operator-facing cause. The failure it exists for: the AI Runs console showed
 * every agent erroring with 0 tokens and gave no way to tell a rejected API key
 * apart from a rate limit or a retired model — three problems with three
 * different fixes, rendered identically.
 */

test("an API-key rejection is called out as a credentials problem", () => {
  for (const message of [
    "API key not valid. Please pass a valid API key.",
    "[GoogleGenerativeAI Error]: error status 403: PERMISSION_DENIED",
    "Request failed with status 401",
    "API_KEY_INVALID",
  ]) {
    const summary = summariseAiFailure(message);
    assert.equal(summary.kind, "auth", `misclassified: ${message}`);
    assert.match(summary.hint, /GOOGLE_API_KEY/);
  }
});

test("throttling is separated from credential failure", () => {
  for (const message of [
    "429 Too Many Requests",
    "RESOURCE_EXHAUSTED: Quota exceeded for quota metric",
    "rate limit reached for model",
  ]) {
    assert.equal(summariseAiFailure(message).kind, "quota", message);
  }
});

test("a retired model id is its own diagnosis", () => {
  // The trap this guards: the fix is a code change (DEFAULT_MODEL_ID), not a
  // secret rotation, so it must not fall through to the auth bucket.
  const summary = summariseAiFailure(
    "models/gemini-1.0-pro is not found for API version v1beta",
  );
  assert.equal(summary.kind, "model");
  assert.match(summary.hint, /DEFAULT_MODEL_ID/);
});

test("timeouts, safety blocks and 5xx are each distinguished", () => {
  assert.equal(
    summariseAiFailure("The operation was aborted due to timeout").kind,
    "timeout",
  );
  assert.equal(
    summariseAiFailure("Candidate was blocked due to SAFETY").kind,
    "safety",
  );
  assert.equal(
    summariseAiFailure("error status 503: model is overloaded").kind,
    "upstream",
  );
});

test("an unrecognised or empty message does not get a fabricated cause", () => {
  // The raw string is always shown next to this, so silence is correct here —
  // a confident wrong hint would send an operator to rotate a healthy key.
  for (const message of [null, undefined, "", "   ", "something odd happened"]) {
    const summary = summariseAiFailure(message);
    assert.equal(summary.kind, "unknown");
    assert.equal(summary.hint, "");
  }
});

test("credential rejection wins over a co-occurring generic code", () => {
  // Provider strings often carry several numbers. Rule order is the contract:
  // "403 ... API key" must read as auth, not as an unclassified upstream 4xx.
  assert.equal(
    summariseAiFailure("error status 403: API key not valid").kind,
    "auth",
  );
});

test("dominantFailure reports a shared cause when most runs fail", () => {
  const rows = [
    { status: "error", error: "API key not valid" },
    { status: "error", error: "API key not valid" },
    { status: "error", error: "403 PERMISSION_DENIED" },
    { status: "ok", error: null },
  ];
  const verdict = dominantFailure(rows);
  assert.ok(verdict, "3 of 4 failing the same way is an outage, not noise");
  assert.equal(verdict.summary.kind, "auth");
  assert.equal(verdict.failed, 3);
  assert.equal(verdict.total, 4);
});

test("dominantFailure stays quiet on a healthy or lightly-failing page", () => {
  assert.equal(dominantFailure([]), null);
  // One failure is noise.
  assert.equal(
    dominantFailure([
      { status: "error", error: "API key not valid" },
      { status: "ok", error: null },
      { status: "ok", error: null },
    ]),
    null,
  );
  // Exactly half is not a majority — banner stays off.
  assert.equal(
    dominantFailure([
      { status: "error", error: "API key not valid" },
      { status: "error", error: "API key not valid" },
      { status: "ok", error: null },
      { status: "ok", error: null },
    ]),
    null,
  );
});

test("dominantFailure will not announce a cause it cannot name", () => {
  const verdict = dominantFailure([
    { status: "error", error: "something odd happened" },
    { status: "error", error: "another odd thing" },
    { status: "error", error: null },
  ]);
  assert.equal(
    verdict,
    null,
    "an 'unknown' plurality gives the operator nothing to act on",
  );
});

test("dominantFailure picks the most common cause, not the first", () => {
  const verdict = dominantFailure([
    { status: "error", error: "operation timed out" },
    { status: "error", error: "429 Too Many Requests" },
    { status: "error", error: "quota exceeded" },
    { status: "error", error: "rate limit reached" },
  ]);
  assert.ok(verdict);
  assert.equal(verdict.summary.kind, "quota");
});
