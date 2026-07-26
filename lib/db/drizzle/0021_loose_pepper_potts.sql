CREATE TABLE "serviceability_interest" (
	"pincode" varchar(6) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "serviceability_interest_pincode_phone_pk" PRIMARY KEY("pincode","phone")
);
