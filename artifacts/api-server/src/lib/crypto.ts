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

/**
 * Structural shape of the clinical free-text arrays on a consumer
 * `user_preferences` row. Kept structural (all fields optional) so full
 * drizzle rows, partial selects, and validated request patches all fit
 * without casts. The scalar clinical fields (`hba1cPct` double precision,
 * `pcosHistory` boolean) are NOT covered: their columns are not text and
 * cannot hold an envelope string without a schema migration, which gets
 * its own review per the working agreement.
 */
export interface ClinicalPreferenceArrays {
  allergens?: string[] | null;
  dislikedIngredients?: string[] | null;
  medicalConditions?: string[] | null;
}

/**
 * Decrypt-on-read for a consumer `user_preferences` row (or any partial
 * select / DTO carrying the clinical arrays). Returns a NEW object — the
 * input row is never mutated. Only fields that are present and non-null
 * are transformed; everything else (cuisines, macros, scalars) passes
 * through untouched. Legacy plaintext elements pass through unchanged via
 * `decryptClinicalStrings`, so this is safe on not-yet-backfilled rows.
 * `null`/`undefined` rows → `null`.
 */
export function decryptPreferencesRow<T extends ClinicalPreferenceArrays>(
  row: T,
  masterKeyHex?: string,
): T;
export function decryptPreferencesRow<T extends ClinicalPreferenceArrays>(
  row: T | null | undefined,
  masterKeyHex?: string,
): T | null;
export function decryptPreferencesRow<T extends ClinicalPreferenceArrays>(
  row: T | null | undefined,
  masterKeyHex?: string,
): T | null {
  if (!row) return null;
  const patch: ClinicalPreferenceArrays = {};
  if (row.allergens != null) {
    patch.allergens = decryptClinicalStrings(row.allergens, masterKeyHex);
  }
  if (row.dislikedIngredients != null) {
    patch.dislikedIngredients = decryptClinicalStrings(
      row.dislikedIngredients,
      masterKeyHex,
    );
  }
  if (row.medicalConditions != null) {
    patch.medicalConditions = decryptClinicalStrings(
      row.medicalConditions,
      masterKeyHex,
    );
  }
  return { ...row, ...patch };
}

/**
 * Encrypt-on-write counterpart for a preferences insert/update patch.
 * Returns a NEW object with the clinical arrays replaced by envelope
 * strings; fields that are absent (`undefined`) stay absent so PATCH
 * semantics ("only update what the caller sent") are preserved. Idempotent
 * via `encryptClinicalStrings` — already-encrypted elements are not
 * double-wrapped. Fails closed (throws) when no KMS master key is
 * configured and there is at least one plaintext element to encrypt.
 */
export function encryptPreferencesPatch<T extends ClinicalPreferenceArrays>(
  patch: T,
  masterKeyHex?: string,
): T {
  const enc: ClinicalPreferenceArrays = {};
  if (patch.allergens != null) {
    enc.allergens = encryptClinicalStrings(patch.allergens, masterKeyHex);
  }
  if (patch.dislikedIngredients != null) {
    enc.dislikedIngredients = encryptClinicalStrings(
      patch.dislikedIngredients,
      masterKeyHex,
    );
  }
  if (patch.medicalConditions != null) {
    enc.medicalConditions = encryptClinicalStrings(
      patch.medicalConditions,
      masterKeyHex,
    );
  }
  return { ...patch, ...enc };
}
