import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import http from "node:http";
import crypto from "node:crypto";
import { type AddressInfo } from "node:net";
import express, { type Express, type Request } from "express";

// Real DB (the route writes metric + rollup rows). Fall back to the local
// staging DB when run standalone; the CI/verify command sets DATABASE_URL.
process.env["DATABASE_URL"] ||=
  "postgres://brand_tanmatra_user:a4bEozBP3nusjNRX@localhost:5432/brand-tanmatra-db-staging";

// Enable the integration in MOCK mode (shared-secret header auth) so we don't
// have to hand-compute HMACs. Config is read at request time.
const MOCK_SECRET = "test-shared-secret";
process.env["WEARABLE_PROVIDER"] = "mock";
process.env["WEARABLE_API_KEY"] = "test-api-key";
process.env["WEARABLE_SIGNING_SECRET"] = MOCK_SECRET;

const { db, usersTable, wearableLinksTable, wearableMetricsTable, wearableDailyRollupTable } =
  await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const { default: wearableRouter } = await import("./wearable");

const PROVIDER_USER_ID = `mock-user-${crypto.randomUUID()}`;
let userId = "";

let server: http.Server;
let base = "";

// Fake auth so requireAuth-guarded endpoints see our test user.
let authUserId: string | null = null;
function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request & any, _res, next) => {
    req.log = { info() {}, warn() {}, error() {} };
    req.isAuthenticated = () => authUserId !== null;
    req.user = authUserId ? { id: authUserId } : undefined;
    next();
  });
  app.use(wearableRouter);
  return app;
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const todayIso = `${new Date().toISOString().slice(0, 10)}T08:00:00Z`;

function terraPayload(providerUserId: string) {
  return {
    type: "activity",
    user: { user_id: providerUserId, provider: "GARMIN" },
    data: [
      {
        metadata: { end_time: todayIso },
        distance_data: { steps: 7200 },
        calories_data: { net_activity_calories: 430 },
        heart_rate_data: { summary: { resting_hr_bpm: 57 } },
        sleep_durations_data: { asleep: { duration_asleep_state_seconds: 25200 } },
      },
      // an impossible record that must be flagged (stored) but excluded
      {
        metadata: { end_time: todayIso.replace("08:00", "09:00") },
        distance_data: { steps: 500000 },
      },
    ],
  };
}

before(async () => {
  const [u] = await db
    .insert(usersTable)
    .values({ phoneE164: `+9199${Math.floor(Math.random() * 1e8)}` })
    .returning({ id: usersTable.id });
  userId = u!.id;
  // Link the aggregator user id to our internal user.
  await db.insert(wearableLinksTable).values({
    userId,
    provider: "mock",
    providerUserId: PROVIDER_USER_ID,
    status: "pending",
    connected: false,
  });

  server = http.createServer(makeApp());
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  // Clean up (FK cascade from users would also work, but be explicit).
  await db.delete(wearableMetricsTable).where(eq(wearableMetricsTable.userId, userId));
  await db.delete(wearableDailyRollupTable).where(eq(wearableDailyRollupTable.userId, userId));
  await db.delete(wearableLinksTable).where(eq(wearableLinksTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
});

const WEBHOOK = "/integrations/wearable/webhook";

// ── auth ─────────────────────────────────────────────────────────────────────
test("webhook 401 on bad signature when enabled", async () => {
  const r = await post(WEBHOOK, terraPayload(PROVIDER_USER_ID), {
    "x-wearable-secret": "WRONG",
  });
  assert.equal(r.status, 401);
  assert.equal(r.json.success, "0");
});

test("webhook 200 no-op when integration is DISABLED", async () => {
  const saved = process.env["WEARABLE_PROVIDER"];
  delete process.env["WEARABLE_PROVIDER"]; // config now returns null
  try {
    const r = await post(WEBHOOK, terraPayload(PROVIDER_USER_ID), {
      "x-wearable-secret": "anything",
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.success, "1");
    assert.match(String(r.json.message), /disabled/);
  } finally {
    process.env["WEARABLE_PROVIDER"] = saved;
  }
});

// ── happy path ───────────────────────────────────────────────────────────────
test("webhook happy-path ingest writes metric rows + a daily rollup", async () => {
  const r = await post(WEBHOOK, terraPayload(PROVIDER_USER_ID), {
    "x-wearable-secret": MOCK_SECRET,
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.success, "1");
  assert.ok(r.json.ingested >= 4, "at least the 4 clean activity metrics ingested");
  assert.ok(r.json.flagged >= 1, "the 500000-step record is flagged");

  const metrics = await db
    .select()
    .from(wearableMetricsTable)
    .where(eq(wearableMetricsTable.userId, userId));
  const steps = metrics.filter((m) => m.metricType === "steps");
  assert.ok(metrics.length >= 5, "clean + flagged metrics all stored");
  assert.ok(
    steps.some((m) => m.value === 500000 && m.flagged),
    "impossible steps stored with flagged=true (not dropped)",
  );

  const day = todayIso.slice(0, 10);
  const [rollup] = await db
    .select()
    .from(wearableDailyRollupTable)
    .where(eq(wearableDailyRollupTable.userId, userId));
  assert.ok(rollup, "rollup row written");
  assert.equal(rollup.day, day);
  assert.equal(rollup.steps, 7200, "flagged 500000-step record excluded from rollup");
  assert.equal(rollup.activeEnergyKcal, 430);
  assert.equal(rollup.restingHr, 57);
  assert.equal(rollup.sleepMinutes, 420); // 25200s / 60

  // link refreshed for the effectiveCalorieTarget() value hook
  const [link] = await db
    .select()
    .from(wearableLinksTable)
    .where(eq(wearableLinksTable.userId, userId));
  assert.equal(link!.status, "connected");
  assert.equal(link!.lastActivityKcal, 430);
  assert.ok(link!.lastSyncedAt);
});

test("webhook is idempotent — re-delivery does not double-count", async () => {
  await post(WEBHOOK, terraPayload(PROVIDER_USER_ID), { "x-wearable-secret": MOCK_SECRET });
  const [rollup] = await db
    .select()
    .from(wearableDailyRollupTable)
    .where(eq(wearableDailyRollupTable.userId, userId));
  assert.equal(rollup!.steps, 7200, "dedupeKey conflict → no double count on replay");
});

// ── connect stub still works when disabled ───────────────────────────────────
test("/wearable/connect keeps the web-preview stub when integration is disabled", async () => {
  const saved = process.env["WEARABLE_PROVIDER"];
  delete process.env["WEARABLE_PROVIDER"];
  authUserId = userId;
  try {
    const r = await post("/wearable/connect", {});
    assert.equal(r.status, 200);
    assert.equal(r.json.enabled, false);
    assert.equal(r.json.preview, true);
  } finally {
    process.env["WEARABLE_PROVIDER"] = saved;
    authUserId = null;
  }
});

test("/wearable/connect requires consent when enabled (DPDPA)", async () => {
  authUserId = userId;
  try {
    const noConsent = await post("/wearable/connect", {});
    assert.equal(noConsent.status, 400);
    const withConsent = await post("/wearable/connect", { consent: true });
    assert.equal(withConsent.status, 200);
    assert.equal(withConsent.json.enabled, true);
    assert.ok(withConsent.json.widgetUrl);
  } finally {
    authUserId = null;
  }
});
