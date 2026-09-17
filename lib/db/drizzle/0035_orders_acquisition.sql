-- T2 (CRO handoff 2026-09-17) — acquisition attribution on orders.
--
-- The placement (`tnm_src`) and funnel-visit (`tnm_fsid`) cookies present
-- when the order was placed (artifacts/api-server/src/routes/checkout.ts),
-- so the server's `purchase` event — the revenue truth, emitted on the
-- placed→preparing transition — joins back to the scan or visit that
-- produced it. Nullable: direct traffic carries neither. Additive only.
ALTER TABLE "orders" ADD COLUMN "acquisition_src" varchar(64);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "funnel_session_id" varchar(64);
