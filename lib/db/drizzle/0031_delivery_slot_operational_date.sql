-- DEFECT-PLAN-SLOT-DATE-001 — make `delivery_slots.slot_date` provably the
-- Asia/Kolkata calendar date of `starts_at`.
--
-- A2.3a pinned the operational timezone for the WINDOW LABEL but left the DATE
-- documentation-only, so every writer was free to keep producing
-- `startsAt.toISOString().slice(0, 10)` — the UTC date. Every writer did. For a
-- slot at 19:00 IST (13:30 UTC) UTC and IST agree and nothing looks wrong; for
-- one at 00:30 IST (19:00 UTC the previous day) they differ, and the customer
-- is shown their delivery on the wrong day. Corrected times only make that more
-- likely, since the corrected dinner slots are exactly the ones near midnight.
--
-- Enforcement is a BEFORE trigger, not a CHECK: `starts_at AT TIME ZONE
-- 'Asia/Kolkata'` is STABLE (it reads the timezone database), and Postgres
-- refuses non-immutable expressions in a CHECK constraint.

-- 1. Backfill. Ordered before the trigger exists, or the trigger would reject
--    the very UPDATE that repairs the rows.
UPDATE "delivery_slots"
   SET "slot_date" = ("starts_at" AT TIME ZONE 'Asia/Kolkata')::date
 WHERE "slot_date" IS DISTINCT FROM ("starts_at" AT TIME ZONE 'Asia/Kolkata')::date;--> statement-breakpoint

-- 2. The guard. Kept byte-identical to DELIVERY_SLOT_DATE_GUARD_SQL in
--    lib/db/src/operationalDate.ts — deployments install it from here, and the
--    test suite installs it from there, because CI builds its database with
--    `drizzle-kit push`, which does not carry triggers.
CREATE OR REPLACE FUNCTION delivery_slot_operational_date_guard() RETURNS trigger AS $guard$
DECLARE
  expected date;
BEGIN
  expected := (NEW.starts_at AT TIME ZONE 'Asia/Kolkata')::date;
  IF NEW.slot_date IS DISTINCT FROM expected THEN
    RAISE EXCEPTION
      'slot_date % contradicts the Asia/Kolkata operational date % of starts_at % (see deriveOperationalDate)',
      NEW.slot_date, expected, NEW.starts_at
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$guard$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_delivery_slot_operational_date ON delivery_slots;--> statement-breakpoint

CREATE TRIGGER trg_delivery_slot_operational_date
BEFORE INSERT OR UPDATE OF slot_date, starts_at ON delivery_slots
FOR EACH ROW EXECUTE FUNCTION delivery_slot_operational_date_guard();--> statement-breakpoint

-- 3. Schedules chosen before the operational timezone was pinned must not be
--    silently reinterpreted. A window label that read "02:30-04:30" under the
--    old UTC rendering means something different now, so the customer has to
--    re-pick rather than have us guess. Only drafts that actually carry a
--    schedule are marked; a draft still being configured has nothing to
--    reconfirm.
ALTER TABLE "plan_drafts" ADD COLUMN "schedule_reconfirm_reason" varchar(64);--> statement-breakpoint

UPDATE "plan_drafts"
   SET "schedule_reconfirm_reason" = 'delivery_window_timezone_updated'
 WHERE "delivery_schedule" IS NOT NULL
   AND "status" NOT IN ('converted', 'abandoned', 'superseded');
