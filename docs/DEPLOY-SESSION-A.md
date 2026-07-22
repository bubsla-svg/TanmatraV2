# Deploy runbook — Session A (live-build price integrity)

**Scope:** ship Ragi deletion, Stage-A prices, the plan-chooser math fix, server price authority (already live), and the macro-chip gate to the **current production build**. Nothing else. Money-path change → **maximum rigor**.

**Artifacts this runbook ships**

| PR | Contents | DB side-effect |
|----|----------|----------------|
| **#286** | Ragi deletion from the catalog + `scripts/data/ragi-remove.sql` | must run `ragi-remove.sql` |
| **#288** | A7 plan-chooser math fix + `PRICE-FLOW.md` | none |
| **#289** | Stage-A prices (116 SKUs) + `scripts/data/stageA-prices.sql` | must run `stageA-prices.sql` |

A3 (server price authority) and A5 (macro-chip gate) are already on `main` — no deploy action.

> **Load-bearing fact (from PRICE-FLOW.md):** the DB `menu_items` overlay **overrides** the catalog price when a row exists. So the served/charged price does **not** change from the code deploy alone — the two SQL files are not optional.

---

## 0 · Pre-flight (before merging anything)

- [ ] **Repo identity on `main`:** 117 dishes; Almond Chicken Salad ₹155, BBQ Grilled Chicken Rice Bowl ₹170, Activated Charcoal Smoothie ₹50. *(Note: the goal expected 116 — that becomes true only after #286 merges.)* Any other mismatch → **STOP**.
- [ ] All three PRs are **green** on their last CI run (typecheck · money-unit · money-integration · gates · e2e).
- [ ] **Capture rollback data — REQUIRED (the SQL is not self-reversing):**
  ```sql
  -- snapshot current DB prices so a rollback can restore them
  \copy (SELECT slug, price_paise FROM menu_items) TO 'menu_items_prices_pre_stageA.csv' CSV HEADER
  -- and a full safety dump of the affected table
  pg_dump --table=menu_items --data-only <PROD_DSN> > menu_items_pre_stageA.dump
  ```
- [ ] Record baselines for the 30-min watch: current **payment success rate**, **menu→cart conversion (28.1% baseline)**, and the current `PRICE_MISMATCH` error rate (should be ~0).

## 1 · Merge order (sequence matters)

1. [ ] Merge **#286 (Ragi)** first — *"Ragi removal is its own safety commit, before prices."*
2. [ ] Rebase **#289 (prices)** onto the new `main`; resolve the `lib/menu-catalog/src/index.ts` overlap (the Ragi block is already gone; the 116 price edits are on non-Ragi dishes — no line overlap expected). Re-run CI → green. Merge **#289**.
3. [ ] Merge **#288 (A7 + PRICE-FLOW.md)** — independent files, any order.
4. [ ] Confirm `main` now shows **116 dishes** and the Stage-A prices in `lib/menu-catalog/src/index.ts`.

## 2 · Staging — the A6 "pre" gates

- [ ] Deploy merged `main` to **staging**.
- [ ] Apply to the **staging DB**, in this order (Ragi before prices):
  ```bash
  psql <STAGING_DSN> -f scripts/data/ragi-remove.sql
  psql <STAGING_DSN> -f scripts/data/stageA-prices.sql
  ```
- [ ] **Playwright money path green at new prices** (the `e2e` suite). *(The "green at old prices" run is the pre-merge `main` baseline — already green.)*
- [ ] **Tamper test passes:** a modified client amount is rejected server-side (`payments.integrity` / the `money-integration` job).
- [ ] **Smoke:**
  - menu renders **Stage-A prices** (spot-check Activated Charcoal ₹69, Aglio Olio Veg ₹189, Roast Chicken Russian ₹199);
  - **cart total == server quote** (no client-computed drift);
  - a **test-mode payment** succeeds end-to-end at a new price;
  - **Ragi is absent** from `GET /api/menu` and the rendered grid: `SELECT count(*) FROM menu_items WHERE slug='ragi-dates-eggless-brownie';` → **0**.
- [ ] Plan-chooser invariant on staging: for one weekly config, **1-Week < 2-Week < 6-Week total**, **BEST VALUE on the 6-Week only**, and **no committed estimate before a duration is picked**.

## 3 · Production — deploy + apply (one window)

- [ ] Announce the maintenance window; ensure the rollback data from §0 is in hand.
- [ ] Deploy `main` to **production** (bundle carries the new catalog file + A7 fix).
- [ ] Apply to the **production DB**, Ragi first:
  ```bash
  psql <PROD_DSN> -f scripts/data/ragi-remove.sql      # safety: possibly-egg item off first
  psql <PROD_DSN> -f scripts/data/stageA-prices.sql    # 116 price updates, transactional
  ```
- [ ] Immediate post-apply checks (same as staging smoke): Ragi count = 0; a live menu read shows Stage-A prices; one real small order's **cart total == server quote**.

## 4 · 30-minute watch (rollback triggers armed)

Watch for the full 30 minutes. **Any one trigger → roll back prices first, investigate second** (Amendment 02a §7):

- [ ] **Payment success rate drops > 2 pts** vs the §0 baseline.
- [ ] **`PRICE_MISMATCH` storm** — a spike from ~0 (indicates a client serving cached/stale prices).
- [ ] **menu→cart conversion falls below the 28.1% baseline** (watch over the first 48h, not just 30 min).
- [ ] Log the watch result (timestamped) regardless of outcome.

## 5 · Rollback procedure (if triggered)

**Prices (reversible):**
1. [ ] `git revert` the **#289** merge on `main` and redeploy (restores the catalog file prices).
2. [ ] Restore the DB prices from the §0 snapshot:
   ```sql
   -- reverse the price change from the pre-change snapshot
   \copy tmp_pre(slug, price_paise) FROM 'menu_items_prices_pre_stageA.csv' CSV HEADER
   UPDATE menu_items m SET price_paise = t.price_paise FROM tmp_pre t WHERE m.slug = t.slug;
   ```
3. [ ] Re-run the money-path smoke at old prices → green.

**Ragi deletion is NOT rolled back** — it is a standing safety removal; it stays gone regardless of a price rollback.

**A7 (plan-chooser)** is display logic with its own tests; roll back only if it is independently implicated (revert #288).

## 6 · Human verifications that this runbook can't do

- [ ] **Aggregators:** confirm Ragi is delisted on Zomato / Swiggy / magicpin (external — no API access from the build).
- [ ] **Rendered menu:** eyeball the live grid post-deploy to confirm Ragi is truly absent (the SQL guarantees the DB row is gone; this is the visual confirmation).

## 7 · Definition of done (Brief §6) — sign-off

- [ ] PRICE-FLOW.md accurate · [ ] tamper rejected + normal order succeeds at new prices · [ ] Playwright money path green pre & post · [ ] plan-chooser invariant green · [ ] 116 prices applied byte-exact (single revertible commit) · [ ] Ragi absent from catalog + DB + rendered menu, aggregator status reported · [ ] deploy gates run, rollback armed, 30-min watch logged.
