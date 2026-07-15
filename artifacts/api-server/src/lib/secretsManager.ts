import crypto from "crypto";
import { logger } from "./logger";

/**
 * Step 2: Encrypted Secrets Manager with Role-Based Access Control (RBAC) & Read Audit Trail
 * Replaces plain-text .env variables with AES-256-GCM encrypted secrets management.
 */

export interface SecretAccessLog {
  secretName: string;
  accessedByRole: string;
  timestamp: string;
  accessGranted: boolean;
}

export const secretAuditLogs: SecretAccessLog[] = [];
const masterEncryptionKey = crypto.randomBytes(32); // Master vault key

export interface EncryptedSecretRecord {
  name: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  allowedRoles: string[];
  lastRotatedAt: Date;
  maxAgeDays: number;
}

const secretVault = new Map<string, EncryptedSecretRecord>();

export function storeSecret(params: {
  name: string;
  plainTextValue: string;
  allowedRoles: string[];
  maxAgeDays?: number;
}): void {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterEncryptionKey, iv);

  let ciphertext = cipher.update(params.plainTextValue, "utf-8", "hex");
  ciphertext += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  secretVault.set(params.name, {
    name: params.name,
    ciphertext,
    iv: iv.toString("hex"),
    authTag,
    allowedRoles: params.allowedRoles,
    lastRotatedAt: new Date(),
    maxAgeDays: params.maxAgeDays ?? 90,
  });
}

export function getSecret(name: string, requesterRole: string): string | null {
  const record = secretVault.get(name);

  if (!record) {
    secretAuditLogs.push({
      secretName: name,
      accessedByRole: requesterRole,
      timestamp: new Date().toISOString(),
      accessGranted: false,
    });
    return null;
  }

  const isRoleAllowed = record.allowedRoles.includes("*") || record.allowedRoles.includes(requesterRole);

  secretAuditLogs.push({
    secretName: name,
    accessedByRole: requesterRole,
    timestamp: new Date().toISOString(),
    accessGranted: isRoleAllowed,
  });

  if (!isRoleAllowed) {
    logger.warn({ secretName: name, requesterRole }, "secrets.access_denied_rbac");
    return null;
  }

  // Decrypt using AES-256-GCM
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    masterEncryptionKey,
    Buffer.from(record.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(record.authTag, "hex"));

  let decrypted = decipher.update(record.ciphertext, "hex", "utf-8");
  decrypted += decipher.final("utf-8");

  return decrypted;
}

export function getSecretRecord(name: string): EncryptedSecretRecord | undefined {
  return secretVault.get(name);
}

/**
 * Step 3: Scheduled Secret Rotation Policy Engine
 * Checks key age and enforces scheduled key rotation.
 */
export function checkSecretRotationStatus(name: string): { needsRotation: boolean; ageDays: number } {
  const record = secretVault.get(name);
  if (!record) return { needsRotation: false, ageDays: 0 };

  const ageMs = Date.now() - record.lastRotatedAt.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  return {
    needsRotation: ageDays >= record.maxAgeDays,
    ageDays,
  };
}
