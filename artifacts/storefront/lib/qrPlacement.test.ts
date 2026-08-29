import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildLandingPath,
  canonicalScanPath,
  GENERIC_LANDING,
  isSafeDestination,
  normalizeQrCode,
  normalizeReferralCode,
} from "./qrPlacement";

test("normalizeQrCode folds the uppercase form the QR actually encodes", () => {
  // The whole reason this function exists: the printed symbol is
  // HTTPS://TANMATRA.FOOD/Q/BOX (QR alphanumeric mode), and URL paths are
  // case-sensitive, so without the fold `BOX` never matches the stored `box`.
  assert.equal(normalizeQrCode("BOX"), "box");
  assert.equal(normalizeQrCode("GYM12"), "gym12");
  assert.equal(normalizeQrCode("  Box  "), "box");
});

test("normalizeQrCode rejects anything that is not a printable short code", () => {
  assert.equal(normalizeQrCode(""), null);
  assert.equal(normalizeQrCode("-leading-dash"), null);
  assert.equal(normalizeQrCode("has space"), null);
  assert.equal(normalizeQrCode("../etc/passwd"), null);
  assert.equal(normalizeQrCode("a".repeat(65)), null);
  assert.equal(normalizeQrCode("a".repeat(64)), "a".repeat(64));
});

test("normalizeReferralCode uppercases and bounds the loyalty code shape", () => {
  assert.equal(normalizeReferralCode("a1b2c3d4"), "A1B2C3D4");
  assert.equal(normalizeReferralCode(" A1B2C3D4 "), "A1B2C3D4");
  assert.equal(normalizeReferralCode("ab"), null);
  assert.equal(normalizeReferralCode("has-dash"), null);
});

test("isSafeDestination rejects the protocol-relative open-redirect shapes", () => {
  // `//evil.example` reads as a path and resolves as a different HOST. This is
  // the failure mode operator-editable destination rows invite.
  assert.equal(isSafeDestination("//evil.example"), false);
  assert.equal(isSafeDestination("/\\evil.example"), false);
  assert.equal(isSafeDestination("https://evil.example"), false);
  assert.equal(isSafeDestination("start"), false);
  assert.equal(isSafeDestination(""), false);
  assert.equal(isSafeDestination("/start"), true);
  assert.equal(isSafeDestination("/start?goal=protein"), true);
});

test("buildLandingPath attaches attribution to the placement's own query", () => {
  assert.equal(
    buildLandingPath("/start?goal=protein", { src: "gym12" }),
    "/start?goal=protein&src=gym12",
  );
  assert.equal(
    buildLandingPath("/start", { src: "box", ref: "a1b2c3d4" }),
    "/start?src=box&ref=A1B2C3D4",
  );
});

test("buildLandingPath falls back to the generic landing for an unsafe destination", () => {
  // Never a 404 and never off-origin: a bad row costs attribution, not the visit.
  assert.equal(buildLandingPath("//evil.example", { src: "box" }), `${GENERIC_LANDING}?src=box`);
  assert.equal(buildLandingPath("", {}), GENERIC_LANDING);
});

test("buildLandingPath overwrites a stale src baked into a destination row", () => {
  // The scan we just resolved outranks a value typed into config months ago.
  assert.equal(buildLandingPath("/start?src=old", { src: "gym12" }), "/start?src=gym12");
  assert.equal(buildLandingPath("/start?src=old", {}), "/start");
});

test("buildLandingPath drops an attribution value that fails validation", () => {
  assert.equal(buildLandingPath("/start", { src: "has space" }), "/start");
  assert.equal(buildLandingPath("/start", { ref: "no" }), "/start");
});

test("canonicalScanPath folds only the two acquisition prefixes", () => {
  assert.equal(canonicalScanPath("/Q/BOX"), "/q/box");
  assert.equal(canonicalScanPath("/R/A1B2C3D4"), "/r/a1b2c3d4");
  assert.equal(canonicalScanPath("/q/box"), null, "already canonical");
  // A case-sensitive id elsewhere in the app must survive untouched — this is
  // why the rule is narrow rather than a blanket toLowerCase().
  assert.equal(canonicalScanPath("/order/confirmed/AbC123"), null);
  assert.equal(canonicalScanPath("/dish/Paneer"), null);
  assert.equal(canonicalScanPath("/"), null);
});

test("canonicalScanPath tolerates a trailing slash and percent escapes", () => {
  assert.equal(canonicalScanPath("/Q/BOX/"), "/q/box");
  assert.equal(canonicalScanPath("/Q/%42OX"), "/q/box");
});
