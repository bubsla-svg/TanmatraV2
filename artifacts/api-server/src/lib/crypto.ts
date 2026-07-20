import {
  encryptClinicalAttribute,
  decryptClinicalAttribute,
  type EncryptedEnvelope,
} from "@workspace/db";

export {
  encryptClinicalAttribute,
  decryptClinicalAttribute,
  type EncryptedEnvelope,
};

/**
 * Clinical-attribute array encryption for DPDPA-sensitive free-text fields
 * (subscription-member medicalConditions / allergens / dislikedIngredients).
 *
 * These columns store an ARRAY of short free-text values. We encrypt each
 * element independently with the AES-256-GCM envelope from `@workspace/db`
 * and store the JSON-serialized envelope string in place of the plaintext.
 * The column type is unchanged (Postgres text[] / jsonb string[]); only the
 * element contents change, so no schema migration is needed — just a data
 * backfill for pre-existing rows.
 *
 * Reads are backward-compatible: `decryptClinicalStrings` decrypts elements
 * that are envelopes and passes through any that are still legacy plaintext,
 * so the read path is safe to deploy before the backfill runs and tolerates
 * rows with a mix of encrypted and not-yet-encrypted elements mid-rollout.
 *
 * The underlying `encryptClinicalAttribute` fails closed (throws) when no KMS
 * master key is configured — so a write path calling these helpers requires
 * `CLINICAL_KMS_MASTER_KEY` (or an alias) to be set. Boot validation
 * (`validateEnv`) hard-requires it in production for exactly this reason.
 */

/**
 * True when `value` is a serialized {@link EncryptedEnvelope} (JSON with the
 * three hex fields), i.e. an already-encrypted element rather than legacy
 * plaintext. Used to keep decrypt-on-read and the backfill idempotent.
 */
export function isEncryptedEnvelope(value: string): boolean {
  if (typeof value !== "string" || value.length === 0 || value[0] !== "{") {
    return false;
  }
  try {
    const parsed = JSON.parse(value) as Partial<EncryptedEnvelope>;
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.ivHex === "string" &&
      typeof parsed.ciphertextHex === "string" &&
      typeof parsed.authTagHex === "string"
    );
  } catch {
    return false;
  }
}

/**
 * Encrypt each element of a clinical free-text array for storage. Elements
 * that are already envelopes are passed through unchanged so the helper is
 * idempotent (safe to call in a backfill re-run). `null`/`undefined` → `[]`.
 */
export function encryptClinicalStrings(
  values: string[] | null | undefined,
  masterKeyHex?: string,
): string[] {
  if (!values || values.length === 0) return [];
  return values.map((v) =>
    isEncryptedEnvelope(v)
      ? v
      : JSON.stringify(encryptClinicalAttribute(v, masterKeyHex)),
  );
}

/**
 * Decrypt each element of a stored clinical free-text array. Envelope
 * elements are decrypted; legacy plaintext elements are returned as-is.
 * `null`/`undefined` → `[]`.
 */
export function decryptClinicalStrings(
  values: string[] | null | undefined,
  masterKeyHex?: string,
): string[] {
  if (!values || values.length === 0) return [];
  return values.map((v) =>
    isEncryptedEnvelope(v) ? decryptClinicalAttribute(v, masterKeyHex) : v,
  );
}
