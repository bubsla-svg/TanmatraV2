import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeliverySlotBookable } from "./deliverySlotBooking";

const now = new Date("2026-07-14T10:00:00Z");
const future = new Date("2026-07-14T12:00:00Z");
const past = new Date("2026-07-14T08:00:00Z");

test("B2: a future window with spare capacity is bookable", () => {
  assert.equal(
    isDeliverySlotBookable({ endsAt: future, reservedCount: 5, capacity: 25 }, now),
    true,
  );
});

test("B2: an expired window is not bookable (no ASAP into the past)", () => {
  assert.equal(
    isDeliverySlotBookable({ endsAt: past, reservedCount: 0, capacity: 25 }, now),
    false,
  );
});

test("B2: a full window is not bookable (a full slot is unselectable)", () => {
  assert.equal(
    isDeliverySlotBookable({ endsAt: future, reservedCount: 25, capacity: 25 }, now),
    false,
  );
});

test("B2: capacity boundary — one below is bookable, at capacity is not", () => {
  assert.equal(
    isDeliverySlotBookable({ endsAt: future, reservedCount: 24, capacity: 25 }, now),
    true,
  );
  assert.equal(
    isDeliverySlotBookable({ endsAt: future, reservedCount: 25, capacity: 25 }, now),
    false,
  );
});
