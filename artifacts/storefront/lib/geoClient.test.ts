/**
 * Unit test suite for geoClient location helpers and contract.
 *
 * Run: node --test --import tsx ./lib/geoClient.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { reverseGeocode, searchLocation, DEFAULT_MAP_CENTER } from "./geoClient";

test("reverseGeocode formats coords cleanly and resolves place", async () => {
  const fakeFetch = async (url: RequestInfo | URL) => {
    const s = String(url);
    assert.match(s, /\/api\/geo\/reverse\?lat=28\.570800&lng=77\.326000/);
    return {
      ok: true,
      text: async () =>
        JSON.stringify({ ok: true, formattedAddress: "Sector 18, Noida", city: "Noida", pincode: "201301" }),
    } as unknown as Response;
  };

  const res = await reverseGeocode(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng, fakeFetch);
  assert.ok(res);
  assert.equal(res?.pincode, "201301");
  assert.equal(res?.city, "Noida");
  assert.equal(res?.formattedAddress, "Sector 18, Noida");
});

test("reverseGeocode returns null when network throws or coordinates invalid", async () => {
  const failingFetch = async () => {
    throw new Error("Network offline");
  };
  const res1 = await reverseGeocode(28.57, 77.32, failingFetch);
  assert.equal(res1, null);

  const res2 = await reverseGeocode(NaN, 77.32, failingFetch);
  assert.equal(res2, null);
});

test("searchLocation skips queries shorter than 3 characters", async () => {
  let called = false;
  const spyFetch = async () => {
    called = true;
    return { ok: true, text: async () => JSON.stringify({ ok: true, results: [] }) } as unknown as Response;
  };
  const res = await searchLocation("ab", spyFetch);
  assert.equal(called, false);
  assert.deepEqual(res, []);
});

test("searchLocation calls /api/geo/search and returns candidate list", async () => {
  const fakeFetch = async (url: RequestInfo | URL) => {
    assert.match(String(url), /\/api\/geo\/search\?q=gurugram/);
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          ok: true,
          results: [{ formattedAddress: "DLF Phase 3, Sector 24, Gurugram", city: "Gurugram", pincode: "122002" }],
        }),
    } as unknown as Response;
  };
  const res = await searchLocation(" gurugram ", fakeFetch);
  assert.equal(res.length, 1);
  assert.equal(res[0]?.city, "Gurugram");
});
