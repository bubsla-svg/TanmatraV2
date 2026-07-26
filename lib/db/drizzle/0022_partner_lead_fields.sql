-- Partner lead capture (L-4/L-6) widens and extends corporate_leads.
--
-- The route already accepts "rd", "trainer" and "dietitian" lead kinds and
-- writes rd_reg_no / practice_setting; without this the INSERT fails and the
-- endpoint 500s. Caught locally as exactly that: six lead-capture tests failing
-- with {"error":"lead capture failed"} against a database on the old shape.
--
-- Renumbered 0021 -> 0022: the onboarding stack landed its own 0021 first.
--
-- All three statements are metadata-only in Postgres — widening a varchar does
-- not rewrite the table, and both new columns are nullable with no default — so
-- it is safe to apply while the current server is still serving.
ALTER TABLE "corporate_leads" ALTER COLUMN "team_size_band" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "corporate_leads" ADD COLUMN "rd_reg_no" varchar(80);--> statement-breakpoint
ALTER TABLE "corporate_leads" ADD COLUMN "practice_setting" varchar(64);