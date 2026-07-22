// ─────────────────────────────────────────────────────────────────────────────
// 3-Day Taste Test eligibility — one trial per phone number, EVER (02b/02e §6).
//
// Pure helpers (no DB): normalize a phone to E.164-ish digits and hash it with a
// salt so the durable `trial_redemptions` ledger never stores a raw number. The
// hash is deterministic for a given (salt, phone), so the same phone always maps
// to the same row and the UNIQUE constraint enforces "once ever".
//
// The salt comes from CLINICAL_KMS_MASTER_KEY (already required in prod) so the
// hash isn't a bare SHA-256 of a 10-digit number (which is trivially rainbow-
// tableable). This module does the pure math; the DB read/write + credit grant
// happen at the trial-PAID confirmation point (IMPLEMENTATION-PLAN slice S5b),
// never at trial-create (a create whose payment fails must not burn the
// allowance).
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";
import { trialCreditGrant, type TrialCreditGrant } from "@workspace/subscription-rules";

/**
 * Normalize a phone to comparable digits. Strips spaces, dashes, parens, a
 * leading `+`, and a leading `0`; for a bare 10-digit Indian number, prefixes
 * the `91` country code so "+91 98…", "098…", and "98…" all collapse to one
 * canonical form. Returns "" for anything without at least 8 digits (caller
 * treats "" as "no usable identity" and does not gate on it).
 */
export function normalizeE164(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 8) return "";
  // Drop a single leading 0 (national trunk prefix).
  if (digits.startsWith("0")) digits = digits.slice(1);
  // Bare 10-digit Indian mobile → prefix country code.
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

/**
 * Salt for the phone hash. Prefers CLINICAL_KMS_MASTER_KEY / its aliases; falls
 * back to a fixed dev string so tests and local runs are deterministic. In
 * production the real key is always present (the server fails to boot without
 * it), so the fallback never applies there.
 */
function hashSalt(): string {
  return (
    process.env.CLINICAL_KMS_MASTER_KEY ||
    process.env.MASTER_KEY ||
    process.env.DPDPA_MASTER_KEY_HEX ||
    process.env.CLINICAL_MASTER_KEY_HEX ||
    "tanmatra-trial-salt-dev"
  );
}

/**
 * Salted SHA-256 (hex) of a normalized phone, for the `trial_redemptions`
 * ledger. Returns "" when the phone can't be normalized (no gating on a number
 * we can't identify). Deterministic for a fixed salt+phone.
 */
export function hashTrialPhone(raw: string | null | undefined): string {
  const normalized = normalizeE164(raw);
  if (!normalized) return "";
  return createHash("sha256").update(`${hashSalt()}:${normalized}`).digest("hex");
}

/**
 * The credit lot to grant when a trial is paid. Thin pass-through to the pure
 * spine descriptor so the api-server has a single import point; the caller
 * passes the result to `issueCredit` at the trial-paid point (S5b).
 */
export function trialCreditGrantFor(trialEndsAt: Date): TrialCreditGrant {
  return trialCreditGrant(trialEndsAt);
}
