import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import type { Request } from "express";

process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const {
  wearableConfig,
  isWearableEnabled,
  verifyWebhookSignature,
  signWebhookBody,
  normalizeProviderPayload,
  toUtcInstant,
  sanitizeMetric,
  rollupForDay,
  METRIC_BOUNDS,
} = await import("./wearableClient");

const ENV_KEYS = [
  "WEARABLE_PROVIDER",
  "TERRA_DEV_ID",
  "TERRA_API_KEY",
  "TERRA_SIGNING_SECRET",
  "WEARABLE_API_KEY",
  "WEARABLE_SIGNING_SECRET",
] as const;

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

function fakeReq(
  body: unknown,
  headers: Record<string, string> = {},
  rawBody?: string,
): Request {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return {
    body,
    rawBody,
    path: "/integrations/wearable/webhook",
    get: (h: string) => lower[h.toLowerCase()],
  } as unknown as Request;
}

const nullLog = { info() {}, warn() {}, error() {} };

beforeEach(() => {
  clearEnv();
});

// ── config gating ────────────────────────────────────────────────────────────
test("integration is OFF when env is unconfigured", () => {
  assert.equal(wearableConfig(), null);
  assert.equal(isWearableEnabled(), false);
});

test("integration stays OFF when only some vars are set", () => {
  process.env["WEARABLE_PROVIDER"] = "terra";
  assert.equal(isWearableEnabled(), false, "provider only → off");
  process.env["TERRA_API_KEY"] = "k";
  assert.equal(isWearableEnabled(), false, "provider+key, no secret → off");
});

test("integration is ON with provider + api key + signing secret", () => {
  process.env["WEARABLE_PROVIDER"] = "terra";
  process.env["TERRA_API_KEY"] = "api-key";
  process.env["TERRA_SIGNING_SECRET"] = "sign-secret";
  assert.equal(isWearableEnabled(), true);
  const cfg = wearableConfig()!;
  assert.equal(cfg.provider, "terra");
  assert.equal(cfg.apiKey, "api-key");
  assert.equal(cfg.signingSecret, "sign-secret");
});

test("generic WEARABLE_* fallbacks work (e.g. for Vital)", () => {
  process.env["WEARABLE_PROVIDER"] = "vital";
  process.env["WEARABLE_API_KEY"] = "vk";
  process.env["WEARABLE_SIGNING_SECRET"] = "vs";
  assert.equal(isWearableEnabled(), true);
  assert.equal(wearableConfig()!.provider, "vital");
});

test("unknown provider value → OFF", () => {
  process.env["WEARABLE_PROVIDER"] = "fitbit-direct";
  process.env["TERRA_API_KEY"] = "k";
  process.env["TERRA_SIGNING_SECRET"] = "s";
  assert.equal(wearableConfig(), null);
});

// ── signature verification ───────────────────────────────────────────────────
test("verifyWebhookSignature: false when unconfigured (null cfg)", () => {
  assert.equal(verifyWebhookSignature(fakeReq({}), null), false);
});

test("verifyWebhookSignature: accepts a valid Terra HMAC over the raw body", () => {
  const cfg = { provider: "terra" as const, devId: null, apiKey: "k", signingSecret: "top-secret" };
  const raw = JSON.stringify({ type: "activity", user: { user_id: "u1" }, data: [] });
  const t = "1720000000";
  const header = signWebhookBody(raw, cfg.signingSecret, t);
  assert.match(header, /^t=1720000000,v1=[0-9a-f]{64}$/);
  const req = fakeReq(JSON.parse(raw), { "terra-signature": header }, raw);
  assert.equal(verifyWebhookSignature(req, cfg, nullLog), true);
});

test("verifyWebhookSignature: rejects a wrong/tampered signature", () => {
  const cfg = { provider: "terra" as const, devId: null, apiKey: "k", signingSecret: "top-secret" };
  const raw = JSON.stringify({ type: "activity", user: { user_id: "u1" }, data: [] });
  const badHeader = "t=1720000000,v1=" + "0".repeat(64);
  const req = fakeReq(JSON.parse(raw), { "terra-signature": badHeader }, raw);
  assert.equal(verifyWebhookSignature(req, cfg, nullLog), false);

  // right secret but body tampered after signing
  const header = signWebhookBody(raw, cfg.signingSecret, "1720000000");
  const tampered = fakeReq({}, { "terra-signature": header }, raw + "x");
  assert.equal(verifyWebhookSignature(tampered, cfg, nullLog), false);
});

test("verifyWebhookSignature: missing header → false", () => {
  const cfg = { provider: "terra" as const, devId: null, apiKey: "k", signingSecret: "s" };
  assert.equal(verifyWebhookSignature(fakeReq({}, {}, "{}"), cfg, nullLog), false);
});

test("verifyWebhookSignature: mock mode accepts a matching shared-secret header", () => {
  const cfg = { provider: "mock" as const, devId: null, apiKey: "k", signingSecret: "shh" };
  assert.equal(
    verifyWebhookSignature(fakeReq({}, { "x-wearable-secret": "shh" }), cfg, nullLog),
    true,
  );
  assert.equal(
    verifyWebhookSignature(fakeReq({}, { "x-wearable-secret": "nope" }), cfg, nullLog),
    false,
  );
  assert.equal(verifyWebhookSignature(fakeReq({}, {}), cfg, nullLog), false);
});

// ── timezone safety ──────────────────────────────────────────────────────────
test("toUtcInstant: honours an explicit offset (IST +05:30 → correct UTC instant)", () => {
  // 2026-07-07 13:30:00 +05:30  ==  2026-07-07 08:00:00Z
  const d = toUtcInstant("2026-07-07T13:30:00+05:30")!;
  assert.equal(d.toISOString(), "2026-07-07T08:00:00.000Z");
});

test("toUtcInstant: WET/UTC offset (+00:00 and Z) parse to the same instant", () => {
  const a = toUtcInstant("2026-07-07T08:00:00+00:00")!;
  const b = toUtcInstant("2026-07-07T08:00:00Z")!;
  assert.equal(a.toISOString(), b.toISOString());
  assert.equal(a.toISOString(), "2026-07-07T08:00:00.000Z");
});

test("toUtcInstant: naive (offset-less) string is treated as UTC, never local", () => {
  const d = toUtcInstant("2026-07-07T08:00:00")!;
  assert.equal(d.toISOString(), "2026-07-07T08:00:00.000Z");
});

test("toUtcInstant: epoch seconds and millis both work; garbage → null", () => {
  assert.equal(toUtcInstant(1720339200)!.toISOString(), "2024-07-07T08:00:00.000Z");
  assert.equal(toUtcInstant(1720339200000)!.toISOString(), "2024-07-07T08:00:00.000Z");
  assert.equal(toUtcInstant("not-a-date"), null);
  assert.equal(toUtcInstant(null), null);
});

// ── normalization ────────────────────────────────────────────────────────────
const terraPayload = {
  type: "activity",
  user: { user_id: "terra-user-123", provider: "GARMIN" },
  data: [
    {
      metadata: { start_time: "2026-07-07T00:00:00+05:30", end_time: "2026-07-07T13:30:00+05:30" },
      distance_data: { steps: 8421 },
      calories_data: { net_activity_calories: 512, total_burned_calories: 2200 },
      heart_rate_data: { summary: { resting_hr_bpm: 58 } },
      sleep_durations_data: { asleep: { duration_asleep_state_seconds: 27000 } },
    },
  ],
};

test("normalizeProviderPayload: Terra activity payload → the four activity metrics", () => {
  const metrics = normalizeProviderPayload(terraPayload, "terra");
  const byType = new Map(metrics.map((m) => [m.metricType, m]));

  assert.equal(byType.get("steps")!.value, 8421);
  assert.equal(byType.get("steps")!.unit, "count");
  assert.equal(byType.get("active_energy_kcal")!.value, 512);
  assert.equal(byType.get("resting_hr")!.value, 58);
  assert.equal(byType.get("sleep_minutes")!.value, 450); // 27000s / 60

  // provider user id + source carried through
  assert.equal(byType.get("steps")!.providerUserId, "terra-user-123");
  assert.equal(byType.get("steps")!.source, "terra:garmin");
});

test("normalizeProviderPayload: recordedAt is the correct UTC instant across an IST offset", () => {
  const metrics = normalizeProviderPayload(terraPayload, "terra");
  // end_time 2026-07-07T13:30:00+05:30 → 08:00:00Z
  for (const m of metrics) {
    assert.equal(m.recordedAt.toISOString(), "2026-07-07T08:00:00.000Z");
  }
});

test("normalizeProviderPayload: dedupeKey is deterministic (idempotent re-delivery)", () => {
  const a = normalizeProviderPayload(terraPayload, "terra");
  const b = normalizeProviderPayload(terraPayload, "terra");
  assert.deepEqual(a.map((m) => m.dedupeKey).sort(), b.map((m) => m.dedupeKey).sort());
  assert.ok(a[0]!.dedupeKey.length <= 120);
});

test("normalizeProviderPayload: junk / missing user → [] (never throws)", () => {
  assert.deepEqual(normalizeProviderPayload(null, "terra"), []);
  assert.deepEqual(normalizeProviderPayload({ data: [] }, "terra"), []);
  assert.deepEqual(normalizeProviderPayload({ user: { user_id: "u" } }, "terra"), []);
});

test("normalizeProviderPayload: does NOT emit glucose (phase 2 not ingested)", () => {
  const withGlucose = {
    ...terraPayload,
    data: [{ ...terraPayload.data[0], glucose_data: { day_avg_blood_glucose_mg_per_dL: 95 } }],
  };
  const metrics = normalizeProviderPayload(withGlucose, "terra");
  assert.equal(
    metrics.some((m) => String(m.metricType).includes("glucose")),
    false,
  );
});

// ── sanitization ─────────────────────────────────────────────────────────────
test("sanitizeMetric: in-bounds values pass (ok, not flagged)", () => {
  assert.deepEqual(sanitizeMetric({ metricType: "steps", value: 8000 }), {
    ok: true,
    flagged: false,
    reason: null,
  });
  assert.equal(sanitizeMetric({ metricType: "resting_hr", value: 58 }).ok, true);
});

test("sanitizeMetric: out-of-bounds / impossible values are FLAGGED, not dropped", () => {
  const negativeSteps = sanitizeMetric({ metricType: "steps", value: -5 });
  assert.equal(negativeSteps.ok, false);
  assert.equal(negativeSteps.flagged, true);
  assert.ok(negativeSteps.reason);

  const impossibleSteps = sanitizeMetric({ metricType: "steps", value: 250_000 });
  assert.equal(impossibleSteps.flagged, true);

  const deadHr = sanitizeMetric({ metricType: "resting_hr", value: 300 });
  assert.equal(deadHr.flagged, true);

  const notFinite = sanitizeMetric({ metricType: "steps", value: NaN });
  assert.equal(notFinite.flagged, true);
});

test("sanitizeMetric: glucose bounds present for phase 2 (450 mg/dL flagged)", () => {
  assert.deepEqual(METRIC_BOUNDS["glucose_mgdl"], { min: 20, max: 600 });
  // 450 is within phase-2 glucose bounds, but glucose is unsupported NOW, so a
  // glucose metric is flagged (never counted) in increment 1.
  const g = sanitizeMetric({ metricType: "glucose_mgdl" as never, value: 450 });
  assert.equal(g.ok, false);
  assert.equal(g.flagged, true);
});

test("sanitizeMetric: Z-score baseline flags a sudden impossible jump within hard bounds", () => {
  // steps normally ~8000 ± 1000; a 90k-step day is within [0,100000] hard
  // bounds but a huge Z jump.
  const r = sanitizeMetric(
    { metricType: "steps", value: 90_000 },
    { mean: 8000, stdDev: 1000, zThreshold: 6 },
  );
  assert.equal(r.flagged, true);
  // a normal day is fine against the same baseline
  assert.equal(
    sanitizeMetric({ metricType: "steps", value: 8500 }, { mean: 8000, stdDev: 1000 }).ok,
    true,
  );
});

// ── rollup ───────────────────────────────────────────────────────────────────
function mkMetric(
  metricType: string,
  value: number,
  iso: string,
  flagged = false,
) {
  return {
    metricType: metricType as never,
    value,
    recordedAt: new Date(iso),
    provider: "terra" as const,
    flagged,
  };
}

test("rollupForDay: sums steps/energy/sleep, averages resting HR", () => {
  const r = rollupForDay([
    mkMetric("steps", 4000, "2026-07-07T02:00:00Z"),
    mkMetric("steps", 3000, "2026-07-07T10:00:00Z"),
    mkMetric("active_energy_kcal", 300, "2026-07-07T02:00:00Z"),
    mkMetric("active_energy_kcal", 200, "2026-07-07T10:00:00Z"),
    mkMetric("resting_hr", 60, "2026-07-07T02:00:00Z"),
    mkMetric("resting_hr", 50, "2026-07-07T10:00:00Z"),
    mkMetric("sleep_minutes", 400, "2026-07-07T02:00:00Z"),
  ])!;
  assert.equal(r.steps, 7000);
  assert.equal(r.activeEnergyKcal, 500);
  assert.equal(r.restingHr, 55); // avg(60,50)
  assert.equal(r.sleepMinutes, 400);
  assert.equal(r.day, "2026-07-07");
});

test("rollupForDay: does NOT double-count duplicate (metricType,timestamp) records", () => {
  const r = rollupForDay([
    mkMetric("steps", 5000, "2026-07-07T02:00:00Z"),
    mkMetric("steps", 5000, "2026-07-07T02:00:00Z"), // duplicate delivery
  ])!;
  assert.equal(r.steps, 5000, "duplicate instant must be deduped, not summed");
});

test("rollupForDay: flagged metrics are excluded", () => {
  const r = rollupForDay([
    mkMetric("steps", 6000, "2026-07-07T02:00:00Z"),
    mkMetric("steps", 250000, "2026-07-07T10:00:00Z", true), // flagged outlier
  ])!;
  assert.equal(r.steps, 6000);
});

test("rollupForDay: empty / all-flagged → null", () => {
  assert.equal(rollupForDay([]), null);
  assert.equal(rollupForDay([mkMetric("steps", 9, "2026-07-07T02:00:00Z", true)]), null);
});
