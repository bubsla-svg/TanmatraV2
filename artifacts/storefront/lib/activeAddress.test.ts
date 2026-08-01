/**
 * Active-address selection. Pure — no DOM, no network.
 * Run: node --test --import tsx ./lib/activeAddress.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { pickActiveAddress, formatDeliveryLabel } from "./activeAddress";
import type { Address } from "./api";

function addr(over: Partial<Address>): Address {
  return {
    id: "1",
    label: "Home",
    type: "home",
    line1: "A-1",
    line2: "Sector 54",
    city: "Noida",
    pincode: "201301",
    phone: "9800000000",
    isDefault: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

test("pickActiveAddress: no addresses yields null", () => {
  assert.equal(pickActiveAddress([], null), null);
  assert.equal(pickActiveAddress([], "7"), null);
});

test("pickActiveAddress: the remembered address wins over the server default", () => {
  const list = [addr({ id: "1", isDefault: true }), addr({ id: "2", label: "Work" })];
  assert.equal(pickActiveAddress(list, "2")?.id, "2");
});

/**
 * The case that matters: addresses are deletable from /account/addresses and
 * on other devices, so a stored id routinely outlives its row. Honouring it
 * blindly leaves the bar blank or — worse — naming an address that is gone.
 */
test("pickActiveAddress: a remembered id that no longer exists falls back to the default", () => {
  const list = [addr({ id: "1" }), addr({ id: "2", isDefault: true })];
  assert.equal(pickActiveAddress(list, "deleted-99")?.id, "2");
});

test("pickActiveAddress: with no remembered id, the server default wins", () => {
  const list = [addr({ id: "1" }), addr({ id: "2", isDefault: true })];
  assert.equal(pickActiveAddress(list, null)?.id, "2");
});

test("pickActiveAddress: with no default at all, the first row is used", () => {
  const list = [addr({ id: "5" }), addr({ id: "6" })];
  assert.equal(pickActiveAddress(list, null)?.id, "5");
});

test("pickActiveAddress: two rows flagged default resolve deterministically to the first", () => {
  // Nothing in the schema prevents this, so it must not be order-of-query luck.
  const list = [addr({ id: "3", isDefault: true }), addr({ id: "4", isDefault: true })];
  assert.equal(pickActiveAddress(list, null)?.id, "3");
  assert.equal(pickActiveAddress([...list].reverse(), null)?.id, "4");
});

/* ───────────────────────────── display label ─────────────────────────────── */

test("formatDeliveryLabel: prefers line2 — the sector is what distinguishes addresses", () => {
  assert.equal(
    formatDeliveryLabel(addr({ label: "Home", line2: "Sector 54", city: "Noida" })),
    "Home (Sector 54)",
  );
});

test("formatDeliveryLabel: falls back to city when line2 is empty or blank", () => {
  assert.equal(formatDeliveryLabel(addr({ label: "Work", line2: "", city: "Noida" })), "Work (Noida)");
  assert.equal(
    formatDeliveryLabel(addr({ label: "Work", line2: "   ", city: "Noida" })),
    "Work (Noida)",
    "whitespace-only line2 must not produce 'Work (   )'",
  );
});

test("formatDeliveryLabel: with no locality hint, renders the label alone — never an empty bracket", () => {
  assert.equal(formatDeliveryLabel(addr({ label: "Home", line2: "", city: "" })), "Home");
});
