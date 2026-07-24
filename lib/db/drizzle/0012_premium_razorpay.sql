ALTER TABLE "premium_memberships" ADD COLUMN "razorpay_order_id" varchar(64);--> statement-breakpoint
ALTER TABLE "premium_memberships" ADD COLUMN "razorpay_payment_id" varchar(64);