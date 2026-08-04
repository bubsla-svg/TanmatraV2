/**
 * Active-address serviceability derivation. Pure — no DOM, no network.
 * Run: node --test --import tsx ./lib/addressServiceability.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  isCheckablePincode,
  deriveDeliveryState,
  mirroredVerdict,
  type DeliveryStateInput,
} from "./addressServiceability";

function input(over: Partial<DeliveryStateInput> = {}): DeliveryStateInput {
  return { pincode: "201301", isPending: false, isError: false, verdict: undefined, ...over };
}

test("isCheckablePincode accepts exactly six digits, trimmed", () => {
  assert.equal(isCheckablePincode("201301"), true);
  assert.equal(isCheckablePincode("  201301  "), true);
  assert.equal(isCheckablePincode("20130"), false);
  assert.equal(isCheckablePincode("2013011"), false);
  assert.equal(isCheckablePincode("20130a"), false);
  assert.equal(isCheckablePincode(""), false);
});

test("a serviceable verdict is deliverable, carrying the trimmed pincode", () => {
  const s = deriveDeliveryState(input({ pincode: " 201301 ", verdict: "serviceable" }));
  assert.deepEqual(s, { kind: "deliverable", pincode: "201301" });
});

test("an unserviceable verdict is undeliverable", () => {
  const s = deriveDeliveryState(input({ pincode: "400001", verdict: "unserviceable" }));
  assert.deepEqual(s, { kind: "undeliverable", pincode: "400001" });
});

test("in flight is checking, not a verdict", () => {
  assert.deepEqual(deriveDeliveryState(input({ isPending: true })), { kind: "checking" });
});

/**
 * THE REGRESSION THIS FILE EXISTS FOR. A transport failure must never render
 * as "we don't deliver to you" — that is a false claim to a customer we can
 * in fact serve, and it costs the order.
 */
test("a failed check is indeterminate, NEVER undeliverable", () => {
  const s = deriveDeliveryState(input({ isError: true }));
  assert.deepEqual(s, { kind: "indeterminate" });
  assert.notEqual(s.kind, "undeliverable");
});

test("an errored check stays indeterminate even while pending is also set", () => {
  // React Query can report both during a background refetch of a failed query.
  const s = deriveDeliveryState(input({ isError: true, isPending: true }));
  assert.deepEqual(s, { kind: "indeterminate" });
});

/**
 * The disabled-query trap: a query gated off by `enabled` reports
 * `isPending: true` forever. If the pincode guard did not run first, an
 * address with a malformed pincode would park the bar on a spinner that
 * never resolves.
 */
test("an uncheckable pincode is indeterminate even though the query reports pending", () => {
  assert.deepEqual(deriveDeliveryState(input({ pincode: "", isPending: true })), {
    kind: "indeterminate",
  });
  assert.deepEqual(deriveDeliveryState(input({ pincode: "abc", isPending: true })), {
    kind: "indeterminate",
  });
  assert.deepEqual(deriveDeliveryState(input({ pincode: "2013", isPending: true })), {
    kind: "indeterminate",
  });
});

test("an uncheckable pincode is indeterminate even if a stale verdict is present", () => {
  // Guards against a verdict cached under the PREVIOUS address leaking onto a
  // new one whose pincode we cannot check.
  assert.deepEqual(deriveDeliveryState(input({ pincode: "", verdict: "unserviceable" })), {
    kind: "indeterminate",
  });
});

test("a settled query with an unknown verdict claims nothing", () => {
  assert.deepEqual(deriveDeliveryState(input({ verdict: "unknown" })), { kind: "indeterminate" });
  assert.deepEqual(deriveDeliveryState(input({ verdict: undefined })), { kind: "indeterminate" });
});

test("mirroredVerdict mirrors only definitive states", () => {
  assert.deepEqual(mirroredVerdict({ kind: "deliverable", pincode: "201301" }), {
    verdict: "serviceable",
    pincode: "201301",
  });
  assert.deepEqual(mirroredVerdict({ kind: "undeliverable", pincode: "400001" }), {
    verdict: "unserviceable",
    pincode: "400001",
  });
  assert.equal(mirroredVerdict({ kind: "checking" }), null);
  assert.equal(mirroredVerdict({ kind: "indeterminate" }), null);
});

/**
 * End-to-end over the switch the bar actually performs: Home (serviceable) →
 * Work (unserviceable). The verdict must follow the address, and the mirror
 * must follow the verdict — the stale-verdict bug in one assertion.
 */
test("switching address flips both the state and the mirrored verdict", () => {
  const home = deriveDeliveryState(input({ pincode: "201301", verdict: "serviceable" }));
  const work = deriveDeliveryState(input({ pincode: "400001", verdict: "unserviceable" }));
  assert.equal(home.kind, "deliverable");
  assert.equal(work.kind, "undeliverable");
  assert.deepEqual(mirroredVerdict(home), { verdict: "serviceable", pincode: "201301" });
  assert.deepEqual(mirroredVerdict(work), { verdict: "unserviceable", pincode: "400001" });
});
