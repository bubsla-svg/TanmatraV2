CREATE TABLE "plan_drafts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"journey" varchar(16) NOT NULL,
	"acquisition_context" varchar(32),
	"status" varchar(24) DEFAULT 'collecting_preferences' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"plan_id" varchar(32),
	"goal" varchar(64),
	"mealtime" jsonb,
	"routine" jsonb,
	"dietary_pattern" varchar(32),
	"hard_allergens" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hard_exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"soft_dislikes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"spice_preference" varchar(16),
	"variety_preference" varchar(16),
	"intensity" jsonb,
	"duration" jsonb,
	"lineup" jsonb,
	"locked_slot_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"previous_lineup" jsonb,
	"delivery_schedule" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_drafts" ADD CONSTRAINT "plan_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_plan_drafts_user" ON "plan_drafts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_plan_drafts_expires" ON "plan_drafts" USING btree ("expires_at");
