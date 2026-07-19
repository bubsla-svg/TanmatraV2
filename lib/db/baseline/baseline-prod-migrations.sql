-- ============================================================================
-- baseline-prod-migrations.sql
-- ----------------------------------------------------------------------------
-- One-time procedure to adopt the prod Postgres DB (originally seeded with
-- `drizzle-kit push`, so it has NO drizzle migration ledger) into the
-- migrate-managed world, WITHOUT the boot crash that #230 hit.
--
-- Root cause being fixed:
--   * Prod was seeded via `drizzle-kit push`, which applies the schema but
--     never creates `drizzle.__drizzle_migrations`. So the ledger is empty.
--   * The deploy-time migrator (#230) saw an empty ledger and tried to replay
--     migration 0000 from scratch -> `CREATE TABLE "sessions"` -> table already
--     exists -> process.exit(1) -> container never bound PORT -> deploy failed.
--   * ALSO: `push` was run at points where it silently skipped some additive
--     objects, so prod is genuinely missing a handful of tables/columns/indexes
--     from 0001-0006. A naive "mark everything applied" baseline would leave
--     those missing FOREVER.
--
-- What this script does, in ONE transaction:
--   PART A. Create every genuinely-missing object from migrations 0001-0006,
--           using fully IDEMPOTENT DDL (IF NOT EXISTS / guarded constraint
--           adds). Objects that already exist are skipped. This is why the
--           script is correct even without a perfect per-object drift audit.
--   PART B. Create `drizzle.__drizzle_migrations` and seed ONE row per
--           migration 0000-0006 with the exact drizzle hash (sha256 of the
--           migration file) and `created_at` = the journal `when` (folderMillis).
--           After this, `drizzle-kit migrate` / the boot migrator sees the
--           latest applied migration == the latest journal entry -> clean no-op.
--
-- SAFETY:
--   * Additive only. There is NO DROP, NO ALTER COLUMN TYPE, NO DELETE, NO
--     UPDATE of business data anywhere in this file.
--   * Fully re-runnable. Every statement is guarded; running twice is a no-op.
--   * Transactional. Postgres DDL is transactional; if any statement fails the
--     whole thing rolls back and prod is untouched.
--   * 0000's 115 tables are intentionally NOT recreated here — prod already has
--     them (that is exactly why #230 crashed on `sessions`). 0000 is only
--     represented in the ledger (PART B).
--
-- PREREQUISITES (do these first — see the .md runbook):
--   1. Take a backup / snapshot of the prod DB. This is non-negotiable.
--   2. Confirm `drizzle.__drizzle_migrations` is empty or absent. If it has
--      rows already, STOP and inspect — this script's PART B seeds only when
--      the ledger is empty and will otherwise leave a partial ledger untouched.
-- ============================================================================

BEGIN;

-- Belt-and-suspenders: block concurrent baseline runs / concurrent boot
-- migrators using the SAME advisory lock key the app-side migrator uses.
-- (pg_advisory_xact_lock releases automatically at COMMIT/ROLLBACK.)
SELECT pg_advisory_xact_lock(727100200);

-- ===========================================================================
-- PART A — create genuinely-missing objects (idempotent, additive)
-- ===========================================================================

-- ---- from 0001_sprint56_mandates -----------------------------------------

CREATE TABLE IF NOT EXISTS "pre_debit_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"scheduled_charge_at" timestamp with time zone NOT NULL,
	"dispatched_at" timestamp with time zone,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "subscription_mandates" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"razorpay_customer_id" varchar(64) NOT NULL,
	"razorpay_token_id" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"next_charge_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "message_dispatches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"template_id" varchar(64) NOT NULL,
	"service_date" varchar(16) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" varchar(128) NOT NULL,
	CONSTRAINT "message_dispatches_dedupe_key_unique" UNIQUE("dedupe_key")
);

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "whatsapp_utility_consent_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "whatsapp_marketing_consent_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sms_fallback_consent_at" timestamp with time zone;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "trial_state" varchar(32);

-- FKs (ADD CONSTRAINT has no IF NOT EXISTS in PG -> guard on pg_constraint).
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pre_debit_notifications_subscription_id_subscriptions_id_fk') THEN
		ALTER TABLE "pre_debit_notifications"
			ADD CONSTRAINT "pre_debit_notifications_subscription_id_subscriptions_id_fk"
			FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;

DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_mandates_subscription_id_subscriptions_id_fk') THEN
		ALTER TABLE "subscription_mandates"
			ADD CONSTRAINT "subscription_mandates_subscription_id_subscriptions_id_fk"
			FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_pre_debit_notifications_sub" ON "pre_debit_notifications" USING btree ("subscription_id");
CREATE INDEX IF NOT EXISTS "idx_subscription_mandates_sub" ON "subscription_mandates" USING btree ("subscription_id");

-- ---- from 0002_sprint78_health_data_lifecycle ----------------------------

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "hba1c_pct" double precision;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "pcos_history" boolean;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "height_cm" integer;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "weight_kg" double precision;
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "purpose_health_data_processing" boolean DEFAULT false NOT NULL;

-- ---- from 0003_add_marketplace_order_kind --------------------------------

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_kind" varchar(16) DEFAULT 'meal' NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "marketplace_delivery_mode" varchar(24);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "bundle_with_order_id" integer;
CREATE INDEX IF NOT EXISTS "idx_orders_kind_status" ON "orders" USING btree ("order_kind","status");

DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_kind_chk') THEN
		ALTER TABLE "orders" ADD CONSTRAINT "orders_order_kind_chk" CHECK ("orders"."order_kind" in ('meal','marketplace'));
	END IF;
END $$;

-- ---- from 0004_subscription_mandate_charge_tracking ----------------------
-- (depends on subscription_mandates, created above from 0001)

ALTER TABLE "subscription_mandates" ADD COLUMN IF NOT EXISTS "last_charge_attempt_at" timestamp with time zone;
ALTER TABLE "subscription_mandates" ADD COLUMN IF NOT EXISTS "last_charge_status" varchar(16);
ALTER TABLE "subscription_mandates" ADD COLUMN IF NOT EXISTS "last_charge_error" varchar(256);
ALTER TABLE "subscription_mandates" ADD COLUMN IF NOT EXISTS "charge_failure_count" integer DEFAULT 0 NOT NULL;

-- ---- from 0005_subscription_plan_change_fields ---------------------------

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pending_cadence" varchar(16);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pending_meals_per_delivery" integer;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pending_price_per_delivery_paise" integer;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pending_change_requested_at" timestamp with time zone;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pending_change_reauth_required" boolean DEFAULT false NOT NULL;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pending_change_razorpay_order_id" varchar(64);

-- ---- from 0006_subscription_member_macro_targets -------------------------

ALTER TABLE "subscription_members" ADD COLUMN IF NOT EXISTS "daily_calorie_target" integer;
ALTER TABLE "subscription_members" ADD COLUMN IF NOT EXISTS "daily_protein_target_grams" integer;

-- ===========================================================================
-- PART B — create + seed the drizzle migration ledger
-- ===========================================================================
-- After PART A every object from 0000-0006 exists, so it is now CORRECT to
-- record all seven migrations as applied. `created_at` is the journal `when`
-- (ms since epoch); `hash` is sha256 of the raw migration .sql file — exactly
-- what drizzle's readMigrationFiles() computes and stores. drizzle's migrator
-- resumes from MAX(created_at), so recording 0006's `when` makes 0000-0006 a
-- no-op and lets any future 0007+ apply normally.

CREATE SCHEMA IF NOT EXISTS "drizzle";

CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
	"id" serial PRIMARY KEY,
	"hash" text NOT NULL,
	"created_at" bigint
);

-- Seed only when the ledger is empty, so re-running is a no-op and a
-- pre-existing (partial) ledger is left for a human to inspect instead of
-- being silently doubled.
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
SELECT v.hash, v.created_at
FROM (VALUES
	('b0ed3082275f283d7b6a8cf271995b8a21a510859b9cbac3c881a2129665ad56'::text, 1783810227946::bigint), -- 0000_good_cammi
	('fa0d63fa1ec139ed7576431f7f0c65e1da45181aea4df58f6310f14885c15cbf'::text, 1783854916815::bigint), -- 0001_sprint56_mandates
	('079455c329142df92d1ecf0296e26f4ba831165d0c61a1ceebefeedbd471d5db'::text, 1783855539159::bigint), -- 0002_sprint78_health_data_lifecycle
	('49ddbfa5e45414fad30328b6dc9bee617fd4bae655b75e0ebb57981cbaca6d91'::text, 1784410072879::bigint), -- 0003_add_marketplace_order_kind
	('cbe8441427e09b1e7c3af9e5373a7ded69e095f9b7b4e0bb32d9cca3481761c1'::text, 1784487275850::bigint), -- 0004_subscription_mandate_charge_tracking
	('a494b03b17922e7305ce14b49629c8e39761794f7eb2c9a2276e9d8f99a43685'::text, 1784490356921::bigint), -- 0005_subscription_plan_change_fields
	('b56d58158456d34b6489f79ea1611a9e16d9027d0ea773193e4a07f6173634d0'::text, 1784492673804::bigint)  -- 0006_subscription_member_macro_targets
) AS v(hash, created_at)
WHERE NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations");

-- ===========================================================================
-- Inspect before you COMMIT.
-- ===========================================================================
-- Expect 7 rows, max(created_at) = 1784492673804 (0006's `when`).
SELECT count(*) AS ledger_rows, max(created_at) AS latest_when
FROM "drizzle"."__drizzle_migrations";

-- If everything looks right:
COMMIT;
-- If anything looks wrong:
-- ROLLBACK;
