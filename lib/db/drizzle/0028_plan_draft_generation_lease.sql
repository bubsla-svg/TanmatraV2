ALTER TABLE "plan_drafts" ADD COLUMN "generation_attempt_id" varchar(64);--> statement-breakpoint
ALTER TABLE "plan_drafts" ADD COLUMN "generation_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plan_drafts" ADD COLUMN "generation_lease_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_plan_drafts_generation_lease" ON "plan_drafts" USING btree ("generation_lease_expires_at");--> statement-breakpoint
CREATE INDEX "idx_plan_drafts_status" ON "plan_drafts" USING btree ("status");
