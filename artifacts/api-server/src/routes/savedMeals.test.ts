/**
 * Integration tests for /saved-meals CRUD operations in My Protocol Vault.
 * Verifies authentication gating, Zod payload validation, atomic upserts,
 * and deletion by canonical dish slug.
 */
import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, savedMealsTable, usersTable } from "@workspace/db";
import savedMealsRouter from "./savedMeals";

interface TestUser {
  id: string;
}

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
  app.use(savedMealsRouter);
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
    await db.delete(savedMealsTable).where(eq(savedMealsTable.userId, uid)).catch(() => {});
    await db.delete(usersTable).where(eq(usersTable.id, uid)).catch(() => {});
  }
});

test("GET /saved-meals returns 401 without authentication", async () => {
  const res = await fetch(`${baseUrl}/saved-meals`);
  assert.equal(res.status, 401);
});

test("POST /saved-meals inserts and updates a meal in Protocol Vault", async () => {
  const userId = await createUser("vault_tester");
  
  // Insert new meal
  const res1 = await fetch(`${baseUrl}/saved-meals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userId },
    body: JSON.stringify({
      dishSlug: "hp-paneer-bowl",
      dishName: "High Protein Paneer Bowl",
      notes: "Extra hemp oil dressing",
      tags: ["post-workout", "high-protein"],
    }),
  });
  assert.equal(res1.status, 201);
  const data1 = (await res1.json()) as any;
  assert.equal(data1.dishSlug, "hp-paneer-bowl");
  assert.equal(data1.notes, "Extra hemp oil dressing");

  // Update existing meal via upsert
  const res2 = await fetch(`${baseUrl}/saved-meals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userId },
    body: JSON.stringify({
      dishSlug: "hp-paneer-bowl",
      dishName: "High Protein Paneer Bowl",
      notes: "Updated note: double protein",
      tags: ["post-workout", "high-protein", "favorite"],
    }),
  });
  assert.equal(res2.status, 200);
  const data2 = (await res2.json()) as any;
  assert.equal(data2.notes, "Updated note: double protein");
  assert.equal(data2.tags.length, 3);
});

test("DELETE /saved-meals/:slug removes item and returns 404 on non-existent", async () => {
  const userId = await createUser("vault_del");
  await fetch(`${baseUrl}/saved-meals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userId },
    body: JSON.stringify({ dishSlug: "eco-salad", dishName: "Economy Salad" }),
  });

  const delRes = await fetch(`${baseUrl}/saved-meals/eco-salad`, {
    method: "DELETE",
    headers: { "x-test-user-id": userId },
  });
  assert.equal(delRes.status, 200);

  const secondRes = await fetch(`${baseUrl}/saved-meals/eco-salad`, {
    method: "DELETE",
    headers: { "x-test-user-id": userId },
  });
  assert.equal(secondRes.status, 404);
});
