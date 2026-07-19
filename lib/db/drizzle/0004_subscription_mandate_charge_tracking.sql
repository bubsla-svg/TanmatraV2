ALTER TABLE "subscription_mandates" ADD COLUMN "last_charge_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_mandates" ADD COLUMN "last_charge_status" varchar(16);--> statement-breakpoint
ALTER TABLE "subscription_mandates" ADD COLUMN "last_charge_error" varchar(256);--> statement-breakpoint
ALTER TABLE "subscription_mandates" ADD COLUMN "charge_failure_count" integer DEFAULT 0 NOT NULL;