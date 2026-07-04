import assert from "node:assert";
import { getTableConfig } from "drizzle-orm/pg-core";
import { inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  userConsentsTable,
  encryptClinicalAttribute,
  decryptClinicalAttribute,
  type InsertUserConsent,
  pool,
  overridePool,
} from "@workspace/db";
import { generateClientSummary } from "@workspace/api-server/rdCopilot/clientSummary";

async function runTests() {
  console.log(
    "=== Starting REM-V2-01 DPDPA 2023 Consent & KMS Envelope Encryption Verification Suite ===\n",
  );
  let passed = 0;

  // Test 1: Creating and validating DPDPA consent schema records with purpose scopes
  console.log(
    "[Test 1] Inspecting and validating DPDPA 2023 Consent Schema (`user_consents`)...",
  );
  const tableConfig = getTableConfig(userConsentsTable);
  assert.strictEqual(
    tableConfig.name,
    "user_consents",
    "Table name should be user_consents",
  );

  const columnNames = tableConfig.columns.map((col) => col.name);
  const requiredColumns = [
    "id",
    "user_id",
    "purpose_clinical_delivery",
    "purpose_marketing",
    "purpose_ai_personalization",
    "consent_version",
    "ip_address",
    "user_agent",
    "status",
    "granted_at",
    "revoked_at",
  ];
  for (const colName of requiredColumns) {
    assert.ok(
      columnNames.includes(colName),
      `Column ${colName} must exist on user_consents table`,
    );
  }

  const indexNames = tableConfig.indexes.map((idx) => idx.config.name);
  assert.ok(
    indexNames.includes("idx_user_consents_user_id"),
    "Index idx_user_consents_user_id must exist",
  );
  assert.ok(
    indexNames.includes("idx_user_consents_status"),
    "Index idx_user_consents_status must exist",
  );

  const checkNames = tableConfig.checks.map((chk) => chk.name);
  assert.ok(
    checkNames.includes("user_consents_status_chk"),
    "Check constraint user_consents_status_chk must exist",
  );

  const sampleConsent: InsertUserConsent = {
    userId: "usr_clinical_101",
    purposeClinicalDelivery: true,
    purposeMarketing: true,
    purposeAiPersonalization: false,
    consentVersion: "2023_DPDPA_v1",
    ipAddress: "192.0.2.1",
    userAgent: "Mozilla/5.0 MedicalClient/1.0",
    status: "granted",
  };
  assert.strictEqual(sampleConsent.userId, "usr_clinical_101");
  assert.strictEqual(sampleConsent.purposeClinicalDelivery, true);
  assert.strictEqual(sampleConsent.consentVersion, "2023_DPDPA_v1");
  assert.strictEqual(sampleConsent.status, "granted");
  console.log(
    "  ✔ DPDPA consent schema columns, indexes, check constraints, and types validated successfully.\n",
  );
  passed++;

  // Test 2: Encrypting sensitive clinical text via AES-256-GCM wrapper and verifying envelope structure
  console.log(
    "[Test 2] Testing AES-256-GCM encryption of sensitive clinical attributes...",
  );
  const sensitiveText = "CKD Stage 3 + Severe T2D (Insulin Dependent)";
  const customKey =
    "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"; // 64 hex chars = 32 bytes
  const envelope = encryptClinicalAttribute(sensitiveText, customKey);

  assert.strictEqual(typeof envelope, "object", "Envelope must be an object");
  assert.strictEqual(
    envelope.keyVersion,
    "v1",
    "keyVersion should default to v1",
  );
  assert.strictEqual(
    envelope.ivHex.length,
    24,
    "IV hex must be exactly 24 characters (12 bytes for GCM)",
  );
  assert.strictEqual(
    envelope.authTagHex.length,
    32,
    "AuthTag hex must be exactly 32 characters (16 bytes)",
  );
  assert.ok(
    envelope.ciphertextHex.length > 0,
    "Ciphertext hex must not be empty",
  );
  assert.notStrictEqual(
    envelope.ciphertextHex,
    sensitiveText,
    "Ciphertext must not match plaintext",
  );
  console.log(
    `  ✔ Encrypted envelope generated successfully (IV: ${envelope.ivHex}, AuthTag: ${envelope.authTagHex}).\n`,
  );
  passed++;

  // Test 3: Decrypting envelope back to exact original plaintext
  console.log(
    "[Test 3] Testing decryption of envelope back to exact original plaintext...",
  );
  const decryptedObject = decryptClinicalAttribute(envelope, customKey);
  assert.strictEqual(
    decryptedObject,
    sensitiveText,
    "Decrypted text from envelope object must exactly match original sensitive plaintext",
  );

  const serializedJson = JSON.stringify(envelope);
  const decryptedJson = decryptClinicalAttribute(serializedJson, customKey);
  assert.strictEqual(
    decryptedJson,
    sensitiveText,
    "Decrypted text from JSON string must exactly match original plaintext",
  );

  const serializedColon = `${envelope.keyVersion}:${envelope.ivHex}:${envelope.authTagHex}:${envelope.ciphertextHex}`;
  const decryptedColon = decryptClinicalAttribute(serializedColon, customKey);
  assert.strictEqual(
    decryptedColon,
    sensitiveText,
    "Decrypted text from colon-delimited string must exactly match original plaintext",
  );
  console.log(
    "  ✔ Exact plaintext recovery verified across object, JSON, and string envelope formats.\n",
  );
  passed++;

  // Test 4: Tamper detection — proving that modifying ciphertext or auth tag throws an authentication error
  console.log(
    "[Test 4] Testing tamper detection and GCM authentication tag verification...",
  );

  // Tamper ciphertext by changing a hex digit
  const tamperedCiphertextHex =
    (envelope.ciphertextHex[0] === "0" ? "1" : "0") +
    envelope.ciphertextHex.slice(1);
  const tamperedCipherEnvelope = {
    ...envelope,
    ciphertextHex: tamperedCiphertextHex,
  };
  assert.throws(
    () => decryptClinicalAttribute(tamperedCipherEnvelope, customKey),
    /Decryption failed/i,
    "Tampered ciphertext must throw authentication/decryption error",
  );

  // Tamper auth tag by changing a hex digit
  const tamperedAuthTagHex =
    (envelope.authTagHex[0] === "a" ? "b" : "a") +
    envelope.authTagHex.slice(1);
  const tamperedTagEnvelope = {
    ...envelope,
    authTagHex: tamperedAuthTagHex,
  };
  assert.throws(
    () => decryptClinicalAttribute(tamperedTagEnvelope, customKey),
    /Decryption failed/i,
    "Tampered authTagHex must throw authentication/decryption error",
  );

  // Wrong key check
  const wrongKey =
    "9999999999999999999999999999999999999999999999999999999999999999";
  assert.throws(
    () => decryptClinicalAttribute(envelope, wrongKey),
    /Decryption failed/i,
    "Decrypting with wrong master key must throw authentication/decryption error",
  );
  console.log(
    "  ✔ Tamper detection verified: modified ciphertext, auth tag, or wrong key immediately rejected.\n",
  );
  passed++;

  // Test 5: Empty string encryption/decryption ("")
  console.log(
    "[Test 5] Testing empty string encryption and decryption (`\"\"`)...",
  );
  const emptyEnvelope = encryptClinicalAttribute("", customKey);
  assert.strictEqual(typeof emptyEnvelope, "object", "Empty string envelope must be an object");
  const decryptedEmpty = decryptClinicalAttribute(emptyEnvelope, customKey);
  assert.strictEqual(
    decryptedEmpty,
    "",
    "Decrypted text must match exact empty string `\"\"`",
  );
  console.log("  ✔ Empty string encryption and decryption verified successfully.\n");
  passed++;

  // Test 6: Trailing non-hex tag rejection ("0123...ZZZ") and strict validation
  console.log(
    "[Test 6] Testing trailing non-hex tag rejection and strict length validation...",
  );
  const malformedTagEnvelope = {
    ...envelope,
    authTagHex: "0123456789abcdef0123456789abcZZZ",
  };
  assert.throws(
    () => decryptClinicalAttribute(malformedTagEnvelope, customKey),
    /Invalid authTag length or format/i,
    "Trailing non-hex authTagHex must throw validation error",
  );

  const wrongLenTagEnvelope = {
    ...envelope,
    authTagHex: "0123456789abcdef",
  };
  assert.throws(
    () => decryptClinicalAttribute(wrongLenTagEnvelope, customKey),
    /Invalid authTag length or format/i,
    "Invalid length authTagHex must throw validation error",
  );

  const malformedIvEnvelope = {
    ...envelope,
    ivHex: "0123456789abcdef01234ZZZ",
  };
  assert.throws(
    () => decryptClinicalAttribute(malformedIvEnvelope, customKey),
    /Invalid IV length or format/i,
    "Trailing non-hex ivHex must throw validation error",
  );

  const trailingNonHexCiphertext = {
    ...envelope,
    ciphertextHex: envelope.ciphertextHex + "ZZ",
  };
  assert.throws(
    () => decryptClinicalAttribute(trailingNonHexCiphertext, customKey),
    /Invalid ciphertext format/i,
    "Trailing non-hex ciphertextHex must throw validation error",
  );

  const oddLenCiphertext = {
    ...envelope,
    ciphertextHex: envelope.ciphertextHex + "a",
  };
  assert.throws(
    () => decryptClinicalAttribute(oddLenCiphertext, customKey),
    /Invalid ciphertext format/i,
    "Odd-length ciphertextHex must throw validation error",
  );

  const malformedCiphertext = {
    ...envelope,
    ciphertextHex: "NOT_HEX!",
  };
  assert.throws(
    () => decryptClinicalAttribute(malformedCiphertext, customKey),
    /Invalid ciphertext format/i,
    "Completely malformed non-hex string ciphertextHex must throw validation error",
  );
  console.log("  ✔ Strict hex regex and length validation verified: malformed or trailing non-hex rejected.\n");
  passed++;

  // Test 7: Production missing key error throwing
  console.log(
    "[Test 7] Testing production missing KMS master key startup error...",
  );
  const origEnv = process.env.NODE_ENV;
  const origKms = process.env.CLINICAL_KMS_MASTER_KEY;
  const origMaster = process.env.MASTER_KEY;
  const origDpdpa = process.env.DPDPA_MASTER_KEY_HEX;
  const origClin = process.env.CLINICAL_MASTER_KEY_HEX;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.CLINICAL_KMS_MASTER_KEY;
    delete process.env.MASTER_KEY;
    delete process.env.DPDPA_MASTER_KEY_HEX;
    delete process.env.CLINICAL_MASTER_KEY_HEX;

    assert.throws(
      () => encryptClinicalAttribute("test production gate"),
      /FATAL: KMS master key not configured in production environment\./,
      "Missing master key in production must throw fatal startup error",
    );
  } finally {
    if (origEnv !== undefined) process.env.NODE_ENV = origEnv; else delete process.env.NODE_ENV;
    if (origKms !== undefined) process.env.CLINICAL_KMS_MASTER_KEY = origKms; else delete process.env.CLINICAL_KMS_MASTER_KEY;
    if (origMaster !== undefined) process.env.MASTER_KEY = origMaster; else delete process.env.MASTER_KEY;
    if (origDpdpa !== undefined) process.env.DPDPA_MASTER_KEY_HEX = origDpdpa; else delete process.env.DPDPA_MASTER_KEY_HEX;
    if (origClin !== undefined) process.env.CLINICAL_MASTER_KEY_HEX = origClin; else delete process.env.CLINICAL_MASTER_KEY_HEX;
  }
  console.log("  ✔ Production missing KMS master key gate verified successfully.\n");
  passed++;

  // Test 8: Consent scope checking in AI Copilot
  console.log(
    "[Test 8] Testing DPDPA Purpose Scope Enforcement in AI Copilot (`clientSummary.ts`)...",
  );
  const summaryRes = await generateClientSummary({
    userId: "usr_nonexistent_dpdpa_check",
    rdSlug: "rd-test-1",
  });
  assert.strictEqual(
    summaryRes.model,
    "dpdpa-blocked",
    "Model output must indicate dpdpa-blocked when consent is missing or revoked",
  );
  assert.ok(
    summaryRes.summary.includes("DPDPA Consent for AI Personalization is missing or revoked"),
    "Summary must state AI processing is blocked due to missing/revoked DPDPA consent",
  );
  assert.strictEqual(
    summaryRes.sources["dpdpaConsent"],
    "missing_or_revoked",
    "Sources must indicate missing_or_revoked consent and block clinical transmission",
  );

  const userAId = `usr_test_revoked_${Date.now()}`;
  const userBId = `usr_test_granted_${Date.now()}`;
  try {
    await db.insert(usersTable).values([
      { id: userAId },
      { id: userBId },
    ]);
    await db.insert(userConsentsTable).values([
      {
        userId: userAId,
        status: "revoked",
        purposeAiPersonalization: true,
      },
      {
        userId: userBId,
        status: "granted",
        purposeAiPersonalization: false,
      },
    ]);

    const resA = await generateClientSummary({
      userId: userAId,
      rdSlug: "rd-test-1",
    });
    assert.strictEqual(
      resA.model,
      "dpdpa-blocked",
      "User A (revoked status) must result in dpdpa-blocked model output",
    );
    assert.strictEqual(
      resA.sources["dpdpaConsent"],
      "missing_or_revoked",
      "User A sources must indicate missing_or_revoked consent",
    );

    const resB = await generateClientSummary({
      userId: userBId,
      rdSlug: "rd-test-1",
    });
    assert.strictEqual(
      resB.model,
      "dpdpa-blocked",
      "User B (purposeAiPersonalization false) must result in dpdpa-blocked model output",
    );
    assert.strictEqual(
      resB.sources["dpdpaConsent"],
      "missing_or_revoked",
      "User B sources must indicate missing_or_revoked consent",
    );
  } catch (err) {
    throw err;
  } finally {
    await db
      .delete(userConsentsTable)
      .where(inArray(userConsentsTable.userId, [userAId, userBId]))
      .catch(() => {});
    await db
      .delete(usersTable)
      .where(inArray(usersTable.id, [userAId, userBId]))
      .catch(() => {});
  }

  console.log("  ✔ DPDPA Purpose Scope Enforcement verified: missing/revoked consent blocks AI transmission.\n");
  passed++;

  console.log(
    `=== All ${passed} DPDPA & KMS Verification Tests PASSED! ===`,
  );
}

runTests()
  .then(async () => {
    await pool.end().catch(() => {});
    await overridePool.end().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Verification failed:", err);
    await pool.end().catch(() => {});
    await overridePool.end().catch(() => {});
    process.exit(1);
  });
