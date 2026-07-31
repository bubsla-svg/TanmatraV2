-- Optimization-audit quick wins (TODO_optimization-auditor.md OA-QUICK-1.2,
-- OA-QUICK-1.3, OA-QUICK-1.4, OA-MED-1.10): four tables that are queried on
-- documented hot paths but were missing the index that predicate needs.
--
-- riders: rider-assignment (routes/delivery.ts, dispatch.ts) filters
--   status = 'online' and orders by active_order_count/rating. This table
--   previously had zero indexes at all.
-- delivery_events: the order-tracking timeline, the support agent, and
--   refund/anomaly checks all filter on order_id and order by created_at.
--   High-write table (every dispatch/refund/rider-sim event inserts a row),
--   so it needed the index rather than a per-lookup sequential scan.
-- subscription_mandates / subscriptions: chargeMandateScheduler,
--   preDebitScheduler and subscriptionAbandonmentScheduler filter status
--   (and next_charge_at / created_at) on every tick. chargeMandateScheduler
--   is the only thing that fires cycle-2+ subscription billing — this is a
--   money-path scheduler.
-- menu_items: POS stock webhooks (routes/petpooja.ts) filter the tags jsonb
--   column with `@>` containment inside a per-item loop, so an unindexed
--   lookup here is multiplied by webhook payload size.
--
-- All six are additive CREATE INDEX statements — no data rewrite, no drop,
-- no column change. Plain (non-CONCURRENTLY) CREATE INDEX: this repo's
-- apply-migrations.ts runs every statement in a migration file inside one
-- transaction (so the tracking row commits atomically with the DDL), and
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block — so it
-- is not available through this pipeline without a runner change, which is
-- out of scope here. Each CREATE INDEX takes a brief write lock on its
-- table while building; acceptable at current table sizes. If any of these
-- tables have grown large by the time this deploys, consider applying this
-- file's statements by hand with CONCURRENTLY ahead of the automated run.
CREATE INDEX "idx_riders_status_load" ON "riders" USING btree ("status","active_order_count");--> statement-breakpoint
CREATE INDEX "idx_delivery_events_order_created" ON "delivery_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_delivery_events_rider" ON "delivery_events" USING btree ("rider_id");--> statement-breakpoint
CREATE INDEX "idx_sub_mandates_active_next_charge" ON "subscription_mandates" USING btree ("status","next_charge_at");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_status_created" ON "subscriptions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_menu_items_tags_gin" ON "menu_items" USING gin ("tags");
