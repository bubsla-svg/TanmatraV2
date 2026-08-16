/**
 * Guest-order claim authority (plan item 2.4).
 *
 * A claim moves ownership of a paid order, and the order id that selects it
 * arrives in a URL. Every case below is therefore an authorisation case, not a
 * formatting one — the refusals matter more than the success.
 *
 * Run: node --test --import tsx ./src/lib/orderClaim.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { claimStatus, claimVerdict } from "./orderClaim";

const CALLER = { userId: "user-1", phoneE164: "+919876543210" };

test("a guest order whose phone matches the verified session is claimable", () => {
  assert.equal(claimVerdict({ userId: null, phone: "9876543210" }, CALLER), "claimable");
});

test("the two numbers are compared in one canonical form, not as typed", () => {
  // The order carries whatever the buyer typed into a text input; the session
  // carries what the OTP flow stored. They are never the same string.
  for (const typed of ["9876543210", "98765 43210", "+91 98765-43210", "09876543210", "919876543210"]) {
    assert.equal(claimVerdict({ userId: null, phone: typed }, CALLER), "claimable", typed);
  }
});

test("a different number is refused — this is the whole authorisation", () => {
  // Without this the endpoint is an IDOR: an order id in a URL would be enough
  // to pull a stranger's order, address and total into your own history.
  assert.equal(claimVerdict({ userId: null, phone: "9000000001" }, CALLER), "phone_mismatch");
});

test("an order already owned by someone else is never claimable", () => {
  assert.equal(claimVerdict({ userId: "user-2", phone: "9876543210" }, CALLER), "owned_by_other");
});

test("ownership is checked before the phone, so a shared number cannot take an owned order", () => {
  // Two people on one household number is ordinary. The second must not be
  // able to pull the first's order out of their history.
  assert.equal(
    claimVerdict({ userId: "user-2", phone: "+919876543210" }, CALLER),
    "owned_by_other",
  );
});

test("re-claiming your own order succeeds instead of erroring", () => {
  // The confirmation island claims on mount and the customer can refresh it.
  const v = claimVerdict({ userId: "user-1", phone: "9876543210" }, CALLER);
  assert.equal(v, "already_yours");
  assert.equal(claimStatus(v), 200);
});

test("two unknown phones do not match each other into a transfer of ownership", () => {
  // normalizeE164 returns "" for anything unreadable. A bare equality check
  // would make "" === "" true and hand an order with no contact number to an
  // account with no verified number — the sharpest failure this module has.
  const noPhoneOrder = { userId: null, phone: null };
  const noPhoneCaller = { userId: "user-1", phoneE164: null };
  assert.notEqual(claimVerdict(noPhoneOrder, noPhoneCaller), "claimable");
  assert.equal(claimVerdict(noPhoneOrder, noPhoneCaller), "unprovable");

  for (const junk of ["", "  ", "123", "-", "n/a"]) {
    assert.notEqual(
      claimVerdict({ userId: null, phone: junk }, { userId: "user-1", phoneE164: junk }),
      "claimable",
      junk,
    );
  }
});

test("a caller with no verified number claims nothing", () => {
  assert.equal(
    claimVerdict({ userId: null, phone: "9876543210" }, { userId: "user-1", phoneE164: null }),
    "phone_mismatch",
  );
});

const REFUSALS = ["owned_by_other", "unprovable", "phone_mismatch", "unknown_order"] as const;

test("every refusal is the same status code", () => {
  // A 404-vs-403 split would answer "does this order exist" and "is it still
  // unclaimed" from the status line alone — reconnaissance for the attack the
  // phone check stops, and free to script. The body distinguishes them for the
  // real customer; the status code says only "no".
  for (const v of REFUSALS) assert.equal(claimStatus(v), 403, v);
  assert.equal(claimStatus("claimable"), 200);
  assert.equal(claimStatus("already_yours"), 200);
});

test("a verdict is a machine code, never a sentence", () => {
  // The storefront writes the copy (lib/claimOrder.ts). If a polished sentence
  // ever appears here it means the copy has two homes and one of them will
  // drift from the screen — Architecture Invariant 18.
  for (const v of [...REFUSALS, "claimable", "already_yours"] as const) {
    assert.match(v, /^[a-z_]+$/, `${v} reads like copy, not a code`);
  }
});
