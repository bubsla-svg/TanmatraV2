/**
 * Unit tests for storefront serviceabilityApi client and storage transitions (OB-2 / II.1).
 *
 * Run: node --test --import tsx ./lib/serviceabilityApi.test.ts
 */
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  checkServiceability,
  submitServiceabilityInterest,
  loadServiceabilityState,
  saveServiceabilityState,
  clearServiceabilityState,
  serviceabilityCookies,
  cityForPincode,
  SERVICEABILITY_EVENT,
  type ServiceabilityState,
} from "./serviceabilityApi";
import { ApiError } from "./apiClient";

const fakeStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => fakeStorage.get(key) ?? null,
  setItem: (key: string, val: string) => fakeStorage.set(key, val),
  removeItem: (key: string) => fakeStorage.delete(key),
};

const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;

beforeEach(() => {
  fakeStorage.clear();
  // @ts-expect-error test shim
  globalThis.window = {};
  // @ts-expect-error test shim
  globalThis.localStorage = mockLocalStorage;
});

afterEach(() => {
  if (originalWindow !== undefined) globalThis.window = originalWindow;
  else delete (globalThis as unknown as { window?: unknown }).window;

  if (originalLocalStorage !== undefined) globalThis.localStorage = originalLocalStorage;
  else delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
});

test("checkServiceability: wire tests resolve serviceable and unserviceable contracts", async () => {
  const serviceableFetch = (async () => ({
    ok: true,
    text: async () => JSON.stringify({ serviceable: true }),
  })) as unknown as typeof fetch;

  const resServ = await checkServiceability("201301", serviceableFetch);
  assert.deepEqual(resServ, { verdict: "serviceable", pincode: "201301" });

  const unserviceableFetch = (async () => ({
    ok: true,
    text: async () => JSON.stringify({ serviceable: false, code: "unserviceable_pincode" }),
  })) as unknown as typeof fetch;

  const resUnserv = await checkServiceability("999999", unserviceableFetch);
  assert.deepEqual(resUnserv, { verdict: "unserviceable", pincode: "999999" });
});

test("checkServiceability: 400 invalid pincode path rejects before fetch or propagates ApiError", async () => {
  await assert.rejects(() => checkServiceability("20130"), /Pincode must be exactly 6 digits/);
  await assert.rejects(() => checkServiceability("20130a"), /Pincode must be exactly 6 digits/);

  const errorFetch = (async () => ({
    ok: false,
    status: 400,
    statusText: "Bad Request",
    text: async () => JSON.stringify({ error: "invalid pincode format" }),
  })) as unknown as typeof fetch;

  await assert.rejects(() => checkServiceability("000000", errorFetch), ApiError);
});

test("state machine transitions: unknown → serviceable → change-pincode → unserviceable", () => {
  // initial read is unknown
  const initial = loadServiceabilityState();
  assert.deepEqual(initial, { verdict: "unknown", pincode: "" });

  // user submits serviceable pincode
  const servState: ServiceabilityState = { verdict: "serviceable", pincode: "201301" };
  saveServiceabilityState(servState);
  assert.deepEqual(loadServiceabilityState(), servState);

  // user taps to change pincode (cleared to unknown)
  clearServiceabilityState();
  assert.deepEqual(loadServiceabilityState(), { verdict: "unknown", pincode: "" });

  // user enters unserviceable pincode
  const unservState: ServiceabilityState = { verdict: "unserviceable", pincode: "999999" };
  saveServiceabilityState(unservState);
  assert.deepEqual(loadServiceabilityState(), unservState);
});

test("loadServiceabilityState degrades safely without window or storage (SSR safe)", () => {
  delete (globalThis as unknown as { window?: unknown }).window;
  const ssrState = loadServiceabilityState();
  assert.deepEqual(ssrState, { verdict: "unknown", pincode: "" });
});

test("submitServiceabilityInterest posts pincode and phone to server and returns result", async () => {
  const successFetch = (async (_url: string, opts: RequestInit) => {
    assert.equal(opts.method, "POST");
    assert.deepEqual(JSON.parse(opts.body as string), { pincode: "999888", phone: "9876543210" });
    return {
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    };
  }) as unknown as typeof fetch;

  const res = await submitServiceabilityInterest("999888 ", " 9876543210 ", successFetch);
  assert.deepEqual(res, { ok: true });

  const duplicateFetch = (async () => ({
    ok: true,
    text: async () => JSON.stringify({ ok: true, duplicate: true }),
  })) as unknown as typeof fetch;

  const resDup = await submitServiceabilityInterest("999888", "9876543210", duplicateFetch);
  assert.deepEqual(resDup, { ok: true, duplicate: true });
});


test("T5: a verdict is mirrored into the tnm_pin / tnm_pin_ok cookies; unknown expires both", () => {
  assert.deepEqual(serviceabilityCookies({ verdict: "serviceable", pincode: "201301" }), [
    "tnm_pin=201301; path=/; samesite=lax; max-age=31536000",
    "tnm_pin_ok=1; path=/; samesite=lax; max-age=31536000",
  ]);
  assert.equal(serviceabilityCookies({ verdict: "unserviceable", pincode: "110001" })[1], "tnm_pin_ok=0; path=/; samesite=lax; max-age=31536000");
  for (const c of serviceabilityCookies({ verdict: "unknown", pincode: "" })) assert.match(c, /max-age=0$/);
  // A malformed PIN never becomes a cookie value.
  for (const c of serviceabilityCookies({ verdict: "serviceable", pincode: "20130" })) assert.match(c, /max-age=0$/);
});

test("T5: save broadcasts the state to every island; clear broadcasts unknown", () => {
  const seen: ServiceabilityState[] = [];
  const g = globalThis as unknown as { window: Record<string, unknown>; CustomEvent?: unknown };
  const prevCustomEvent = g.CustomEvent;
  g.CustomEvent = class { type: string; detail: unknown; constructor(type: string, init: { detail: unknown }) { this.type = type; this.detail = init.detail; } };
  g.window = { dispatchEvent: (e: { type: string; detail: ServiceabilityState }) => { if (e.type === SERVICEABILITY_EVENT) seen.push(e.detail); return true; } };
  try {
    saveServiceabilityState({ verdict: "serviceable", pincode: "201301" });
    clearServiceabilityState();
  } finally {
    if (prevCustomEvent === undefined) delete g.CustomEvent; else g.CustomEvent = prevCustomEvent;
  }
  assert.deepEqual(seen, [
    { verdict: "serviceable", pincode: "201301" },
    { verdict: "unknown", pincode: "" },
  ]);
});

test("T5: cityForPincode names the NCR city for a PIN and nothing for anywhere else", () => {
  assert.equal(cityForPincode("201301"), "Noida");
  assert.equal(cityForPincode("201306"), "Noida");
  assert.equal(cityForPincode("201009"), "Ghaziabad");
  assert.equal(cityForPincode("110001"), "Delhi");
  assert.equal(cityForPincode("122002"), "Gurugram");
  assert.equal(cityForPincode("400001"), null, "not the NCR → no guess");
  assert.equal(cityForPincode("2013"), null);
});
