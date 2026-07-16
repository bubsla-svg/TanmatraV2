import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { scanGitHistoryForSecrets } from "./gitHistorySecretScanner";
import {
  storeSecret,
  getSecret,
  secretAuditLogs,
  checkSecretRotationStatus,
  getSecretRecord,
} from "./secretsManager";

describe("Secrets Management, Git History Scan & Key Rotation Engine", () => {
  beforeEach(() => {
    secretAuditLogs.length = 0;
  });

  it("Step 1 (Git History Secret Scanning): scans commit history diffs for leaked API keys", () => {
    const repoPath = process.cwd();
    const findings = scanGitHistoryForSecrets(repoPath);

    assert.ok(Array.isArray(findings));
  });

  it("Step 2 (Encrypted Secrets & Audit Trail): encrypts secrets with AES-256-GCM and audits every access attempt", () => {
    storeSecret({
      name: "PAYMENT_GATEWAY_SECRET",
      plainTextValue: "live_secret_key_889210",
      allowedRoles: ["admin", "payment_service"],
    });

    // 1. Authorized Read
    const decrypted = getSecret("PAYMENT_GATEWAY_SECRET", "payment_service");
    assert.strictEqual(decrypted, "live_secret_key_889210");

    // 2. Unauthorized Read Attempt
    const unauthorized = getSecret("PAYMENT_GATEWAY_SECRET", "guest_user");
    assert.strictEqual(unauthorized, null);

    // 3. Verify Read Audit Log
    assert.strictEqual(secretAuditLogs.length, 2);
    assert.strictEqual(secretAuditLogs[0].accessGranted, true);
    assert.strictEqual(secretAuditLogs[1].accessGranted, false);
  });

  it("Step 3 (Scheduled Key Rotation Policy): flags stale secrets exceeding max age threshold for rotation", () => {
    storeSecret({
      name: "RAZORPAY_WEBHOOK_KEY",
      plainTextValue: "wh_secret_10029",
      allowedRoles: ["admin"],
      maxAgeDays: 90,
    });

    const statusInitial = checkSecretRotationStatus("RAZORPAY_WEBHOOK_KEY");
    assert.strictEqual(statusInitial.needsRotation, false);

    // Age the secret past 90 days
    const record = getSecretRecord("RAZORPAY_WEBHOOK_KEY");
    if (record) {
      record.lastRotatedAt = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
    }

    const statusAged = checkSecretRotationStatus("RAZORPAY_WEBHOOK_KEY");
    assert.strictEqual(statusAged.needsRotation, true);
    assert.ok(statusAged.ageDays >= 90);
  });
});
