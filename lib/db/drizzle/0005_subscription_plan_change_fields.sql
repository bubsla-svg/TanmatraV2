ALTER TABLE "subscriptions" ADD COLUMN "pending_cadence" varchar(16);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pending_meals_per_delivery" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pending_price_per_delivery_paise" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pending_change_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pending_change_reauth_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pending_change_razorpay_order_id" varchar(64);