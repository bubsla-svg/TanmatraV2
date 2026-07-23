/**
 * Onboarding auth gateway — the seam between the mobile onboarding UI and the
 * server auth endpoints. Pure (no React Native imports) so it is unit-testable
 * with an injected fetch.
 *
 * State of play (why `verifyOtp` is a seam, not a call):
 *   - `POST /auth/phone/send-otp` is real and reachable — it triggers the SMS.
 *     `sendOtp()` below calls it for real.
 *   - `POST /auth/phone/verify-otp` on the server expects a **Firebase ID
 *     token** (server-side comment: "send = Twilio; verify = a Firebase idToken
 *     from the client SDK") and, on success, issues a **cookie** session and
 *     returns `{ ok, user }` — no bearer token in the body.
 *   - The mobile app authenticates every request with a **bearer pairing
 *     token** (see lib/auth.ts) and has no Firebase dependency.
 *
 * So the mobile client cannot complete verification against main today without
 * (a) a Firebase phone-auth client to mint the idToken, AND (b) a server path
 * that returns a bearer token for native clients. That reconciliation is the
 * follow-up tracked for a later PR (see docs/NATIVE-ONBOARDING-PORT-PLAN.md).
 *
 * Until then `verifyOtp` runs through a provider seam:
 *   - "live"  → throws `AuthNotWiredError` (fails loud — never fakes a session).
 *   - "mock"  → resolves a clearly-marked dev result WITHOUT a real session, so
 *               the UI flow can be exercised in dev/CI. Selected only when
 *               `EXPO_PUBLIC_AUTH_MODE === "mock"` (never the production default).
 */

export type FetchImpl = typeof fetch;

export interface AuthGatewayConfig {
  apiBase: string;
  fetchImpl?: FetchImpl;
  /** "live" (default) or "mock". Resolved from EXPO_PUBLIC_AUTH_MODE by default. */
  mode?: AuthMode;
}

export type AuthMode = "live" | "mock";

export interface SendOtpResult {
  ok: true;
  /** Present only in the server's dev/mock mode. */
  devCode?: string;
}

export interface VerifyOtpResult {
  ok: true;
  /**
   * True whenever real server verification is not yet wired (mock provider).
   * The UI must treat the user as NOT durably signed in and must not persist a
   * session token. Lets the shell advance while staying honest.
   */
  pendingRealAuth: boolean;
}

export class AuthError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

/** Thrown by the live verify seam: real verification isn't wired yet. */
export class AuthNotWiredError extends AuthError {
  constructor() {
    super(
      "Phone verification isn't available yet on this build.",
      "verify_not_wired",
    );
    this.name = "AuthNotWiredError";
  }
}

export function resolveAuthMode(explicit?: AuthMode): AuthMode {
  if (explicit) return explicit;
  return process.env["EXPO_PUBLIC_AUTH_MODE"] === "mock" ? "mock" : "live";
}

/**
 * Trigger an OTP SMS via the real server endpoint. Throws {@link AuthError} on
 * a non-2xx response so the UI can surface it.
 */
export async function sendOtp(
  input: { countryCode: string; phone: string },
  config: AuthGatewayConfig,
): Promise<SendOtpResult> {
  const fetchImpl = config.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(`${config.apiBase}/auth/phone/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (err) {
    throw new AuthError(
      `Couldn't reach the server: ${(err as Error).message}`,
      "network",
    );
  }
  if (res.status === 429) {
    throw new AuthError("Too many attempts. Try again later.", "rate_limited");
  }
  if (!res.ok) {
    throw new AuthError(
      "Couldn't send the code. Check the number.",
      "send_failed",
    );
  }
  const json = (await res.json().catch(() => ({}))) as { devCode?: string };
  return { ok: true, ...(json.devCode ? { devCode: json.devCode } : {}) };
}

/**
 * Verify an OTP code. SEAM — see the module doc. In "live" mode this throws
 * until the Firebase-idToken + native-token reconciliation lands; in "mock"
 * mode it resolves a pending-real-auth result so the shell can be exercised.
 */
export async function verifyOtp(
  input: { countryCode: string; phone: string; code: string },
  config: AuthGatewayConfig,
): Promise<VerifyOtpResult> {
  const mode = resolveAuthMode(config.mode);
  if (mode === "mock") {
    // Dev/CI only. Accepts the server's mock code so the flow is drivable.
    if (input.code.trim() !== "123456") {
      throw new AuthError("Incorrect code.", "bad_code");
    }
    return { ok: true, pendingRealAuth: true };
  }
  // "live": never fabricate a session — real verification isn't wired yet.
  throw new AuthNotWiredError();
}
