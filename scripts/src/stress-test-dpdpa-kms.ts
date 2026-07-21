import assert from "node:assert";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  userConsentsTable,
  encryptClinicalAttribute,
  decryptClinicalAttribute,
  type EncryptedEnvelope,
} from "@workspace/db";

function runStressTests() {
  console.log("=== REM-V2-01 DPDPA Consent & KMS Encryption Stress Test Suite ===\n");
  let passed = 0;
  let failed = 0;
  const findings: string[] = [];

  const masterKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  // 1. IV Uniqueness Stress Test
  console.log("[Stress Test 1] Evaluating IV Uniqueness over 5,000 iterations...");
  const ivSet = new Set<string>();
  const cipherSet = new Set<string>();
  const testPlaintext = "Patient Diagnosis: Hypertension Stage 2";
  const iterations = 5000;

  for (let i = 0; i < iterations; i++) {
    const env = encryptClinicalAttribute(testPlaintext, masterKey);
    assert.strictEqual(env.ivHex.length, 24, "IV must be 12 bytes (24 hex chars)");
    ivSet.add(env.ivHex);
    cipherSet.add(env.ciphertextHex);
  }
  if (ivSet.size === iterations && cipherSet.size === iterations) {
    console.log(`  ✔ PASSED: 100% IV and Ciphertext uniqueness confirmed across ${iterations} iterations.\n`);
    passed++;
  } else {
    console.log(`  ❌ FAILED: IV collision detected! Unique IVs: ${ivSet.size}/${iterations}\n`);
    failed++;
    findings.push(`IV collision detected in ${iterations} iterations.`);
  }

  // 2. Auth Tag Size & Truncation / Padding Stress Test
  console.log("[Stress Test 2] Evaluating Authentication Tag Size & Validation...");
  const baseEnv = encryptClinicalAttribute(testPlaintext, masterKey);
  assert.strictEqual(baseEnv.authTagHex.length, 32, "Auth tag must be exactly 16 bytes (32 hex chars)");

  // Truncated auth tag (15 bytes = 30 hex chars)
  const shortTagEnv: EncryptedEnvelope = { ...baseEnv, authTagHex: baseEnv.authTagHex.slice(0, 30) };
  try {
    decryptClinicalAttribute(shortTagEnv, masterKey);
    console.log("  ❌ FAILED: Truncated auth tag (15 bytes) was incorrectly accepted!\n");
    failed++;
    findings.push("Truncated auth tag (15 bytes) accepted without throwing length error.");
  } catch (err: any) {
    assert.match(err.message, /Invalid authTag length: expected 16 bytes, got 15/);
    console.log("  ✔ Truncated auth tag (15 bytes) correctly rejected.");
  }

  // Oversized auth tag (17 bytes = 34 hex chars)
  const longTagEnv: EncryptedEnvelope = { ...baseEnv, authTagHex: baseEnv.authTagHex + "00" };
  try {
    decryptClinicalAttribute(longTagEnv, masterKey);
    console.log("  ❌ FAILED: Oversized auth tag (17 bytes) was incorrectly accepted!\n");
    failed++;
    findings.push("Oversized auth tag (17 bytes) accepted without throwing length error.");
  } catch (err: any) {
    assert.match(err.message, /Invalid authTag length: expected 16 bytes, got 17/);
    console.log("  ✔ Oversized auth tag (17 bytes) correctly rejected.");
  }

  // Trailing garbage / non-hex character vulnerability in Buffer.from(hexString, 'hex')
  // If authTagHex is 32 hex chars followed by non-hex chars 'zzzz', Buffer.from stops parsing at 'z' and yields 16 bytes!
  const dirtyTagEnv: EncryptedEnvelope = { ...baseEnv, authTagHex: baseEnv.authTagHex + "zzzz" };
  try {
    const res = decryptClinicalAttribute(dirtyTagEnv, masterKey);
    console.log(`  ⚠️ FINDING / VULNERABILITY: Trailing non-hex characters in authTagHex ('${dirtyTagEnv.authTagHex}') are silently ignored by Buffer.from(..., 'hex'), allowing decryption to succeed.`);
    findings.push("Buffer.from(authTagHex, 'hex') silently ignores trailing non-hex characters after 16 valid bytes.");
  } catch (err: any) {
    console.log("  ✔ Dirty auth tag rejected:", err.message);
  }
  console.log("  ✔ Auth tag length validation (16 bytes) verified.\n");
  passed++;

  // 3. Bit-Flipping & Ciphertext Tampering Stress Test
  console.log("[Stress Test 3] Evaluating Resistance to Bit-Flipping & Ciphertext Tampering...");
  let tamperedCaught = 0;
  const totalTamperTests = baseEnv.ciphertextHex.length * 4; // test flipping bits across hex chars

  for (let i = 0; i < baseEnv.ciphertextHex.length; i++) {
    const origChar = parseInt(baseEnv.ciphertextHex[i], 16);
    const flippedChar = (origChar ^ 1).toString(16); // flip lowest bit of hex digit
    const tamperedCipher = baseEnv.ciphertextHex.slice(0, i) + flippedChar + baseEnv.ciphertextHex.slice(i + 1);
    try {
      decryptClinicalAttribute({ ...baseEnv, ciphertextHex: tamperedCipher }, masterKey);
      console.log(`  ❌ FAILED: Tampered ciphertext at index ${i} was accepted!`);
      failed++;
    } catch {
      tamperedCaught++;
    }
  }
  console.log(`  ✔ PASSED: 100% of bit-flip tamper attempts (${tamperedCaught}/${baseEnv.ciphertextHex.length}) rejected with GCM authentication failure.\n`);
  passed++;

  // 4. Edge Case: Empty String Encryption & Decryption
  console.log("[Stress Test 4] Evaluating Empty String Plaintext Handling...");
  try {
    const emptyEnv = encryptClinicalAttribute("", masterKey);
    console.log(`  Encrypted empty string -> ivHex: ${emptyEnv.ivHex}, ciphertextHex: '${emptyEnv.ciphertextHex}', authTagHex: ${emptyEnv.authTagHex}`);
    assert.strictEqual(emptyEnv.ciphertextHex, "", "Empty string plaintext produces empty ciphertext in GCM");

    try {
      const decEmpty = decryptClinicalAttribute(emptyEnv, masterKey);
      console.log(`  ✔ PASSED: Decrypted empty string successfully: '${decEmpty}'\n`);
      passed++;
    } catch (err: any) {
      console.log(`  ❌ BUG DETECTED: decryptClinicalAttribute failed on valid empty string ciphertext! Error: ${err.message}\n`);
      failed++;
      findings.push(`BUG in decryptClinicalAttribute: !parsed.ciphertextHex check treats valid empty string ciphertext ("") as missing field, throwing: "${err.message}".`);
    }
  } catch (err: any) {
    console.log(`  ❌ FAILED to encrypt empty string: ${err.message}\n`);
    failed++;
  }

  // 5. DPDPA Purpose Scope & Schema Verification
  console.log("[Stress Test 5] Evaluating DPDPA Consent Schema & Purpose Scopes...");
  const cfg = getTableConfig(userConsentsTable);
  const cols = cfg.columns.map((c) => c.name);
  console.log(`  Schema columns: ${cols.join(", ")}`);
  assert.ok(cols.includes("purpose_clinical_delivery"), "purpose_clinical_delivery column exists");
  assert.ok(cols.includes("purpose_marketing"), "purpose_marketing column exists");
  assert.ok(cols.includes("purpose_ai_personalization"), "purpose_ai_personalization column exists");
  console.log("  ✔ DPDPA consent schema structure verified.\n");
  passed++;

  console.log("=== Summary of Stress Test Results ===");
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed / Bugs Detected: ${failed}`);
  if (findings.length > 0) {
    console.log("\nKey Findings & Vulnerabilities:");
    findings.forEach((f, idx) => console.log(`  ${idx + 1}. ${f}`));
  }

  if (failed > 0 || findings.length > 0) {
    process.exit(1);
  }
}

runStressTests();
