/**
 * Backfill: envelope-encrypt existing subscription-member clinical free-text.
 *
 * The `subscription_members` clinical arrays — `medical_conditions`,
 * `allergens`, `disliked_ingredients` — historically stored plaintext. The API
 * now encrypts these at rest (see artifacts/api-server/src/lib/crypto.ts +
 * routes/subscriptions.ts). This script converts pre-existing plaintext rows to
 * the same AES-256-GCM envelope format so no clinical free-text remains in
 * cleartext at rest.
 *
 * Run with (dry-run by default — pass --apply to write):
 *   pnpm --filter @workspace/scripts run backfill-encrypt-subscription-members
 *   pnpm --filter @workspace/scripts run backfill-encrypt-subscription-members -- --apply
 *
 * Requires CLINICAL_KMS_MASTER_KEY (or an alias) in the environment — the same
 * key the API server uses. The underlying crypto fails closed, so a missing key
 * aborts the run rather than writing anything.
 *
 * Idempotent: elements already stored as an envelope are left untouched, so the
 * script is safe to re-run and safe to run while the encrypting API is live.
 */
import { eq } from "drizzle-orm";
import {
  db,
  subscriptionMembersTable,
  encryptClinicalAttribute,
  type EncryptedEnvelope,
} from "@workspace/db";

const APPLY = process.argv.includes("--apply");
const BATCH = 100;

/** True when `value` is already a serialized EncryptedEnvelope (skip it). */
function isEncryptedEnvelope(value: string): boolean {
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

/** Encrypt any plaintext elements; leave already-encrypted ones as-is. */
function encryptArray(values: string[] | null | undefined): {
  next: string[];
  changed: boolean;
} {
  if (!values || values.length === 0) return { next: values ?? [], changed: false };
  let changed = false;
  const next = values.map((v) => {
    if (isEncryptedEnvelope(v)) return v;
    changed = true;
    return JSON.stringify(encryptClinicalAttribute(v));
  });
  return { next, changed };
}

async function main(): Promise<void> {
  const rows = await db
    .select({
      id: subscriptionMembersTable.id,
      allergens: subscriptionMembersTable.allergens,
      medicalConditions: subscriptionMembersTable.medicalConditions,
      dislikedIngredients: subscriptionMembersTable.dislikedIngredients,
    })
    .from(subscriptionMembersTable);

  console.log(
    `[backfill-encrypt] ${rows.length} subscription members scanned (apply=${APPLY})`,
  );

  let updated = 0;
  let alreadyEncrypted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    for (const row of slice) {
      const allergens = encryptArray(row.allergens);
      const medicalConditions = encryptArray(row.medicalConditions);
      const dislikedIngredients = encryptArray(row.dislikedIngredients);
      const changed =
        allergens.changed ||
        medicalConditions.changed ||
        dislikedIngredients.changed;
      if (!changed) {
        alreadyEncrypted += 1;
        continue;
      }
      updated += 1;
      if (APPLY) {
        await db
          .update(subscriptionMembersTable)
          .set({
            allergens: allergens.next,
            medicalConditions: medicalConditions.next,
            dislikedIngredients: dislikedIngredients.next,
          })
          .where(eq(subscriptionMembersTable.id, row.id));
      }
    }
    console.log(
      `[backfill-encrypt] processed ${Math.min(i + BATCH, rows.length)}/${rows.length}`,
    );
  }

  console.log(
    `[backfill-encrypt] done — ${APPLY ? "updated" : "would update"}=${updated} ` +
      `already-encrypted/empty=${alreadyEncrypted}`,
  );
  if (!APPLY && updated > 0) {
    console.log("[backfill-encrypt] dry-run only — re-run with --apply to write.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill-encrypt] failed:", err);
    process.exit(1);
  });
