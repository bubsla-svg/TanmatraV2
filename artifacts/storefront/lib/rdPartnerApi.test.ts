/**
 * RD-partner application client's wire contract (injected fetch, no network).
 * Locks method/path/body/credentials and every documented status branch against
 * artifacts/api-server/src/routes/rdPartners.ts.
 * Run: node --test --import tsx ./lib/rdPartnerApi.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./apiClient";
import {
  newRdSessionId,
  sendRdWhatsappOtp,
  submitRdApplication,
  trackRdWizardEvent,
  verifyRdWhatsappOtp,
  RD_CLIENT_VOLUME_LABELS,
  RD_PRACTICE_SETTINGS,
  type RdApplicationInput,
} from "./rdPartnerApi";

interface Call { method: string; url: string; credentials?: string; body?: unknown }

function fakeFetch(calls: Call[], respond: () => { status: number; body: unknown }): typeof fetch {
  return (async (url: unknown, init: Record<string, unknown>) => {
    calls.push({
      method: String(init.method),
      url: String(url),
      credentials: init.credentials as string | undefined,
      body: init.body,
    });
    const { status, body } = respond();
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      text: async () => (body === undefined ? "" : JSON.stringify(body)),
    };
  }) as unknown as typeof fetch;
}

const SESSION = "11111111-2222-3333-4444-555555555555";

const APPLICATION: RdApplicationInput = {
  path: "partner",
  fullName: "Meera Iyer",
  email: "meera@clinic.test",
  credentials: "RD, MSc Clinical Nutrition",
  registrationBody: "IDA",
  registrationNumber: "IDA/5678",
  yearsExperience: 9,
  specializations: ["diabetes", "renal"],
  cityRegion: "Bengaluru",
  languages: ["English", "Kannada"],
  practiceSetting: "clinic",
  clientVolumeBucket: "50_200",
  interests: ["protocol-design"],
  bio: "Nine years in outpatient metabolic care.",
  whatsapp: { countryCode: "+91", phone: "9876543210" },
  whatsappOptIn: true,
  notifyPref: "weekly",
  sessionId: SESSION,
};

test("submitRdApplication: POST /api/rd-partners/applications sends the payload verbatim", async () => {
  const calls: Call[] = [];
  const res = await submitRdApplication(
    APPLICATION,
    fakeFetch(calls, () => ({
      status: 200,
      body: { application: { id: 42, path: "partner", fullName: "Meera Iyer", email: "meera@clinic.test" }, notify: { ok: true } },
    })),
  );
  const [c] = calls;
  assert.ok(c);
  assert.equal(c.method, "POST");
  assert.match(c.url, /\/api\/rd-partners\/applications$/);
  assert.equal(c.credentials, "include");
  // Verbatim: no field dropped, renamed, or synthesised on the way out.
  assert.deepEqual(JSON.parse(String(c.body)), APPLICATION);
  assert.equal(res.application.id, 42);
});

test("submitRdApplication: 409 duplicate email surfaces as a typed ApiError with the server's copy", async () => {
  await assert.rejects(
    submitRdApplication(
      APPLICATION,
      fakeFetch([], () => ({ status: 409, body: { error: "An application with this email already exists." } })),
    ),
    (e) => e instanceof ApiError && e.status === 409 && /already exists/.test((e as Error).message),
  );
});

test("submitRdApplication: 400 invalid payload surfaces as 400 (form maps the issues array)", async () => {
  await assert.rejects(
    submitRdApplication(
      { ...APPLICATION, yearsExperience: 999 },
      fakeFetch([], () => ({
        status: 400,
        body: { error: "invalid payload", issues: [{ path: "yearsExperience", message: "Too big" }] },
      })),
    ),
    (e) => e instanceof ApiError && e.status === 400,
  );
});

test("submitRdApplication: 429 submission limit (5/IP/24h) surfaces as 429", async () => {
  await assert.rejects(
    submitRdApplication(APPLICATION, fakeFetch([], () => ({ status: 429, body: { error: "submission limit reached" } }))),
    (e) => e instanceof ApiError && e.status === 429,
  );
});

test("submitRdApplication: these routes carry no `code`, so ApiError.code falls back — callers must branch on status", async () => {
  await assert.rejects(
    submitRdApplication(APPLICATION, fakeFetch([], () => ({ status: 409, body: { error: "An application with this email already exists." } }))),
    (e) => e instanceof ApiError && e.code === "error" && e.status === 409,
  );
});

test("sendRdWhatsappOtp: POST /api/rd-partners/whatsapp/send-otp with just the phone pair", async () => {
  const calls: Call[] = [];
  const res = await sendRdWhatsappOtp(
    { countryCode: "+91", phone: "9876543210" },
    fakeFetch(calls, () => ({ status: 200, body: { ok: true, devCode: "123456" } })),
  );
  const [c] = calls;
  assert.ok(c);
  assert.match(c.url, /\/api\/rd-partners\/whatsapp\/send-otp$/);
  assert.deepEqual(JSON.parse(String(c.body)), { countryCode: "+91", phone: "9876543210" });
  assert.equal(res.devCode, "123456");
});

test("sendRdWhatsappOtp: 502 transport failure is distinguishable from 429 throttling", async () => {
  await assert.rejects(
    sendRdWhatsappOtp({ countryCode: "+91", phone: "9876543210" }, fakeFetch([], () => ({ status: 502, body: { error: "failed to send OTP" } }))),
    (e) => e instanceof ApiError && e.status === 502,
  );
  await assert.rejects(
    sendRdWhatsappOtp({ countryCode: "+91", phone: "9876543210" }, fakeFetch([], () => ({ status: 429, body: { error: "too many OTP requests, please wait", retryAfterMs: 900000 } }))),
    (e) => e instanceof ApiError && e.status === 429,
  );
});

test("verifyRdWhatsappOtp: sends code AND sessionId — the proof is bound to the session", async () => {
  const calls: Call[] = [];
  const res = await verifyRdWhatsappOtp(
    { countryCode: "+91", phone: "9876543210", code: "123456", sessionId: SESSION },
    fakeFetch(calls, () => ({ status: 200, body: { ok: true, e164: "+919876543210" } })),
  );
  const [c] = calls;
  assert.ok(c);
  assert.match(c.url, /\/api\/rd-partners\/whatsapp\/verify-otp$/);
  const sent = JSON.parse(String(c.body)) as Record<string, unknown>;
  assert.equal(sent.code, "123456");
  // Regression guard: dropping sessionId here silently loses the opt-in at submit.
  assert.equal(sent.sessionId, SESSION);
  assert.equal(res.e164, "+919876543210");
});

test("trackRdWizardEvent: POST /api/rd-partners/events with the stable sessionId", async () => {
  const calls: Call[] = [];
  await trackRdWizardEvent(
    { sessionId: SESSION, eventName: "step_viewed", step: 2 },
    fakeFetch(calls, () => ({ status: 200, body: { ok: true } })),
  );
  const [c] = calls;
  assert.ok(c);
  assert.match(c.url, /\/api\/rd-partners\/events$/);
  assert.deepEqual(JSON.parse(String(c.body)), { sessionId: SESSION, eventName: "step_viewed", step: 2 });
});

test("newRdSessionId: within the server's 8–64 char bound and unique per call", async () => {
  const a = newRdSessionId();
  const b = newRdSessionId();
  assert.ok(a.length >= 8 && a.length <= 64, `length ${a.length} out of the 8–64 bound`);
  assert.notEqual(a, b);
});

test("enum tables match the server schema exactly", async () => {
  assert.deepEqual([...RD_PRACTICE_SETTINGS], [
    "solo", "clinic", "hospital", "corporate", "academia", "online-only", "other",
  ]);
  // Every wire bucket has presentable copy — no raw "lt10" reaching the UI.
  assert.deepEqual(Object.keys(RD_CLIENT_VOLUME_LABELS).sort(), ["10_50", "50_200", "gt200", "lt10"]);
});
