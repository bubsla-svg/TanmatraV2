/**
 * PetPooja push-menu curated-column fence (TNM-MENU-01 M-1, ruling R-1).
 *
 * The own-app catalog owns its curation: display name, category taxonomy and
 * the veg mark (plus price, fenced earlier under TNM-ADM-01 ADM-28 — see
 * petpooja.priceAuthority.test.ts). A PetPooja push-menu re-sync must never
 * revert them on an existing row; only the operational fields may move. This
 * is the manual's §7.2 replay contract: a recorded push-menu body replayed
 * against a curated catalog changes zero curated fields and zero prices.
 *
 * The allowlist assertion below is deliberately a full-row diff, not a
 * per-column check: when the taxonomy migration adds more curated columns
 * (section_order, sort_rank, veg_class, badge, archived), any upsert write to
 * them fails this test without it needing to learn their names.
 *
 * These tests run against real Postgres: DATABASE_URL, NODE_ENV=test.
 *
 * Run with:
 *   node --test --test-force-exit --import tsx ./src/routes/petpooja.menuFence.test.ts
 */
import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { type AddressInfo } from "node:net";
import express, { type Express, type Request } from "express";

process.env["DATABASE_URL"] ||=
  "postgres://postgres:postgres@localhost:5432/brand-tanmatra-db-staging";
process.env["PETPOOJA_APP_KEY"] = "m1-fence-key";
process.env["PETPOOJA_APP_SECRET"] = "m1-fence-secret";
process.env["PETPOOJA_ACCESS_TOKEN"] = "m1-fence-token";
process.env["PETPOOJA_RESTAURANT_ID"] = "m1-fence-rest";

const { db, menuItemsTable, auditLogTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const { default: petpoojaRouter } = await import("./petpooja");

const AUTH = { "x-petpooja-app-secret": "m1-fence-secret" } as const;
const RUN = randomUUID().slice(0, 8);
const curatedSlug = `m1-fence-existing-${RUN}`;
const newSlug = `m1-fence-new-${RUN}`;

// The row as the own-app catalog curates it — a Menu v2 display name, an
// own-app category, a non-veg mark, an operator-ratified price, and
// deliberately unavailable (as a curated disable would leave it).
const CURATED = {
  slug: curatedSlug,
  name: "Grilled Chicken with Veggies & Mash",
  description: "",
  pricePaise: 29_900,
  category: "mains",
  isVeg: false,
  isAvailable: false,
} as const;

// Every column a push-menu upsert is allowed to touch on an existing row.
// Anything else changing is a fence breach.
const POS_WRITABLE = new Set<string>([
  "description",
  "imageUrl",
  "tags",
  "allergens",
  "cuisineTags",
  "macros",
  "customizations",
  "isAvailable",
  "updatedAt",
]);

type Row = typeof menuItemsTable.$inferSelect;

async function fetchRow(slug: string): Promise<Row> {
  const [row] = await db
    .select()
    .from(menuItemsTable)
    .where(eq(menuItemsTable.slug, slug))
    .limit(1);
  assert.ok(row, `expected a menu_items row for ${slug}`);
  return row as Row;
}

function changedColumns(before: Row, after: Row): string[] {
  return (Object.keys(before) as Array<keyof Row>)
    .filter(
      (k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null),
    )
    .map(String);
}

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

// mapPetpoojaItem derives the DB slug via slugify(itemname); using the target
// slug itself as itemname keeps the two identical (same trick as the
// priceAuthority suite). The payload disagrees with the curated row on every
// fenced field — name (the slug string ≠ the curated display name), category
// ("Aggregator Drift Category" ≠ "mains"), veg mark (veg ≠ non-veg) and price
// (999.00 ≠ 299.00) — while also carrying legitimate operational updates.
function pushBody(itemname: string, itemid: string) {
  return {
    success: "1",
    restaurants: [
      { restaurantid: "m1-fence-rest", details: { restaurantname: "Fence Test" } },
    ],
    categories: [
      { categoryid: "77", active: "1", categoryname: "Aggregator Drift Category" },
    ],
    items: [
      {
        itemid,
        item_categoryid: "77",
        active: "1",
        in_stock: "2",
        itemname,
        item_attributeid: "1",
        itemdescription: "aggregator description",
        item_image_url: "https://cdn.example.com/petpooja-item.jpg",
        price: "999.00",
      },
    ],
    addongroups: [],
    attributes: [
      { attributeid: "1", attribute: "veg", active: "1" },
      { attributeid: "2", attribute: "non-veg", active: "1" },
    ],
  };
}

async function replayPush(body: unknown): Promise<number> {
  const res = await fetch(`${baseUrl}/integrations/petpooja/push-menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH },
    body: JSON.stringify(body),
  });
  return res.status;
}

before(async () => {
  await db.insert(menuItemsTable).values(CURATED);
  server = http.createServer(makeApp());
  await new Promise<void>((r) => server.listen(0, r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await db.delete(auditLogTable).where(eq(auditLogTable.resourceId, curatedSlug));
  await db.delete(menuItemsTable).where(eq(menuItemsTable.slug, curatedSlug));
  await db.delete(menuItemsTable).where(eq(menuItemsTable.slug, newSlug));
});

test("a replayed push changes zero curated fields on an existing row, and only touches the operational allowlist", async () => {
  const beforeRow = await fetchRow(curatedSlug);

  const status = await replayPush(pushBody(curatedSlug, "fence-item-id"));
  assert.equal(status, 200);

  const afterRow = await fetchRow(curatedSlug);

  // The curated set stays exactly as the catalog wrote it.
  assert.equal(afterRow.name, CURATED.name, "push-menu must not overwrite the display name");
  assert.equal(afterRow.category, CURATED.category, "push-menu must not overwrite the category");
  assert.equal(afterRow.isVeg, CURATED.isVeg, "push-menu must not overwrite the veg mark");
  assert.equal(afterRow.pricePaise, CURATED.pricePaise, "push-menu must not overwrite the price");

  // The fence must not over-block: operational fields did update.
  assert.equal(afterRow.description, "aggregator description");
  assert.equal(afterRow.imageUrl, "https://cdn.example.com/petpooja-item.jpg");
  // isAvailable is operational (POS stock signal), not curated — R-1 leaves
  // it POS-writable. The curated master switch is `archived`, which arrives
  // with the taxonomy migration and, being curated, may never join the upsert.
  assert.equal(afterRow.isAvailable, true);

  // The forward-proof half: nothing outside the allowlist moved at all.
  for (const col of changedColumns(beforeRow, afterRow)) {
    assert.ok(
      POS_WRITABLE.has(col),
      `push-menu wrote fenced column "${col}" on an existing row`,
    );
  }
});

test("replaying the identical recorded body again is a no-op (idempotent replay)", async () => {
  const firstApplied = await fetchRow(curatedSlug);

  const status = await replayPush(pushBody(curatedSlug, "fence-item-id"));
  assert.equal(status, 200);

  const secondApplied = await fetchRow(curatedSlug);
  // updatedAt is the one column the upsert always stamps; everything else
  // must be byte-identical between the two replays.
  const drift = changedColumns(firstApplied, secondApplied).filter(
    (c) => c !== "updatedAt",
  );
  assert.deepEqual(drift, [], "a second identical replay must change nothing");
});

test("a brand-new item still takes name, category, veg mark and price from the payload", async () => {
  const status = await replayPush(pushBody(newSlug, "fence-new-item-id"));
  assert.equal(status, 200);

  const row = await fetchRow(newSlug);
  // No curation exists yet for a genuinely new row — the payload is the only
  // source, same rationale as ADM-28's insert path.
  assert.equal(row.name, newSlug);
  assert.equal(row.category, "Aggregator Drift Category");
  assert.equal(row.isVeg, true);
  assert.equal(row.pricePaise, 99_900);
});
