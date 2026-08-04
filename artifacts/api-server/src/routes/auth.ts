import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  AuthUser,
  PhoneSendOtpBody,
  PhoneSendOtpResponse,
  PhoneVerifyOtpBody,
  PhoneVerifyOtpResponse,
  LogoutResponse,
  UpdateProfileInfoBody,
  UpdateProfileInfoResponse,
  TruecallerVerifyBody,
  TruecallerVerifyResponse,
  type VerifyOtpAttribution,
} from "@workspace/api-zod";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  clearSession,
  createSession,
  getSession,
  getSessionId,
  updateSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
} from "../lib/auth";
import { normalisePhone, sendSmsOtp, maskE164 } from "../lib/sms";
import { verifyFirebaseIdToken } from "../lib/firebase";
import {
  verifyTruecallerToken,
  TruecallerVerifyError,
  type TruecallerProfile,
} from "../lib/truecaller";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Cookies are `secure` by default — only opt out when explicitly
// running on plain HTTP (local dev). Production / staging / preview
// envs are HTTPS-only, so a typo in NODE_ENV (e.g. "prod") cannot
// silently downgrade the cookie to be sent over HTTP.
const isInsecureLocalDev = 
  process.env["NODE_ENV"] !== "production" || 
  process.env["INSECURE_DEV_COOKIE"] === "1";

// When the SPA and API live on different origins (e.g. tanmatra.food →
// wellness-foods.run.app), cookies must be issued with SameSite=None so
// the browser includes them on cross-site fetches. SameSite=None *requires*
// Secure, which is already the default in non-dev. Operators set
// SESSION_SAMESITE=none on the cross-origin deployment.
const sessionSameSite = ((): "lax" | "strict" | "none" => {
  const v = (process.env["SESSION_SAMESITE"] ?? "lax").toLowerCase();
  return v === "none" || v === "strict" ? v : "lax";
})();

// Browsers reject SameSite=None cookies that aren't also Secure, which
// would silently break login on the cross-origin deployment. Refuse to
// boot if the operator sets that combination — it's never what they
// meant. (Production never sets INSECURE_DEV_COOKIE, so this only
// catches misconfigured dev/preview environments.)
if (sessionSameSite === "none" && isInsecureLocalDev) {
  throw new Error(
    "SESSION_SAMESITE=none requires Secure cookies; unset INSECURE_DEV_COOKIE.",
  );
}
// In production, "lax" is the right default for same-origin SPA+API
// deployments, but a cross-origin deployment will silently lose its
// session on every cross-site request. Surface the choice loudly so
// ops sees it in boot logs.
if (process.env["NODE_ENV"] === "production") {
  logger.info(
    { sameSite: sessionSameSite },
    "session cookie SameSite policy",
  );
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: !isInsecureLocalDev,
    sameSite: sessionSameSite,
    path: "/",
    maxAge: SESSION_TTL,
  });
}

// --- Rate limiting (per-IP and per-phone) — see lib/rateLimit.ts -----------

import { rateLimit } from "../lib/rateLimit";

function clientIp(req: Request): string {
  // Relies on `app.set("trust proxy", 2)` (app.ts) so req.ip resolves past
  // BOTH trusted hops (GCLB, then the storefront's own /api rewrite) to the
  // actual visitor's address instead of the storefront's shared one.
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

// --- Routes -----------------------------------------------------------------

import {
  rotateRefreshToken,
} from "../lib/refreshTokenRotation";

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

/**
 * POST /auth/refresh
 * Silent background token refresh endpoint.
 * - Extends session TTL invisibly without interrupting user workflow.
 * - Rotates refresh tokens on every call (Single-Use Token Rotation).
 * - Detects token reuse compromise and revokes token family if replay attack occurs.
 */
router.post("/auth/refresh", async (req: Request, res: Response): Promise<void> => {
  const presentedRefreshToken =
    (req.body?.refreshToken as string) ??
    (req.headers["x-refresh-token"] as string) ??
    req.cookies?.["refreshToken"];

  const sid = getSessionId(req);

  // If no refresh token provided, try active session background touch
  if (!presentedRefreshToken) {
    if (sid) {
      const session = await getSession(sid);
      if (session) {
        // Extend session TTL silently
        await updateSession(sid, session);
        setSessionCookie(res, sid);
        res.json({ ok: true, user: session.user, refreshed: "session_extended" });
        return;
      }
    }
    // Graceful Failure Step 2: Session expired -> indicate preserveState to client
    res.status(401).json({
      error: "session expired",
      code: "session_expired",
      preserveState: true,
      redirect: "/login",
    });
    return;
  }

  // Token Rotation & Reuse Check
  const rotationResult = await rotateRefreshToken(presentedRefreshToken);

  if (!rotationResult.success) {
    if (rotationResult.reason === "reuse_compromise") {
      // Step 3 Compromise Guard: Theft replay detected -> revoke session immediately
      if (sid) await clearSession(res, sid);
      res.status(401).json({
        error: "security breach: token reuse detected",
        code: "token_reuse_compromise",
        action: "revoke_all_sessions",
        redirect: "/login",
      });
      return;
    }

    // Standard expiry or not found
    if (sid) await clearSession(res, sid);
    res.status(401).json({
      error: "refresh token invalid or expired",
      code: "session_expired",
      preserveState: true,
      redirect: "/login",
    });
    return;
  }

  // Rotation Succeeded: Issue rotated refresh token & update session
  const { newToken } = rotationResult;
  res.cookie("refreshToken", newToken.token, {
    httpOnly: true,
    secure: !isInsecureLocalDev,
    sameSite: sessionSameSite,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  if (sid) {
    const existing = await getSession(sid);
    if (existing) {
      await updateSession(sid, existing);
      setSessionCookie(res, sid);
    }
  }

  res.json({
    ok: true,
    refreshed: true,
    refreshToken: newToken.token,
    expiresAt: newToken.expiresAt.toISOString(),
  });
});

router.post(
  "/auth/phone/send-otp",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = PhoneSendOtpBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid phone" });
      return;
    }
    const num = normalisePhone(parsed.data.countryCode, parsed.data.phone);
    if (!num) {
      res.status(400).json({ error: "invalid phone" });
      return;
    }

    if (!(await rateLimit(`auth:otp:ip:${clientIp(req)}`, 60 * 60_000, 20))) {
      res.status(429).json({ error: "too many requests" });
      return;
    }
    if (!(await rateLimit(`auth:otp:ph:${num.e164}`, 60 * 60_000, 5))) {
      res.status(429).json({ error: "too many requests" });
      return;
    }

    const result = await sendSmsOtp(num);
    if (!result.ok) {
      res.status(502).json({ error: result.error ?? "send failed" });
      return;
    }
    logger.info({ e164: num.e164 }, "auth.phone.otp_sent");
    res.json(
      PhoneSendOtpResponse.parse({
        ok: true,
        ...(result.devCode ? { devCode: result.devCode } : {}),
      }),
    );
  },
);

router.post(
  "/auth/phone/verify-otp",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = PhoneVerifyOtpBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid input" });
      return;
    }

    if (!(await rateLimit(`auth:verify:ip:${clientIp(req)}`, 60 * 60_000, 30))) {
      res.status(429).json({ error: "too many requests" });
      return;
    }

    let phoneE164: string;
    try {
      phoneE164 = await verifyFirebaseIdToken(parsed.data.idToken);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "auth.phone.firebase_verify_failed");
      res.status(401).json({ error: "invalid token" });
      return;
    }

    // Upsert the user by their verified phone. We let the DB generate the
    // user id on first sign-in (gen_random_uuid()).
    const now = new Date();
    const attr = parsed.data.attribution;
    const consentUpdates: Record<string, Date | string> = {
      phoneVerifiedAt: now,
      updatedAt: now,
    };
    if (attr?.marketingSmsConsent === true) {
      consentUpdates["marketingSmsConsentAt"] = now;
    }
    if (attr?.dpdpConsent === true) {
      consentUpdates["dpdpConsentAt"] = now;
    }
    if (attr?.tosVersion) {
      consentUpdates["tosAcceptedVersion"] = attr.tosVersion;
    }
    const [user] = await db
      .insert(usersTable)
      .values({
        phoneE164: phoneE164,
        phoneVerifiedAt: now,
        signupSource: attr?.signupSource,
        utmSource: attr?.utmSource,
        utmMedium: attr?.utmMedium,
        utmCampaign: attr?.utmCampaign,
        referralCode: attr?.referralCode,
        marketingSmsConsentAt:
          attr?.marketingSmsConsent === true ? now : undefined,
        dpdpConsentAt: attr?.dpdpConsent === true ? now : undefined,
        tosAcceptedVersion: attr?.tosVersion,
      })
      .onConflictDoUpdate({
        target: usersTable.phoneE164,
        set: consentUpdates,
      })
      .returning();

    if (!user) {
      logger.error({ e164: phoneE164 }, "auth.phone.upsert_failed");
      res.status(500).json({ error: "could not create session" });
      return;
    }

    const authUser = AuthUser.parse({
      id: user.id,
      phoneE164: user.phoneE164,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    });

    const sid = await createSession({
      user: authUser,
      kind: "phone-otp",
      createdAt: Date.now(),
    });
    setSessionCookie(res, sid);

    logger.info(
      { userId: user.id, e164: phoneE164 },
      "auth.phone.session_created",
    );

    res.json(
      PhoneVerifyOtpResponse.parse({ ok: true, user: authUser }),
    );
  },
);

/**
 * Upsert a user by a phone number that has ALREADY been verified by a trusted
 * provider (Truecaller here). Attribution + optional names are applied only on
 * first creation; a returning user's edited name/email is never clobbered — we
 * only refresh the verification timestamp and any freshly-granted consents.
 */
async function upsertUserByVerifiedPhone(
  phoneE164: string,
  attr: VerifyOtpAttribution | undefined,
  names: { firstName?: string; lastName?: string },
) {
  const now = new Date();
  const consentUpdates: Record<string, Date | string> = {
    phoneVerifiedAt: now,
    updatedAt: now,
  };
  if (attr?.marketingSmsConsent === true) {
    consentUpdates["marketingSmsConsentAt"] = now;
  }
  if (attr?.dpdpConsent === true) {
    consentUpdates["dpdpConsentAt"] = now;
  }
  if (attr?.tosVersion) {
    consentUpdates["tosAcceptedVersion"] = attr.tosVersion;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      phoneE164,
      phoneVerifiedAt: now,
      firstName: names.firstName,
      lastName: names.lastName,
      signupSource: attr?.signupSource ?? "truecaller",
      utmSource: attr?.utmSource,
      utmMedium: attr?.utmMedium,
      utmCampaign: attr?.utmCampaign,
      referralCode: attr?.referralCode,
      marketingSmsConsentAt:
        attr?.marketingSmsConsent === true ? now : undefined,
      dpdpConsentAt: attr?.dpdpConsent === true ? now : undefined,
      tosAcceptedVersion: attr?.tosVersion,
    })
    .onConflictDoUpdate({
      target: usersTable.phoneE164,
      set: consentUpdates,
    })
    .returning();
  return user;
}

// POST /auth/truecaller/verify — Truecaller 1-Tap sign-in. The client sends a
// Truecaller OAuth authorization code + PKCE verifier; we verify with Truecaller
// and derive the phone from *their* userinfo response (never the client's), then
// mint a session exactly like the OTP path. See lib/truecaller.ts for the
// security invariant this endpoint depends on.
router.post(
  "/auth/truecaller/verify",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = TruecallerVerifyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid input" });
      return;
    }

    // Per-IP only: a per-phone limit is impossible before verification because
    // we (deliberately) do not trust any client-supplied number here.
    if (!(await rateLimit(`auth:tc:ip:${clientIp(req)}`, 60 * 60_000, 30))) {
      res.status(429).json({ error: "too many requests" });
      return;
    }

    let profile: TruecallerProfile;
    try {
      profile = await verifyTruecallerToken({
        authorizationCode: parsed.data.authorizationCode,
        codeVerifier: parsed.data.codeVerifier,
        devPhoneE164: parsed.data.devPhoneE164,
      });
    } catch (err) {
      if (err instanceof TruecallerVerifyError && err.reason === "config") {
        logger.error({ err: err.message }, "auth.truecaller.not_configured");
        res.status(503).json({ error: "Truecaller sign-in is unavailable" });
        return;
      }
      logger.warn(
        { err: (err as Error).message },
        "auth.truecaller.verify_failed",
      );
      res.status(401).json({ error: "invalid token" });
      return;
    }

    const user = await upsertUserByVerifiedPhone(
      profile.phoneE164,
      parsed.data.attribution,
      { firstName: profile.firstName, lastName: profile.lastName },
    );
    if (!user) {
      logger.error(
        { e164: profile.phoneE164 },
        "auth.truecaller.upsert_failed",
      );
      res.status(500).json({ error: "could not create session" });
      return;
    }

    const authUser = AuthUser.parse({
      id: user.id,
      phoneE164: user.phoneE164,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    });

    const sid = await createSession({
      user: authUser,
      kind: "truecaller",
      createdAt: Date.now(),
    });
    setSessionCookie(res, sid);

    logger.info(
      { userId: user.id, e164: maskE164(profile.phoneE164) },
      "auth.truecaller.session_created",
    );

    res.json(TruecallerVerifyResponse.parse({ ok: true, user: authUser }));
  },
);

// PATCH /auth/profile-info — first name / last name / email capture. Used by
// the post-OTP "what should we call you?" modal AND any future inline edit
// in /account. PATCH semantics: omitted fields stay untouched.
router.patch(
  "/auth/profile-info",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ error: "not authenticated" });
      return;
    }
    const parsed = UpdateProfileInfoBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid input" });
      return;
    }
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (parsed.data.firstName !== undefined) {
      updates.firstName = parsed.data.firstName;
    }
    if (parsed.data.lastName !== undefined) {
      updates.lastName = parsed.data.lastName;
    }
    if (parsed.data.email !== undefined) {
      updates.email = parsed.data.email.toLowerCase();
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "no fields to update" });
      return;
    }
    try {
      const [updated] = await db
        .update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, req.user.id))
        .returning();
      if (!updated) {
        res.status(404).json({ error: "user not found" });
        return;
      }
      const freshUser = AuthUser.parse({
        id: updated.id,
        phoneE164: updated.phoneE164,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        profileImageUrl: updated.profileImageUrl,
      });
      // Refresh the session blob so subsequent requests in the same session
      // (e.g. /auth/user, headers reading req.user.firstName) see the new
      // values immediately. Without this, a brand-new user would complete
      // the WelcomeModal but the header would still show "no name" until
      // they re-logged in. We re-read the session before writing so we
      // don't clobber other fields the session might carry.
      const sid = getSessionId(req);
      if (sid) {
        const existing = await getSession(sid);
        if (existing) {
          await updateSession(sid, { ...existing, user: freshUser });
        }
      }
      res.json(
        UpdateProfileInfoResponse.parse({
          ok: true,
          user: freshUser,
        }),
      );
    } catch (e) {
      // Most likely cause: unique constraint on email (another account
      // already owns this address). Surface as 409 so the client can show a
      // sensible message instead of a generic 500.
      const msg = String(e instanceof Error ? e.message : e);
      if (msg.includes("unique") || msg.includes("duplicate")) {
        res.status(409).json({ error: "email already in use" });
        return;
      }
      logger.error({ err: msg, userId: req.user.id }, "auth.profile.update_failed");
      res.status(500).json({ error: "could not update profile" });
    }
  },
);

router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json(LogoutResponse.parse({ success: true }));
});

router.delete("/user/account", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "not authenticated" });
    return;
  }
  const userId = req.user.id;

  await db
    .update(usersTable)
    .set({ deletedAt: new Date() })
    .where(eq(usersTable.id, userId));

  const userSessions = await db
    .select({ sid: sessionsTable.sid })
    .from(sessionsTable)
    .where(sql`${sessionsTable.sess}->'user'->>'id' = ${userId}`);

  for (const sess of userSessions) {
    await deleteSession(sess.sid, db);
  }

  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ success: true });
});

// Legacy GET /login — the OIDC redirect is gone; bounce the browser to the
// in-app login screen. Preserves a `returnTo` query if provided.
router.get("/login", (req: Request, res: Response): void => {
  const returnToRaw = req.query.returnTo;
  const next =
    typeof returnToRaw === "string" &&
    returnToRaw.startsWith("/") &&
    !returnToRaw.startsWith("//")
      ? returnToRaw
      : "/";
  res.redirect(`/login?next=${encodeURIComponent(next)}`);
});

export default router;
