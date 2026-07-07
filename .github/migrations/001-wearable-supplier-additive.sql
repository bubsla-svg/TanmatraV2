-- Bounded, additive-only, idempotent migration.
-- Rectifications: vendor batch persistence + wearable ingestion (increment 1).
-- Safe to re-run. Non-destructive: only NEW tables + NEW nullable/defaulted columns.
BEGIN;

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

COMMIT;
