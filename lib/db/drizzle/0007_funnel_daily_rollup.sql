CREATE TABLE "funnel_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"name" varchar(64) NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"distinct_sessions" integer DEFAULT 0 NOT NULL,
	"distinct_users" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_funnel_daily_day_name" ON "funnel_daily" USING btree ("day","name");