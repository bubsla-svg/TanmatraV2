-- delivery_slots operational-date guard (DEFECT-PLAN-SLOT-DATE-001).
--
-- Enforces, for every row:
--     slot_date = the Asia/Kolkata calendar date of starts_at
--
-- A BEFORE trigger rather than a CHECK constraint: `starts_at AT TIME ZONE
-- 'Asia/Kolkata'` is STABLE (it reads the timezone database), and Postgres
-- refuses non-immutable expressions in CHECK.
--
-- Lives here as runnable DDL, not only inside migration 0031, because the two
-- ways this repository builds a database do not agree — deployments run the
-- migration chain, CI runs `drizzle-kit push`, and push knows nothing about
-- triggers. `pnpm --filter @workspace/db run push` applies this directory
-- afterwards so a push-built database carries what production has.
--
-- MUST BE IDEMPOTENT: it runs on every push.

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
$guard$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_delivery_slot_operational_date ON delivery_slots;

CREATE TRIGGER trg_delivery_slot_operational_date
BEFORE INSERT OR UPDATE OF slot_date, starts_at ON delivery_slots
FOR EACH ROW EXECUTE FUNCTION delivery_slot_operational_date_guard();
