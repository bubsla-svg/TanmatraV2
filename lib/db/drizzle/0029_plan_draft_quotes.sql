CREATE TABLE "plan_draft_quotes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"plan_draft_id" varchar NOT NULL,
	"plan_draft_version" integer NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"delivery_fee_paise" integer DEFAULT 0 NOT NULL,
	"tax_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"schedule" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_draft_quotes" ADD CONSTRAINT "plan_draft_quotes_plan_draft_id_plan_drafts_id_fk" FOREIGN KEY ("plan_draft_id") REFERENCES "public"."plan_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_plan_draft_quotes_draft" ON "plan_draft_quotes" USING btree ("plan_draft_id");--> statement-breakpoint
CREATE INDEX "idx_plan_draft_quotes_status" ON "plan_draft_quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_plan_draft_quotes_expires" ON "plan_draft_quotes" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD COLUMN "plan_draft_quote_id" varchar;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_slot_reservation_plan_draft_quote" ON "slot_reservations" USING btree ("plan_draft_quote_id","slot_id") WHERE "slot_reservations"."plan_draft_quote_id" is not null;
