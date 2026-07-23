/**
 * Unit tests for the Truecaller OAuth verifier — the security core of the
 * 1-Tap sign-in endpoint. No database or network: the Truecaller HTTP calls
 * are stubbed via an injected fetch.
 *
 * The central property under test: the verified phone number is ALWAYS derived
 * from Truecaller's userinfo response, never from client input. This is the fix
 * for the original endpoint's auth bypass (it trusted a client-supplied phone).
 *
 * Run with:
 *   node --test --import tsx ./src/lib/truecaller.test.ts
 */

import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";

import { verifyTruecallerToken, TruecallerVerifyError } from "./truecaller";

// --- env save/restore -------------------------------------------------------

const ENV_KEYS = [
  "TRUECALLER_CLIENT_ID",
  "TRUECALLER_TOKEN_URL",
  "TRUECALLER_USERINFO_URL",
  "TRUECALLER_REDIRECT_URI",
  "NODE_ENV",
] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

// --- fetch stub helpers -----------------------------------------------------

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A fetch stub that returns the queued responses in call order. */
function sequenceFetch(responses: Response[]): {
  fetchImpl: typeof fetch;
  calls: Array<{ url: string; init?: RequestInit }>;
} {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let i = 0;
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const res = responses[i++];
    if (!res) throw new Error("unexpected extra fetch call");
    return res;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const VALID_INPUT = {
  authorizationCode: "auth-code-abc",
  codeVerifier: "pkce-verifier-xyz",
};

// --- production / real-credential path --------------------------------------

test("derives the verified phone from Truecaller userinfo (never the client)", async () => {
  process.env["NODE_ENV"] = "production";
  process.env["TRUECALLER_CLIENT_ID"] = "test-client-id";
  const { fetchImpl, calls } = sequenceFetch([
    jsonResponse(200, { access_token: "tc-access-token" }),
    jsonResponse(200, {
      phone_number: "+919876500011",
      given_name: "Asha",
      family_name: "Rao",
    }),
  ]);

  const profile = await verifyTruecallerToken(
    // A hostile client tries to smuggle a different number — it must be ignored.
    { ...VALID_INPUT, devPhoneE164: "+919999999999" },
    { fetchImpl },
  );

  assert.equal(profile.phoneE164, "+919876500011");
  assert.equal(profile.firstName, "Asha");
  assert.equal(profile.lastName, "Rao");
  // Token exchange first, then userinfo with the bearer token.
  assert.equal(calls.length, 2);
  assert.match(calls[0]!.url, /\/token$/);
  assert.match(calls[1]!.url, /\/userinfo$/);
  const authHeader = new Headers(calls[1]!.init?.headers).get("authorization");
  assert.equal(authHeader, "Bearer tc-access-token");
});

test("throws (exchange) when the token endpoint rejects the code", async () => {
  process.env["NODE_ENV"] = "production";
  process.env["TRUECALLER_CLIENT_ID"] = "test-client-id";
  const { fetchImpl } = sequenceFetch([
    jsonResponse(401, { error: "invalid_grant" }),
  ]);

  await assert.rejects(
    () => verifyTruecallerToken(VALID_INPUT, { fetchImpl }),
    (err: unknown) =>
      err instanceof TruecallerVerifyError && err.reason === "exchange",
  );
});

test("throws (exchange) when the token response carries no access_token", async () => {
  process.env["NODE_ENV"] = "production";
  process.env["TRUECALLER_CLIENT_ID"] = "test-client-id";
  const { fetchImpl } = sequenceFetch([
    jsonResponse(200, { token_type: "bearer" }),
  ]);

  await assert.rejects(
    () => verifyTruecallerToken(VALID_INPUT, { fetchImpl }),
    (err: unknown) =>
      err instanceof TruecallerVerifyError && err.reason === "exchange",
  );
});

test("throws (userinfo) when the userinfo endpoint fails", async () => {
  process.env["NODE_ENV"] = "production";
  process.env["TRUECALLER_CLIENT_ID"] = "test-client-id";
  const { fetchImpl } = sequenceFetch([
    jsonResponse(200, { access_token: "tc-access-token" }),
    jsonResponse(500, { error: "server_error" }),
  ]);

  await assert.rejects(
    () => verifyTruecallerToken(VALID_INPUT, { fetchImpl }),
    (err: unknown) =>
      err instanceof TruecallerVerifyError && err.reason === "userinfo",
  );
});

test("throws (no_phone) when the verified profile has no phone number", async () => {
  process.env["NODE_ENV"] = "production";
  process.env["TRUECALLER_CLIENT_ID"] = "test-client-id";
  const { fetchImpl } = sequenceFetch([
    jsonResponse(200, { access_token: "tc-access-token" }),
    jsonResponse(200, { given_name: "NoPhone" }),
  ]);

  await assert.rejects(
    () => verifyTruecallerToken(VALID_INPUT, { fetchImpl }),
    (err: unknown) =>
      err instanceof TruecallerVerifyError && err.reason === "no_phone",
  );
});

test("throws (no_phone) when Truecaller returns a non-E.164 phone", async () => {
  process.env["NODE_ENV"] = "production";
  process.env["TRUECALLER_CLIENT_ID"] = "test-client-id";
  const { fetchImpl } = sequenceFetch([
    jsonResponse(200, { access_token: "tc-access-token" }),
    jsonResponse(200, { phone_number: "98765" }),
  ]);

  await assert.rejects(
    () => verifyTruecallerToken(VALID_INPUT, { fetchImpl }),
    (err: unknown) =>
      err instanceof TruecallerVerifyError && err.reason === "no_phone",
  );
});

test("includes redirect_uri in the exchange only when configured", async () => {
  process.env["NODE_ENV"] = "production";
  process.env["TRUECALLER_CLIENT_ID"] = "test-client-id";

  // Not set → body omits redirect_uri.
  delete process.env["TRUECALLER_REDIRECT_URI"];
  const a = sequenceFetch([
    jsonResponse(200, { access_token: "t" }),
    jsonResponse(200, { phone_number: "+919812345678" }),
  ]);
  await verifyTruecallerToken(VALID_INPUT, { fetchImpl: a.fetchImpl });
  assert.doesNotMatch(String(a.calls[0]!.init?.body), /redirect_uri/);

  // Set → body carries the configured redirect_uri.
  process.env["TRUECALLER_REDIRECT_URI"] = "tanmatra://auth/truecaller";
  const b = sequenceFetch([
    jsonResponse(200, { access_token: "t" }),
    jsonResponse(200, { phone_number: "+919812345678" }),
  ]);
  await verifyTruecallerToken(VALID_INPUT, { fetchImpl: b.fetchImpl });
  assert.match(
    String(b.calls[0]!.init?.body),
    /redirect_uri=tanmatra%3A%2F%2Fauth%2Ftruecaller/,
  );
});

test("accepts the alternate phoneNumbers[] profile shape", async () => {
  process.env["NODE_ENV"] = "production";
  process.env["TRUECALLER_CLIENT_ID"] = "test-client-id";
  const { fetchImpl } = sequenceFetch([
    jsonResponse(200, { access_token: "tc-access-token" }),
    jsonResponse(200, { phoneNumbers: ["+919812345678"] }),
  ]);

  const profile = await verifyTruecallerToken(VALID_INPUT, { fetchImpl });
  assert.equal(profile.phoneE164, "+919812345678");
});

// --- fail-closed in production without credentials --------------------------

test("throws (config) in production when TRUECALLER_CLIENT_ID is missing", async () => {
  process.env["NODE_ENV"] = "production";
  delete process.env["TRUECALLER_CLIENT_ID"];
  // Even a well-formed devPhoneE164 must NOT be honoured in production.
  await assert.rejects(
    () =>
      verifyTruecallerToken({ ...VALID_INPUT, devPhoneE164: "+919876500011" }),
    (err: unknown) =>
      err instanceof TruecallerVerifyError && err.reason === "config",
  );
});

// --- dev/CI mock mode -------------------------------------------------------

test("mock mode (no creds, non-prod) returns the dev-supplied phone", async () => {
  process.env["NODE_ENV"] = "test";
  delete process.env["TRUECALLER_CLIENT_ID"];
  const profile = await verifyTruecallerToken({
    ...VALID_INPUT,
    devPhoneE164: "+919876500022",
  });
  assert.equal(profile.phoneE164, "+919876500022");
});

test("mock mode requires a valid devPhoneE164 (no invented numbers)", async () => {
  process.env["NODE_ENV"] = "test";
  delete process.env["TRUECALLER_CLIENT_ID"];
  await assert.rejects(
    () => verifyTruecallerToken(VALID_INPUT),
    (err: unknown) =>
      err instanceof TruecallerVerifyError && err.reason === "no_phone",
  );
});
