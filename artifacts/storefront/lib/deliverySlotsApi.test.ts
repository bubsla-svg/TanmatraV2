import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchDeliverySlots } from "./deliverySlotsApi";

function fetchStub(status: number, body: unknown, seen: { url?: string } = {}) {
  return (async (input: RequestInfo | URL) => {
    seen.url = String(input);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

test("asks the server for the zone's windows and returns the list verbatim", async () => {
  const seen: { url?: string } = {};
  const slots = [{ id: 7, slotDate: "2026-09-04", startsAt: "a", endsAt: "b", zone: "default", capacity: 5, reservedCount: 1, remaining: 4, full: false }];
  const out = await fetchDeliverySlots(undefined, fetchStub(200, { slots }, seen));
  assert.deepEqual(out, slots);
  assert.match(seen.url ?? "", /\/api\/delivery\/slots\?zone=default$/);
});

test("a malformed body yields no windows rather than a crash", async () => {
  const out = await fetchDeliverySlots("default", fetchStub(200, { nope: true }));
  assert.deepEqual(out, []);
});

test("an HTTP failure propagates as an error the picker can fall back on", async () => {
  await assert.rejects(() => fetchDeliverySlots("default", fetchStub(503, { error: "down" })));
});
