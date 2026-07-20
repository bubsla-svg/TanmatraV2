import { test } from "node:test";
import assert from "node:assert";
import {
  encryptClinicalStrings,
  decryptClinicalStrings,
  isEncryptedEnvelope,
} from "./crypto";

// 32-byte (64 hex char) test key, passed explicitly so these tests need no
// CLINICAL_KMS_MASTER_KEY env var and no database.
const KEY =
  "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

test("encrypt → decrypt round-trips array values", () => {
  const plain = ["diabetes", "hypertension", "CKD Stage 3"];
  const encrypted = encryptClinicalStrings(plain, KEY);
  assert.strictEqual(encrypted.length, 3);
  for (const el of encrypted) {
    assert.ok(isEncryptedEnvelope(el), "each element must be an envelope");
    assert.ok(!plain.includes(el), "ciphertext must not equal plaintext");
  }
  assert.deepStrictEqual(decryptClinicalStrings(encrypted, KEY), plain);
});

test("decrypt passes through legacy plaintext elements unchanged", () => {
  // Simulates a not-yet-backfilled row.
  const legacy = ["peanuts", "shellfish"];
  assert.deepStrictEqual(decryptClinicalStrings(legacy, KEY), legacy);
});

test("decrypt handles a mix of encrypted and plaintext elements", () => {
  const encrypted = encryptClinicalStrings(["gerd"], KEY);
  const mixed = [...encrypted, "celiac"]; // one envelope + one legacy plaintext
  assert.deepStrictEqual(decryptClinicalStrings(mixed, KEY), ["gerd", "celiac"]);
});

test("encrypt is idempotent — already-encrypted elements are not re-wrapped", () => {
  const once = encryptClinicalStrings(["pregnancy"], KEY);
  const twice = encryptClinicalStrings(once, KEY);
  assert.deepStrictEqual(twice, once);
  assert.deepStrictEqual(decryptClinicalStrings(twice, KEY), ["pregnancy"]);
});

test("null / undefined / empty arrays normalize to []", () => {
  assert.deepStrictEqual(encryptClinicalStrings(null, KEY), []);
  assert.deepStrictEqual(encryptClinicalStrings(undefined, KEY), []);
  assert.deepStrictEqual(encryptClinicalStrings([], KEY), []);
  assert.deepStrictEqual(decryptClinicalStrings(null, KEY), []);
  assert.deepStrictEqual(decryptClinicalStrings(undefined, KEY), []);
  assert.deepStrictEqual(decryptClinicalStrings([], KEY), []);
});

test("empty-string values encrypt and round-trip", () => {
  const encrypted = encryptClinicalStrings([""], KEY);
  assert.ok(isEncryptedEnvelope(encrypted[0]!));
  assert.deepStrictEqual(decryptClinicalStrings(encrypted, KEY), [""]);
});

test("isEncryptedEnvelope rejects plaintext and malformed input", () => {
  assert.strictEqual(isEncryptedEnvelope("diabetes"), false);
  assert.strictEqual(isEncryptedEnvelope(""), false);
  assert.strictEqual(isEncryptedEnvelope("{not json"), false);
  assert.strictEqual(isEncryptedEnvelope('{"foo":"bar"}'), false);
  assert.strictEqual(
    isEncryptedEnvelope(encryptClinicalStrings(["x"], KEY)[0]!),
    true,
  );
});

test("decrypt with the wrong key throws (tamper/again-safety)", () => {
  const encrypted = encryptClinicalStrings(["diabetes"], KEY);
  const wrongKey =
    "9999999999999999999999999999999999999999999999999999999999999999";
  assert.throws(() => decryptClinicalStrings(encrypted, wrongKey), /Decryption failed/i);
});
