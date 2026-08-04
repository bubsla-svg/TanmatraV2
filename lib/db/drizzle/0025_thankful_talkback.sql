CREATE TABLE "legal_company_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"singleton_key" varchar(16) DEFAULT 'singleton' NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"brand" varchar(100) NOT NULL,
	"fssai_license_no" varchar(64) NOT NULL,
	"fssai_valid_upto" varchar(100) NOT NULL,
	"cin" varchar(100) NOT NULL,
	"registered_office" text NOT NULL,
	"grievance_officer" varchar(200) NOT NULL,
	"grievance_email" varchar(200) NOT NULL,
	"privacy_email" varchar(200) NOT NULL,
	"support_email" varchar(200) NOT NULL,
	"support_phone" varchar(32) NOT NULL,
	"service_areas" text NOT NULL,
	"jurisdiction_city" varchar(100) NOT NULL,
	"jurisdiction_state" varchar(100) NOT NULL,
	"updated_by" varchar(128) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_document_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"version" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"summary" varchar(500) DEFAULT '' NOT NULL,
	"body" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" varchar(128) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"title" varchar(200) NOT NULL,
	"summary" varchar(500) DEFAULT '' NOT NULL,
	"body" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_version_id" integer,
	"updated_by" varchar(128) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "legal_company_profile_singleton_idx" ON "legal_company_profile" USING btree ("singleton_key");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_document_versions_slug_version_idx" ON "legal_document_versions" USING btree ("slug","version");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_slug_idx" ON "legal_documents" USING btree ("slug");