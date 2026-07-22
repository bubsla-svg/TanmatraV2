-- Ragi Dates Eggless Brownie — DB propagation of the catalog deletion (Agent
-- Brief A4, revised). The SKU was removed from lib/menu-catalog/src/index.ts,
-- but getMergedCatalog (artifacts/api-server/src/lib/menuResolver.ts) renders
-- DB-only rows: a menu_items row with no catalog counterpart still surfaces in
-- the menu (with a synthetic id). So the catalog removal does NOT propagate to
-- the rendered menu unless the DB row is removed too.
--
-- Run this in the SAME release as the catalog removal, BEFORE the Stage-A price
-- change (a possibly-egg-containing item labelled veg must not render). It is
-- conditional (no-op if the row is absent) and slug-scoped; no table references
-- menu_items by id, so the delete is FK-safe. If the live DB does NOT carry the
-- row, this is a clean no-op and the deletion is already fully propagated.
BEGIN;
-- Belt-and-suspenders: hide it first (covers any code path that reads before
-- the delete commits), then remove the row so it can't render as a DB-only item.
UPDATE menu_items SET is_available = false WHERE slug = 'ragi-dates-eggless-brownie';
DELETE FROM menu_items WHERE slug = 'ragi-dates-eggless-brownie';
COMMIT;

-- Verify (must both return 0):
--   SELECT count(*) FROM menu_items WHERE slug = 'ragi-dates-eggless-brownie';
--   -- and confirm the slug is absent from GET /api/menu output and the rendered grid.
