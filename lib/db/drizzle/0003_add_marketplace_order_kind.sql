ALTER TABLE "orders" ADD COLUMN "order_kind" varchar(16) DEFAULT 'meal' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "marketplace_delivery_mode" varchar(24);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "bundle_with_order_id" integer;--> statement-breakpoint
CREATE INDEX "idx_orders_kind_status" ON "orders" USING btree ("order_kind","status");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_kind_chk" CHECK ("orders"."order_kind" in ('meal','marketplace'));