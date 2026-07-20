import { test } from "node:test";
import assert from "node:assert";
import type { Request } from "express";
import { safeEqual, hasAdminToken } from "./adminGate";

function reqWithToken(token: string | undefined): Request {
  return {
    header: (name: string) =>
      name.toLowerCase() === "x-admin-token" ? token : undefined,
  } as unknown as Request;
}

test("safeEqual returns true only for identical strings", () => {
  assert.strictEqual(safeEqual("s3cr3t-token", "s3cr3t-token"), true);
  assert.strictEqual(safeEqual("", ""), true);
});

test("safeEqual returns false for different values and differing lengths", () => {
  assert.strictEqual(safeEqual("s3cr3t-token", "s3cr3t-toke!"), false); // same length, differs
  assert.strictEqual(safeEqual("short", "much-longer-value"), false); // length mismatch
  assert.strictEqual(safeEqual("token", ""), false);
});

test("hasAdminToken accepts a matching x-admin-token when RD_ADMIN_TOKEN is set", () => {
  const orig = process.env["RD_ADMIN_TOKEN"];
  try {
    process.env["RD_ADMIN_TOKEN"] = "the-shared-admin-token";
    assert.strictEqual(hasAdminToken(reqWithToken("the-shared-admin-token")), true);
    assert.strictEqual(hasAdminToken(reqWithToken("wrong-token")), false);
    assert.strictEqual(hasAdminToken(reqWithToken(undefined)), false);
    // A wrong-length token must not throw (timingSafeEqual requires equal
    // lengths — the helper length-checks first) and must be rejected.
    assert.strictEqual(hasAdminToken(reqWithToken("x")), false);
  } finally {
    if (orig === undefined) delete process.env["RD_ADMIN_TOKEN"];
    else process.env["RD_ADMIN_TOKEN"] = orig;
  }
});

test("hasAdminToken returns false when RD_ADMIN_TOKEN is unset (header path disabled)", () => {
  const orig = process.env["RD_ADMIN_TOKEN"];
  try {
    delete process.env["RD_ADMIN_TOKEN"];
    assert.strictEqual(hasAdminToken(reqWithToken("anything")), false);
  } finally {
    if (orig !== undefined) process.env["RD_ADMIN_TOKEN"] = orig;
  }
});
