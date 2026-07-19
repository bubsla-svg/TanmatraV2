# Prod migration baseline runbook

**Goal:** adopt the prod Postgres DB (seeded with `drizzle-kit push`, so it has
no drizzle migration ledger) into migrate-managed state, create the additive
objects `push` silently skipped, and make the deploy-time migrator a clean
no-op — so the migrate-at-boot feature (reverted in #233) can be re-shipped
without re-crashing the container.

Run this **once**, in a maintenance window, against prod. All statements are
additive and idempotent; the whole thing is one transaction.

> **Verified end-to-end against Postgres 16** before shipping. On a scratch DB
> seeded with `0000` only (no ledger — the worst-case "push-managed prod" drift):
> `baseline-prod-migrations.sql` applied clean, was a no-op on a second run, and
> a `pg_dump --schema-only` of the result was **byte-identical** (7825/7825 lines,
> modulo pg_dump's random session nonce) to a DB built by running all seven real
> migrations `0000`–`0006`. `drizzle-kit migrate` against the baselined DB was a
> clean no-op; against the same DB *without* the baseline it reproduced the exact
> prod crash (`relation "sessions" already exists`, exit 1).

---

## Why this is needed (one paragraph)

Prod was bootstrapped with `drizzle-kit push`, which stamps the schema but never
creates `drizzle.__drizzle_migrations`. #230 shipped a boot-time
`drizzle-kit migrate`; it saw an **empty ledger**, assumed nothing was applied,
and tried to replay `0000` from scratch — `CREATE TABLE "sessions"` → *relation
already exists* → `process.exit(1)` → the container never bound `PORT=8080` →
Cloud Run failed the deploy. Separately, because `push` was run at inopportune
points, prod is **genuinely missing** some additive objects from `0001`–`0006`
(e.g. `pre_debit_notifications`, `subscription_mandates`, `message_dispatches`,
`subscriptions.trial_state`, the `user_preferences` health columns,
`user_consents.purpose_health_data_processing`, …). So the fix is *not* "mark
everything applied" (that leaves those objects missing forever) — it is
**create-what's-missing, then seed the ledger.**

---

## Pre-flight

1. **Back up prod. Non-negotiable.** Cloud SQL: take an on-demand backup *and* a
   `pg_dump` you can restore locally:
   ```bash
   # On-demand Cloud SQL backup
   gcloud sql backups create --instance="$INSTANCE" \
     --description="pre-migration-baseline $(date -u +%FT%TZ)"
   # Logical dump (schema is enough for this additive change, but grab all)
   pg_dump "$DATABASE_URL" --format=custom --file=prod-pre-baseline.dump
   ```
2. **Confirm the ledger is empty/absent** (the script only seeds when empty):
   ```sql
   SELECT to_regclass('drizzle.__drizzle_migrations') AS ledger_table;
   -- If non-null, also:
   SELECT count(*) FROM drizzle.__drizzle_migrations;
   ```
   - `ledger_table` NULL, or count 0 → proceed.
   - **count > 0 → STOP.** Someone already (partially) seeded it. Inspect the
     rows against `lib/db/drizzle/meta/_journal.json` before doing anything; the
     script will refuse to touch a non-empty ledger.
3. **Optional drift snapshot** (nice for the change record — not required, the
   DDL is idempotent regardless):
   ```sql
   SELECT to_regclass('public.pre_debit_notifications'),
          to_regclass('public.subscription_mandates'),
          to_regclass('public.message_dispatches');
   SELECT column_name FROM information_schema.columns
    WHERE table_name='subscriptions' AND column_name LIKE 'pending_%' ORDER BY 1;
   ```

## Apply

Run `lib/db/baseline/baseline-prod-migrations.sql` against prod, ideally with
`psql` so you can eyeball the final `SELECT` **before** the `COMMIT`:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/baseline/baseline-prod-migrations.sql
```

The script:
- takes advisory lock `727100200` (same key the app migrator uses — blocks a
  concurrent boot-migrator from racing it),
- **PART A** — `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` /
  `CREATE INDEX IF NOT EXISTS` + `pg_constraint`-guarded FK/CHECK adds for every
  object in `0001`–`0006`. Existing objects are skipped; missing ones are
  created. **0000's 115 tables are deliberately not recreated** — prod has them.
- **PART B** — creates `drizzle.__drizzle_migrations` and seeds one row per
  migration `0000`–`0006` with the exact drizzle `hash` (sha256 of the `.sql`
  file) and `created_at` = the journal `when`.
- prints `ledger_rows | latest_when`, then `COMMIT`.

> ⚠️ `ADD COLUMN … DEFAULT … NOT NULL` on `orders.order_kind`,
> `user_consents.purpose_health_data_processing`,
> `subscription_mandates.charge_failure_count`,
> `subscriptions.pending_change_reauth_required` triggers a table rewrite and a
> brief `ACCESS EXCLUSIVE` lock proportional to table size. On a large `orders`
> table, run in the maintenance window. (These are the only rewrites; all other
> columns are nullable/metadata-only.)

## Verify (post-COMMIT)

```sql
-- 1. Ledger: 7 rows, latest_when = 1784492673804 (0006).
SELECT count(*) AS rows, max(created_at) AS latest_when
FROM drizzle.__drizzle_migrations;

-- 2. Previously-missing tables now present:
SELECT to_regclass('public.pre_debit_notifications') AS a,
       to_regclass('public.subscription_mandates')   AS b,
       to_regclass('public.message_dispatches')       AS c;   -- all non-null

-- 3. Spot-check a few previously-missing columns:
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name='subscriptions' AND column_name='trial_state')                     AS trial_state,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name='user_consents' AND column_name='purpose_health_data_processing')  AS consent_col,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name='orders' AND column_name='order_kind')                             AS order_kind;
```

Then confirm the tooling agrees nothing is left to apply:
```bash
# From a machine with prod DATABASE_URL. Expect: "No migrations to apply" / no-op.
pnpm --filter @workspace/db exec drizzle-kit migrate --config ./drizzle.config.ts
```

## Re-ship the migrate-at-boot feature

Only after the baseline is verified in prod:

1. New branch off latest `main`, re-introduce the reverted #230 pieces
   (`lib/db/src/migrate.ts`, `artifacts/api-server/scripts/migrate.ts`, the
   `migrateToLatest()` fail-fast in `src/index.ts`, the `Dockerfile`
   `dist/drizzle` copy, the `lib/db/package.json` `./migrate` export, the
   `bulkhead-ci.yml` migrate-seed swap).
2. In a **staging** DB that mirrors the freshly-baselined prod ledger, boot the
   built image once and confirm `migrateToLatest()` logs a **no-op** (latest
   applied == `0006`) and the container binds `PORT`.
3. Ship. Because the ledger now resumes from `0006`, boot is a no-op today and
   future `0007+` migrations apply exactly once, before traffic.

## Rollback

- **Mid-run failure:** the transaction rolls back automatically; prod is
  untouched. Re-run after fixing the cause.
- **Post-commit regret:** every change is additive, so nothing is broken by
  leaving it. If you must, the ledger is disposable — `DROP SCHEMA drizzle
  CASCADE;` returns you to the pre-baseline (push-managed) state without
  touching business data. Restore from the backup only if a table rewrite is
  suspected of harm (it should not be — no data is mutated).

---

### Object inventory this baseline guarantees (0001–0006)

| Migration | Objects |
|---|---|
| 0001 | tables `pre_debit_notifications`, `subscription_mandates`, `message_dispatches`; cols `users.whatsapp_utility_consent_at` / `whatsapp_marketing_consent_at` / `sms_fallback_consent_at`, `subscriptions.trial_state`; 2 FKs; 2 indexes |
| 0002 | cols `users.deleted_at`, `user_preferences.hba1c_pct` / `pcos_history` / `height_cm` / `weight_kg`, `user_consents.purpose_health_data_processing` |
| 0003 | cols `orders.order_kind` / `marketplace_delivery_mode` / `bundle_with_order_id`; index `idx_orders_kind_status`; check `orders_order_kind_chk` |
| 0004 | cols `subscription_mandates.last_charge_attempt_at` / `last_charge_status` / `last_charge_error` / `charge_failure_count` |
| 0005 | cols `subscriptions.pending_cadence` / `pending_meals_per_delivery` / `pending_price_per_delivery_paise` / `pending_change_requested_at` / `pending_change_reauth_required` / `pending_change_razorpay_order_id` |
| 0006 | cols `subscription_members.daily_calorie_target` / `daily_protein_target_grams` |

Ledger `hash` = sha256 of each `lib/db/drizzle/000N_*.sql`; `created_at` = the
`when` from `lib/db/drizzle/meta/_journal.json`.
