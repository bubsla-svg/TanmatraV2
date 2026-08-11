-- Schema-drift repair: three objects that landed in lib/db/src/schema (Phase-13
-- family wellness + RD advisory work) WITHOUT a committed migration. Production
-- is migrated exclusively by scripts/src/apply-migrations.ts replaying these
-- files, so all three have been absent from the live database since merge.
--
-- The acute customer-facing casualty is users.family_group_id: Drizzle's
-- .returning() enumerates every schema column, so the verify-otp user upsert
-- (routes/auth.ts) selects "family_group_id" on a table that does not have it —
-- 42703 → 500 "internal error" on EVERY phone sign-in.
--
-- All statements are additive; nothing destructive.

ALTER TABLE "users" ADD COLUMN "family_group_id" varchar(64);--> statement-breakpoint
CREATE TABLE "patient_biomarkers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"appointment_id" integer,
	"lab_upload_id" integer,
	"report_name" text NOT NULL,
	"report_date" timestamp with time zone,
	"biomarkers" jsonb NOT NULL,
	"summary" text,
	"flagged_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_biomarkers" ADD CONSTRAINT "patient_biomarkers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_biomarkers" ADD CONSTRAINT "patient_biomarkers_appointment_id_rd_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."rd_appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_biomarkers" ADD CONSTRAINT "patient_biomarkers_lab_upload_id_rd_lab_uploads_id_fk" FOREIGN KEY ("lab_upload_id") REFERENCES "public"."rd_lab_uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_patient_biomarkers_user" ON "patient_biomarkers" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE TABLE "fasting_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"target_hours" integer DEFAULT 16 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fasting_logs" ADD CONSTRAINT "fasting_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
