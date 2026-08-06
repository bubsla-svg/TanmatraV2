/**
 * Integration tests for Phase 3 Ecosystem API endpoints:
 * symptom logs, community Q&A threads, meal history, and challenge tracker.
 */
import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, symptomLogsTable, communityQaThreadsTable, usersTable } from "@workspace/db";
import ecosystemRouter from "./ecosystem";

interface TestUser {
  id: string;
}

process.env["CLINICAL_KMS_MASTER_KEY"] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

let server: http.Server;
let baseUrl = "";
const CREATED_USER_IDS: string[] = [];
const USER_REGISTRY = new Map<string, TestUser>();

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const r = req as unknown as {
      user?: unknown;
      log: Record<string, (...a: unknown[]) => void>;
      isAuthenticated: () => boolean;
    };
    const headerId = req.header("x-test-user-id");
    const u = headerId ? USER_REGISTRY.get(headerId) : undefined;
    if (u) r.user = u;
    r.isAuthenticated = () => r.user != null;
    r.log = { error: () => {}, info: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {} };
    next();
  });
  app.use(ecosystemRouter);
  return app;
}

async function createUser(prefix: string): Promise<string> {
  const id = `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
  await db.insert(usersTable).values({ id });
  CREATED_USER_IDS.push(id);
  USER_REGISTRY.set(id, { id });
  return id;
}

before(async () => {
  const app = makeApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  for (const uid of CREATED_USER_IDS) {
    await db.delete(symptomLogsTable).where(eq(symptomLogsTable.userId, uid)).catch(() => {});
    await db.delete(communityQaThreadsTable).where(eq(communityQaThreadsTable.userId, uid)).catch(() => {});
    await db.delete(usersTable).where(eq(usersTable.id, uid)).catch(() => {});
  }
});

test("POST and GET /symptom-logs records physiological symptoms", async () => {
  const userId = await createUser("symptom_user");
  const postRes = await fetch(`${baseUrl}/symptom-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userId },
    body: JSON.stringify({
      loggedDate: "2026-07-25",
      symptomType: "bloating",
      severity: 2,
      notes: "Slight bloating after lunch",
    }),
  });
  assert.equal(postRes.status, 201);
  const data = (await postRes.json()) as any;
  assert.equal(data.symptomType, "bloating");

  const getRes = await fetch(`${baseUrl}/symptom-logs`, {
    headers: { "x-test-user-id": userId },
  });
  assert.equal(getRes.status, 200);
  const list = (await getRes.json()) as any[];
  assert.equal(list.length, 1);
});

test("POST and GET /community/qa manages question threads", async () => {
  const userId = await createUser("qa_user");
  const postRes = await fetch(`${baseUrl}/community/qa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userId },
    body: JSON.stringify({
      questionTitle: "Best macro ratio for insulin sensitivity?",
      questionBody: "Looking for verified dietary recommendations for afternoon energy dips.",
      category: "pcos",
    }),
  });
  assert.equal(postRes.status, 201);
  const data = (await postRes.json()) as any;
  assert.equal(data.category, "pcos");

  const getRes = await fetch(`${baseUrl}/community/qa`);
  assert.equal(getRes.status, 200);
  const threads = (await getRes.json()) as any[];
  assert.ok(threads.length >= 1);
});

test("GET /nutrition-history returns user meal targets and logs", async () => {
  const userId = await createUser("hist_user");
  const res = await fetch(`${baseUrl}/nutrition-history`, {
    headers: { "x-test-user-id": userId },
  });
  assert.equal(res.status, 200);
  const data = (await res.json()) as any;
  assert.ok(data.targets.calorieTarget >= 2000);
});

test("GET /challenge-tracker returns check-ins and active routines", async () => {
  const userId = await createUser("chall_user");
  const res = await fetch(`${baseUrl}/challenge-tracker`, {
    headers: { "x-test-user-id": userId },
  });
  assert.equal(res.status, 200);
  const data = (await res.json()) as any;
  assert.ok(Array.isArray(data.challenges));
});

test("symptom notes are ENCRYPTED at rest and decrypted only for the owner", async () => {
  const userId = await createUser("symptom_crypto_user");
  const PLAINTEXT = "severe cramping after the millet bowl, worse than last week";

  const postRes = await fetch(`${baseUrl}/symptom-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userId },
    body: JSON.stringify({
      loggedDate: "2026-07-25",
      symptomType: "cramping",
      severity: 3,
      notes: PLAINTEXT,
      relatedDishSlug: "millet-khichdi",
    }),
  });
  assert.equal(postRes.status, 201);
  const created = (await postRes.json()) as { id: number; notes: string };
  // The caller gets their own plaintext back…
  assert.equal(created.notes, PLAINTEXT);

  // …but the ROW must not contain it. Patient-authored free text is clinical
  // data; this codebase's contract is AES-256-GCM envelopes at rest
  // (CLINICAL_KMS_MASTER_KEY), same as the preferences row.
  const [raw] = await db
    .select({ notes: symptomLogsTable.notes })
    .from(symptomLogsTable)
    .where(eq(symptomLogsTable.id, created.id));
  assert.ok(raw, "row must exist");
  assert.ok(!raw.notes.includes("cramping"), "plaintext must not be stored");
  assert.ok(!raw.notes.includes(PLAINTEXT), "plaintext must not be stored");
  const envelope = JSON.parse(raw.notes) as { ivHex?: string; ciphertextHex?: string; authTagHex?: string };
  assert.ok(envelope.ivHex && envelope.ciphertextHex && envelope.authTagHex, "stored value must be the AES-GCM envelope");

  // And the owner's read decrypts it back.
  const getRes = await fetch(`${baseUrl}/symptom-logs`, {
    headers: { "x-test-user-id": userId },
  });
  const rows = (await getRes.json()) as Array<{ id: number; notes: string }>;
  const mine = rows.find((r) => r.id === created.id);
  assert.equal(mine?.notes, PLAINTEXT);
});

test("public /community/qa never ships author user ids", async () => {
  const userId = await createUser("qa_privacy_user");
  const postRes = await fetch(`${baseUrl}/community/qa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userId },
    body: JSON.stringify({
      questionTitle: "Is quinoa okay on a low-GI plan?",
      questionBody: "Asking for my meal prep.",
      category: "nutrition",
    }),
  });
  assert.equal(postRes.status, 201);

  // The list endpoint is unauthenticated by design — which is exactly why it
  // must not leak the author's internal user id to anyone with curl.
  const listRes = await fetch(`${baseUrl}/community/qa`);
  assert.equal(listRes.status, 200);
  const body = await listRes.text();
  assert.ok(!body.includes(userId), "public QA payload must not contain user ids");
  assert.ok(!body.includes("userId"), "public QA payload must not carry a userId field");
});
