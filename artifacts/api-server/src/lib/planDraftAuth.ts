import { type Request, type Response } from "express";
import type { PlanDraft } from "@workspace/db";

// ─────────────────────────────────────────────────────────────────────────────
// Guest ownership for PlanDraft (PR A2.1).
//
// A PlanDraft's `id` is already an opaque, unguessable, server-generated
// token (crypto.randomBytes(32).toString("hex") — see planDrafts.ts, mirrors
// sessionsTable.sid). That token is the guest ownership credential. Per the
// rebuild spec, it must live in "a secure, appropriate session mechanism",
// NOT in localStorage/sessionStorage where any XSS or browser extension can
// read it — so it is carried exclusively in an httpOnly cookie the frontend
// never touches. Knowing a draft's id (e.g. leaked via a referrer header or
// browser history) is deliberately NOT sufficient on its own to read a
// guest-owned draft; the request must also present the matching cookie.
//
// Once a draft is claimed (userId set via POST /plan-drafts/:id/claim),
// ownership switches entirely to the authenticated session — the cookie is
// no longer consulted for that draft, so a stale/shared cookie can never
// unlock another user's claimed draft.
// ─────────────────────────────────────────────────────────────────────────────

export const PLAN_DRAFT_COOKIE = "plan_draft_id";
export const PLAN_DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const isInsecureLocalDev =
  process.env["NODE_ENV"] !== "production" ||
  process.env["INSECURE_DEV_COOKIE"] === "1";

const sameSite = ((): "lax" | "strict" | "none" => {
  const v = (process.env["SESSION_SAMESITE"] ?? "lax").toLowerCase();
  return v === "none" || v === "strict" ? v : "lax";
})();

export function setPlanDraftCookie(res: Response, draftId: string): void {
  res.cookie(PLAN_DRAFT_COOKIE, draftId, {
    httpOnly: true,
    secure: !isInsecureLocalDev,
    sameSite,
    path: "/",
    maxAge: PLAN_DRAFT_TTL_MS,
  });
}

export function clearPlanDraftCookie(res: Response): void {
  res.clearCookie(PLAN_DRAFT_COOKIE, { path: "/" });
}

export function readPlanDraftCookie(req: Request): string | null {
  const raw = req.cookies?.[PLAN_DRAFT_COOKIE];
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/** The authenticated user id for this request, or null if unauthenticated.
 *  Deliberately duck-typed against `req.isAuthenticated`/`req.user` rather
 *  than importing requireAuthUser, since access resolution here must NOT
 *  short-circuit the response on its own (a failed guest-cookie check and a
 *  failed auth check both fall through to the same 404). */
function currentUserId(req: Request): string | null {
  return req.isAuthenticated() ? req.user.id : null;
}

export type PlanDraftAccessResult =
  | { ok: true }
  | { ok: false; status: 404 };

/**
 * Resolves whether the requester may read/modify `draft`.
 *   - Claimed draft (userId set): the authenticated user must match. A guest
 *     cookie is never sufficient once a draft has an owner.
 *   - Guest draft (userId null): the plan-draft cookie must name this exact
 *     draft. There is deliberately no "any authenticated user may read any
 *     unclaimed draft" fallback — claiming is the only ownership transfer.
 * Ownership failures and not-found both return 404 (never 403) so a probe
 * can't distinguish "not yours" from "doesn't exist".
 */
export function resolvePlanDraftAccess(
  req: Request,
  draft: Pick<PlanDraft, "id" | "userId">,
): PlanDraftAccessResult {
  if (draft.userId != null) {
    return draft.userId === currentUserId(req)
      ? { ok: true }
      : { ok: false, status: 404 };
  }
  return readPlanDraftCookie(req) === draft.id
    ? { ok: true }
    : { ok: false, status: 404 };
}
