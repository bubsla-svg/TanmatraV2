CREATE TABLE "pre_debit_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"scheduled_charge_at" timestamp with time zone NOT NULL,
	"dispatched_at" timestamp with time zone,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_mandates" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"razorpay_customer_id" varchar(64) NOT NULL,
	"razorpay_token_id" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"next_charge_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_dispatches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"template_id" varchar(64) NOT NULL,
	"service_date" varchar(16) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" varchar(128) NOT NULL,
	CONSTRAINT "message_dispatches_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp_utility_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp_marketing_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sms_fallback_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "trial_state" varchar(32);--> statement-breakpoint
ALTER TABLE "pre_debit_notifications" ADD CONSTRAINT "pre_debit_notifications_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_mandates" ADD CONSTRAINT "subscription_mandates_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pre_debit_notifications_sub" ON "pre_debit_notifications" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_mandates_sub" ON "subscription_mandates" USING btree ("subscription_id");