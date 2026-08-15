-- TNM-MENU-01 M-2 — curated taxonomy columns on menu_items.
--
-- Five columns the Menu v2 program curates (docs/TNM-MENU-01/M0-FINDINGS.md §1
-- found all five absent): the payload-authoritative base order the ranked
-- endpoint will consume (section_order + sort_rank), the tri-state customer
-- veg mark (veg_class — is_veg stays as the legacy boolean), the card badge,
-- and the soft-disable master switch (archived). All five are fenced from the
-- petpooja push-menu upsert under ruling R-1; petpooja.menuFence.test.ts's
-- full-row allowlist diff enforces that without naming them.
--
-- NULL section_order/sort_rank/veg_class/badge = "not yet curated" (rows that
-- predate the Menu v2 apply). archived defaults false for every existing row.
-- All statements are additive; nothing destructive.
ALTER TABLE "menu_items" ADD COLUMN "section_order" integer;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "sort_rank" integer;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "veg_class" varchar(16);--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "badge" varchar(48);--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_veg_class_chk" CHECK ("veg_class" is null or "veg_class" in ('veg','non-veg','egg'));
