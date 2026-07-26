/**
 * Integration tests for notify-me lead capture (OB-3 / II.3).
 * Proves 201 creation, 200 idempotent deduplication, 400 validation, and table projection pins.
 *
 * Run: DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/tanmatra_test NODE_ENV=test node --test --import tsx ./src/routes/serviceabilityInterest.test.ts
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import express, { type Express } from "express";
import http from "node:http";
import { db, serviceabilityInterestTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import serviceabilityInterestRouter from "./serviceabilityInterest";

let app: Express;
let server: http.Server;
let baseUrl: string;

before(async () => {
  app = express();
  app.use(express.json());
  app.use(serviceabilityInterestRouter);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  // Clean test rows before running
  await db.delete(serviceabilityInterestTable).where(eq(serviceabilityInterestTable.pincode, "999888"));
});

after(async () => {
  await db.delete(serviceabilityInterestTable).where(eq(serviceabilityInterestTable.pincode, "999888"));
  if (server) await new Promise<void>((res) => server.close(() => res()));
});

test("POST /serviceability-interest creates lead with 201 and honors strict projection pin", async () => {
  const payload = { pincode: "999888", phone: "9876543210" };
  const res = await fetch(`${baseUrl}/serviceability-interest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.deepEqual(data, { ok: true });

  const rows = await db
    .select()
    .from(serviceabilityInterestTable)
    .where(eq(serviceabilityInterestTable.pincode, "999888"));

  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.pincode, "999888");
  assert.equal(rows[0]!.phone, "9876543210");
  assert.ok(rows[0]!.createdAt instanceof Date);

  // Assert projection pin — exactly {pincode, phone, createdAt} exists on the database table row
  const keys = Object.keys(rows[0]!).sort();
  assert.deepEqual(keys, ["createdAt", "phone", "pincode"]);
});

test("POST /serviceability-interest returns idempotent 200 on duplicate submission", async () => {
  const payload = { pincode: "999888", phone: "9876543210" };
  const res = await fetch(`${baseUrl}/serviceability-interest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data, { ok: true, duplicate: true });

  const rows = await db
    .select()
    .from(serviceabilityInterestTable)
    .where(eq(serviceabilityInterestTable.pincode, "999888"));

  assert.equal(rows.length, 1, "no duplicate row inserted into db");
});

test("POST /serviceability-interest rejects invalid pincode or phone with 400", async () => {
  const badPin = await fetch(`${baseUrl}/serviceability-interest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pincode: "9998", phone: "9876543210" }),
  });
  assert.equal(badPin.status, 400);

  const badPhone = await fetch(`${baseUrl}/serviceability-interest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pincode: "999888", phone: "123" }),
  });
  assert.equal(badPhone.status, 400);
});
