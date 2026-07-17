import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  resolveRedisTarget,
  isRedisConfigured,
  assertRedisAvailableInProduction,
} from "./queue";

const KEYS = [
  "REDIS_URL",
  "REDIS_HOST",
  "REDIS_PORT",
  "REDIS_PASSWORD",
  "REDIS_USERNAME",
  "REDIS_TLS",
  "NODE_ENV",
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

test("nothing set -> not configured", () => {
  assert.equal(resolveRedisTarget(), null);
  assert.equal(isRedisConfigured(), false);
});

test("valid rediss:// URL -> url target", () => {
  process.env["REDIS_URL"] = "rediss://default:pw@example.com:6380";
  const t = resolveRedisTarget();
  assert.equal(t?.kind, "url");
});

test("bare hostname REDIS_URL (no scheme) -> ignored, null without components", () => {
  process.env["REDIS_URL"] = "redis-17230.example.redislabs.com";
  assert.equal(resolveRedisTarget(), null);
});

test("scheme-only REDIS_URL with empty host -> ignored", () => {
  process.env["REDIS_URL"] = "redis://";
  assert.equal(resolveRedisTarget(), null);
});

test("invalid REDIS_URL + valid components -> options target wins", () => {
  process.env["REDIS_URL"] = "not a url, some pasted table row";
  process.env["REDIS_HOST"] = "example.redislabs.com";
  process.env["REDIS_PORT"] = "17230";
  process.env["REDIS_PASSWORD"] = "pw";
  const t = resolveRedisTarget();
  assert.equal(t?.kind, "options");
  if (t?.kind === "options") {
    assert.equal(t.options.host, "example.redislabs.com");
    assert.equal(t.options.port, 17230);
    assert.equal(t.options.username, "default");
    assert.equal(t.options.password, "pw");
    assert.equal("tls" in t.options, false);
  }
});

test("garbage / out-of-range REDIS_PORT -> not configured", () => {
  process.env["REDIS_HOST"] = "example.com";
  for (const bad of ["notaport", "0", "-5", "70000", "17230.5"]) {
    process.env["REDIS_PORT"] = bad;
    assert.equal(resolveRedisTarget(), null, `port ${bad} should be rejected`);
  }
});

test("missing REDIS_PORT defaults to 6379", () => {
  process.env["REDIS_HOST"] = "example.com";
  const t = resolveRedisTarget();
  assert.equal(t?.kind, "options");
  if (t?.kind === "options") assert.equal(t.options.port, 6379);
});

test("REDIS_TLS=true adds tls options; custom username respected", () => {
  process.env["REDIS_HOST"] = "example.com";
  process.env["REDIS_PASSWORD"] = "pw";
  process.env["REDIS_USERNAME"] = "acl-user";
  process.env["REDIS_TLS"] = "true";
  const t = resolveRedisTarget();
  assert.equal(t?.kind, "options");
  if (t?.kind === "options") {
    assert.deepEqual(t.options.tls, {});
    assert.equal(t.options.username, "acl-user");
  }
});

test("prod assert: throws when nothing configured", () => {
  process.env["NODE_ENV"] = "production";
  assert.throws(() => assertRedisAvailableInProduction(), /Redis must be configured in production/);
});

test("prod assert: throws for remote host without password", () => {
  process.env["NODE_ENV"] = "production";
  process.env["REDIS_HOST"] = "example.redislabs.com";
  assert.throws(() => assertRedisAvailableInProduction(), /unauthenticated remote Redis/);
});

test("prod assert: allows localhost without password", () => {
  process.env["NODE_ENV"] = "production";
  process.env["REDIS_HOST"] = "localhost";
  assert.doesNotThrow(() => assertRedisAvailableInProduction());
});

test("prod assert: allows valid URL config", () => {
  process.env["NODE_ENV"] = "production";
  process.env["REDIS_URL"] = "rediss://default:pw@example.com:6380";
  assert.doesNotThrow(() => assertRedisAvailableInProduction());
});

test("non-production: assert never throws even when unconfigured", () => {
  assert.doesNotThrow(() => assertRedisAvailableInProduction());
});
