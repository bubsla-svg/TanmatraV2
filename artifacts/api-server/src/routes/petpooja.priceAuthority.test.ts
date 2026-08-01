/**
 * PetPooja push-menu price-write authority (TNM-ADM-01 ADM-28).
 *
 * The catalog (menu_items via lib/menu.ts::updatePrice) is the sole price
 * authority. push-menu bulk-upserts menu_items on every sync, and used to
 * write price_paise unconditionally — a replayed or stale PetPooja payload
 * could silently revert an operator's price change with no record of it.
 *
 * These tests run against real Postgres: DATABASE_URL, NODE_ENV=test.
 *
 * Run with:
 *   node --test --test-force-exit --import tsx ./src/routes/petpooja.priceAuthority.test.ts
 */
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { type AddressInfo } from "node:net";
import express, { type Express, type Request } from "express";

process.env["DATABASE_URL"] ||=
  "postgres://postgres:postgres@localhost:5432/brand-tanmatra-db-staging";
process.env["PETPOOJA_APP_KEY"] = "adm28-key";
process.env["PETPOOJA_APP_SECRET"] = "adm28-secret";
process.env["PETPOOJA_ACCESS_TOKEN"] = "adm28-token";
process.env["PETPOOJA_RESTAURANT_ID"] = "adm28-rest";

const { db, menuItemsTable, auditLogTable } = await import("@workspace/db");
const { eq, and } = await import("drizzle-orm");
const { default: petpoojaRouter } = await import("./petpooja");

const AUTH = { "x-petpooja-app-secret": "adm28-secret" } as const;
const RUN = randomUUID().slice(0, 8);
const existingSlug = `adm28-existing-${RUN}`;
const newSlug = `adm28-new-${RUN}`;
const categoryId = "9001";

let server: http.Server;
let baseUrl = "";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request & any, _res, next) => {
    req.log = { info() {}, warn() {}, error() {} };
    next();
  });
  app.use(petpoojaRouter);
  return app;
}

before(async () => {
  await db.insert(menuItemsTable).values({
    slug: existingSlug,
    name: "ADM-28 Existing Dish",
    pricePaise: 45_000,
    category: "mains",
    isAvailable: true,
  });

  server = http.createServer(makeApp());
  await new Promise<void>((r) => server.listen(0, r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await db.delete(auditLogTable).where(eq(auditLogTable.resourceId, existingSlug));
  await db.delete(menuItemsTable).where(eq(menuItemsTable.slug, existingSlug));
  await db.delete(menuItemsTable).where(eq(menuItemsTable.slug, newSlug));
});

// mapPetpoojaItem derives the DB slug via slugify(itemname). Using the
// target slug itself as itemname keeps the two identical (slugify is a
// no-op on an already-lowercase, already-hyphenated string) instead of
// depending on slugify's exact collapsing behaviour for a human-readable name.
function pushPayload(itemname: string, itemid: string, price: string) {
  return {
    success: "1",
    restaurants: [{ restaurantid: "adm28-rest", details: { restaurantname: "Test" } }],
    categories: [{ categoryid: categoryId, active: "1", categoryname: "mains" }],
    items: [
      {
        itemid,
        item_categoryid: categoryId,
        active: "1",
        in_stock: "2",
        itemname,
        item_attributeid: "1",
        price,
      },
    ],
    addongroups: [],
    attributes: [{ attributeid: "1", attribute: "veg", active: "1" }],
  };
}

test("push-menu does not change price_paise on an existing item, even when the payload disagrees", async () => {
  const res = await fetch(`${baseUrl}/integrations/petpooja/push-menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH },
    // 999.00 rupees != the seeded 45000 paise (450.00 rupees) — a replayed
    // or stale sync trying to revert/overwrite an operator-set price.
    body: JSON.stringify(pushPayload(existingSlug, "existing-item-id", "999.00")),
  });
  assert.equal(res.status, 200);

  const [row] = await db
    .select({ pricePaise: menuItemsTable.pricePaise })
    .from(menuItemsTable)
    .where(eq(menuItemsTable.slug, existingSlug))
    .limit(1);
  assert.equal(row?.pricePaise, 45_000, "push-menu must never overwrite an existing price");
});

test("a rejected push-driven price change is logged to the audit table", async () => {
  const [entry] = await db
    .select()
    .from(auditLogTable)
    .where(
      and(
        eq(auditLogTable.resourceId, existingSlug),
        eq(auditLogTable.action, "menu.price_write_rejected"),
      ),
    )
    .limit(1);
  assert.ok(entry, "expected an audit_log row for the rejected price-write attempt");
  const meta = JSON.parse(entry!.meta as string);
  assert.equal(meta.before.pricePaise, 45_000);
  assert.equal(meta.after.attemptedPricePaise, 99_900);
});

test("a replayed push with the SAME price does not write a spurious audit row", async () => {
  const before = await db
    .select()
    .from(auditLogTable)
    .where(eq(auditLogTable.resourceId, existingSlug));

  const res = await fetch(`${baseUrl}/integrations/petpooja/push-menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH },
    // 450.00 rupees == the seeded 45000 paise — matches, no attempted change.
    body: JSON.stringify(pushPayload(existingSlug, "existing-item-id", "450.00")),
  });
  assert.equal(res.status, 200);

  const after = await db
    .select()
    .from(auditLogTable)
    .where(eq(auditLogTable.resourceId, existingSlug));
  assert.equal(after.length, before.length, "a matching price must not produce an audit row");
});

test("a brand-new item still gets its initial price from the push payload", async () => {
  const res = await fetch(`${baseUrl}/integrations/petpooja/push-menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH },
    body: JSON.stringify(pushPayload(newSlug, "new-item-id", "199.00")),
  });
  assert.equal(res.status, 200);

  const [row] = await db
    .select({ pricePaise: menuItemsTable.pricePaise })
    .from(menuItemsTable)
    .where(eq(menuItemsTable.slug, newSlug))
    .limit(1);
  assert.equal(row?.pricePaise, 19_900, "a genuinely new item has no operator price to protect");
});
