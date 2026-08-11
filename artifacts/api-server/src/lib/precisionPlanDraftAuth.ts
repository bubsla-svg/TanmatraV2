import { type Request, type Response } from "express";
import type { PrecisionPlanDraft } from "@workspace/db";

// ─────────────────────────────────────────────────────────────────────────────
// Guest ownership for PrecisionPlanDraft — mirrors lib/planDraftAuth.ts's
// pattern for the same reason: the id is already an opaque, unguessable,
// server-generated token (crypto.randomBytes(32).toString("hex")), so it is
// the guest ownership credential. It lives exclusively in an httpOnly cookie
// the frontend never touches, never in localStorage/sessionStorage. Knowing a
// draft's id (e.g. leaked via a referrer header) is deliberately NOT
// sufficient on its own to read a guest-owned draft — the request must also
// present the matching cookie.
//
// Own module rather than reusing planDraftAuth.ts: a customer can have both a
// plan-quiz draft AND a precision-plan draft in flight at once, so they need
// distinct cookies. The security properties are identical; the identifiers
// are not shared, so the code isn't shared either.
// ─────────────────────────────────────────────────────────────────────────────

export const PRECISION_PLAN_DRAFT_COOKIE = "precision_plan_draft_id";
export const PRECISION_PLAN_DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const isInsecureLocalDev =
  process.env["NODE_ENV"] !== "production" ||
  process.env["INSECURE_DEV_COOKIE"] === "1";

const sameSite = ((): "lax" | "strict" | "none" => {
  const v = (process.env["SESSION_SAMESITE"] ?? "lax").toLowerCase();
  return v === "none" || v === "strict" ? v : "lax";
})();

export function setPrecisionPlanDraftCookie(res: Response, draftId: string): void {
  res.cookie(PRECISION_PLAN_DRAFT_COOKIE, draftId, {
    httpOnly: true,
    secure: !isInsecureLocalDev,
    sameSite,
    path: "/",
    maxAge: PRECISION_PLAN_DRAFT_TTL_MS,
  });
}

export function readPrecisionPlanDraftCookie(req: Request): string | null {
  const raw = req.cookies?.[PRECISION_PLAN_DRAFT_COOKIE];
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/** Deliberately duck-typed against `req.isAuthenticated`/`req.user` rather
 *  than importing requireAuthUser — access resolution here must NOT
 *  short-circuit the response on its own (a failed guest-cookie check and a
 *  failed auth check both fall through to the same 404). */
function currentUserId(req: Request): string | null {
  return req.isAuthenticated() ? req.user.id : null;
}

export type PrecisionPlanDraftAccessResult =
  | { ok: true }
  | { ok: false; status: 404 };

/**
 * Resolves whether the requester may read `draft`.
 *   - Claimed draft (userId set): the authenticated user must match.
 *   - Guest draft (userId null): the precision-plan-draft cookie must name
 *     this exact draft.
 * Ownership failures and not-found both return 404 (never 403) so a probe
 * can't distinguish "not yours" from "doesn't exist".
 */
export function resolvePrecisionPlanDraftAccess(
  req: Request,
  draft: Pick<PrecisionPlanDraft, "id" | "userId">,
): PrecisionPlanDraftAccessResult {
  if (draft.userId != null) {
    return draft.userId === currentUserId(req)
      ? { ok: true }
      : { ok: false, status: 404 };
  }
  return readPrecisionPlanDraftCookie(req) === draft.id
    ? { ok: true }
    : { ok: false, status: 404 };
}
