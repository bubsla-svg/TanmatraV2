import crypto from "crypto";
import { logger } from "./logger";

export interface RefreshTokenRecord {
  token: string;
  familyId: string;
  userId: string;
  isUsed: boolean;
  expiresAt: Date;
  createdAt: Date;
  rotatedAt?: Date;
}

// In-memory Token Family Store (Postgres backed in schema)
const tokenStore = new Map<string, RefreshTokenRecord>();
const familyRevokedSet = new Set<string>();

export function issueRefreshToken(userId: string, familyId?: string): RefreshTokenRecord {
  const token = `rft_${crypto.randomBytes(32).toString("hex")}`;
  const record: RefreshTokenRecord = {
    token,
    familyId: familyId ?? `fam_${crypto.randomBytes(16).toString("hex")}`,
    userId,
    isUsed: false,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  };
  tokenStore.set(token, record);
  return record;
}

export async function rotateRefreshToken(
  presentedToken: string
): Promise<
  | { success: true; newToken: RefreshTokenRecord }
  | { success: false; reason: "expired" | "not_found" | "family_revoked" | "reuse_compromise" }
> {
  const record = tokenStore.get(presentedToken);

  if (!record) {
    return { success: false, reason: "not_found" };
  }

  if (familyRevokedSet.has(record.familyId)) {
    return { success: false, reason: "family_revoked" };
  }

  if (record.expiresAt < new Date()) {
    tokenStore.delete(presentedToken);
    return { success: false, reason: "expired" };
  }

  // Reuse Detection: If an already-used refresh token is presented again, flag compromise!
  if (record.isUsed) {
    logger.error(
      { userId: record.userId, familyId: record.familyId, token: presentedToken },
      "auth.token.reuse_compromise_detected"
    );
    // Compromise Guard: Revoke whole token family immediately
    familyRevokedSet.add(record.familyId);
    return { success: false, reason: "reuse_compromise" };
  }

  // Mark current token as used
  record.isUsed = true;
  record.rotatedAt = new Date();

  // Issue new token in the same token family (Single-Use Token Rotation)
  const newToken = issueRefreshToken(record.userId, record.familyId);
  return { success: true, newToken };
}

export function isFamilyRevoked(familyId: string): boolean {
  return familyRevokedSet.has(familyId);
}

export function clearTokenStoreForTesting(): void {
  tokenStore.clear();
  familyRevokedSet.clear();
}
