CREATE TABLE "community_qa_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"author_name" varchar(128) DEFAULT 'Member' NOT NULL,
	"question_title" varchar(256) NOT NULL,
	"question_body" text NOT NULL,
	"category" varchar(64) DEFAULT 'general' NOT NULL,
	"rd_answer" text DEFAULT '' NOT NULL,
	"rd_answered_by" varchar(128) DEFAULT '' NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "symptom_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"logged_date" varchar(32) NOT NULL,
	"symptom_type" varchar(64) NOT NULL,
	"severity" integer DEFAULT 1 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"related_dish_slug" varchar(128) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "community_qa_threads" ADD CONSTRAINT "community_qa_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptom_logs" ADD CONSTRAINT "symptom_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_community_qa_category" ON "community_qa_threads" USING btree ("category","created_at");--> statement-breakpoint
CREATE INDEX "idx_community_qa_user" ON "community_qa_threads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_symptom_logs_user" ON "symptom_logs" USING btree ("user_id","logged_date");