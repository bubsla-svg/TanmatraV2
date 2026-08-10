// ─────────────────────────────────────────────────────────────────────────────
// The operational timezone, and the one place a delivery date is derived from
// an instant (DEFECT-PLAN-SLOT-DATE-001).
//
// This lives beside the schema rather than in a service package because the
// invariant it exists to hold is a statement ABOUT A COLUMN:
//
//     delivery_slots.slot_date = the Asia/Kolkata calendar date of starts_at
//
// Anything that writes a slot already imports the table from here, so the
// correct helper is unavoidable rather than something a new writer has to know
// to go looking for.
//
// WHY IT NEEDS ENFORCING AT ALL. `starts_at` is `timestamptz` (an absolute
// instant) and `slot_date` is a `date` (a calendar day with no zone). Nothing
// in either type ties them together, and the obvious way to produce the second
// from the first — `startsAt.toISOString().slice(0, 10)` — silently yields the
// UTC date. Every writer in this repository did exactly that. For a 19:00 IST
// dinner slot (13:30 UTC) the two agree and the bug is invisible; for anything
// from 05:30 IST onwards on the far side of midnight UTC they disagree by a
// day, and the customer is shown their delivery on the wrong date.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE ONE OPERATIONAL TIMEZONE. Every human-facing delivery date and time is
 * expressed in it, and nothing anywhere reads a client's timezone.
 *
 * An IANA name, deliberately, not a hardcoded +05:30. India observes no DST
 * today, so the offset happens to be constant — but encoding that as a number
 * would make a future zone change (or a second kitchen in a DST zone) a silent
 * data-corruption bug rather than a one-line configuration change.
 */
export const DELIVERY_OPERATIONAL_TZ = "Asia/Kolkata";

/** Parts of an instant as read in a given IANA zone. */
function zonedParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string): number => {
    const found = parts.find((p) => p.type === type);
    if (!found) throw new Error(`missing ${type} formatting ${timeZone}`);
    return Number(found.value);
  };

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** The zone's UTC offset, in ms, at a particular instant. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Second-granularity: the formatter drops milliseconds, so put them back
  // before differencing or the offset is wrong by up to 999ms.
  return asIfUtc - (instant.getTime() - instant.getMilliseconds());
}

/**
 * The calendar date, in the operational timezone, on which an instant falls.
 * Returns `YYYY-MM-DD` — the shape a Postgres `date` column round-trips.
 *
 * THE canonical derivation. Every writer of `delivery_slots.slot_date` must use
 * this; a database trigger rejects rows where it disagrees, so a writer that
 * does not is a failed INSERT rather than a wrong delivery date.
 */
export function deriveOperationalDate(
  instant: Date,
  timeZone: string = DELIVERY_OPERATIONAL_TZ,
): string {
  const { year, month, day } = zonedParts(instant, timeZone);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/**
 * The instant at which a given wall-clock time occurs on a given operational
 * date — the inverse of `deriveOperationalDate`.
 *
 * Slot publishers think in local terms ("lunch is 12:00, dinner is 19:00"), and
 * writing that with `Date.prototype.setHours` produces whatever the container's
 * `TZ` says. On a UTC server — which is what Cloud Run gives you — a "19:00"
 * dinner slot became 19:00 UTC, i.e. 00:30 IST the *following* morning. This
 * function is how a publisher says 19:00 and means 19:00 in Noida.
 *
 * Resolved by iteration rather than by assuming a fixed offset, so it stays
 * correct if the operational zone ever observes DST. Two passes converge for
 * any real zone; a wall-clock time skipped by a DST jump resolves to the
 * instant the clock reaches next, which is the only defensible reading.
 */
export function operationalInstant(
  operationalDate: string,
  hour: number,
  minute = 0,
  timeZone: string = DELIVERY_OPERATIONAL_TZ,
): Date {
  const [y, m, d] = operationalDate.split("-").map(Number);
  if (y == null || m == null || d == null || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
    throw new Error(`operationalInstant: expected YYYY-MM-DD, got "${operationalDate}"`);
  }
  const wallClockAsUtc = Date.UTC(y, m - 1, d, hour, minute, 0, 0);

  let instant = new Date(wallClockAsUtc);
  for (let pass = 0; pass < 2; pass++) {
    instant = new Date(wallClockAsUtc - zoneOffsetMs(instant, timeZone));
  }
  return instant;
}

/**
 * The database-side half of this invariant is a BEFORE trigger, installed from
 * `lib/db/ddl/0001_delivery_slot_operational_date_guard.sql` (and from
 * migration 0031 for deployments). It raises `23514` (check_violation) on a
 * mismatch, so a caller can tell "this writer computed the date wrong" from any
 * other write failure.
 *
 * It is a trigger rather than a CHECK constraint because
 * `starts_at AT TIME ZONE 'Asia/Kolkata'` is STABLE, not IMMUTABLE — it reads
 * the timezone database — and Postgres refuses non-immutable expressions in
 * CHECK.
 *
 * The DDL keeps its own literal copy of the zone name. `deliverySlotOperationalDate.test.ts`
 * asserts it still matches `DELIVERY_OPERATIONAL_TZ`, so the two cannot drift
 * silently.
 */
export const DELIVERY_SLOT_DATE_GUARD_DDL_FILE =
  "0001_delivery_slot_operational_date_guard.sql";
