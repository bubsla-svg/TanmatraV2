CREATE TABLE "trial_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_hash" varchar(64) NOT NULL,
	"user_id" varchar,
	"subscription_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trial_redemptions" ADD CONSTRAINT "trial_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_trial_redemptions_phone" ON "trial_redemptions" USING btree ("phone_hash");