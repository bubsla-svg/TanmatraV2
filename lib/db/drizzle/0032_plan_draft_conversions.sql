-- A2.4 — the record of a PlanDraft becoming a live subscription.
--
-- `uniq_plan_draft_conversion_quote` is the point of the table: it makes
--     one settled quote → exactly one order → exactly one subscription
-- a database fact rather than an application promise. A repeated payment
-- callback, a double-clicked button and a retried webhook all lose the INSERT
-- race and are answered with the conversion that already exists.

CREATE TABLE "plan_draft_conversions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"plan_draft_id" varchar NOT NULL,
	"plan_draft_quote_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"idempotency_key" varchar(128),
	"subscription_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"settlement_kind" varchar(16) NOT NULL,
	"settlement_ref" varchar(128),
	"settled_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_draft_conversions" ADD CONSTRAINT "plan_draft_conversions_plan_draft_id_plan_drafts_id_fk" FOREIGN KEY ("plan_draft_id") REFERENCES "public"."plan_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_plan_draft_conversion_quote" ON "plan_draft_conversions" USING btree ("plan_draft_quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_plan_draft_conversion_idempotency" ON "plan_draft_conversions" USING btree ("user_id","idempotency_key") WHERE "plan_draft_conversions"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "idx_plan_draft_conversions_draft" ON "plan_draft_conversions" USING btree ("plan_draft_id");--> statement-breakpoint
CREATE INDEX "idx_plan_draft_conversions_subscription" ON "plan_draft_conversions" USING btree ("subscription_id");
