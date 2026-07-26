/**
 * Tests for the thrown-API-error parse that CheckoutAppointment.tsx uses to
 * decide, AFTER a card has been charged, whether to tell the customer their
 * booking failed.
 *
 * Both defects this pins actually shipped:
 *   1. `String(err).includes("Error")` as "is this a server error" — true for
 *      every Error ever thrown, so the transport-failure branch it guarded was
 *      unreachable and a captured-but-unconfirmed payment was reported as a
 *      hard failure.
 *   2. `String(err) === "cancelled"` to detect a dismissed Razorpay modal —
 *      never true, because String(new Error("cancelled")) is
 *      "Error: cancelled". Closing the modal showed "Could not book".
 *
 * DB-free and DOM-free — pure string arithmetic.
 * Run from artifacts/api-server:
 *   node --test --import tsx ../tanmatra/src/lib/apiError.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  errorMessage,
  httpStatusOf,
  isHttpStatus,
  isTransportFailure,
} from "./apiError";

test("reads the status off the shape request<T>() actually throws", () => {
  // request<T>: throw new Error(`${res.status}: ${text || res.statusText}`)
  assert.equal(httpStatusOf(new Error("409: slot taken")), 409);
  assert.equal(httpStatusOf(new Error("401: unauthorized")), 401);
  assert.equal(httpStatusOf(new Error("502: Bad Gateway")), 502);
  // Empty body — statusText also empty
  assert.equal(httpStatusOf(new Error("500: ")), 500);
});

test("a transport failure has no status, and that is the answer", () => {
  // What fetch rejects with when the request never completes. The wording
  // differs per browser, which is why the parse must not match on it.
  for (const err of [
    new TypeError("Failed to fetch"),
    new TypeError("NetworkError when attempting to fetch resource."),
    new TypeError("Load failed"),
    new DOMException("The operation was aborted.", "AbortError"),
  ]) {
    assert.equal(httpStatusOf(err), null, `${err} must carry no status`);
    assert.ok(isTransportFailure(err));
  }
});

test("the old `includes(\"Error\")` test could not have separated them", () => {
  const serverRefused = new Error("409: slot taken");
  const neverReached = new TypeError("Failed to fetch");
  // The shipped condition, verbatim — true for both, so the else branch was dead.
  assert.ok(String(serverRefused).includes("Error"));
  assert.ok(String(neverReached).includes("Error"));
  // The replacement separates them.
  assert.notEqual(httpStatusOf(serverRefused), null);
  assert.equal(httpStatusOf(neverReached), null);
});

test("modal outcomes are read from message, not from String(err)", () => {
  const cancelled = new Error("cancelled");
  // The shipped comparison, verbatim — never matched.
  assert.notEqual(String(cancelled), "cancelled");
  assert.equal(String(cancelled), "Error: cancelled");
  // What the call site now does.
  assert.equal(errorMessage(cancelled), "cancelled");
  assert.equal(errorMessage(new Error("unavailable")), "unavailable");
  // And an outcome word is not mistaken for a status.
  assert.equal(httpStatusOf(cancelled), null);
});

test("only a LEADING status counts", () => {
  // A status mentioned inside a server's error body is not this request's
  // status. Without anchoring, this would report 404 for a 200 response.
  assert.equal(httpStatusOf(new Error("upstream returned 404 for /menu")), null);
  assert.equal(httpStatusOf(new Error("409: conflict on 500 rows")), 409);
});

test("a bare status with no colon still parses", () => {
  assert.equal(httpStatusOf(new Error("503")), 503);
  assert.equal(httpStatusOf(new Error("503 Service Unavailable")), 503);
});

test("non-status leading digits are not statuses", () => {
  assert.equal(httpStatusOf(new Error("1234: not a status")), null);
  assert.equal(httpStatusOf(new Error("42: also not")), null);
  // In range as three digits but not a real HTTP class.
  assert.equal(httpStatusOf(new Error("099: below range")), null);
});

test("handles throwables that are not Errors at all", () => {
  assert.equal(httpStatusOf("404: not found"), 404);
  assert.equal(errorMessage("plain string"), "plain string");
  assert.equal(httpStatusOf(null), null);
  assert.equal(httpStatusOf(undefined), null);
  assert.equal(httpStatusOf({ status: 500 }), null);
});

test("isHttpStatus matches exactly, not by substring", () => {
  const err = new Error("409: slot taken");
  assert.ok(isHttpStatus(err, 409));
  assert.ok(!isHttpStatus(err, 40));
  assert.ok(!isHttpStatus(err, 4090));
  assert.ok(!isHttpStatus(new TypeError("Failed to fetch"), 409));
});
