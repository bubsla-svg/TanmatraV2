import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import http from "node:http";
import { type AddressInfo } from "node:net";
import express, { type Express, type Request } from "express";

// Local-run fallback only — CI/verify sets a real DATABASE_URL. Never commit a
// real credential here; this points at a throwaway local Postgres.
process.env["DATABASE_URL"] ||=
  "postgres://postgres:postgres@localhost:5432/brand-tanmatra-db-staging";

const { db, usersTable, userPreferencesTable, rdUsersTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const { default: menuRouter } = await import("./menu");

let server: http.Server;
let base = "";

let userIdWeightLoss = "";
let userIdMuscleGain = "";
let userIdAllergens = "";
let clinicianUserId = "";
let plainCustomerUserId = "";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request & any, _res, next) => {
    req.log = { info() {}, warn() {}, error() {} };
    if (req.headers["x-test-unauthenticated"] === "true") {
      req.isAuthenticated = () => false;
      req.user = undefined;
    } else {
      req.isAuthenticated = () => true;
      req.user = {
        id: req.headers["x-test-user-id"] || req.query.profile_id || "default-user",
      };
    }
    next();
  });
  app.use(menuRouter);
  return app;
}

async function get(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}${path}`, {
    method: "GET",
    headers,
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

before(async () => {
  const rand = () => `+919900${Math.floor(Math.random() * 900000 + 100000)}`;

  // Create test users and preference profiles.
  const [u1] = await db.insert(usersTable).values({ phoneE164: rand() }).returning({ id: usersTable.id });
  userIdWeightLoss = u1!.id;
  await db.insert(userPreferencesTable).values({
    userId: userIdWeightLoss,
    goal: "lose_weight",
    allergens: [],
    quizCompletedAt: new Date(),
  });

  const [u2] = await db.insert(usersTable).values({ phoneE164: rand() }).returning({ id: usersTable.id });
  userIdMuscleGain = u2!.id;
  await db.insert(userPreferencesTable).values({
    userId: userIdMuscleGain,
    goal: "gain_muscle",
    allergens: [],
    quizCompletedAt: new Date(),
  });

  const [u3] = await db.insert(usersTable).values({ phoneE164: rand() }).returning({ id: usersTable.id });
  userIdAllergens = u3!.id;
  await db.insert(userPreferencesTable).values({
    userId: userIdAllergens,
    goal: "general_wellness",
    allergens: ["dairy"], // dairy allergy conflict
    quizCompletedAt: new Date(),
  });

  const [u4] = await db.insert(usersTable).values({ phoneE164: rand() }).returning({ id: usersTable.id });
  clinicianUserId = u4!.id;
  await db.insert(rdUsersTable).values({ userId: clinicianUserId, rdSlug: "test-rd" });

  const [u5] = await db.insert(usersTable).values({ phoneE164: rand() }).returning({ id: usersTable.id });
  plainCustomerUserId = u5!.id;

  server = http.createServer(makeApp());
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await db.delete(userPreferencesTable).where(eq(userPreferencesTable.userId, userIdWeightLoss));
  await db.delete(userPreferencesTable).where(eq(userPreferencesTable.userId, userIdMuscleGain));
  await db.delete(userPreferencesTable).where(eq(userPreferencesTable.userId, userIdAllergens));
  await db.delete(rdUsersTable).where(eq(rdUsersTable.userId, clinicianUserId));
  await db.delete(usersTable).where(eq(usersTable.id, userIdWeightLoss));
  await db.delete(usersTable).where(eq(usersTable.id, userIdMuscleGain));
  await db.delete(usersTable).where(eq(usersTable.id, userIdAllergens));
  await db.delete(usersTable).where(eq(usersTable.id, clinicianUserId));
  await db.delete(usersTable).where(eq(usersTable.id, plainCustomerUserId));
});

test("GET /menu/ranked returns curated list for unassessed users", async () => {
  const r = await get("/menu/ranked");
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.items));
  assert.ok(r.json.items.length > 0);
  // Unassessed returns neutral/curated ordering by default (fit_band is neutral or conflict)
  assert.ok(r.json.items.every((item: any) => item.fit_band === "neutral" || item.fit_band === "conflict"));
});

test("GET /menu/ranked ranks low calorie dishes high for weight_loss goal", async () => {
  const r = await get(`/menu/ranked?profile_id=${userIdWeightLoss}`);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.items));
  
  const highItems = r.json.items.filter((item: any) => item.fit_band === "high");
  // There should be low calorie dishes ranked high
  assert.ok(highItems.length > 0);
  assert.ok(highItems.every((item: any) => item.rank_reason_codes.includes("goal_match_calories")));

  // Highly ranked items should appear first in the array
  const firstItem = r.json.items[0];
  assert.equal(firstItem.fit_band, "high");
});

test("GET /menu/ranked ranks high protein dishes high for muscle_gain goal", async () => {
  const r = await get(`/menu/ranked?profile_id=${userIdMuscleGain}`);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.items));
  
  const highItems = r.json.items.filter((item: any) => item.fit_band === "high");
  assert.ok(highItems.length > 0);
  assert.ok(highItems.every((item: any) => item.rank_reason_codes.includes("goal_match_protein")));

  const firstItem = r.json.items[0];
  assert.equal(firstItem.fit_band, "high");
});

test("GET /menu/ranked marks allergy conflicts", async () => {
  const r = await get(`/menu/ranked?profile_id=${userIdAllergens}`);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.items));

  const conflicts = r.json.items.filter((item: any) => item.fit_band === "conflict");
  assert.ok(conflicts.length > 0);
});

test("GET /menu/ranked?profile_id=... returns 401 when unauthenticated", async () => {
  const r = await get(`/menu/ranked?profile_id=${userIdWeightLoss}`, {
    "x-test-unauthenticated": "true",
  });
  assert.equal(r.status, 401);
});

test("GET /menu/ranked?profile_id=... returns 403 when authenticated as different user", async () => {
  const r = await get(`/menu/ranked?profile_id=${userIdWeightLoss}`, {
    "x-test-user-id": plainCustomerUserId,
  });
  assert.equal(r.status, 403);
});

test("GET /menu/ranked?profile_id=... returns 200 when clinician calls it", async () => {
  const r = await get(`/menu/ranked?profile_id=${userIdWeightLoss}`, {
    "x-test-user-id": clinicianUserId,
  });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.items));
});
