import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, ordersTable, usersTable, mealPlansTable } from "@workspace/db";
import { detectAdherenceForPlan } from "./adherence";

// Regression test for the orderKind='marketplace' bug: the ordersTable query
// backing outside_plan detection previously had no orderKind filter, so a
// marketplace purchase (snacks, supplements — never matching any plan day's
// dish slugs) got wrongly flagged as outside_plan drift on every scan. The
// fix adds `eq(ordersTable.orderKind, "meal")` to that query — since the
// filter is applied in SQL, this must be a real-DB test, not a mocked one.

const CREATED_USER_IDS: string[] = [];

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(usersTable).values({
    id,
    email: `adherence-orderkind-${id}@example.test`,
    firstName: "Adherence",
    lastName: "Tester",
  });
  CREATED_USER_IDS.push(id);
  return id;
}

const CREATED_PLAN_IDS: number[] = [];

after(async () => {
  if (CREATED_PLAN_IDS.length > 0) {
    await db.delete(mealPlansTable).where(inArray(mealPlansTable.id, CREATED_PLAN_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(ordersTable).where(inArray(ordersTable.userId, CREATED_USER_IDS));
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

const dayDate = "2026-01-01";

const PLAN_DAYS = [
  {
    date: dayDate,
    breakfast: {
      dishId: 1,
      slug: "oats-bowl",
      name: "Oats Bowl",
      image: "",
      pricePaise: 20000,
      calories: 300,
      protein: 10,
      carbs: 40,
      fat: 5,
    },
  },
];

async function makePlan(userId: string): Promise<{ id: number; userId: string; subscriptionId: null; days: typeof PLAN_DAYS }> {
  const [row] = await db
    .insert(mealPlansTable)
    .values({
      userId,
      weekStartDate: dayDate,
      status: "accepted",
      constraints: {
        dailyCalorieTarget: null,
        dailyProteinTargetGrams: null,
        weeklyBudgetPaise: null,
        maxRepetitionsPerDish: 3,
        allergens: [],
        dietaryStyle: null,
        spiceLevel: null,
        goal: null,
      },
      days: PLAN_DAYS,
    })
    .returning({ id: mealPlansTable.id });
  CREATED_PLAN_IDS.push(row!.id);
  return { id: row!.id, userId, subscriptionId: null, days: PLAN_DAYS };
}

test("marketplace orders do not trigger outside_plan drift", async () => {
  const userId = await makeUser();
  await db.insert(ordersTable).values({
    userId,
    externalOrderId: `mkt-${randomUUID()}`,
    orderKind: "marketplace",
    status: "delivered",
    totalPaise: 5000,
    // A slug that will never match the plan's "oats-bowl" — this is exactly
    // the shape that used to false-flag outside_plan before the fix.
    items: [
      {
        itemId: 1,
        slug: "protein-bar-snack",
        name: "Protein Bar",
        qty: 1,
        unitPricePaise: 5000,
        supplierName: "Test Supplier",
        commissionPaise: 0,
        vendorPayoutPaise: 5000,
      },
    ],
    fulfillmentType: "delivery",
    createdAt: new Date(`${dayDate}T12:00:00.000Z`),
  });

  const result = await detectAdherenceForPlan({
    plan: await makePlan(userId),
    now: new Date("2026-01-02T00:00:00.000Z"),
  });

  assert.equal(result.countsByKind.outside_plan, 0);
  assert.equal(result.newEvents.length, 0);
});

test("meal orders with off-plan items still trigger outside_plan drift", async () => {
  const userId = await makeUser();
  await db.insert(ordersTable).values({
    userId,
    externalOrderId: `meal-${randomUUID()}`,
    orderKind: "meal",
    status: "delivered",
    totalPaise: 20000,
    // The strict meal-item type has no `slug` field (only marketplace items
    // carry one) — cast past that here since jsonb doesn't enforce it at
    // the DB level and computeDrift reads `slug` loosely off a Record cast
    // regardless of orderKind (see adherence.ts). This test only needs to
    // prove the SQL orderKind filter includes "meal" rows, not exercise
    // real production item shapes.
    items: [{ id: 2, name: "Random Snack", slug: "random-snack", qty: 1, price: 20000 }] as any,
    fulfillmentType: "delivery",
    createdAt: new Date(`${dayDate}T12:00:00.000Z`),
  });

  const result = await detectAdherenceForPlan({
    plan: await makePlan(userId),
    now: new Date("2026-01-02T00:00:00.000Z"),
  });

  assert.equal(result.countsByKind.outside_plan, 1);
  assert.equal(
    result.newEvents.some((e) => e.kind === "outside_plan"),
    true,
  );
});
