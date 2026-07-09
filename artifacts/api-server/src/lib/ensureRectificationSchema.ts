import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Boot-time, additive-only, idempotent schema ensure for the rectification
 * batch (vendor batch persistence + wearable ingestion). Mirrors the existing
 * `ensureSafeViews()` boot pattern.
 *
 * Every statement is `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, so it can
 * only ADD new tables/columns — it can never drop or alter existing objects,
 * and is safe to run on every boot. A session-level advisory lock serialises
 * concurrent instance boots so two containers don't race on `CREATE TABLE`.
 *
 * Run BEFORE the HTTP server binds its port, so the new `wearable_links`
 * columns exist before any request (e.g. the Wellness page) queries them.
 */
const ADVISORY_LOCK_KEY = 918273645;

const DDL = `
CREATE TABLE IF NOT EXISTS public.supplier_batches (
  id serial PRIMARY KEY,
  product varchar(256) NOT NULL,
  farm_origin varchar(512) NOT NULL,
  harvest_date date NOT NULL,
  batch_code varchar(128) NOT NULL,
  quantity numeric(12,3) NOT NULL,
  barcode_token varchar(128) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'delivered',
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_batches_barcode_token_unique UNIQUE (barcode_token)
);
CREATE INDEX IF NOT EXISTS idx_supplier_batches_created ON public.supplier_batches (created_at);
CREATE INDEX IF NOT EXISTS idx_supplier_batches_status ON public.supplier_batches (status);

CREATE TABLE IF NOT EXISTS public.wearable_metrics (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider varchar(24) NOT NULL,
  metric_type varchar(32) NOT NULL,
  value integer NOT NULL,
  unit varchar(16) NOT NULL,
  recorded_at timestamptz NOT NULL,
  source varchar(64) NOT NULL,
  dedupe_key varchar(120),
  flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wearable_metrics_user_type_time ON public.wearable_metrics (user_id, metric_type, recorded_at);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wearable_metrics_dedupe ON public.wearable_metrics (user_id, dedupe_key) WHERE (dedupe_key IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.wearable_daily_rollup (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  provider varchar(24) NOT NULL,
  active_energy_kcal integer NOT NULL DEFAULT 0,
  steps integer NOT NULL DEFAULT 0,
  resting_hr integer,
  sleep_minutes integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_wearable_rollup_user_day ON public.wearable_daily_rollup (user_id, day);

ALTER TABLE public.wearable_links ADD COLUMN IF NOT EXISTS provider_user_id varchar(128);
ALTER TABLE public.wearable_links ADD COLUMN IF NOT EXISTS status varchar(24) NOT NULL DEFAULT 'connected';
ALTER TABLE public.wearable_links ADD COLUMN IF NOT EXISTS scopes jsonb;
ALTER TABLE public.wearable_links ADD COLUMN IF NOT EXISTS consent_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_wearable_links_provider_user ON public.wearable_links (provider, provider_user_id);

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS day_plan jsonb;
`;

export async function ensureRectificationSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    await client.query("BEGIN");
    await client.query(DDL);
    await client.query("COMMIT");
    logger.info("ensureRectificationSchema: additive schema ensured");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    // Additive + idempotent, so a failure here means the new wearable/supplier
    // features degrade — but the rest of the API stays up. Log loudly; do not
    // crash the process.
    logger.error({ err }, "ensureRectificationSchema failed (continuing without new schema)");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => {});
    client.release();
  }
}
