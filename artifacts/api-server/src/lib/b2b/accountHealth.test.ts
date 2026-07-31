/**
 * listAllAccountsWithHealth (OA-QUICK-1.6): was 1 + N round trips (one
 * getLatestHealth call per company). Pins the collapsed-to-2-queries
 * behavior against real Postgres: every company appears exactly once, each
 * with its most recent snapshot — never an older one, never another
 * company's.
 *
 * Run from artifacts/api-server:
 *   DATABASE_URL=... node --test --import tsx ./src/lib/b2b/accountHealth.test.ts
 */
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import {
  db,
  accountHealthSnapshotsTable,
  companiesTable,
  usersTable,
  type AccountHealthDrivers,
} from "@workspace/db";

import { listAllAccountsWithHealth } from "./accountHealth";

const RUN = randomUUID().slice(0, 8);
const CREATED_USER_IDS: string[] = [];
const CREATED_COMPANY_IDS: number[] = [];

after(async () => {
  if (CREATED_COMPANY_IDS.length > 0) {
    await db
      .delete(accountHealthSnapshotsTable)
      .where(inArray(accountHealthSnapshotsTable.companyId, CREATED_COMPANY_IDS));
    await db.delete(companiesTable).where(inArray(companiesTable.id, CREATED_COMPANY_IDS));
  }
  if (CREATED_USER_IDS.length > 0) {
    await db.delete(usersTable).where(inArray(usersTable.id, CREATED_USER_IDS));
  }
});

const DRIVERS: AccountHealthDrivers = {
  ordersLast30: 10,
  ordersPrev30: 8,
  ordersTrendPct: 25,
  activeMembers: 4,
  totalMembers: 5,
  memberActivationPct: 80,
  budgetUtilization: 0.5,
  daysSinceLastOrder: 2,
  hasDietProfile: true,
};

async function seedCompany(slugSuffix: string): Promise<number> {
  const userId = randomUUID();
  await db.insert(usersTable).values({
    id: userId,
    email: `acct-health-${userId}@example.test`,
    firstName: "Owner",
    lastName: slugSuffix,
  });
  CREATED_USER_IDS.push(userId);
  const [company] = await db
    .insert(companiesTable)
    .values({
      slug: `acct-health-${RUN}-${slugSuffix}`,
      name: `Account Health Co ${slugSuffix}`,
      ownerUserId: userId,
      perEmployeeMonthlyBudgetPaise: 500_000,
    })
    .returning({ id: companiesTable.id });
  CREATED_COMPANY_IDS.push(company!.id);
  return company!.id;
}

async function seedSnapshot(
  companyId: number,
  snapshotDate: string,
  riskLevel: "healthy" | "watch" | "at_risk" | "critical",
  score: number,
): Promise<void> {
  await db.insert(accountHealthSnapshotsTable).values({
    companyId,
    snapshotDate,
    score,
    riskLevel,
    drivers: DRIVERS,
    commentary: `snapshot ${snapshotDate}`,
    modelId: "deterministic",
  });
}

test("returns every company exactly once, each with its MOST RECENT snapshot", async () => {
  const companyA = await seedCompany("a");
  const companyB = await seedCompany("b");
  const companyC = await seedCompany("c"); // never gets a snapshot

  // Company A: two snapshots, newest is "healthy". Older ("critical") must
  // NOT be what's returned — this is exactly the bug an unordered or
  // wrong-direction fetch-all-then-group would introduce.
  await seedSnapshot(companyA, "2020-01-01", "critical", 10);
  await seedSnapshot(companyA, "2020-01-03", "healthy", 90);
  // Company B: a single snapshot.
  await seedSnapshot(companyB, "2020-01-02", "at_risk", 45);

  const results = await listAllAccountsWithHealth();
  const byId = new Map(results.map((r) => [r.company.id, r]));

  // Exactly one row per company — no duplicates, no dropped rows.
  assert.equal(
    results.filter((r) => CREATED_COMPANY_IDS.includes(r.company.id)).length,
    3,
  );

  assert.equal(byId.get(companyA)!.health!.riskLevel, "healthy");
  assert.equal(byId.get(companyA)!.health!.snapshotDate, "2020-01-03");
  assert.equal(byId.get(companyB)!.health!.riskLevel, "at_risk");
  assert.equal(byId.get(companyC)!.health, null);
});

test("sorts by the existing risk-band contract: no-snapshot, then critical, then healthy", async () => {
  const critical = await seedCompany("crit");
  const healthy = await seedCompany("healthy");
  const none = await seedCompany("none");
  await seedSnapshot(critical, "2020-02-01", "critical", 5);
  await seedSnapshot(healthy, "2020-02-01", "healthy", 95);

  const results = await listAllAccountsWithHealth();
  const ourResults = results.filter((r) =>
    [critical, healthy, none].includes(r.company.id),
  );
  const order = ourResults.map((r) => r.company.id);
  // Pins the PRE-EXISTING sort contract (unchanged by the N+1 fix): a
  // company with no snapshot at all sorts as band -1, ahead of every real
  // band (critical=0 .. healthy=3) — so "none" leads, then critical, then
  // healthy, regardless of insertion order.
  assert.ok(order.indexOf(none) < order.indexOf(critical));
  assert.ok(order.indexOf(critical) < order.indexOf(healthy));
});
