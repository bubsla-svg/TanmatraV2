ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "hba1c_pct" double precision;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "pcos_history" boolean;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "height_cm" integer;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "weight_kg" double precision;--> statement-breakpoint
ALTER TABLE "user_consents" ADD COLUMN "purpose_health_data_processing" boolean DEFAULT false NOT NULL;