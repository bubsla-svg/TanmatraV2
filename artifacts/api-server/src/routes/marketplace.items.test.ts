/**
 * OA-MED-1.12 — GET /marketplace/items category filtering + isActive gate.
 *
 * `category` used to be filtered in JS after pulling every active row; this
 * pins the SQL-side rewrite's two risky edges: an unknown category value
 * must still match nothing (never silently fall back to "everything"), and
 * an inactive row must never leak through regardless of category.
 *
 * Hits the real dev DB via DATABASE_URL. Uses unique slugs (not category
 * counts) for isolation — `ensureMarketplaceSeeded()` inserts a fixed seed
 * set once per process and other suites may run against the same table.
 *
 * Run with:
 *   DATABASE_URL=... node --test --import tsx \
 *     ./src/routes/marketplace.items.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { type AddressInfo } from "node:net";
import http from "node:http";

import express, { type Express } from "express";
import { inArray } from "drizzle-orm";
import { db, marketplaceItemsTable } from "@workspace/db";

import marketplaceRouter from "./marketplace";

let server: http.Server;
let baseUrl: string;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api", marketplaceRouter);
  return app;
}

const CREATED_IDS: number[] = [];
const ACTIVE_OILS_SLUG = `test-oils-active-${randomUUID().slice(0, 8)}`;
const INACTIVE_OILS_SLUG = `test-oils-inactive-${randomUUID().slice(0, 8)}`;
const ACTIVE_SAUCES_SLUG = `test-sauces-active-${randomUUID().slice(0, 8)}`;

async function api(path: string): Promise<{ status: number; body: { items: Array<{ slug: string }> } }> {
  const res = await fetch(`${baseUrl}${path}`);
  const body = (await res.json()) as { items: Array<{ slug: string }> };
  return { status: res.status, body };
}

test.before(async () => {
  const app = makeApp();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;

  const rows = await db
    .insert(marketplaceItemsTable)
    .values([
      { slug: ACTIVE_OILS_SLUG, name: "Test Active Oil", category: "oils", pricePaise: 10000, isActive: true },
      { slug: INACTIVE_OILS_SLUG, name: "Test Inactive Oil", category: "oils", pricePaise: 10000, isActive: false },
      { slug: ACTIVE_SAUCES_SLUG, name: "Test Active Sauce", category: "sauces", pricePaise: 10000, isActive: true },
    ])
    .returning({ id: marketplaceItemsTable.id });
  CREATED_IDS.push(...rows.map((r) => r.id));
});

test.after(async () => {
  server?.close();
  if (CREATED_IDS.length > 0) {
    await db.delete(marketplaceItemsTable).where(inArray(marketplaceItemsTable.id, CREATED_IDS));
  }
});

test("category=oils matches only active oils items — inactive and other categories excluded", async () => {
  const { status, body } = await api("/api/marketplace/items?category=oils");
  assert.equal(status, 200);
  const slugs = body.items.map((i) => i.slug);
  assert.ok(slugs.includes(ACTIVE_OILS_SLUG), "active oils item missing");
  assert.ok(!slugs.includes(INACTIVE_OILS_SLUG), "inactive item leaked through");
  assert.ok(!slugs.includes(ACTIVE_SAUCES_SLUG), "wrong category leaked through");
});

test("an unknown category matches nothing — never silently falls back to all items", async () => {
  const { status, body } = await api("/api/marketplace/items?category=not-a-real-category");
  assert.equal(status, 200);
  assert.deepEqual(body.items, []);
});

test("no category (or 'all') returns every active item, still excluding inactive rows", async () => {
  const { body: noParam } = await api("/api/marketplace/items");
  const { body: allParam } = await api("/api/marketplace/items?category=all");
  for (const body of [noParam, allParam]) {
    const slugs = body.items.map((i) => i.slug);
    assert.ok(slugs.includes(ACTIVE_OILS_SLUG));
    assert.ok(slugs.includes(ACTIVE_SAUCES_SLUG));
    assert.ok(!slugs.includes(INACTIVE_OILS_SLUG));
  }
});
