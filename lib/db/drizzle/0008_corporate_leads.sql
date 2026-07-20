CREATE TABLE "corporate_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" varchar(24) NOT NULL,
	"name" varchar(80) NOT NULL,
	"work_email" varchar(256) NOT NULL,
	"company" varchar(120) NOT NULL,
	"team_size_band" varchar(16) NOT NULL,
	"park_or_sector" varchar(120),
	"phone" varchar(20),
	"message" text,
	"source" varchar(160),
	"status" varchar(16) DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_corporate_leads_status_time" ON "corporate_leads" USING btree ("status","created_at");