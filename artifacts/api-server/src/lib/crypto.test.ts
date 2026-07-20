import { test } from "node:test";
import assert from "node:assert";
import {
  encryptClinicalStrings,
  decryptClinicalStrings,
  isEncryptedEnvelope,
  encryptPreferencesPatch,
  decryptPreferencesRow,
  type ClinicalPreferenceArrays,
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

// ---------------------------------------------------------------------------
// Consumer user_preferences row seam (encryptPreferencesPatch /
// decryptPreferencesRow) — the write→read round trip used by the
// /preferences routes and every server-side reader.
// ---------------------------------------------------------------------------

test("preferences patch write → row read round-trips all three clinical arrays", () => {
  // Arrange: what the PUT /preferences handler stores.
  const stored = encryptPreferencesPatch(
    {
      allergens: ["peanuts", "shellfish"],
      dislikedIngredients: ["okra"],
      medicalConditions: ["diabetes", "gerd"],
    },
    KEY,
  );

  // At rest: every clinical element is an envelope, never plaintext.
  for (const arr of [
    stored.allergens,
    stored.dislikedIngredients,
    stored.medicalConditions,
  ]) {
    for (const el of arr ?? []) {
      assert.ok(isEncryptedEnvelope(el), `must be encrypted at rest: ${el}`);
    }
  }

  // Act: what a reader gets back from a full-row select.
  const row = {
    userId: "user-1",
    ...stored,
    cuisines: ["indian"],
    dietaryStyle: "omnivore",
    hba1cPct: 7.2,
    pcosHistory: true,
  };
  const read = decryptPreferencesRow(row, KEY);

  // Assert: clinical arrays are plaintext again; nothing else changed.
  assert.deepStrictEqual(read.allergens, ["peanuts", "shellfish"]);
  assert.deepStrictEqual(read.dislikedIngredients, ["okra"]);
  assert.deepStrictEqual(read.medicalConditions, ["diabetes", "gerd"]);
  assert.deepStrictEqual(read.cuisines, ["indian"]);
  assert.strictEqual(read.dietaryStyle, "omnivore");
  assert.strictEqual(read.hba1cPct, 7.2);
  assert.strictEqual(read.pcosHistory, true);
  assert.strictEqual(read.userId, "user-1");
});

test("decryptPreferencesRow returns null for null/undefined rows", () => {
  assert.strictEqual(decryptPreferencesRow(null, KEY), null);
  assert.strictEqual(decryptPreferencesRow(undefined, KEY), null);
});

test("decryptPreferencesRow passes through a legacy plaintext row unchanged (pre-backfill)", () => {
  const legacy = {
    allergens: ["dairy"],
    dislikedIngredients: [],
    medicalConditions: ["gerd"],
  };
  const read = decryptPreferencesRow(legacy, KEY);
  assert.deepStrictEqual(read, legacy);
  assert.notStrictEqual(read, legacy, "must return a copy, not the input");
});

test("decryptPreferencesRow does not mutate its input row", () => {
  const stored = encryptPreferencesPatch({ medicalConditions: ["pcos"] }, KEY);
  const row = { medicalConditions: [...(stored.medicalConditions ?? [])] };
  const frozen = JSON.stringify(row);
  decryptPreferencesRow(row, KEY);
  assert.strictEqual(JSON.stringify(row), frozen, "input row must be untouched");
});

test("decryptPreferencesRow handles partial selects (single clinical column)", () => {
  const [envelope] = encryptClinicalStrings(["diabetes"], KEY);
  const partial = { medicalConditions: [envelope!, "celiac"] }; // mixed mid-rollout
  const read = decryptPreferencesRow(partial, KEY);
  assert.deepStrictEqual(read.medicalConditions, ["diabetes", "celiac"]);
  assert.ok(!("allergens" in read), "absent fields must stay absent");
});

test("encryptPreferencesPatch keeps absent fields absent (PATCH semantics)", () => {
  const patch = encryptPreferencesPatch<ClinicalPreferenceArrays>(
    { medicalConditions: ["pcos"] },
    KEY,
  );
  assert.strictEqual(patch.allergens, undefined);
  assert.strictEqual(patch.dislikedIngredients, undefined);
  assert.ok(isEncryptedEnvelope(patch.medicalConditions![0]!));
});

test("encryptPreferencesPatch is idempotent and does not mutate its input", () => {
  const input = { allergens: ["soy"] };
  const frozen = JSON.stringify(input);
  const once = encryptPreferencesPatch(input, KEY);
  const twice = encryptPreferencesPatch(once, KEY);
  assert.deepStrictEqual(twice.allergens, once.allergens, "no double-wrap");
  assert.strictEqual(JSON.stringify(input), frozen, "input patch must be untouched");
  assert.deepStrictEqual(decryptPreferencesRow(twice, KEY).allergens, ["soy"]);
});

test("targeted-removal pattern: compare decrypted, keep stored form (DELETE /user/health-data)", () => {
  // Mirrors the medicalConditions?condition=X route logic: stored elements
  // may be envelopes or legacy plaintext; the match runs on plaintext but
  // kept elements retain their original stored representation.
  const [gerdEnvelope, diabetesEnvelope] = encryptClinicalStrings(
    ["gerd", "diabetes"],
    KEY,
  );
  const current = [gerdEnvelope!, diabetesEnvelope!, "pcos"]; // mixed row
  const currentPlain = decryptClinicalStrings(current, KEY);
  const lower = "gerd";
  const updated = current.filter(
    (_, i) => (currentPlain[i] ?? "").toLowerCase() !== lower,
  );
  assert.deepStrictEqual(updated, [diabetesEnvelope, "pcos"]);
  assert.deepStrictEqual(decryptClinicalStrings(updated, KEY), ["diabetes", "pcos"]);
});

test("decrypting an encrypted row without any key fails closed", () => {
  const stored = encryptPreferencesPatch({ allergens: ["peanuts"] }, KEY);
  const saved = {
    CLINICAL_KMS_MASTER_KEY: process.env.CLINICAL_KMS_MASTER_KEY,
    MASTER_KEY: process.env.MASTER_KEY,
    DPDPA_MASTER_KEY_HEX: process.env.DPDPA_MASTER_KEY_HEX,
    CLINICAL_MASTER_KEY_HEX: process.env.CLINICAL_MASTER_KEY_HEX,
  };
  try {
    delete process.env.CLINICAL_KMS_MASTER_KEY;
    delete process.env.MASTER_KEY;
    delete process.env.DPDPA_MASTER_KEY_HEX;
    delete process.env.CLINICAL_MASTER_KEY_HEX;
    // No explicit key + no env key + encrypted element → must throw, never
    // silently hand ciphertext to allergen matching.
    assert.throws(() => decryptPreferencesRow(stored), /master key not configured/i);
    // A fully-plaintext legacy row still reads fine without a key.
    assert.deepStrictEqual(
      decryptPreferencesRow({ allergens: ["peanuts"] }).allergens,
      ["peanuts"],
    );
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
