import { test } from "node:test";
import assert from "node:assert/strict";
import { statusLabel, statusTone, TRACKABLE_STATUSES, fetchOrderStatus } from "./orderStatus";

test("statusTone marks every trackable status as live", () => {
  for (const status of TRACKABLE_STATUSES) {
    assert.equal(statusTone(status), "live", `${status} should be live`);
  }
});

test("statusTone marks unsettled terminal statuses as failed", () => {
  assert.equal(statusTone("cancelled"), "failed");
  assert.equal(statusTone("refunded"), "failed");
  assert.equal(statusTone("failed"), "failed");
});

test("statusTone marks delivered as settled", () => {
  assert.equal(statusTone("delivered"), "settled");
});

test("statusTone falls back to settled for an unrecognised status", () => {
  // Fail-safe: an unknown status must not fabricate liveness or alarm.
  assert.equal(statusTone("quantum_superposition"), "settled");
  assert.equal(statusTone(""), "settled");
});

test("statusTone never reports a trackable status as failed", () => {
  // Guards the overlap bug: "failed" tone must never dim a live order.
  for (const status of TRACKABLE_STATUSES) {
    assert.notEqual(statusTone(status), "failed");
  }
});

test("statusLabel passes unknown statuses through rather than guessing", () => {
  assert.equal(statusLabel("delivered"), "Delivered");
  assert.equal(statusLabel("brand_new_state"), "brand_new_state");
});

test("fetchOrderStatus maps 404 to not_found", async () => {
  const fetchImpl = async () => new Response("{}", { status: 404 });
  const result = await fetchOrderStatus("TM-1", "https://api.test", fetchImpl as typeof fetch);
  assert.equal(result.kind, "not_found");
});

test("fetchOrderStatus maps a malformed 200 body to unavailable", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ nonsense: true }), { status: 200 });
  const result = await fetchOrderStatus("TM-1", "https://api.test", fetchImpl as typeof fetch);
  assert.equal(result.kind, "unavailable");
});

test("fetchOrderStatus defaults a missing etaMinutes to 0 rather than NaN", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ orderId: "TM-1", status: "preparing" }), { status: 200 });
  const result = await fetchOrderStatus("TM-1", "https://api.test", fetchImpl as typeof fetch);
  assert.equal(result.kind, "ok");
  if (result.kind === "ok") {
    assert.equal(result.status.timing, "on_demand");
    assert.equal(result.status.etaMinutes, 0);
  }
});

test("fetchOrderStatus surfaces a scheduled delivery's date/window, never a countdown", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        orderId: "sub-1",
        status: "preparing",
        timing: "scheduled",
        etaMinutes: null,
        scheduledFor: "2026-08-13T06:30:00.000Z",
        deliveryWindow: "12:00-14:00",
      }),
      { status: 200 },
    );
  const result = await fetchOrderStatus("sub-1", "https://api.test", fetchImpl as typeof fetch);
  assert.equal(result.kind, "ok");
  if (result.kind === "ok") {
    assert.equal(result.status.timing, "scheduled");
    assert.equal(result.status.etaMinutes, null);
    assert.equal(result.status.scheduledFor, "2026-08-13T06:30:00.000Z");
    assert.equal(result.status.deliveryWindow, "12:00-14:00");
  }
});

test("fetchOrderStatus surfaces a pending schedule as pending, not a fabricated countdown", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({ orderId: "sub-2", status: "placed", timing: "pending", etaMinutes: null }),
      { status: 200 },
    );
  const result = await fetchOrderStatus("sub-2", "https://api.test", fetchImpl as typeof fetch);
  assert.equal(result.kind, "ok");
  if (result.kind === "ok") {
    assert.equal(result.status.timing, "pending");
    assert.equal(result.status.etaMinutes, null);
    assert.equal(result.status.scheduledFor, null);
    assert.equal(result.status.deliveryWindow, null);
  }
});

test("fetchOrderStatus rejects an unrecognised timing value back to on_demand", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({ orderId: "TM-1", status: "preparing", timing: "quantum", etaMinutes: 9 }),
      { status: 200 },
    );
  const result = await fetchOrderStatus("TM-1", "https://api.test", fetchImpl as typeof fetch);
  assert.equal(result.kind, "ok");
  if (result.kind === "ok") {
    assert.equal(result.status.timing, "on_demand");
    assert.equal(result.status.etaMinutes, 9);
  }
});
