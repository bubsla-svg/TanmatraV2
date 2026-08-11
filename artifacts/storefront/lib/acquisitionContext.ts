/**
 * Acquisition-context handoff (D-04B / TNM-CRO-01 owner ruling 2026-08-11).
 * `AcquisitionContext` (./types.ts) is the repo's own backbone object for
 * carrying an acquisition-time signal across a multi-page handoff — this
 * module builds one from a self-serve quick-setup completion and threads it
 * through the exit URL as an opaque `acquisitionContextId`, never a parallel
 * param bag.
 *
 * Persistence mirrors quickSetupDraft.ts: sessionStorage, same-tab, dies with
 * the tab, storage failures never break the redirect (the goal/condition/plan
 * signal also rides the exit URL directly, so a storage failure here loses
 * only the context object's extra fields, not the routing decision itself).
 */
import type { AcquisitionContext, AcquisitionSource } from "./types";

const KEY_PREFIX = "tnm:acquisition-context:";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for runtimes without crypto.randomUUID — collision odds are
  // irrelevant here (a same-tab, session-scoped, non-security id).
  return `ac_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

/** Builds and persists an AcquisitionContext for a self-serve quick-setup
 *  completion, returning its id for the exit URL's `acquisitionContextId`. */
export function createAcquisitionContext(
  opts: { intendedGoal?: string; recommendedPlanId?: string; returnRoute: string },
  storage: StorageLike | null = defaultStorage(),
): string {
  const id = generateId();
  const ctx: AcquisitionContext = {
    sourceType: "organic",
    intendedGoal: opts.intendedGoal,
    recommendedPlanId: opts.recommendedPlanId,
    verificationStatus: "not-required",
    eligibleBenefitIds: [],
    returnRoute: opts.returnRoute,
  };
  if (storage) {
    try {
      storage.setItem(`${KEY_PREFIX}${id}`, JSON.stringify(ctx));
    } catch {
      // Quota or privacy failures — the id still routes; the routing decision
      // itself rides the exit URL's own condition/goal params, not this store.
    }
  }
  return id;
}

const ACQUISITION_SOURCES: readonly AcquisitionSource[] = [
  "organic",
  "corporate",
  "gym",
  "fitness-club",
  "dietitian",
  "challenge",
  "referral",
  "campaign",
];

const VERIFICATION_STATUSES: readonly AcquisitionContext["verificationStatus"][] = [
  "not-required",
  "pending",
  "verified",
  "failed",
  "expired",
];

function isValidAcquisitionContext(x: unknown): x is AcquisitionContext {
  if (typeof x !== "object" || x === null) return false;
  const c = x as Record<string, unknown>;
  return (
    (ACQUISITION_SOURCES as string[]).includes(c["sourceType"] as string) &&
    (VERIFICATION_STATUSES as string[]).includes(c["verificationStatus"] as string) &&
    Array.isArray(c["eligibleBenefitIds"]) &&
    c["eligibleBenefitIds"].every((v) => typeof v === "string") &&
    typeof c["returnRoute"] === "string" &&
    (c["sourceId"] === undefined || typeof c["sourceId"] === "string") &&
    (c["campaignId"] === undefined || typeof c["campaignId"] === "string") &&
    (c["referralCode"] === undefined || typeof c["referralCode"] === "string") &&
    (c["intendedGoal"] === undefined || typeof c["intendedGoal"] === "string") &&
    (c["recommendedPlanId"] === undefined || typeof c["recommendedPlanId"] === "string") &&
    (c["expiresAt"] === undefined || typeof c["expiresAt"] === "string")
  );
}

/** Reads back a persisted AcquisitionContext by id. null when absent,
 *  corrupt, or storage is unreadable — callers fall back to the URL's own
 *  condition/goal params, which carry the same decision independently. */
export function readAcquisitionContext(
  id: string,
  storage: StorageLike | null = defaultStorage(),
): AcquisitionContext | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(`${KEY_PREFIX}${id}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidAcquisitionContext(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
