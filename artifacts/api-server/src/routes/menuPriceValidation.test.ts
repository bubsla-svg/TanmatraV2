/**
 * POST /menu/items/:slug/price price-band validation (TNM-ADM-01 ADM-28).
 * validatePricePaise's own unit coverage is in lib/priceBands.test.ts; this
 * exercises it through the real route, including the 422 mapping.
 *
 * Run with:
 *   node --test --test-force-exit --import tsx ./src/routes/menuPriceValidation.test.ts
 */
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { type AddressInfo } from "node:net";
import express, { type Express, type Request, type Response, type NextFunction } from "express";

process.env["DATABASE_URL"] ||=
  "postgres://postgres:postgres@localhost:5432/brand-tanmatra-db-staging";

const ADMIN_TOKEN = "adm28-price-validation-token";
process.env["RD_ADMIN_TOKEN"] = ADMIN_TOKEN;

const { db, menuItemsTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const { default: menuRouter } = await import("./menu");

const RUN = randomUUID().slice(0, 8);
const slug = `adm28-price-validation-${RUN}`;

let server: http.Server;
let baseUrl = "";

before(async () => {
  await db.insert(menuItemsTable).values({
    slug,
    name: "ADM-28 Price Validation Dish",
    pricePaise: 25_000,
    category: "mains",
    isAvailable: true,
  });

  const app: Express = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.log = { info() {}, warn() {}, error() {}, debug() {} } as any;
    next();
  });
  app.use(menuRouter);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await db.delete(menuItemsTable).where(eq(menuItemsTable.slug, slug));
});

async function setPrice(pricePaise: number) {
  const res = await fetch(`${baseUrl}/menu/items/${slug}/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify({ pricePaise }),
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function currentPrice(): Promise<number | undefined> {
  const [row] = await db
    .select({ pricePaise: menuItemsTable.pricePaise })
    .from(menuItemsTable)
    .where(eq(menuItemsTable.slug, slug))
    .limit(1);
  return row?.pricePaise;
}

test("a price inside the category band succeeds", async () => {
  const { status, json } = await setPrice(30_000);
  assert.equal(status, 200);
  assert.equal(json.item.pricePaise, 30_000);
  assert.equal(await currentPrice(), 30_000);
});

test("zero is rejected with 422 and the price is left unchanged", async () => {
  const before = await currentPrice();
  const { status, json } = await setPrice(0);
  assert.equal(status, 422);
  assert.match(json.error, /positive/i);
  assert.equal(await currentPrice(), before);
});

test("a price far outside the mains band is rejected with 422", async () => {
  const before = await currentPrice();
  // 1000000 paise = ₹10,000 for a mains dish — clears the outer Zod bound
  // (max ₹1,00,000) but not the category band (₹99-₹600 for mains).
  const { status, json } = await setPrice(1_000_000);
  assert.equal(status, 422);
  assert.match(json.error, /outside the band/i);
  assert.equal(await currentPrice(), before);
});
