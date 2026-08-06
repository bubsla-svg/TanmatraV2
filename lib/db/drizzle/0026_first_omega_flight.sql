-- ci:allow-destructive
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
CREATE TABLE "fasting_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"target_hours" integer DEFAULT 16 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"total_paise" integer NOT NULL,
	"items" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"customer_id" varchar NOT NULL,
	"quote_id" varchar NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'created' NOT NULL,
	"provider_reference" varchar(64),
	"order_id" varchar(64),
	"internal_order_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DROP TABLE IF EXISTS "admin_role_assignments" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "family_group_id" varchar(64);--> statement-breakpoint
ALTER TABLE "patient_biomarkers" ADD CONSTRAINT "patient_biomarkers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_biomarkers" ADD CONSTRAINT "patient_biomarkers_appointment_id_rd_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."rd_appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_biomarkers" ADD CONSTRAINT "patient_biomarkers_lab_upload_id_rd_lab_uploads_id_fk" FOREIGN KEY ("lab_upload_id") REFERENCES "public"."rd_lab_uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fasting_logs" ADD CONSTRAINT "fasting_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_internal_order_id_orders_id_fk" FOREIGN KEY ("internal_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "idx_patient_biomarkers_user" ON "patient_biomarkers" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_payment_attempts_customer_idempotency" ON "payment_attempts" USING btree ("customer_id","idempotency_key");