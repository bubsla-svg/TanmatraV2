CREATE TABLE "marketplace_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"batch_number" varchar(64) NOT NULL,
	"expiry_date" timestamp with time zone NOT NULL,
	"current_qty" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_batch_qty_chk" CHECK ("marketplace_batches"."current_qty" >= 0)
);
--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "fulfillment_type" varchar(16) DEFAULT 'MTO' NOT NULL;--> statement-breakpoint
ALTER TABLE "marketplace_batches" ADD CONSTRAINT "marketplace_batches_inventory_item_id_marketplace_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."marketplace_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_marketplace_batch" ON "marketplace_batches" USING btree ("inventory_item_id","batch_number");--> statement-breakpoint
CREATE INDEX "idx_marketplace_batches_expiry" ON "marketplace_batches" USING btree ("inventory_item_id","expiry_date");