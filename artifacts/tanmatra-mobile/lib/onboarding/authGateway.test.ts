/**
 * node --test --import tsx ./lib/onboarding/authGateway.test.ts
 */
import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import {
  sendOtp,
  verifyOtp,
  resolveAuthMode,
  AuthError,
  AuthNotWiredError,
  type FetchImpl,
} from "./authGateway";

const API = "https://api.example.test/api";

function stubFetch(
  res: Response,
  capture?: { url?: string; init?: RequestInit },
): FetchImpl {
  return (async (url: unknown, init?: RequestInit) => {
    if (capture) {
      capture.url = String(url);
      capture.init = init;
    }
    return res;
  }) as unknown as FetchImpl;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const savedMode = process.env["EXPO_PUBLIC_AUTH_MODE"];
afterEach(() => {
  if (savedMode === undefined) delete process.env["EXPO_PUBLIC_AUTH_MODE"];
  else process.env["EXPO_PUBLIC_AUTH_MODE"] = savedMode;
});

test("sendOtp posts to the real endpoint and returns devCode when present", async () => {
  const cap: { url?: string; init?: RequestInit } = {};
  const res = await sendOtp(
    { countryCode: "+91", phone: "9876543210" },
    {
      apiBase: API,
      fetchImpl: stubFetch(json(200, { ok: true, devCode: "123456" }), cap),
    },
  );
  assert.equal(res.ok, true);
  assert.equal(res.devCode, "123456");
  assert.equal(cap.url, `${API}/auth/phone/send-otp`);
  assert.equal(cap.init?.method, "POST");
  assert.match(String(cap.init?.body), /9876543210/);
});

test("sendOtp maps 429 to a rate_limited AuthError", async () => {
  await assert.rejects(
    () =>
      sendOtp(
        { countryCode: "+91", phone: "9876543210" },
        { apiBase: API, fetchImpl: stubFetch(json(429, {})) },
      ),
    (e: unknown) => e instanceof AuthError && e.code === "rate_limited",
  );
});

test("sendOtp maps a non-2xx to send_failed", async () => {
  await assert.rejects(
    () =>
      sendOtp(
        { countryCode: "+91", phone: "9876543210" },
        { apiBase: API, fetchImpl: stubFetch(json(400, {})) },
      ),
    (e: unknown) => e instanceof AuthError && e.code === "send_failed",
  );
});

test("sendOtp maps a network throw to a network AuthError", async () => {
  const boom = (async () => {
    throw new Error("offline");
  }) as unknown as FetchImpl;
  await assert.rejects(
    () =>
      sendOtp(
        { countryCode: "+91", phone: "9876543210" },
        { apiBase: API, fetchImpl: boom },
      ),
    (e: unknown) => e instanceof AuthError && e.code === "network",
  );
});

test("verifyOtp in live mode fails loud (never fabricates a session)", async () => {
  await assert.rejects(
    () =>
      verifyOtp(
        { countryCode: "+91", phone: "9876543210", code: "123456" },
        { apiBase: API, mode: "live" },
      ),
    (e: unknown) => e instanceof AuthNotWiredError,
  );
});

test("verifyOtp in mock mode accepts the mock code, flagged pendingRealAuth", async () => {
  const r = await verifyOtp(
    { countryCode: "+91", phone: "9876543210", code: "123456" },
    { apiBase: API, mode: "mock" },
  );
  assert.equal(r.ok, true);
  assert.equal(r.pendingRealAuth, true);
});

test("verifyOtp in mock mode rejects a wrong code", async () => {
  await assert.rejects(
    () =>
      verifyOtp(
        { countryCode: "+91", phone: "9876543210", code: "000000" },
        { apiBase: API, mode: "mock" },
      ),
    (e: unknown) => e instanceof AuthError && e.code === "bad_code",
  );
});

test("resolveAuthMode defaults to live and honours the mock env flag", () => {
  delete process.env["EXPO_PUBLIC_AUTH_MODE"];
  assert.equal(resolveAuthMode(), "live");
  process.env["EXPO_PUBLIC_AUTH_MODE"] = "mock";
  assert.equal(resolveAuthMode(), "mock");
  assert.equal(resolveAuthMode("live"), "live"); // explicit wins
});
