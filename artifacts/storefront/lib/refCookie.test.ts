import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractRefFromQuery,
  buildRefSetCookieHeader,
  REF_COOKIE_NAME,
  REF_COOKIE_MAX_AGE_SEC,
} from "./refCookie";

test("extractRefFromQuery extracts ref parameter from URLSearchParams and trims/truncates (L-1)", () => {
  const params = new URLSearchParams("ref=gym_fitlife_sector62 &other=foo");
  assert.equal(extractRefFromQuery(params), "gym_fitlife_sector62");

  const utmParams = new URLSearchParams("utm_ref=dietitian_sharma");
  assert.equal(extractRefFromQuery(utmParams), "dietitian_sharma");

  assert.equal(extractRefFromQuery(new URLSearchParams("no_ref=here")), null);
});

test("extractRefFromQuery extracts ref from plain records", () => {
  assert.equal(extractRefFromQuery({ ref: "corporate_inquiry" }), "corporate_inquiry");
  assert.equal(extractRefFromQuery({ ref: ["array_first", "second"] }), "array_first");
});

test("buildRefSetCookieHeader formats cookie string for 30 day expiration", () => {
  const header = buildRefSetCookieHeader("gym_fitlife", true);
  assert.ok(header.includes(`${REF_COOKIE_NAME}=gym_fitlife`));
  assert.ok(header.includes(`Max-Age=${REF_COOKIE_MAX_AGE_SEC}`));
  assert.ok(header.includes("Secure"));
  assert.ok(header.includes("SameSite=Lax"));
});
