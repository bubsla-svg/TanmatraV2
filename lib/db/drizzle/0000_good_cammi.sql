CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" varchar,
	"phone_verified_at" timestamp with time zone,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"signup_source" varchar(32),
	"utm_source" varchar(64),
	"utm_medium" varchar(64),
	"utm_campaign" varchar(128),
	"referral_code" varchar(64),
	"marketing_sms_consent_at" timestamp with time zone,
	"dpdp_consent_at" timestamp with time zone,
	"tos_accepted_version" varchar(16),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_e164_unique" UNIQUE("phone_e164"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" varchar(256) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"user_id" varchar NOT NULL,
	"key" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"status_code" integer,
	"response_body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_key_pk" PRIMARY KEY("user_id","key"),
	CONSTRAINT "idempotency_keys_status_chk" CHECK ("idempotency_keys"."status_code" is null or ("idempotency_keys"."status_code" >= 100 and "idempotency_keys"."status_code" < 600))
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"external_order_id" varchar(64),
	"razorpay_order_id" varchar(64),
	"razorpay_payment_id" varchar(64),
	"status" varchar(32) DEFAULT 'placed' NOT NULL,
	"total_paise" integer NOT NULL,
	"charge_paise" integer,
	"address_label" varchar(64),
	"address_line" varchar(256),
	"city" varchar(64),
	"pincode" varchar(16),
	"phone" varchar(32),
	"drop_lat" double precision,
	"drop_lng" double precision,
	"items" jsonb NOT NULL,
	"rider_id" integer,
	"scheduled_for" timestamp with time zone,
	"delivery_slot_id" integer,
	"pickup_location_id" integer,
	"fulfillment_type" varchar(16) DEFAULT 'delivery' NOT NULL,
	"eco_packaging_opt_in" integer DEFAULT 0 NOT NULL,
	"delivery_instructions" varchar(512),
	"priority" varchar(16) DEFAULT 'routine' NOT NULL,
	"sla_breach_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_priority_chk" CHECK ("orders"."priority" in ('routine','urgent','stat'))
);
--> statement-breakpoint
CREATE TABLE "riders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"zone" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'offline' NOT NULL,
	"rating" double precision DEFAULT 5 NOT NULL,
	"active_order_count" integer DEFAULT 0 NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"rider_id" integer,
	"event" varchar(64) NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packaging_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_no" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"price_per_piece_paise" integer
);
--> statement-breakpoint
CREATE TABLE "packaging_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"order_id" integer NOT NULL,
	"status" varchar(32) DEFAULT 'opted_in' NOT NULL,
	"credit_paise" integer DEFAULT 2000 NOT NULL,
	"returned_at" timestamp with time zone,
	"credited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"slot_date" date NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"zone" varchar(64) DEFAULT 'default' NOT NULL,
	"capacity" integer DEFAULT 20 NOT NULL,
	"reserved_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot_reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slot_id" integer NOT NULL,
	"user_id" varchar,
	"order_id" integer,
	"subscription_id" integer,
	"kind" varchar(32) DEFAULT 'order' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pickup_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"partner_name" varchar(128),
	"address_line" varchar(256) NOT NULL,
	"city" varchar(64) NOT NULL,
	"pincode" varchar(16) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"hours" varchar(128),
	"discount_paise" integer DEFAULT 3000 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "address_instructions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"address_label" varchar(128) NOT NULL,
	"instructions" varchar(512) DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"label" varchar(64) NOT NULL,
	"type" varchar(16) DEFAULT 'home' NOT NULL,
	"line1" varchar(256) NOT NULL,
	"line2" varchar(256),
	"city" varchar(128) NOT NULL,
	"pincode" varchar(16) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_no" integer NOT NULL,
	"product" varchar(256) NOT NULL,
	"buying_qty" varchar(64),
	"buying_price_paise" integer,
	"per_kg_unit_paise" integer,
	"price_per_100_gm_pcs_label" varchar(128),
	"price_per_10_gm_label" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"position" integer NOT NULL,
	"raw_text" varchar(256) NOT NULL,
	"ingredient" varchar(128) NOT NULL,
	"quantity_text" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_no" integer NOT NULL,
	"name" varchar(256) NOT NULL,
	"slug" varchar(256) NOT NULL,
	"serving_size" varchar(64),
	"method" text DEFAULT '' NOT NULL,
	"food_cost_paise" integer,
	"calories_kcal" integer,
	"protein_g" integer,
	"carbs_g" integer,
	"fat_g" integer,
	"fiber_g" integer,
	"saturated_fat_g" integer,
	"sugar_g" integer,
	"sodium_mg" integer,
	"glycaemic_index" varchar(16),
	"allergens" jsonb DEFAULT '[]'::jsonb,
	"micronutrients" jsonb DEFAULT '[]'::jsonb,
	"sourcing_notes" jsonb DEFAULT '[]'::jsonb,
	"contains_claims" jsonb DEFAULT '[]'::jsonb,
	"free_from_claims" jsonb DEFAULT '[]'::jsonb,
	CONSTRAINT "recipes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "team_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(128) NOT NULL,
	"name" varchar(200) NOT NULL,
	"role" varchar(16) NOT NULL,
	"title" varchar(200) NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"signature_line" varchar(280),
	"years_experience" integer DEFAULT 0 NOT NULL,
	"initials" varchar(8) NOT NULL,
	"accent" varchar(16) DEFAULT 'gold' NOT NULL,
	"credentials" jsonb DEFAULT '[]'::jsonb,
	"kitchens" jsonb DEFAULT '[]'::jsonb,
	"lifestyles" jsonb DEFAULT '[]'::jsonb,
	"owned_dish_slugs" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "meal_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"subscription_id" integer,
	"delivery_id" integer,
	"amount" integer NOT NULL,
	"reason" varchar(32) NOT NULL,
	"expires_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"delivery_window" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'upcoming' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"order_id" integer,
	"notes" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"name" varchar(64) NOT NULL,
	"diet" varchar(16) DEFAULT 'any' NOT NULL,
	"allergens" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"medical_conditions" text[] DEFAULT '{}' NOT NULL,
	"disliked_ingredients" text[] DEFAULT '{}' NOT NULL,
	"lifestyle" varchar(32),
	"spice_level" varchar(16) DEFAULT 'medium',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"cadence" varchar(16) NOT NULL,
	"meals_per_delivery" integer NOT NULL,
	"delivery_window" varchar(32) NOT NULL,
	"preferred_slot_id" integer,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"next_delivery_at" timestamp with time zone NOT NULL,
	"paused_at" timestamp with time zone,
	"address_label" varchar(64),
	"address_line" varchar(256),
	"city" varchar(64),
	"pincode" varchar(16),
	"phone" varchar(32),
	"price_per_delivery_paise" integer DEFAULT 0 NOT NULL,
	"day_plan" jsonb,
	"notes" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"delta_paise" integer NOT NULL,
	"reason" varchar(32) NOT NULL,
	"ref_type" varchar(32),
	"ref_id" varchar(64),
	"note" varchar(256),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_config" (
	"id" integer PRIMARY KEY NOT NULL,
	"referrer_award_paise" integer NOT NULL,
	"referee_award_paise" integer NOT NULL,
	"referral_expiry_days" integer NOT NULL,
	"winback_paused_days" integer NOT NULL,
	"winback_offer_paise" integer NOT NULL,
	"birthday_paise" integer NOT NULL,
	"anniversary_paise" integer NOT NULL,
	"loyalty_free_every_n" integer NOT NULL,
	"premium_unlock_deliveries" integer NOT NULL,
	"premium_unlock_bonus_paise" integer NOT NULL,
	"protein_streak_threshold" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"kind" varchar(32) NOT NULL,
	"title" varchar(128) NOT NULL,
	"body" varchar(512) NOT NULL,
	"channel" varchar(16) DEFAULT 'in_app' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"dedupe_key" varchar(128),
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_order_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"order_id" varchar(64) NOT NULL,
	"gross_paise" integer DEFAULT 0 NOT NULL,
	"redeemed_paise" integer DEFAULT 0 NOT NULL,
	"final_paise" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"code" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code_id" integer NOT NULL,
	"referrer_user_id" varchar NOT NULL,
	"referee_user_id" varchar NOT NULL,
	"referee_award_paise" integer NOT NULL,
	"referrer_award_paise" integer NOT NULL,
	"awarded_at" timestamp with time zone,
	"first_order_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"birth_date" date,
	"anniversary_date" date,
	"protein_goal_grams" integer,
	"last_nutrition_log_at" timestamp with time zone,
	"protein_shortfall_streak" integer DEFAULT 0 NOT NULL,
	"email_opt_out" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"allergens" text[] DEFAULT '{}' NOT NULL,
	"disliked_ingredients" text[] DEFAULT '{}' NOT NULL,
	"medical_conditions" text[] DEFAULT '{}' NOT NULL,
	"cuisines" text[] DEFAULT '{}' NOT NULL,
	"spice_level" varchar(16) DEFAULT 'medium' NOT NULL,
	"dietary_style" varchar(16) DEFAULT 'omnivore' NOT NULL,
	"goal" varchar(24) DEFAULT 'general_wellness' NOT NULL,
	"activity_level" varchar(16) DEFAULT 'moderate' NOT NULL,
	"calorie_target" integer,
	"protein_target_grams" integer,
	"carbs_target_grams" integer,
	"fat_target_grams" integer,
	"quiz_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"rd_slug" varchar(64) NOT NULL,
	"kind" varchar(24) NOT NULL,
	"status" varchar(16) DEFAULT 'scheduled' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"price_paise" integer DEFAULT 0 NOT NULL,
	"payment_status" varchar(16) DEFAULT 'free' NOT NULL,
	"join_url" text,
	"user_question" text,
	"rd_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"rd_slug" varchar(64) NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_lab_uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"shared_with_rd_slug" varchar(64),
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" varchar(64) NOT NULL,
	"size_bytes" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"rd_slug" varchar(64) NOT NULL,
	"sender_role" varchar(8) NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_progress_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"weight_kg" numeric(5, 2),
	"energy_score" integer,
	"adherence_score" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"rd_slug" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bundles" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"badge" varchar(32),
	"price_paise" integer NOT NULL,
	"original_price_paise" integer NOT NULL,
	"dish_ids" jsonb NOT NULL,
	"image" varchar(512),
	CONSTRAINT "bundles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "group_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(8) NOT NULL,
	"host_user_id" varchar,
	"host_name" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "group_orders_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "daily_targets" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"calorie_target" integer DEFAULT 2000 NOT NULL,
	"protein_target_grams" integer DEFAULT 80 NOT NULL,
	"fiber_target_grams" integer DEFAULT 28 NOT NULL,
	"water_target_ml" integer DEFAULT 2500 NOT NULL,
	"veg_target_servings" integer DEFAULT 3 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"logged_for" date NOT NULL,
	"source" varchar(24) DEFAULT 'manual' NOT NULL,
	"label" varchar(128) NOT NULL,
	"calories" integer DEFAULT 0 NOT NULL,
	"protein_grams" integer DEFAULT 0 NOT NULL,
	"carbs_grams" integer DEFAULT 0 NOT NULL,
	"fat_grams" integer DEFAULT 0 NOT NULL,
	"fiber_grams" integer DEFAULT 0 NOT NULL,
	"water_ml" integer DEFAULT 0 NOT NULL,
	"veg_servings" integer DEFAULT 0 NOT NULL,
	"order_id" integer,
	"dedupe_key" varchar(96),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"kind" varchar(16) NOT NULL,
	"current_days" integer DEFAULT 0 NOT NULL,
	"best_days" integer DEFAULT 0 NOT NULL,
	"last_day_hit" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wearable_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" varchar(24) NOT NULL,
	"connected" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_activity_kcal" integer,
	"last_steps" integer,
	"provider_user_id" varchar(128),
	"status" varchar(24) DEFAULT 'connected' NOT NULL,
	"scopes" jsonb,
	"consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wearable_daily_rollup" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"day" date NOT NULL,
	"provider" varchar(24) NOT NULL,
	"active_energy_kcal" integer DEFAULT 0 NOT NULL,
	"steps" integer DEFAULT 0 NOT NULL,
	"resting_hr" integer,
	"sleep_minutes" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wearable_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" varchar(24) NOT NULL,
	"metric_type" varchar(32) NOT NULL,
	"value" integer NOT NULL,
	"unit" varchar(16) NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"source" varchar(64) NOT NULL,
	"dedupe_key" varchar(120),
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent" text NOT NULL,
	"user_id" text,
	"model" text NOT NULL,
	"prompt_version" text,
	"input" jsonb NOT NULL,
	"output" text,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micro_usd" bigint DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"timed_out" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"escalated" integer DEFAULT 0 NOT NULL,
	"refusal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dish_availability" (
	"slug" varchar(128) PRIMARY KEY NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"reason" text,
	"updated_by" varchar(128),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ops_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"operator_id" varchar(128),
	"agent" varchar(64) NOT NULL,
	"action" varchar(64) NOT NULL,
	"params" jsonb NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb,
	"status" varchar(32) NOT NULL,
	"error" text,
	"reasoning" text,
	"dedupe_key" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ops_actions_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "ops_audit_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"dedupe_key" varchar(128) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "ops_audit_outbox_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "supplier_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"product" varchar(256) NOT NULL,
	"farm_origin" varchar(512) NOT NULL,
	"harvest_date" date NOT NULL,
	"batch_code" varchar(128) NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"barcode_token" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'delivered' NOT NULL,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_batches_barcode_token_unique" UNIQUE("barcode_token")
);
--> statement-breakpoint
CREATE TABLE "forecast_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"for_date" date NOT NULL,
	"daypart" varchar(16) NOT NULL,
	"zone" varchar(64) NOT NULL,
	"dish_slug" varchar(128) NOT NULL,
	"forecast_qty" double precision NOT NULL,
	"actual_qty" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kitchen_stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"zone" varchar(64) DEFAULT 'default' NOT NULL,
	"on_hand_qty" double precision DEFAULT 0 NOT NULL,
	"unit" varchar(32) DEFAULT 'kg' NOT NULL,
	"par_level" double precision DEFAULT 0 NOT NULL,
	"reorder_qty" double precision DEFAULT 0 NOT NULL,
	"lead_time_days" integer DEFAULT 2 NOT NULL,
	"supplier_name" varchar(128),
	"supplier_email" varchar(128),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_order_id" integer NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"qty" double precision NOT NULL,
	"unit" varchar(32) DEFAULT 'kg' NOT NULL,
	"unit_price_paise" integer DEFAULT 0 NOT NULL,
	"line_total_paise" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_name" varchar(128) NOT NULL,
	"supplier_email" varchar(128),
	"zone" varchar(64) DEFAULT 'default' NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"total_paise" integer DEFAULT 0 NOT NULL,
	"eta_date" date,
	"notes" text,
	"created_by" varchar(128),
	"approved_by" varchar(128),
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eta_predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"zone" varchar(64) NOT NULL,
	"model_version" varchar(32) DEFAULT 'v1-heuristic' NOT NULL,
	"predicted_minutes" double precision NOT NULL,
	"predicted_eta_at" timestamp with time zone NOT NULL,
	"features" jsonb,
	"actual_minutes" double precision,
	"actual_delivered_at" timestamp with time zone,
	"error_minutes" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_key" varchar(64) NOT NULL,
	"order_id" integer NOT NULL,
	"chosen_rider_id" integer,
	"chosen_score" double precision,
	"chosen_breakdown" jsonb,
	"chosen_distance_km" double precision,
	"baseline_rider_id" integer,
	"baseline_score" double precision,
	"baseline_distance_km" double precision,
	"strategy" varchar(32) DEFAULT 'smart' NOT NULL,
	"batched" integer DEFAULT 0 NOT NULL,
	"operator_id" varchar(64),
	"notes" varchar(256),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anomaly_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"metric" varchar(64) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"value" double precision NOT NULL,
	"baseline" double precision,
	"threshold" double precision,
	"deviation" double precision,
	"dimensions" jsonb,
	"summary" text NOT NULL,
	"suggested_action" text NOT NULL,
	"acked_by" varchar(128),
	"acked_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"fingerprint" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anomaly_alerts_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(128) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_paise" integer NOT NULL,
	"category" varchar(64) NOT NULL,
	"kitchen_location" varchar(128) DEFAULT 'default' NOT NULL,
	"is_veg" boolean DEFAULT true NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"availability_window" jsonb,
	"tags" jsonb,
	"image_url" text,
	"long_description" text,
	"allergens" jsonb,
	"contraindications" jsonb DEFAULT '[]'::jsonb,
	"cuisine_tags" jsonb,
	"vibe_tags" jsonb,
	"seo_title" varchar(200),
	"seo_description" text,
	"macros" jsonb,
	"macros_are_estimate" boolean DEFAULT true NOT NULL,
	"rd_verified" boolean DEFAULT false NOT NULL,
	"rd_note" text,
	"allergen_review_state" varchar(32) DEFAULT 'pending_review' NOT NULL,
	"prep_time" varchar(64),
	"glycaemic_index" varchar(16),
	"sugar_per_serving" varchar(64),
	"ingredients" jsonb,
	"customizations" jsonb,
	"pairing_slug" varchar(128),
	"copy_generated_at" timestamp with time zone,
	"copy_generated_by" varchar(64),
	"unavailable_reason" text,
	"unavailable_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_items_slug_unique" UNIQUE("slug"),
	CONSTRAINT "menu_items_allergen_review_state_chk" CHECK ("menu_items"."allergen_review_state" in ('pending_review','reviewed','blocked'))
);
--> statement-breakpoint
CREATE TABLE "menu_item_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(128) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text NOT NULL,
	"mime_type" varchar(64) NOT NULL,
	"width" integer,
	"height" integer,
	"bytes" integer,
	"source_asset_id" integer,
	"provenance" jsonb,
	"is_ai_generated" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "dish_review_summaries" (
	"slug" varchar(128) PRIMARY KEY NOT NULL,
	"most_loved" text DEFAULT '' NOT NULL,
	"common_gripe" text DEFAULT '' NOT NULL,
	"trend" varchar(32) DEFAULT 'stable' NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"average_rating_x10" integer DEFAULT 0 NOT NULL,
	"model_id" varchar(64) NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dish_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"slug" varchar(128) NOT NULL,
	"rating" integer NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"photo_url" varchar(1024),
	"sentiment" jsonb,
	"hidden" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_engineering_dish_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"slug" varchar(128) NOT NULL,
	"name" varchar(200) NOT NULL,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"units_sold" integer DEFAULT 0 NOT NULL,
	"revenue_paise" integer DEFAULT 0 NOT NULL,
	"margin_paise" integer DEFAULT 0 NOT NULL,
	"popularity_score_x100" integer DEFAULT 0 NOT NULL,
	"margin_score_x100" integer DEFAULT 0 NOT NULL,
	"classification" varchar(16) NOT NULL,
	"recommendation" varchar(16) NOT NULL,
	"commentary" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_engineering_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"model_id" varchar(64) NOT NULL,
	"total_dishes" integer DEFAULT 0 NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer,
	"slug" varchar(128) NOT NULL,
	"zone" varchar(32) DEFAULT 'all' NOT NULL,
	"daypart" varchar(32) DEFAULT 'all' NOT NULL,
	"current_paise" integer NOT NULL,
	"suggested_paise" integer NOT NULL,
	"expected_revenue_delta_pct_low_x10" integer DEFAULT 0 NOT NULL,
	"expected_revenue_delta_pct_high_x10" integer DEFAULT 0 NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"decided_by" varchar,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_queries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(128),
	"question" text NOT NULL,
	"sql" text NOT NULL,
	"chart_spec" jsonb,
	"rationale" text,
	"row_count" integer DEFAULT 0 NOT NULL,
	"saved" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voc_themes" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"week_end" timestamp with time zone NOT NULL,
	"theme" varchar(128) NOT NULL,
	"sentiment" varchar(16) NOT NULL,
	"mention_count" integer DEFAULT 0 NOT NULL,
	"example_quotes" jsonb NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wbr_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"week_end" timestamp with time zone NOT NULL,
	"kpis" jsonb NOT NULL,
	"chart_spec" jsonb,
	"commentary" text NOT NULL,
	"model_id" varchar(64),
	"published_at" timestamp with time zone,
	"publish_channel" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nps_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(128),
	"score" integer NOT NULL,
	"comment" text,
	"source" varchar(32) DEFAULT 'post_delivery' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_eval_examples" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"label" varchar(16) NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"ai_category" varchar(32),
	"ai_priority" varchar(16),
	"ai_team" varchar(16),
	"human_category" varchar(32),
	"human_priority" varchar(16),
	"human_team" varchar(16),
	"ai_draft" text,
	"final_reply" text,
	"rejection_reason" text,
	"model_id" varchar(64),
	"triage_run_id" integer,
	"draft_run_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(128),
	"order_id" integer,
	"channel" varchar(16) DEFAULT 'web' NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"status" varchar(24) DEFAULT 'new' NOT NULL,
	"category" varchar(32),
	"priority" varchar(16),
	"team" varchar(16),
	"triage_run_id" integer,
	"triage_reason" text,
	"triaged_at" timestamp with time zone,
	"draft_reply" text,
	"draft_citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draft_run_id" integer,
	"drafted_at" timestamp with time zone,
	"sent_reply" text,
	"sent_by" varchar(128),
	"sent_at" timestamp with time zone,
	"human_category" varchar(32),
	"human_priority" varchar(16),
	"human_team" varchar(16),
	"rejection_reason" text,
	"rejected_by" varchar(128),
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(128) NOT NULL,
	"title" varchar(200) NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"image" varchar(512),
	"author_name" varchar(128) NOT NULL,
	"author_role" varchar(64) DEFAULT 'RD' NOT NULL,
	"goal" varchar(32) DEFAULT 'general_wellness' NOT NULL,
	"diet" varchar(32) DEFAULT 'omnivore' NOT NULL,
	"time_minutes" integer DEFAULT 30 NOT NULL,
	"calories" integer,
	"protein_grams" integer,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_recipes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "challenge_check_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"join_url" varchar(512) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "challenge_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"author_name" varchar(128) DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"hidden" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(128) NOT NULL,
	"title" varchar(200) NOT NULL,
	"tagline" varchar(280) DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image" varchar(512),
	"rd_name" varchar(128) DEFAULT '' NOT NULL,
	"duration_days" integer DEFAULT 21 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"goal_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bundle_slug" varchar(128),
	"featured" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenges_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rd_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" varchar(16) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"email" varchar(200) NOT NULL,
	"credentials" varchar(200) NOT NULL,
	"registration_body" varchar(120),
	"registration_number" varchar(80),
	"years_experience" integer NOT NULL,
	"specializations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"city_region" varchar(200) NOT NULL,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"practice_setting" varchar(32) NOT NULL,
	"client_volume_bucket" varchar(32),
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bio" text,
	"whatsapp_country_code" varchar(8),
	"whatsapp_phone" varchar(20),
	"whatsapp_verified_at" timestamp with time zone,
	"whatsapp_opt_in" boolean DEFAULT false NOT NULL,
	"notify_pref" varchar(16) DEFAULT 'weekly' NOT NULL,
	"status" varchar(16) DEFAULT 'new' NOT NULL,
	"admin_notes" text,
	"reviewed_by" varchar(128),
	"reviewed_at" timestamp with time zone,
	"linked_user_id" varchar(128),
	"linked_rd_slug" varchar(64),
	"submit_client_ip" varchar(64),
	"submit_user_agent" varchar(400),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_whatsapp_optins" (
	"id" serial PRIMARY KEY NOT NULL,
	"country_code" varchar(8) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_application_id" integer,
	"notify_pref" varchar(16) DEFAULT 'weekly' NOT NULL,
	"opted_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_wizard_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"event_name" varchar(64) NOT NULL,
	"step" integer,
	"application_id" integer,
	"extra" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"owner_user_id" varchar NOT NULL,
	"per_employee_monthly_budget_paise" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_budget_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"period_month" varchar(7) NOT NULL,
	"spent_paise" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" varchar,
	"email" varchar(256) NOT NULL,
	"role" varchar(16) DEFAULT 'member' NOT NULL,
	"status" varchar(16) DEFAULT 'invited' NOT NULL,
	"invite_token" varchar(64),
	"per_employee_budget_paise_override" integer,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "office_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"created_by_user_id" varchar NOT NULL,
	"title" varchar(128) NOT NULL,
	"address" jsonb NOT NULL,
	"per_employee_budget_paise" integer DEFAULT 0 NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"window_closes_at" timestamp with time zone NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"picks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_paise" integer DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(24) NOT NULL,
	"amount_paise" integer NOT NULL,
	"purchased_by_user_id" varchar,
	"recipient_email" varchar(256),
	"recipient_name" varchar(128),
	"message" varchar(512),
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"redeemed_by_user_id" varchar,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" varchar(32) NOT NULL,
	"price_paise" integer NOT NULL,
	"image" varchar(512),
	"rd_verified" boolean DEFAULT false NOT NULL,
	"premium_only" boolean DEFAULT false NOT NULL,
	"recommended_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"macros" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "addons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "order_addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"addon_id" integer NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit_price_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "premium_meals" (
	"id" serial PRIMARY KEY NOT NULL,
	"dish_slug" varchar(128) NOT NULL,
	"reason" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "premium_meals_dish_slug_unique" UNIQUE("dish_slug")
);
--> statement-breakpoint
CREATE TABLE "premium_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"monthly_price_paise" integer DEFAULT 99900 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"rd_consults_used_this_period" integer DEFAULT 0 NOT NULL,
	"rd_consults_per_period" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"long_description" text DEFAULT '' NOT NULL,
	"category" varchar(32) NOT NULL,
	"price_paise" integer NOT NULL,
	"weight_label" varchar(32),
	"supplier_name" varchar(128),
	"image" varchar(512),
	"badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rd_verified" boolean DEFAULT false NOT NULL,
	"stock_qty" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_items_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "marketplace_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar(16) DEFAULT 'placed' NOT NULL,
	"delivery_mode" varchar(24) DEFAULT 'ship' NOT NULL,
	"items" jsonb NOT NULL,
	"total_paise" integer NOT NULL,
	"address_label" varchar(64),
	"address_line" varchar(256),
	"city" varchar(64),
	"pincode" varchar(16),
	"phone" varchar(32),
	"bundle_with_order_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dish_rationales" (
	"user_id" varchar NOT NULL,
	"dish_id" integer NOT NULL,
	"brief_hash" varchar(64) NOT NULL,
	"rationale" text NOT NULL,
	"expanded" text NOT NULL,
	"model" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dish_rationales_user_id_dish_id_brief_hash_pk" PRIMARY KEY("user_id","dish_id","brief_hash")
);
--> statement-breakpoint
CREATE TABLE "meal_plan_settings" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"auto_replan_enabled" boolean DEFAULT false NOT NULL,
	"weekly_budget_paise" integer,
	"max_repetitions_per_dish" integer DEFAULT 2 NOT NULL,
	"last_planned_week_start" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"week_start_date" date NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"constraints" jsonb NOT NULL,
	"days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"totals" jsonb,
	"subscription_id" integer,
	"model" varchar(64),
	"notes" varchar(512),
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adherence_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"meal_plan_id" integer NOT NULL,
	"day_date" date NOT NULL,
	"kind" varchar(24) NOT NULL,
	"severity" integer DEFAULT 1 NOT NULL,
	"detail" jsonb,
	"nudge_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"rd_slug" varchar(64) NOT NULL,
	"proposal_id" integer,
	"kind" varchar(32) NOT NULL,
	"actor" varchar(8) DEFAULT 'rd' NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_client_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"rd_slug" varchar(64) NOT NULL,
	"summary" text NOT NULL,
	"sources" jsonb,
	"model" varchar(64),
	"drafted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rd_plan_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"rd_slug" varchar(64) NOT NULL,
	"week_start_date" date NOT NULL,
	"status" varchar(16) DEFAULT 'ai_drafted' NOT NULL,
	"constraints" jsonb NOT NULL,
	"days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"totals" jsonb,
	"ai_rationale" text,
	"rd_notes" text,
	"meal_plan_id" integer,
	"model" varchar(64),
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_cohort_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"cohort_id" integer NOT NULL,
	"week_start_date" varchar(10) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"metric" varchar(32) NOT NULL,
	"target_count" integer DEFAULT 5 NOT NULL,
	"reward_points" integer DEFAULT 50 NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"model" varchar(64),
	"ai_rationale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_cohort_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"cohort_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_cohorts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_cohorts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "moderation_appeals" (
	"id" serial PRIMARY KEY NOT NULL,
	"decision_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"reviewer_id" varchar,
	"reviewer_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "moderation_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_type" varchar(24) NOT NULL,
	"content_id" integer NOT NULL,
	"user_id" varchar,
	"decision" varchar(16) NOT NULL,
	"severity" integer DEFAULT 1 NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"actor" varchar(8) DEFAULT 'ai' NOT NULL,
	"reviewer_id" varchar,
	"model" varchar(64),
	"snapshot" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_health_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"snapshot_date" date NOT NULL,
	"score" integer NOT NULL,
	"risk_level" varchar(16) NOT NULL,
	"drivers" jsonb NOT NULL,
	"commentary" text DEFAULT '' NOT NULL,
	"model_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lunch_plan_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"week_start_date" date NOT NULL,
	"plan" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"scheduled_office_order_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qbr_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"edited_by" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_diet_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"constraints" jsonb NOT NULL,
	"last_survey_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" varchar(128) NOT NULL,
	"actor_role" varchar(32) NOT NULL,
	"action" varchar(64) NOT NULL,
	"resource_type" varchar(64),
	"resource_id" varchar(128),
	"ip_address" varchar(64),
	"meta" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"log_date" date NOT NULL,
	"cold_storage_temp_celsius" double precision NOT NULL,
	"hygiene_confirmed" boolean DEFAULT true NOT NULL,
	"delivery_batches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" varchar(64) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"code" varchar(64) NOT NULL,
	"type" varchar(32) NOT NULL,
	"currency" varchar(8) DEFAULT 'INR' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_journal_entries" (
	"id" varchar(64) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"description" varchar(512) NOT NULL,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reference_id" varchar(128),
	"previous_hash" varchar(64) NOT NULL,
	"hash" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'posted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_lines" (
	"id" varchar(64) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" varchar(64) NOT NULL,
	"account_id" varchar(64) NOT NULL,
	"entry_type" varchar(16) NOT NULL,
	"amount" bigint NOT NULL,
	"description" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_lines_entry_type_chk" CHECK ("ledger_lines"."entry_type" in ('DEBIT', 'CREDIT')),
	CONSTRAINT "ledger_lines_amount_chk" CHECK ("ledger_lines"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"purpose_clinical_delivery" boolean DEFAULT true NOT NULL,
	"purpose_marketing" boolean DEFAULT false NOT NULL,
	"purpose_ai_personalization" boolean DEFAULT false NOT NULL,
	"consent_version" varchar(64) DEFAULT '2023_DPDPA_v1' NOT NULL,
	"ip_address" varchar(64),
	"user_agent" varchar(512),
	"status" varchar(32) DEFAULT 'granted' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "user_consents_status_chk" CHECK ("user_consents"."status" in ('granted', 'revoked', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "webhook_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(128) NOT NULL,
	"source" varchar(64) NOT NULL,
	"event_type" varchar(128) NOT NULL,
	"signature" varchar(512),
	"payload" text NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnel_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"props" jsonb,
	"session_id" varchar(64),
	"user_id" varchar,
	"path" varchar(256),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"external_order_id" varchar(64),
	"amount_paise" integer NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"reason" varchar(256),
	"razorpay_payment_id" varchar(64),
	"razorpay_refund_id" varchar(64),
	"requested_by" varchar,
	"decided_by" varchar,
	"decided_at" timestamp with time zone,
	"note" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_slot_id_delivery_slots_id_fk" FOREIGN KEY ("delivery_slot_id") REFERENCES "public"."delivery_slots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pickup_location_id_pickup_locations_id_fk" FOREIGN KEY ("pickup_location_id") REFERENCES "public"."pickup_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_reservations" ADD CONSTRAINT "slot_reservations_slot_id_delivery_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."delivery_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_credits" ADD CONSTRAINT "meal_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_credits" ADD CONSTRAINT "meal_credits_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_credits" ADD CONSTRAINT "meal_credits_delivery_id_subscription_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."subscription_deliveries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_deliveries" ADD CONSTRAINT "subscription_deliveries_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_members" ADD CONSTRAINT "subscription_members_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_order_claims" ADD CONSTRAINT "loyalty_order_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_redemptions" ADD CONSTRAINT "referral_redemptions_code_id_referral_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."referral_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_redemptions" ADD CONSTRAINT "referral_redemptions_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_redemptions" ADD CONSTRAINT "referral_redemptions_referee_user_id_users_id_fk" FOREIGN KEY ("referee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_appointments" ADD CONSTRAINT "rd_appointments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_lab_uploads" ADD CONSTRAINT "rd_lab_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_messages" ADD CONSTRAINT "rd_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_progress_logs" ADD CONSTRAINT "rd_progress_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_users" ADD CONSTRAINT "rd_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_orders" ADD CONSTRAINT "group_orders_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_targets" ADD CONSTRAINT "daily_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_logs" ADD CONSTRAINT "nutrition_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wearable_links" ADD CONSTRAINT "wearable_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wearable_daily_rollup" ADD CONSTRAINT "wearable_daily_rollup_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wearable_metrics" ADD CONSTRAINT "wearable_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kitchen_stock" ADD CONSTRAINT "kitchen_stock_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eta_predictions" ADD CONSTRAINT "eta_predictions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_decisions" ADD CONSTRAINT "dispatch_decisions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_decisions" ADD CONSTRAINT "dispatch_decisions_chosen_rider_id_riders_id_fk" FOREIGN KEY ("chosen_rider_id") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_decisions" ADD CONSTRAINT "dispatch_decisions_baseline_rider_id_riders_id_fk" FOREIGN KEY ("baseline_rider_id") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_reviews" ADD CONSTRAINT "dish_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_engineering_dish_stats" ADD CONSTRAINT "menu_engineering_dish_stats_run_id_menu_engineering_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."menu_engineering_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_suggestions" ADD CONSTRAINT "pricing_suggestions_run_id_menu_engineering_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."menu_engineering_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_suggestions" ADD CONSTRAINT "pricing_suggestions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_check_ins" ADD CONSTRAINT "challenge_check_ins_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_members" ADD CONSTRAINT "challenge_members_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_members" ADD CONSTRAINT "challenge_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_posts" ADD CONSTRAINT "challenge_posts_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_posts" ADD CONSTRAINT "challenge_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_budget_usage" ADD CONSTRAINT "company_budget_usage_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_budget_usage" ADD CONSTRAINT "company_budget_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_orders" ADD CONSTRAINT "office_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_orders" ADD CONSTRAINT "office_orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_purchased_by_user_id_users_id_fk" FOREIGN KEY ("purchased_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_redeemed_by_user_id_users_id_fk" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_addons" ADD CONSTRAINT "order_addons_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_addons" ADD CONSTRAINT "order_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premium_memberships" ADD CONSTRAINT "premium_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_rationales" ADD CONSTRAINT "dish_rationales_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_settings" ADD CONSTRAINT "meal_plan_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adherence_events" ADD CONSTRAINT "adherence_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adherence_events" ADD CONSTRAINT "adherence_events_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_audit_log" ADD CONSTRAINT "rd_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_client_summaries" ADD CONSTRAINT "rd_client_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_plan_proposals" ADD CONSTRAINT "rd_plan_proposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rd_plan_proposals" ADD CONSTRAINT "rd_plan_proposals_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_cohort_challenges" ADD CONSTRAINT "community_cohort_challenges_cohort_id_community_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."community_cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_cohort_members" ADD CONSTRAINT "community_cohort_members_cohort_id_community_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."community_cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_cohort_members" ADD CONSTRAINT "community_cohort_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_decision_id_moderation_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."moderation_decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_health_snapshots" ADD CONSTRAINT "account_health_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lunch_plan_proposals" ADD CONSTRAINT "lunch_plan_proposals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbr_drafts" ADD CONSTRAINT "qbr_drafts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_diet_profiles" ADD CONSTRAINT "team_diet_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_journal_entry_id_ledger_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."ledger_journal_entries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "rate_limits_reset_at_idx" ON "rate_limits" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_orders_user_external" ON "orders" USING btree ("user_id","external_order_id") WHERE external_order_id is not null;--> statement-breakpoint
CREATE INDEX "idx_orders_user_created" ON "orders" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_orders_status_created" ON "orders" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_orders_rider" ON "orders" USING btree ("rider_id");--> statement-breakpoint
CREATE INDEX "idx_orders_razorpay_order_id" ON "orders" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "idx_orders_stat_unassigned" ON "orders" USING btree ("created_at") WHERE priority = 'stat' and rider_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_packaging_return_order" ON "packaging_returns" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_delivery_slot_zone_window" ON "delivery_slots" USING btree ("zone","starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_slot_reservation_order" ON "slot_reservations" USING btree ("order_id") WHERE "slot_reservations"."order_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_slot_reservation_subscription" ON "slot_reservations" USING btree ("subscription_id") WHERE "slot_reservations"."subscription_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_addr_instructions_user_label" ON "address_instructions" USING btree ("user_id","address_label");--> statement-breakpoint
CREATE INDEX "idx_user_addresses_user" ON "user_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_meal_credits_user" ON "meal_credits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sub_deliveries_sub" ON "subscription_deliveries" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_sub_deliveries_scheduled" ON "subscription_deliveries" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_sub_members_sub" ON "subscription_members" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_user" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_credit_ledger_user" ON "credit_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_notifications_dedupe" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_loyalty_order_claims" ON "loyalty_order_claims" USING btree ("user_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_referral_codes_code" ON "referral_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_referral_codes_user" ON "referral_codes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_referral_redemptions_referee" ON "referral_redemptions" USING btree ("referee_user_id");--> statement-breakpoint
CREATE INDEX "idx_referral_redemptions_referrer" ON "referral_redemptions" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "idx_rd_appt_user" ON "rd_appointments" USING btree ("user_id","start_at");--> statement-breakpoint
CREATE INDEX "idx_rd_appt_rd" ON "rd_appointments" USING btree ("rd_slug","start_at");--> statement-breakpoint
CREATE INDEX "idx_rd_avail_slug" ON "rd_availability" USING btree ("rd_slug","day_of_week");--> statement-breakpoint
CREATE INDEX "idx_rd_lab_user" ON "rd_lab_uploads" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_rd_msg_thread" ON "rd_messages" USING btree ("user_id","rd_slug","created_at");--> statement-breakpoint
CREATE INDEX "idx_rd_progress_user" ON "rd_progress_logs" USING btree ("user_id","logged_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rd_users_user" ON "rd_users" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rd_users_slug" ON "rd_users" USING btree ("rd_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_nutrition_logs_dedupe" ON "nutrition_logs" USING btree ("user_id","dedupe_key") WHERE dedupe_key is not null;--> statement-breakpoint
CREATE INDEX "idx_nutrition_logs_user_day" ON "nutrition_logs" USING btree ("user_id","logged_for");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_streaks_user_kind" ON "streaks" USING btree ("user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_wearable_links_user_provider" ON "wearable_links" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "idx_wearable_links_provider_user" ON "wearable_links" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_wearable_rollup_user_day" ON "wearable_daily_rollup" USING btree ("user_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_wearable_metrics_dedupe" ON "wearable_metrics" USING btree ("user_id","dedupe_key") WHERE dedupe_key is not null;--> statement-breakpoint
CREATE INDEX "idx_wearable_metrics_user_type_time" ON "wearable_metrics" USING btree ("user_id","metric_type","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_ai_runs_agent_created" ON "ai_runs" USING btree ("agent","created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_runs_user_created" ON "ai_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ops_actions_operator_created" ON "ops_actions" USING btree ("operator_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ops_actions_action_created" ON "ops_actions" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "idx_ops_audit_outbox_drain" ON "ops_audit_outbox" USING btree ("processed_at","claimed_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_supplier_batches_status" ON "supplier_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_supplier_batches_created" ON "supplier_batches" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_forecast_date_daypart_zone_dish" ON "forecast_snapshots" USING btree ("for_date","daypart","zone","dish_slug");--> statement-breakpoint
CREATE INDEX "idx_forecast_for_date" ON "forecast_snapshots" USING btree ("for_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_kitchen_stock_item_zone" ON "kitchen_stock" USING btree ("inventory_item_id","zone");--> statement-breakpoint
CREATE INDEX "idx_po_status_created" ON "purchase_orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_eta_predictions_order" ON "eta_predictions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_eta_predictions_zone_created" ON "eta_predictions" USING btree ("zone","created_at");--> statement-breakpoint
CREATE INDEX "idx_dispatch_decisions_order" ON "dispatch_decisions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_dispatch_decisions_batch" ON "dispatch_decisions" USING btree ("batch_key");--> statement-breakpoint
CREATE INDEX "idx_dispatch_decisions_created" ON "dispatch_decisions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_anomaly_alerts_status_created" ON "anomaly_alerts" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_anomaly_alerts_metric_created" ON "anomaly_alerts" USING btree ("metric","created_at");--> statement-breakpoint
CREATE INDEX "idx_menu_items_category_kitchen" ON "menu_items" USING btree ("category","kitchen_location");--> statement-breakpoint
CREATE INDEX "idx_menu_items_available" ON "menu_items" USING btree ("is_available");--> statement-breakpoint
CREATE INDEX "menu_item_assets_slug_idx" ON "menu_item_assets" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_dish_reviews_slug" ON "dish_reviews" USING btree ("slug","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_me_dish_stats_run_slug" ON "menu_engineering_dish_stats" USING btree ("run_id","slug");--> statement-breakpoint
CREATE INDEX "idx_pricing_suggestions_status" ON "pricing_suggestions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_pricing_suggestions_slug" ON "pricing_suggestions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_analytics_queries_created" ON "analytics_queries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_voc_themes_week" ON "voc_themes" USING btree ("week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_voc_week_theme" ON "voc_themes" USING btree ("week_start","theme");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_wbr_week" ON "wbr_reports" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "idx_nps_created" ON "nps_responses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_support_eval_label_created" ON "support_eval_examples" USING btree ("label","created_at");--> statement-breakpoint
CREATE INDEX "idx_support_eval_ticket" ON "support_eval_examples" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_status_created" ON "support_tickets" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_team_priority" ON "support_tickets" USING btree ("team","priority");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_user_created" ON "support_tickets" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_content_recipes_goal" ON "content_recipes" USING btree ("goal","published_at");--> statement-breakpoint
CREATE INDEX "idx_challenge_check_ins" ON "challenge_check_ins" USING btree ("challenge_id","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_challenge_member" ON "challenge_members" USING btree ("challenge_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_challenge_member_user" ON "challenge_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_challenge_posts" ON "challenge_posts" USING btree ("challenge_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_rd_app_status_created" ON "rd_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rd_app_email" ON "rd_applications" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rd_whatsapp_phone" ON "rd_whatsapp_optins" USING btree ("country_code","phone");--> statement-breakpoint
CREATE INDEX "idx_rd_whatsapp_pref" ON "rd_whatsapp_optins" USING btree ("notify_pref");--> statement-breakpoint
CREATE INDEX "idx_rd_wiz_event_name_created" ON "rd_wizard_events" USING btree ("event_name","created_at");--> statement-breakpoint
CREATE INDEX "idx_rd_wiz_session" ON "rd_wizard_events" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_companies_slug" ON "companies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_companies_owner" ON "companies" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_company_budget_usage_period" ON "company_budget_usage" USING btree ("company_id","user_id","period_month");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_company_members_company_email" ON "company_members" USING btree ("company_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_company_members_invite_token" ON "company_members" USING btree ("invite_token");--> statement-breakpoint
CREATE INDEX "idx_company_members_user" ON "company_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_office_orders_company" ON "office_orders" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_vouchers_code" ON "vouchers" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_vouchers_purchaser" ON "vouchers" USING btree ("purchased_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_order_addons_order" ON "order_addons" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_premium_user" ON "premium_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_marketplace_active" ON "marketplace_items" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_marketplace_orders_user" ON "marketplace_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dish_rationales_user" ON "dish_rationales" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_meal_plans_user" ON "meal_plans" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_meal_plans_user_week" ON "meal_plans" USING btree ("user_id","week_start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_adherence_event" ON "adherence_events" USING btree ("user_id","meal_plan_id","day_date","kind");--> statement-breakpoint
CREATE INDEX "idx_adherence_user" ON "adherence_events" USING btree ("user_id","day_date");--> statement-breakpoint
CREATE INDEX "idx_rd_audit_rd_user" ON "rd_audit_log" USING btree ("rd_slug","user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rd_summary_user_rd" ON "rd_client_summaries" USING btree ("user_id","rd_slug");--> statement-breakpoint
CREATE INDEX "idx_rd_proposal_rd" ON "rd_plan_proposals" USING btree ("rd_slug","status");--> statement-breakpoint
CREATE INDEX "idx_rd_proposal_user" ON "rd_plan_proposals" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cohort_week" ON "community_cohort_challenges" USING btree ("cohort_id","week_start_date");--> statement-breakpoint
CREATE INDEX "idx_cohort_challenge_status" ON "community_cohort_challenges" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cohort_member" ON "community_cohort_members" USING btree ("cohort_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_cohort_member_user" ON "community_cohort_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_open_appeal_per_decision" ON "moderation_appeals" USING btree ("decision_id") WHERE status = 'open';--> statement-breakpoint
CREATE INDEX "idx_appeals_status" ON "moderation_appeals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_moderation_content" ON "moderation_decisions" USING btree ("content_type","content_id");--> statement-breakpoint
CREATE INDEX "idx_moderation_decision" ON "moderation_decisions" USING btree ("decision","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_health_company_date" ON "account_health_snapshots" USING btree ("company_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_health_risk" ON "account_health_snapshots" USING btree ("risk_level","snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lunch_plan_company_week" ON "lunch_plan_proposals" USING btree ("company_id","week_start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_qbr_company_period" ON "qbr_drafts" USING btree ("company_id","period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_team_diet_company" ON "team_diet_profiles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_created_idx" ON "audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_action_created_idx" ON "audit_log" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_resource_idx" ON "audit_log" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_compliance_log_date" ON "compliance_logs" USING btree ("log_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_ledger_accounts_code" ON "ledger_accounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_ledger_accounts_type_status" ON "ledger_accounts" USING btree ("type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_ledger_journal_entries_hash" ON "ledger_journal_entries" USING btree ("hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ledger_je_prev_hash" ON "ledger_journal_entries" USING btree ("previous_hash");--> statement-breakpoint
CREATE INDEX "idx_ledger_journal_entries_posted_at" ON "ledger_journal_entries" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "idx_ledger_journal_entries_reference_id" ON "ledger_journal_entries" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_lines_journal_entry" ON "ledger_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_lines_account" ON "ledger_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_lines_entry_type" ON "ledger_lines" USING btree ("entry_type");--> statement-breakpoint
CREATE INDEX "idx_user_consents_user_id" ON "user_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_consents_status" ON "user_consents" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_inbox_source_event_id_uidx" ON "webhook_inbox" USING btree ("source","event_id");--> statement-breakpoint
CREATE INDEX "webhook_inbox_status_created_at_idx" ON "webhook_inbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_funnel_events_name_time" ON "funnel_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "idx_funnel_events_session" ON "funnel_events" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_refund_requests_order" ON "refund_requests" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_refund_requests_status_created" ON "refund_requests" USING btree ("status","created_at");