/**
 * Decrypt-on-read seam for consumer `user_preferences` rows.
 *
 * Consumer clinical arrays (allergens / dislikedIngredients /
 * medicalConditions) are stored as AES-256-GCM envelope strings at rest
 * (see `./crypto`), mirroring the subscription-member clinical fields.
 * Every server-side reader that needs the PLAINTEXT values — safety
 * gates, ranking, AI briefs — must go through this helper (or
 * `decryptPreferencesRow` when it already holds a row) instead of
 * selecting from `userPreferencesTable` directly, so a row that has been
 * backfilled to ciphertext never leaks envelopes into matching logic.
 *
 * Legacy plaintext rows pass through unchanged, so this is safe to call
 * before any backfill has run. If a row IS encrypted and no KMS master
 * key is configured, decryption throws — failing closed rather than
 * silently feeding ciphertext to allergen/condition matching (which
 * would disable safety blocks).
 *
 * Accepts an optional executor so transactional readers (checkout
 * finalize, group-order add) can re-read preferences inside their own
 * `tx` and keep their TOCTOU guarantees.
 */
import { eq } from "drizzle-orm";
import { db, userPreferencesTable, type UserPreferences } from "@workspace/db";
import { decryptPreferencesRow } from "./crypto";
import type { DbReadExecutor } from "./menu";

/**
 * Fetch a user's preferences row with clinical arrays decrypted.
 * Returns `null` when the user has no preferences row.
 */
export async function getDecryptedPreferences(
  userId: string,
  executor: DbReadExecutor = db,
): Promise<UserPreferences | null> {
  const [row] = await executor
    .select()
    .from(userPreferencesTable)
    .where(eq(userPreferencesTable.userId, userId))
    .limit(1);
  return decryptPreferencesRow(row ?? null);
}
