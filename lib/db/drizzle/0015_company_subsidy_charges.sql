CREATE TABLE "company_subsidy_charges" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"order_id" integer NOT NULL,
	"period_month" varchar(7) NOT NULL,
	"paise" integer NOT NULL,
	"status" varchar(16) DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_subsidy_charges_status_chk" CHECK ("company_subsidy_charges"."status" in ('reserved','committed','released')),
	CONSTRAINT "company_subsidy_charges_paise_chk" CHECK ("company_subsidy_charges"."paise" > 0)
);
--> statement-breakpoint
ALTER TABLE "company_subsidy_charges" ADD CONSTRAINT "company_subsidy_charges_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_subsidy_charges" ADD CONSTRAINT "company_subsidy_charges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_company_subsidy_charges_order" ON "company_subsidy_charges" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_company_subsidy_charges_period" ON "company_subsidy_charges" USING btree ("company_id","user_id","period_month","status");