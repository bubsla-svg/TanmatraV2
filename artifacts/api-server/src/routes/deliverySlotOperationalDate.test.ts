/**
 * The Asia/Kolkata operational-date invariant (DEFECT-PLAN-SLOT-DATE-001).
 * Real Postgres.
 *
 * Run with:
 *   node --test --import tsx ./src/routes/deliverySlotOperationalDate.test.ts
 *
 * The invariant, for every row:
 *
 *     delivery_slots.slot_date = the Asia/Kolkata calendar date of starts_at
 *
 * It matters because `starts_at` is an instant and `slot_date` is a bare
 * calendar day, and nothing in either type ties them together. The obvious way
 * to derive the second from the first — `toISOString().slice(0, 10)` — yields
 * the UTC date, which every writer in this repository was doing. For a lunch
 * slot the two agree and the bug is invisible; near midnight IST they differ by
 * a day and the customer is shown their delivery on the wrong date.
 *
 * These tests exercise the DATABASE guard rather than only the helper, because
 * documentation and a helper cannot stop a raw INSERT, a migration, or the next
 * writer who has not read either.
 */

import assert from "node:assert/strict";
import { test, after, before } from "node:test";
import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  deliverySlotsTable,
  applyNonDrizzleDdl,
  deriveOperationalDate,
  nonDrizzleDdlSource,
  operationalInstant,
  DELIVERY_OPERATIONAL_TZ,
  DELIVERY_SLOT_DATE_GUARD_DDL_FILE,
} from "@workspace/db";

const CREATED_SLOTS: number[] = [];

before(async () => {
  // CI builds its database with `drizzle-kit push`, which carries no triggers.
  // Installing the guard here means this suite tests what production actually
  // has instead of passing against a database missing the thing under test.
  await applyNonDrizzleDdl((raw) => db.execute(sql.raw(raw)));
});

after(async () => {
  if (CREATED_SLOTS.length > 0) {
    await db.delete(deliverySlotsTable).where(inArray(deliverySlotsTable.id, CREATED_SLOTS));
  }
});

async function insertSlot(
  startsAt: Date,
  slotDate: string,
  zone = `opdate-${randomUUID().slice(0, 8)}`,
): Promise<number> {
  const [row] = await db
    .insert(deliverySlotsTable)
    .values({
      slotDate,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3600_000),
      zone,
      capacity: 5,
      reservedCount: 0,
    })
    .returning();
  assert.ok(row);
  CREATED_SLOTS.push(row.id);
  return row.id;
}

function isOperationalDateViolation(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown; cause?: { code?: unknown; message?: unknown } };
  const code = e?.code ?? e?.cause?.code;
  const message = String(e?.message ?? "") + String(e?.cause?.message ?? "");
  return code === "23514" || /operational date/i.test(message);
}

// ── The canonical derivation ─────────────────────────────────────────────────

test("an 08:00 IST slot is filed under that IST date", () => {
  // 02:30 UTC — same calendar day in both zones. The easy case, which is
  // exactly why the bug survived: this is what a lunch slot looks like.
  const startsAt = new Date("2026-09-05T02:30:00.000Z");
  assert.equal(deriveOperationalDate(startsAt), "2026-09-05");
});

test("a 00:30 IST slot is filed under the IST date, not the UTC one", () => {
  // 19:00 UTC on the 4th is 00:30 IST on the 5th. The UTC date is a day early —
  // this is the row the old code wrote wrong, and the one the corrected seeder
  // now produces for the late dinner window.
  const startsAt = new Date("2026-09-04T19:00:00.000Z");
  assert.equal(startsAt.toISOString().slice(0, 10), "2026-09-04", "precondition: UTC says the 4th");
  assert.equal(deriveOperationalDate(startsAt), "2026-09-05", "IST says the 5th");
});

test("a 23:30 IST slot is filed under the IST date", () => {
  // 18:00 UTC on the 5th is 23:30 IST the same day — UTC and IST agree here,
  // and 30 minutes later they would not.
  assert.equal(deriveOperationalDate(new Date("2026-09-05T18:00:00.000Z")), "2026-09-05");
  assert.equal(deriveOperationalDate(new Date("2026-09-05T18:30:00.000Z")), "2026-09-06");
});

test("the IST day boundary falls exactly at 18:30 UTC", () => {
  assert.equal(deriveOperationalDate(new Date("2026-09-05T18:29:59.999Z")), "2026-09-05");
  assert.equal(deriveOperationalDate(new Date("2026-09-05T18:30:00.000Z")), "2026-09-06");
});

test("operationalInstant is the exact inverse of deriveOperationalDate", () => {
  for (const [date, hour, minute] of [
    ["2026-09-05", 12, 0],
    ["2026-09-05", 19, 0],
    ["2026-09-05", 20, 30],
    ["2026-09-05", 0, 30],
    ["2026-01-01", 23, 59],
  ] as const) {
    const instant = operationalInstant(date, hour, minute);
    assert.equal(
      deriveOperationalDate(instant),
      date,
      `${date} ${hour}:${minute} must round-trip to its own operational date`,
    );
  }
  // And it means what a kitchen means: 19:00 IST is 13:30 UTC.
  assert.equal(operationalInstant("2026-09-05", 19, 0).toISOString(), "2026-09-05T13:30:00.000Z");
});

test("the derivation does not depend on the process timezone", () => {
  const startsAt = new Date("2026-09-04T19:00:00.000Z");
  const original = process.env["TZ"];
  const seen: Record<string, string> = {};
  try {
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Kiritimati"]) {
      process.env["TZ"] = tz;
      seen[tz] = deriveOperationalDate(startsAt);
    }
  } finally {
    if (original === undefined) delete process.env["TZ"];
    else process.env["TZ"] = original;
  }
  assert.equal(
    new Set(Object.values(seen)).size,
    1,
    `the operational date is a property of the instant and ${DELIVERY_OPERATIONAL_TZ}, not of TZ: ${JSON.stringify(seen)}`,
  );
  assert.equal(seen["UTC"], "2026-09-05");
});

// ── The database guard ───────────────────────────────────────────────────────

test("a correctly dated slot inserts", async () => {
  const startsAt = new Date("2026-09-04T19:00:00.000Z"); // 00:30 IST on the 5th
  const id = await insertSlot(startsAt, "2026-09-05");
  const [row] = await db
    .select()
    .from(deliverySlotsTable)
    .where(eq(deliverySlotsTable.id, id));
  assert.equal(row!.slotDate, "2026-09-05");
});

test("a UTC-dated slot is REJECTED — the exact mistake every writer was making", async () => {
  const startsAt = new Date("2026-09-04T19:00:00.000Z");
  await assert.rejects(
    () => insertSlot(startsAt, startsAt.toISOString().slice(0, 10)),
    (err: unknown) => {
      assert.ok(
        isOperationalDateViolation(err),
        `expected an operational-date violation, got ${String((err as Error)?.message)}`,
      );
      return true;
    },
    "toISOString().slice(0,10) must not be able to reach the table",
  );
});

test("an UPDATE cannot move starts_at away from its slot_date", async () => {
  const startsAt = operationalInstant("2026-09-10", 12, 0);
  const id = await insertSlot(startsAt, "2026-09-10");

  await assert.rejects(
    () =>
      db
        .update(deliverySlotsTable)
        // Shift it across the IST midnight boundary without restating the date.
        .set({ startsAt: operationalInstant("2026-09-11", 0, 30) })
        .where(eq(deliverySlotsTable.id, id)),
    isOperationalDateViolation,
    "an instant edit that changes the operational day must restate slot_date",
  );

  await assert.rejects(
    () =>
      db
        .update(deliverySlotsTable)
        .set({ slotDate: "2026-09-11" })
        .where(eq(deliverySlotsTable.id, id)),
    isOperationalDateViolation,
    "a date edit that contradicts the instant must be refused",
  );
});

test("a raw INSERT bypassing the ORM is rejected too", async () => {
  // The reason enforcement is in the database and not only in a helper: a seed
  // script, a migration, or a psql session reaches none of the TypeScript.
  const zone = `raw-${randomUUID().slice(0, 8)}`;
  await assert.rejects(
    () =>
      db.execute(sql`
        insert into delivery_slots (slot_date, starts_at, ends_at, zone, capacity, reserved_count)
        values ('2026-09-04', timestamptz '2026-09-04 19:00:00+00', timestamptz '2026-09-04 20:00:00+00', ${zone}, 5, 0)
      `),
    isOperationalDateViolation,
  );
});

test("the mismatch sweep finds nothing once the guard is installed", async () => {
  await insertSlot(operationalInstant("2026-09-12", 19, 0), "2026-09-12");
  const mismatched = await db.execute(sql`
    select id from delivery_slots
     where slot_date is distinct from (starts_at at time zone ${DELIVERY_OPERATIONAL_TZ})::date
  `);
  const rows = (mismatched as unknown as { rows?: unknown[] }).rows ?? [];
  assert.equal(
    rows.length,
    0,
    `every persisted slot must satisfy the invariant; ${rows.length} do not`,
  );
});

test("the guard DDL names the same timezone the TypeScript does", () => {
  // The trigger must hard-code the zone (SQL cannot read a TS constant), so the
  // two could drift and nothing would notice until a delivery landed on the
  // wrong day. This is the seam that would not otherwise be checked.
  const ddl = nonDrizzleDdlSource(DELIVERY_SLOT_DATE_GUARD_DDL_FILE);
  assert.ok(
    ddl.includes(`'${DELIVERY_OPERATIONAL_TZ}'`),
    `the guard DDL must use ${DELIVERY_OPERATIONAL_TZ}; it does not`,
  );
  const zonesInDdl = new Set(
    Array.from(ddl.matchAll(/AT TIME ZONE '([^']+)'/gi), (m) => m[1]),
  );
  assert.deepEqual(
    [...zonesInDdl],
    [DELIVERY_OPERATIONAL_TZ],
    "the guard must reference exactly one timezone, and it must be the operational one",
  );
});

test("installing the guard is idempotent", async () => {
  await applyNonDrizzleDdl((raw) => db.execute(sql.raw(raw)));
  await applyNonDrizzleDdl((raw) => db.execute(sql.raw(raw)));
  // Still enforcing after two reinstalls.
  await assert.rejects(
    () => insertSlot(new Date("2026-09-04T19:00:00.000Z"), "2026-09-04"),
    isOperationalDateViolation,
  );
});
