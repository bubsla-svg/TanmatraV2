ALTER TABLE "vouchers" ALTER COLUMN "status" SET DEFAULT 'pending_payment';--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "razorpay_order_id" varchar(64);--> statement-breakpoint
ALTER TABLE "vouchers" ADD COLUMN "razorpay_payment_id" varchar(64);--> statement-breakpoint
CREATE INDEX "idx_vouchers_razorpay_order" ON "vouchers" USING btree ("razorpay_order_id");--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_status_chk" CHECK ("vouchers"."status" in ('pending_payment','active','redeemed','cancelled'));