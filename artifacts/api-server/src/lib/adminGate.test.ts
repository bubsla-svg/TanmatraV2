import { test } from "node:test";
import assert from "node:assert";
import type { Request } from "express";

// adminGate.ts imports @workspace/db (for the admin_roles lookup), which
// throws at import time without DATABASE_URL. This suite never touches the
// DB — isRoleRequest's DB branch isn't exercised here (mocks pass isAuthenticated
// => false) — so a dummy value just satisfies the module's import-time check.
process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const { safeEqual, hasAdminToken, isRoleRequest } = await import("./adminGate");
const { signAdminToken, ADMIN_COOKIE } = await import("./adminAuth");

function reqWithToken(token: string | undefined): Request {
  return {
    header: (name: string) =>
      name.toLowerCase() === "x-admin-token" ? token : undefined,
    cookies: {},
    isAuthenticated: () => false,
  } as unknown as Request;
}

function reqWithAdminCookie(token: string | undefined): Request {
  return {
    header: () => undefined,
    cookies: token === undefined ? {} : { [ADMIN_COOKIE]: token },
    isAuthenticated: () => false,
  } as unknown as Request;
}

async function withEnv<T>(
  vars: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const orig: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) orig[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    // Must await here, not just `return fn()` — that returns a pending
    // promise while the surrounding try/finally is still synchronous, so
    // `finally` would restore the env vars before an async fn's later
    // `await` points ever run against them.
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(orig)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
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

// There is exactly one admin identity (ADMIN_USERNAME/ADMIN_PASSWORD_HASH),
// and the signed session cookie is the proof that identity logged in via
// /admin/login. It must be treated as owner-equivalent for every role —
// finance (refunds), compliance, owner (AI runs, RD applications) included —
// not just the "operational" subset. Regression for the bug where those
// routes 403'd for the only admin login flow that exists.
test("a valid admin session cookie satisfies a non-operational role (finance/compliance/owner)", async () => {
  await withEnv({ ADMIN_SESSION_SECRET: "a".repeat(32), RD_ADMIN_TOKEN: undefined }, async () => {
    const token = signAdminToken("admin");
    assert.ok(token, "expected signAdminToken to produce a token");
    for (const role of ["finance", "compliance", "owner"]) {
      const result = await isRoleRequest(reqWithAdminCookie(token!), role);
      assert.strictEqual(result.allowed, true, `admin cookie should satisfy role "${role}"`);
      assert.strictEqual(result.operatorId, "admin:admin");
    }
  });
});

test("a valid admin session cookie still satisfies operational roles", async () => {
  await withEnv({ ADMIN_SESSION_SECRET: "a".repeat(32), RD_ADMIN_TOKEN: undefined }, async () => {
    const token = signAdminToken("admin");
    const result = await isRoleRequest(reqWithAdminCookie(token!), "kitchen");
    assert.strictEqual(result.allowed, true);
  });
});

test("the x-admin-token header does NOT satisfy a non-operational role", async () => {
  await withEnv({ RD_ADMIN_TOKEN: "the-shared-admin-token", ADMIN_SESSION_SECRET: undefined }, async () => {
    for (const role of ["finance", "compliance", "owner"]) {
      const result = await isRoleRequest(reqWithToken("the-shared-admin-token"), role);
      assert.strictEqual(result.allowed, false, `x-admin-token must not satisfy role "${role}"`);
    }
  });
});

test("the x-admin-token header still satisfies operational roles", async () => {
  await withEnv({ RD_ADMIN_TOKEN: "the-shared-admin-token", ADMIN_SESSION_SECRET: undefined }, async () => {
    const result = await isRoleRequest(reqWithToken("the-shared-admin-token"), "catalog");
    assert.strictEqual(result.allowed, true);
  });
});

test("no cookie and no token denies access regardless of role", async () => {
  await withEnv({ ADMIN_SESSION_SECRET: "a".repeat(32), RD_ADMIN_TOKEN: undefined }, async () => {
    const result = await isRoleRequest(reqWithAdminCookie(undefined), "owner");
    assert.strictEqual(result.allowed, false);
  });
});
