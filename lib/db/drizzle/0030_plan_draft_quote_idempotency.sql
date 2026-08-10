-- A2.3a — idempotency and an explicit reservation lifecycle.
--
-- Three invariants the A2.3 review asked for, none of which application code
-- could hold on its own:
--
--   1. A reservation gives its capacity back AT MOST ONCE, and a reservation an
--      order has consumed can never be released by a sweeper arriving late.
--      `status` makes the release a guarded transition instead of a DELETE.
--   2. A draft holds AT MOST ONE ACTIVE QUOTE. Two concurrent issue requests
--      both read "no active quote" and both insert; only a unique index stops
--      the draft holding kitchen capacity through two quotes at once.
--   3. A RETRIED issue request resolves to the quote already issued rather than
--      superseding it and re-reserving.

ALTER TABLE "slot_reservations" ADD COLUMN "status" varchar(16) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD COLUMN "released_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_slot_reservations_status" ON "slot_reservations" USING btree ("status");--> statement-breakpoint

ALTER TABLE "plan_draft_quotes" ADD COLUMN "idempotency_key" varchar(128);--> statement-breakpoint

-- Both indexes are created on tables that may already hold rows. Plan checkout
-- is gated and nothing consumes a quote yet, but build them so a pre-existing
-- violation surfaces here rather than at the first concurrent request.
--
-- The active-quote index is partial on status: superseded, expired and consumed
-- quotes accumulate per draft by design (they are the audit trail), so the
-- constraint has to apply to the live one only.
CREATE UNIQUE INDEX "uniq_plan_draft_quote_active" ON "plan_draft_quotes" USING btree ("plan_draft_id") WHERE "plan_draft_quotes"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_plan_draft_quote_idempotency" ON "plan_draft_quotes" USING btree ("plan_draft_id","idempotency_key") WHERE "plan_draft_quotes"."idempotency_key" is not null;
