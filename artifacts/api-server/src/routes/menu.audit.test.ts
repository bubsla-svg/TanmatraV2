import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import http from "node:http";
import { type AddressInfo } from "node:net";
import express, { type Express, type Request, type Response, type NextFunction } from "express";

process.env["DATABASE_URL"] ||= "postgres://postgres:postgres@localhost:5432/brand-tanmatra-db-staging";
process.env["RD_ADMIN_TOKEN"] = "test-admin-token";

const { db, auditLogTable, menuItemsTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const { default: menuRouter } = await import("./menu");

let server: http.Server;
let base = "";
let testItemSlug = "";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request & any, _res: Response, next: NextFunction) => {
    req.log = { info() {}, warn() {}, error() {} };
    // This will be read by hasAdminToken / requireCatalog
    req.user = { id: "test-admin-1" };
    next();
  });
  
  app.use(menuRouter);
  return app;
}

before(async () => {
  const [item] = await db.insert(menuItemsTable).values({
    name: "Audit Test Dish",
    slug: "audit-test-dish",
    pricePaise: 15000,
    category: "lunch",
    kitchenLocation: "blr-1"
  }).returning({ slug: menuItemsTable.slug });
  testItemSlug = item!.slug;

  server = http.createServer(makeApp());
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await db.delete(auditLogTable).where(eq(auditLogTable.resourceId, testItemSlug));
  await db.delete(menuItemsTable).where(eq(menuItemsTable.slug, testItemSlug));
});

test("POST /menu/items/:slug/price records an admin audit log", async () => {
  await db.delete(auditLogTable).where(eq(auditLogTable.resourceId, testItemSlug));

  const res = await fetch(`${base}/menu/items/${testItemSlug}/price`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": "test-admin-token"
    },
    body: JSON.stringify({ pricePaise: 16000 })
  });

  assert.equal(res.status, 200);
  
  const logs = await db.select().from(auditLogTable).where(eq(auditLogTable.resourceId, testItemSlug));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "menu_price_update");
  
  const meta = JSON.parse(logs[0].meta ?? "{}");
  assert.equal(meta.before.pricePaise, 15000);
  assert.equal(meta.after.pricePaise, 16000);
});
