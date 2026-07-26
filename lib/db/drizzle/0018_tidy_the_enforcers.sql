CREATE TABLE "dish_bom_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"dish_slug" varchar(128) NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"quantity_needed" double precision NOT NULL,
	"unit" varchar(32) DEFAULT 'g' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dish_bom_components" ADD CONSTRAINT "dish_bom_components_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_dish_bom_item" ON "dish_bom_components" USING btree ("dish_slug","inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_dish_bom_slug" ON "dish_bom_components" USING btree ("dish_slug");