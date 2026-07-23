import { logger } from "./logger";

/**
 * Truecaller 1-Tap sign-in verification (OAuth 2.0 + PKCE).
 *
 * The mobile app runs Truecaller's bottom-sheet OAuth flow and receives an
 * authorization code plus the PKCE `code_verifier` it generated. It sends both
 * to us; we exchange them with Truecaller for an access token and then read the
 * VERIFIED phone number from Truecaller's userinfo endpoint.
 *
 * The security invariant: the phone number is *always* derived from Truecaller,
 * never taken from the client. A caller therefore cannot mint a session for a
 * number it does not control — which is exactly the bypass this endpoint had in
 * its original form (it trusted a client-supplied phone + opaque token).
 *
 * Required env (production): TRUECALLER_CLIENT_ID. Endpoint hosts are region
 * specific — the non-EU hosts are the default for the India launch and can be
 * overridden via TRUECALLER_TOKEN_URL / TRUECALLER_USERINFO_URL. Set
 * TRUECALLER_REDIRECT_URI when the authorize step uses one (RFC 6749 §4.1.3).
 *
 * Mock mode: when TRUECALLER_CLIENT_ID is unset AND NODE_ENV !== "production",
 * the verifier accepts a dev-supplied `devPhoneE164` so local/CI can drive the
 * flow without real credentials — mirroring the OTP mock in `sms.ts`. In
 * production, mock mode is refused (fails closed) so a missing credential can
 * never silently downgrade to "trust the client".
 */

const DEFAULT_TOKEN_URL = "https://oauth-account-noneu.truecaller.com/v1/token";
const DEFAULT_USERINFO_URL =
  "https://oauth-account-noneu.truecaller.com/v1/userinfo";

export interface TruecallerProfile {
  /** E.164, verified by Truecaller. */
  phoneE164: string;
  firstName?: string;
  lastName?: string;
}

export interface VerifyTruecallerInput {
  authorizationCode: string;
  codeVerifier: string;
  /** Dev/CI only — see module doc. Never read in production. */
  devPhoneE164?: string;
}

export interface VerifyTruecallerOptions {
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export type TruecallerVerifyReason =
  | "config"
  | "exchange"
  | "userinfo"
  | "no_phone";

/** Thrown on any verification failure — the route maps this to 4xx/5xx. */
export class TruecallerVerifyError extends Error {
  readonly reason: TruecallerVerifyReason;
  constructor(message: string, reason: TruecallerVerifyReason) {
    super(message);
    this.name = "TruecallerVerifyError";
    this.reason = reason;
  }
}

function hasTruecallerCreds(): boolean {
  return Boolean(process.env["TRUECALLER_CLIENT_ID"]);
}

/** Mock is only allowed outside production — same posture as sms.ts. */
function mockAllowed(): boolean {
  return (process.env["NODE_ENV"] ?? "development") !== "production";
}

/**
 * Mask an E.164 number for logs — keep the country code + last 2 digits, hide
 * the rest. Kept local (rather than importing sms.ts' maskE164) so this pure
 * verifier carries no database import and stays unit-testable without a DB.
 */
function maskE164(e164: string): string {
  const m = /^(\+\d{1,4})(\d+)$/.exec(e164);
  if (!m) return "***";
  const cc = m[1] ?? "";
  const rest = m[2] ?? "";
  if (rest.length <= 2) return `${cc}**`;
  return `${cc}${"*".repeat(rest.length - 2)}${rest.slice(-2)}`;
}

/** Validate an already-combined E.164 string (e.g. "+919876543210"). */
function normaliseE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/[\s-]/g, "");
  return /^\+\d{8,15}$/.test(trimmed) ? trimmed : null;
}

/**
 * Exchange a Truecaller OAuth authorization code for the verified profile.
 * Throws {@link TruecallerVerifyError} on any failure (never resolves with an
 * unverified or client-supplied phone number).
 */
export async function verifyTruecallerToken(
  input: VerifyTruecallerInput,
  opts: VerifyTruecallerOptions = {},
): Promise<TruecallerProfile> {
  const fetchImpl = opts.fetchImpl ?? fetch;

  if (!hasTruecallerCreds()) {
    if (!mockAllowed()) {
      throw new TruecallerVerifyError(
        "Truecaller sign-in is not configured",
        "config",
      );
    }
    // Dev/CI mock: the dev must name which test user to sign in. We never
    // invent a number here, and this branch is unreachable in production.
    const e164 = normaliseE164(input.devPhoneE164);
    if (!e164) {
      throw new TruecallerVerifyError(
        "mock Truecaller verify requires a valid devPhoneE164",
        "no_phone",
      );
    }
    logger.info({ e164: maskE164(e164) }, "truecaller.mock_verify");
    return { phoneE164: e164, firstName: "Dev", lastName: "User" };
  }

  const clientId = process.env["TRUECALLER_CLIENT_ID"]!;
  const tokenUrl = process.env["TRUECALLER_TOKEN_URL"] ?? DEFAULT_TOKEN_URL;
  const userinfoUrl =
    process.env["TRUECALLER_USERINFO_URL"] ?? DEFAULT_USERINFO_URL;

  // 1. Exchange the authorization code for an access token (PKCE — no client
  //    secret; the code_verifier proves the caller started the flow). RFC 6749
  //    §4.1.3 requires `redirect_uri` in the exchange iff one was sent at the
  //    authorize step — include it when the deployment configures one.
  const tokenBody: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: clientId,
    code: input.authorizationCode,
    code_verifier: input.codeVerifier,
  };
  const redirectUri = process.env["TRUECALLER_REDIRECT_URI"];
  if (redirectUri) tokenBody["redirect_uri"] = redirectUri;

  let tokenRes: Response;
  try {
    tokenRes = await fetchImpl(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(tokenBody).toString(),
    });
  } catch (err) {
    throw new TruecallerVerifyError(
      `Truecaller token exchange threw: ${(err as Error).message}`,
      "exchange",
    );
  }
  if (!tokenRes.ok) {
    throw new TruecallerVerifyError(
      `Truecaller token exchange failed (${tokenRes.status})`,
      "exchange",
    );
  }
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
  };
  if (!tokenJson.access_token) {
    throw new TruecallerVerifyError(
      "Truecaller token exchange returned no access token",
      "exchange",
    );
  }

  // 2. Read the verified profile with the access token.
  let infoRes: Response;
  try {
    infoRes = await fetchImpl(userinfoUrl, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
  } catch (err) {
    throw new TruecallerVerifyError(
      `Truecaller userinfo threw: ${(err as Error).message}`,
      "userinfo",
    );
  }
  if (!infoRes.ok) {
    throw new TruecallerVerifyError(
      `Truecaller userinfo request failed (${infoRes.status})`,
      "userinfo",
    );
  }
  const info = (await infoRes.json().catch(() => ({}))) as {
    phone_number?: string;
    phoneNumbers?: string[];
    given_name?: string;
    family_name?: string;
  };

  // The phone comes ONLY from Truecaller's response — never from the client.
  const e164 = normaliseE164(info.phone_number ?? info.phoneNumbers?.[0]);
  if (!e164) {
    throw new TruecallerVerifyError(
      "Truecaller profile has no usable phone number",
      "no_phone",
    );
  }
  return {
    phoneE164: e164,
    ...(info.given_name ? { firstName: info.given_name } : {}),
    ...(info.family_name ? { lastName: info.family_name } : {}),
  };
}
