# Runbook — Seed the kitchen master sheet into the database

**Audience:** the engineering agent applying the DB write.
**What this does:** loads the RD-verified *Tanmatra Kitchen Data Collection Sheet*
(parsed to `scripts/data/kitchen-data-collection.json`) into the admin/ops backend
tables — `menu_items`, `inventory_items`, `packaging_items`, `recipes`,
`recipe_ingredients`.

The seeders were validated by dry-run in the authoring environment; the actual
DB write could not run there (no Postgres egress). This runbook is that write step.

---

## 0 · Sync with the GitHub repo

```bash
# First time only — clone. If you already have a checkout, skip to `git fetch`.
git clone https://github.com/chan8822/Wellness-Foods.git
cd Wellness-Foods

# Get the latest refs.
git fetch origin --prune

# Check out the branch that carries the seeders + data.
#   • If PR #115 is already MERGED to main:
git checkout main && git pull origin main
#   • Otherwise, use the PR branch:
git checkout claude/tanmatra-ux-clinical-audit-2nsutp \
  && git pull origin claude/tanmatra-ux-clinical-audit-2nsutp

# Confirm the data file and seeders are present (all three must exist):
ls scripts/data/kitchen-data-collection.json
ls scripts/src/seed-menu-items.ts scripts/src/seed-ops-data.ts

# Install workspace dependencies (pnpm only — npm/yarn are rejected).
pnpm install --frozen-lockfile
```

Point at the target database (use **staging first** if one exists):

```bash
export DATABASE_URL="postgres://…"   # real Postgres, must be reachable
```

---

## 1 · Ensure the schema exists

The seeders write to `menu_items`, `inventory_items`, `packaging_items`,
`recipes`, `recipe_ingredients`. Make the live schema current:

```bash
pnpm --filter @workspace/db run push
```

> `drizzle-kit push` diffs the live DB against the schema and prints a plan.
> Review it before confirming. If the four ops tables are missing it will
> create them; do not accept any unexpected `DROP`.

---

## 2 · Dry-run both seeders (no writes)

Confirms the data parses and the counts are right before touching anything:

```bash
pnpm --filter @workspace/scripts exec tsx ./src/seed-menu-items.ts
pnpm --filter @workspace/scripts exec tsx ./src/seed-ops-data.ts
```

**Expected output**

- `seed-menu-items` → `117 dishes prepared, 116 carry goal tags from the sheet`
- `seed-ops-data`  → `inventory_items: 122 · packaging_items: 15 · recipes: 117`
  (`117 matched to catalog · 114 with method · 75 with food cost`)

---

## 3 · Apply

```bash
# a) menu_items — UPSERT, non-destructive. Coalesce keeps any editor-set
#    name/description/price/tags; only FILLS empty tags + availability_window.
pnpm --filter @workspace/scripts exec tsx ./src/seed-menu-items.ts --apply

# b) inventory_items / packaging_items / recipes / recipe_ingredients
#    ⚠️ TRUNCATE-AND-RESEED: deletes all rows in those four tables, then
#    reloads them from the sheet. Intended — they are sheet-derived reference
#    tables. Deterministic and safe to re-run.
pnpm --filter @workspace/scripts exec tsx ./src/seed-ops-data.ts --apply
```

Order is for clarity only — the two seeders touch disjoint tables.

---

## 4 · Verify

```sql
SELECT count(*) FROM menu_items;          -- ≥ 117
SELECT count(*) FROM inventory_items;     -- 122
SELECT count(*) FROM packaging_items;     -- 15
SELECT count(*) FROM recipes;             -- 117
SELECT count(*) FROM recipe_ingredients;  -- ~1000+

-- CMS-panel fields landed from the sheet:
SELECT slug, tags, availability_window FROM menu_items WHERE slug = 'quinoa-upma';
--   → tags {LOW SODIUM, KID FRIENDLY, EASY DIGEST}, availability_window ["breakfast"]

-- recipes carry the CORRECTED nutrition label (from the calculator fix):
SELECT slug, calories_kcal, protein_g, serving_size, food_cost_paise
FROM recipes WHERE slug = 'quinoa-upma';
--   → 192, 6, "~440g (recipe est.)", 2407
```

Or via the read APIs: `GET /api/ops/inventory` (122), `GET /api/ops/packaging`
(15), `GET /api/recipes` (117), `GET /api/menu/public` (dishes now carry `tags`
+ `availabilityWindow`).

---

## Must-know before running

- **`seed-ops-data --apply` is destructive** to the four reference tables
  (truncate-and-reseed). If anything else writes to them, coordinate first.
- **`seed-menu-items --apply` is safe/idempotent** — upsert by slug with
  `coalesce`, so it never clobbers editor-set fields; it only fills empty
  `tags` / `availability_window`.
- **Both write straight to the DB, bypassing the REST clinical guard**
  (GI = `high` + `diabetes-management` / `heart-healthy` tags → 422). The
  sheet's goal tags are `LOW SODIUM / HIGH PROTEIN / LOW GI / KID FRIENDLY /
  EASY DIGEST`, none of which collide — safe, but worth knowing.
- **Seeded `menu_items` get `allergen_review_state = "reviewed"`** → publicly
  visible. Correct for this RD-verified catalog.
- **`cwd` matters:** the seeders resolve `./data/kitchen-data-collection.json`
  relative to the `scripts/` package. The `pnpm --filter @workspace/scripts
  exec` form sets that cwd automatically — don't run raw `tsx` from repo root.
- **Staging first**, verify counts, then production.

## Out of scope

PR #111's curated-catalog price migration (`apply-menu-engineering.ts`) is a
**different** seeder and a separate concern — do **not** run it as part of this.
