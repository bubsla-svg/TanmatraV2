/**
 * Unit tests for storefront serviceabilityApi client and storage transitions (OB-2 / II.1).
 *
 * Run: node --test --import tsx ./lib/serviceabilityApi.test.ts
 */
import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  checkServiceability,
  loadServiceabilityState,
  saveServiceabilityState,
  clearServiceabilityState,
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
