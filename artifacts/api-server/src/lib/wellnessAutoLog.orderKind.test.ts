import assert from "node:assert/strict";
import { test } from "node:test";
import { ordersTable } from "@workspace/db/schema";

// Set a dummy DATABASE_URL before importing the DB library so it doesn't throw
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";

const { db } = await import("@workspace/db");
const { autoLogDeliveredOrder } = await import("./wellnessAutoLog");

// Regression test for the orderKind='marketplace' bug: before the fix,
// autoLogDeliveredOrder read `order.items` assuming every ordersTable row
// was a meal order and called getDishById(it.id) on each line. Marketplace
// order items use marketplace_items ids, not menu_items ids, so this could
// either silently no-op (harmless) or, on an id collision, log fabricated
// nutrition data for a dish the user never ate. The fix short-circuits on
// orderKind !== "meal" before touching order.items at all.
test("autoLogDeliveredOrder skips marketplace orders without inserting nutrition logs", async (t) => {
  t.mock.method(db, "select", () => ({
    from: (table: any) => {
      assert.equal(table, ordersTable);
      return {
        where: () =>
          Promise.resolve([
            {
              id: 555,
              userId: "user-1",
              orderKind: "marketplace",
              items: [{ id: 1, qty: 1 }], // could collide with a real dish id
              scheduledFor: null,
              createdAt: new Date(),
            },
          ]),
      };
    },
  }));

  let insertCalled = false;
  t.mock.method(db, "insert", () => {
    insertCalled = true;
    throw new Error("insert should not be called for a marketplace order");
  });

  const rows = await autoLogDeliveredOrder(555);

  assert.equal(rows, 0);
  assert.equal(insertCalled, false);
});
