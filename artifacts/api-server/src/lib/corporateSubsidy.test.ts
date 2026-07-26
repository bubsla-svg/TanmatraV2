/**
 * The clamping rules that decide how much of an order a company pays.
 *
 * Pure arithmetic, so it is testable without Postgres — and it is the part that
 * decides real money, so it gets its own file rather than living only inside a
 * DB-backed flow test.
 *
 * The invariant every case here serves: the customer's card is charged
 * `gross - subsidy`, and the company is billed `subsidy`. If the subsidy could
 * exceed the gross, the card charge would go negative; if it could exceed the
 * remaining budget, the company would be billed money it never agreed to.
 * Either way `customer + company === gross` breaks, and that identity is the
 * whole point.
 *
 * DB-free. Run from artifacts/api-server:
 *   node --test --import tsx ./src/lib/corporateSubsidy.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

process.env["DATABASE_URL"] ||= "postgresql://dummy:dummy@localhost:5432/dummy";

const { subsidyForOrderPaise, budgetPeriodMonth, subsidyLockKey } = await import(
  "./corporateSubsidy"
);

const BUDGET = 500_000; // ₹5,000/month
const GROSS = 100_000; // a ₹1,000 order

function subsidy(over: Partial<Parameters<typeof subsidyForOrderPaise>[0]> = {}) {
  return subsidyForOrderPaise({
    monthlyBudgetPaise: BUDGET,
    committedPaise: 0,
    reservedPaise: 0,
    grossPaise: GROSS,
    optIn: true,
    ...over,
  });
}

test("covers the whole order when the budget comfortably allows it", () => {
  assert.equal(subsidy(), GROSS);
});

test("customer charge plus company charge always equals the gross", () => {
  for (const committed of [0, 250_000, 450_000, 500_000, 600_000]) {
    const company = subsidy({ committedPaise: committed });
    const customer = GROSS - company;
    assert.equal(
      customer + company,
      GROSS,
      `identity broken at committed=${committed}`,
    );
    assert.ok(customer >= 0, "the card charge may never go negative");
    assert.ok(company >= 0, "the company may never be billed a negative amount");
  }
});

test("never exceeds what is left this month", () => {
  // ₹4,700 already spent leaves ₹300 of a ₹1,000 order for the company.
  assert.equal(subsidy({ committedPaise: 470_000 }), 30_000);
  // Exhausted.
  assert.equal(subsidy({ committedPaise: BUDGET }), 0);
  // Over-spent (bad data, or a budget lowered after the fact) is not a
  // negative subsidy — it is no subsidy.
  assert.equal(subsidy({ committedPaise: BUDGET + 99_999 }), 0);
});

test("reservations count against the budget, not just committed spend", () => {
  // This is what stops two checkouts open at once being promised the same
  // money: the first one's reservation is already subtracted here.
  assert.equal(subsidy({ reservedPaise: 450_000 }), 50_000);
  assert.equal(subsidy({ committedPaise: 200_000, reservedPaise: 300_000 }), 0);
  // Committed and reserved add — neither is a substitute for the other.
  assert.equal(
    subsidy({ committedPaise: 200_000, reservedPaise: 250_000 }),
    50_000,
  );
});

test("never exceeds the order, so the card charge cannot go negative", () => {
  // A ₹5,000 budget against a ₹1,000 order pays ₹1,000, not ₹5,000.
  assert.equal(subsidy({ grossPaise: 100_000 }), 100_000);
  assert.equal(subsidy({ grossPaise: 1 }), 1);
  assert.equal(subsidy({ grossPaise: 0 }), 0);
});

test("opting out spends nothing, however much budget is available", () => {
  assert.equal(subsidy({ optIn: false }), 0);
  assert.equal(subsidy({ optIn: false, committedPaise: 0 }), 0);
});

test("garbage inputs degrade to no subsidy rather than to a wrong one", () => {
  assert.equal(subsidy({ monthlyBudgetPaise: -1 }), 0);
  assert.equal(subsidy({ grossPaise: -500 }), 0);
  // A negative stored spend must not READ as extra headroom.
  assert.equal(subsidy({ committedPaise: -100_000 }), GROSS);
  assert.equal(
    subsidy({ committedPaise: -100_000, monthlyBudgetPaise: 50_000 }),
    50_000,
    "a negative spend cannot inflate the budget past its real value",
  );
});

test("returns whole paise — a subsidy is never a fraction of one", () => {
  const got = subsidy({ monthlyBudgetPaise: 33_333.7, grossPaise: 99_999.9 });
  assert.equal(Number.isInteger(got), true);
  assert.equal(got, 33_333);
});

test("the period is UTC yyyy-mm, zero-padded", () => {
  assert.equal(budgetPeriodMonth(new Date("2026-07-25T15:00:00Z")), "2026-07");
  assert.equal(budgetPeriodMonth(new Date("2026-01-01T00:00:00Z")), "2026-01");
  // A local-time implementation would report December here for anyone east of
  // UTC, silently moving a charge into the wrong budget month.
  assert.equal(budgetPeriodMonth(new Date("2026-12-31T23:59:59Z")), "2026-12");
  assert.equal(budgetPeriodMonth(new Date("2027-01-01T00:00:00Z")), "2027-01");
});

test("the lock key is per company, per employee, per period", () => {
  assert.equal(subsidyLockKey(7, "user-a", "2026-07"), "subsidy:7:user-a:2026-07");
  // Any of the three differing must give a different key, or two unrelated
  // employees would serialise against each other (or worse, two related ones
  // would not).
  const base = subsidyLockKey(7, "user-a", "2026-07");
  assert.notEqual(subsidyLockKey(8, "user-a", "2026-07"), base);
  assert.notEqual(subsidyLockKey(7, "user-b", "2026-07"), base);
  assert.notEqual(subsidyLockKey(7, "user-a", "2026-08"), base);
});
