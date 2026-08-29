import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FUNNEL_SESSION_COOKIE_NAME,
  isValidFunnelSessionId,
  isValidSrc,
  newFunnelSessionId,
  readCookie,
  resolveAttribution,
  SRC_COOKIE_NAME,
} from "./acquisition";

test("readCookie finds a value among neighbours and tolerates junk", () => {
  const jar = `a=1; ${SRC_COOKIE_NAME}=gym12; b=2`;
  assert.equal(readCookie(jar, SRC_COOKIE_NAME), "gym12");
  assert.equal(readCookie("", SRC_COOKIE_NAME), undefined);
  assert.equal(readCookie("novalue; other=1", SRC_COOKIE_NAME), undefined);
  assert.equal(readCookie(`${SRC_COOKIE_NAME}=%62ox`, SRC_COOKIE_NAME), "box");
});

test("readCookie does not match a cookie whose name merely ends with the key", () => {
  assert.equal(readCookie(`x_${SRC_COOKIE_NAME}=nope`, SRC_COOKIE_NAME), undefined);
});

test("isValidSrc guards the cookie on the way out, not just on the way in", () => {
  // The cookie is attacker-writable and its value reaches an analytics props
  // blob and a qr_scans row.
  assert.equal(isValidSrc("gym12"), true);
  assert.equal(isValidSrc("BOX"), false, "stored form is lowercase");
  assert.equal(isValidSrc("has space"), false);
  assert.equal(isValidSrc(undefined), false);
  assert.equal(isValidSrc(null), false);
});

test("isValidFunnelSessionId bounds the join key", () => {
  assert.equal(isValidFunnelSessionId("abc12345"), true);
  assert.equal(isValidFunnelSessionId("short"), false);
  assert.equal(isValidFunnelSessionId("has-dash-in-it"), false);
});

test("newFunnelSessionId produces a value its own validator accepts", () => {
  for (let i = 0; i < 5; i++) {
    assert.equal(isValidFunnelSessionId(newFunnelSessionId()), true);
  }
  assert.notEqual(newFunnelSessionId(), newFunnelSessionId());
});

test("resolveAttribution prefers this visit's URL over a stale cookie", () => {
  // Someone who scanned the box sticker last week and the gym poster today is
  // the gym poster's visit.
  const a = resolveAttribution(
    new URLSearchParams("src=gym12"),
    `${SRC_COOKIE_NAME}=box; ${FUNNEL_SESSION_COOKIE_NAME}=abc12345`,
  );
  assert.deepEqual(a, { src: "gym12", sessionId: "abc12345" });
});

test("resolveAttribution falls back to the cookie once the query is gone", () => {
  // A scanner who wanders to /menu and buys three screens later is still the
  // poster's conversion.
  const a = resolveAttribution(new URLSearchParams(""), `${SRC_COOKIE_NAME}=box`);
  assert.deepEqual(a, { src: "box", sessionId: null });
});

test("resolveAttribution discards an invalid value from either source", () => {
  const fromUrl = resolveAttribution(
    new URLSearchParams("src=NOT VALID"),
    `${SRC_COOKIE_NAME}=box`,
  );
  assert.equal(fromUrl.src, "box", "a bad URL value falls through to the cookie");

  const both = resolveAttribution(new URLSearchParams("src=..%2Fetc"), `${SRC_COOKIE_NAME}=%2Fbad`);
  assert.deepEqual(both, { src: null, sessionId: null });
});

test("resolveAttribution works with no search params at all", () => {
  assert.deepEqual(resolveAttribution(null, ""), { src: null, sessionId: null });
});
