import crypto from "node:crypto";

export interface EncryptedEnvelope {
  ivHex: string;
  ciphertextHex: string;
  authTagHex: string;
  keyVersion: string;
}

const DEFAULT_DEV_MASTER_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function resolveMasterKey(masterKeyHex?: string): Buffer {
  const normalize = (key?: string): string | undefined =>
    typeof key === "string" && key.trim() === "" ? undefined : key;

  let resolvedHex =
    normalize(masterKeyHex) ??
    normalize(process.env.CLINICAL_KMS_MASTER_KEY) ??
    normalize(process.env.MASTER_KEY) ??
    normalize(process.env.DPDPA_MASTER_KEY_HEX) ??
    normalize(process.env.CLINICAL_MASTER_KEY_HEX);

  if (typeof resolvedHex === "string" && resolvedHex.trim() === "") {
    resolvedHex = undefined;
  }

  if (!resolvedHex && process.env.NODE_ENV === "production") {
    throw new Error("FATAL: KMS master key not configured in production environment.");
  }

  const hexKey = resolvedHex ?? DEFAULT_DEV_MASTER_KEY_HEX;

  if (typeof hexKey !== "string") {
    throw new TypeError("Master key must be provided as a string");
  }

  if (/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    return Buffer.from(hexKey, "hex");
  }

  const rawBuf = Buffer.from(hexKey, "utf8");
  if (rawBuf.length === 32) {
    return rawBuf;
  }

  return crypto.createHash("sha256").update(hexKey, "utf8").digest();
}

export function encryptClinicalAttribute(
  plaintext: string,
  masterKeyHex?: string,
): EncryptedEnvelope {
  if (typeof plaintext !== "string") {
    throw new TypeError("Plaintext must be a string");
  }
  const key = resolveMasterKey(masterKeyHex);
  const iv = crypto.randomBytes(12); // 96-bit IV
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 128-bit auth tag (16 bytes)

  return {
    ivHex: iv.toString("hex"),
    ciphertextHex: ciphertext.toString("hex"),
    authTagHex: authTag.toString("hex"),
    keyVersion: "v1",
  };
}

export function decryptClinicalAttribute(
  envelope: EncryptedEnvelope | string,
  masterKeyHex?: string,
): string {
  let parsed: EncryptedEnvelope;
  if (typeof envelope === "string") {
    try {
      parsed = JSON.parse(envelope) as EncryptedEnvelope;
    } catch {
      const parts = envelope.split(":");
      if (parts.length === 4 && parts[0] === "v1") {
        parsed = {
          keyVersion: parts[0],
          ivHex: parts[1],
          authTagHex: parts[2],
          ciphertextHex: parts[3],
        };
      } else if (parts.length === 3) {
        parsed = {
          keyVersion: "v1",
          ivHex: parts[0],
          authTagHex: parts[1],
          ciphertextHex: parts[2],
        };
      } else {
        throw new Error(
          "Invalid envelope format: string must be valid JSON or v1:ivHex:authTagHex:ciphertextHex",
        );
      }
    }
  } else if (envelope && typeof envelope === "object") {
    parsed = envelope;
  } else {
    throw new TypeError("Envelope must be an object or string");
  }

  if (
    typeof parsed.ivHex !== "string" ||
    typeof parsed.ciphertextHex !== "string" ||
    typeof parsed.authTagHex !== "string"
  ) {
    throw new Error(
      "Invalid envelope structure: missing ivHex, ciphertextHex, or authTagHex",
    );
  }

  if (parsed.ivHex.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(parsed.ivHex)) {
    throw new Error(`Invalid IV length or format: expected 24 hex characters (12 bytes), got "${parsed.ivHex}"`);
  }
  if (parsed.authTagHex.length !== 32 || !/^[0-9a-fA-F]{32}$/.test(parsed.authTagHex)) {
    throw new Error(`Invalid authTag length or format: expected 32 hex characters (16 bytes), got "${parsed.authTagHex}"`);
  }
  if (
    parsed.ciphertextHex.length > 0 &&
    (!/^[0-9a-fA-F]+$/.test(parsed.ciphertextHex) || parsed.ciphertextHex.length % 2 !== 0)
  ) {
    throw new Error("Invalid ciphertext format: must be valid hex string");
  }

  const key = resolveMasterKey(masterKeyHex);
  const iv = Buffer.from(parsed.ivHex, "hex");
  const ciphertext = Buffer.from(parsed.ciphertextHex, "hex");
  const authTag = Buffer.from(parsed.authTagHex, "hex");

  if (iv.length !== 12) {
    throw new Error(`Invalid IV length: expected 12 bytes, got ${iv.length}`);
  }
  if (authTag.length !== 16) {
    throw new Error(
      `Invalid authTag length: expected 16 bytes, got ${authTag.length}`,
    );
  }

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch (err: any) {
    throw new Error(
      `Decryption failed (tampered ciphertext or invalid authentication tag): ${err?.message ?? err}`,
    );
  }
}
