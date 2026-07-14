import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isBridgeCreditRedeemable,
  bridgeCreditDiscountPaise,
  BRIDGE_CREDIT_MEALS,
} from "./bridgeCredit";

const now = new Date("2026-07-14T10:00:00Z");
const future = new Date("2026-08-14T10:00:00Z");
const past = new Date("2026-06-14T10:00:00Z");

// ── redeemability gate ───────────────────────────────────────────────────────
test("C2: an unconsumed, unexpired bridge credit is redeemable against a trial", () => {
  assert.equal(
    isBridgeCreditRedeemable(
      { reason: "alacarte_bridge", consumedAt: null, expiresAt: future },
      "trial",
      now,
    ),
    true,
  );
});

test("C2: a bridge credit is NOT redeemable against a standard plan (trial-only)", () => {
  assert.equal(
    isBridgeCreditRedeemable(
      { reason: "alacarte_bridge", consumedAt: null, expiresAt: future },
      "standard",
      now,
    ),
    false,
  );
});

test("C2: a consumed credit cannot be redeemed again", () => {
  assert.equal(
    isBridgeCreditRedeemable(
      { reason: "alacarte_bridge", consumedAt: past, expiresAt: future },
      "trial",
      now,
    ),
    false,
  );
});

test("C2: an expired credit is not redeemable", () => {
  assert.equal(
    isBridgeCreditRedeemable(
      { reason: "alacarte_bridge", consumedAt: null, expiresAt: past },
      "trial",
      now,
    ),
    false,
  );
});

test("C2: a non-bridge credit (e.g. skip) is never redeemed by this path", () => {
  assert.equal(
    isBridgeCreditRedeemable(
      { reason: "skipped_delivery", consumedAt: null, expiresAt: future },
      "trial",
      now,
    ),
    false,
  );
});

// ── discount math ────────────────────────────────────────────────────────────
test("C2: one free meal off a 3-meal ₹1,499 trial ≈ one meal's share (~₹500)", () => {
  // ₹1,499 all-in = 149900 paise; 1 of 3 meals free → round(149900/3) = 49967.
  assert.equal(bridgeCreditDiscountPaise(BRIDGE_CREDIT_MEALS, 3, 149900), 49967);
});

test("C2: the discount can never exceed the trial price", () => {
  assert.equal(bridgeCreditDiscountPaise(5, 3, 149900), 149900);
});

test("C2: no meals / zero-priced trial → no discount", () => {
  assert.equal(bridgeCreditDiscountPaise(0, 3, 149900), 0);
  assert.equal(bridgeCreditDiscountPaise(1, 0, 149900), 0);
});
