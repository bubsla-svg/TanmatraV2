/**
 * Pure guards on the scan-resolution path, unit-tested without a database.
 *
 * Deliberately a separate file from a route-level test: `normalizeQrCode` and
 * `isSafeDestination` are the two functions that decide, respectively, whether a
 * printed poster resolves at all and whether a placement row can send a visitor
 * off-origin. Both are worth locking on their own, and both are answerable with
 * no Postgres in the loop.
 *
 * Run: node --test --import tsx ./src/routes/qr.pure.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

process.env["DATABASE_URL"] ||= "postgres://postgres:postgres@127.0.0.1:5432/tanmatra_test";

const { normalizeQrCode, isSafeDestination, GENERIC_LANDING } = await import("./qr");

test("normalizeQrCode folds the uppercase form a QR symbol actually encodes", () => {
  // The printed code is HTTPS://TANMATRA.FOOD/Q/BOX — uppercase, because that
  // is what QR alphanumeric mode can pack into a lower-density symbol. URL
  // paths are case-sensitive, so this fold is what makes the poster resolve.
  assert.equal(normalizeQrCode("BOX"), "box");
  assert.equal(normalizeQrCode(" Gym12 "), "gym12");
});

test("normalizeQrCode rejects anything outside the printable short-code shape", () => {
  assert.equal(normalizeQrCode(""), null);
  assert.equal(normalizeQrCode("has space"), null);
  assert.equal(normalizeQrCode("../etc/passwd"), null);
  assert.equal(normalizeQrCode("-leading"), null);
  assert.equal(normalizeQrCode("a".repeat(65)), null);
});

test("isSafeDestination refuses the protocol-relative open-redirect shapes", () => {
  // `qr_placements.destination` is an operator-editable column, which is
  // exactly where an open redirect gets introduced by accident.
  assert.equal(isSafeDestination("//evil.example"), false);
  assert.equal(isSafeDestination("/\\evil.example"), false);
  assert.equal(isSafeDestination("https://evil.example"), false);
  assert.equal(isSafeDestination("start"), false);
  assert.equal(isSafeDestination("/start"), true);
  assert.equal(isSafeDestination("/start?goal=protein"), true);
});

test("the generic landing is a path this server would itself accept", () => {
  // Guards the fallback against a future edit that makes it unroutable — the
  // one destination that must always work is the one used when nothing else did.
  assert.equal(isSafeDestination(GENERIC_LANDING), true);
});
