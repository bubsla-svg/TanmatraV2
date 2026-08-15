# TNM-MENU-01 · M-0 findings — repo verification session

**Session:** M-0 (manual §2, read-only) · **Date:** 2026-08-15
**Pinned SHA:** `2341b609c842f4e8ec8efe813dc15036769afcac` (origin/main at session start; every `path:line` below cites this SHA)
**Mandate:** findings only — no fixes, no source edits. This PR adds documentation and program data artifacts exclusively.

**Inputs (Drive):**

| File | Drive ID |
|---|---|
| claude_TNM-MENU-01-catalog-update-runbook.md (v2 manual) | `1DLeR8FOZPDDGOF6aTeCQsyjM5d6CHgRpmiNUtZman20` |
| claude_TNM-MENU-01-master-handoff.md | `1TqODd3XJ_at_o_VEY81kPBJLkwvCr9GEZ5PvZj-t0dM` |
| menu-catalog-v2.1-payload (92 rows) | `17yHdiNCNBuJh4y7I-mKmOWEH4UXTXlkCrnx-ANHCBGM` |
| m0-runtime-findings-2026-08-15.md (F1–F7) | `1tQZCU3Vcsbof1LHcoSD1ADCZfQ9tcANdvbBjA6eDhGE` |
| m0-provisional-slug-map (92 rows) | `1geTztHQigf49xXOH23_vaWqi6g1TiBB13Vr1Pd4Tq60` |
| tanmatra-menu-rationalization (198 rows, disable-set source) | `1acslTQFFv9r8caDFgDWbkNTeRqt56sUt9E5Rs9jPt4w` |

**Artifacts committed alongside this report** (canonical copies, imported verbatim from the Drive exports above):
`menu-catalog-v2.1-payload.csv` · `tanmatra-menu-rationalization.csv` · `m0-final-slug-map.csv` (deliverable b, produced this session).

---

## 0. Verdict summary

| Item | Verdict |
|---|---|
| §2.1 menu_items schema | **VERIFIED, GAPS FOUND** — M-2 set = `section_order`, `sort_rank`, `veg_class`, `badge`, `archived` |
| §2.2 /menu/ranked mechanics | **VERIFIED** — computed, no persisted rank; F3 confirmed |
| §2.3 push-menu upsert set | **VERIFIED** — price already fenced (ADM-28); clobber set = name/category/isVeg/isAvailable (+ customizations) |
| §2.4 addon schema capability | **VERIFIED, ONE GAP** — R-4 verdict: **modifiers path**; `required` semantics missing (additive M-4 change) |
| §2.5 slug map | **VERIFIED** — finalized, 66 MATCH + 9 FUZZY→confirmed + 10 CREATE + 7 NEW, 0 conflicts |
| §2.6 macros coverage | **VERIFIED, DISCREPANCY** — effective needs-macros set is 10 rows, manual §4 says nine → stop-and-ask |
| §2.7 price render path | **VERIFIED, 2 LITERALS** — both un-gated (lint covers legacy SPA only); listed M-5 dependencies |
| §2.8 millet fact-check | **BLOCKED (owner/kitchen)** — repo evidence recorded; payload already flags `millet-confirm-N1` |
| §2.9 wok kitchen readiness | **BLOCKED (kitchen)** — 0 of 5 wok dishes have a recipe on file in-repo |
| F1 route mounts | **VERIFIED** — /api/menu/* real; /api/v1 spec declares a dead path (double-prefix bug found) |
| F2 availability flip | **VERIFIED (mechanism)** — push-menu + stock webhooks overwrite `isAvailable` on every matched row |
| F3 ranked is computed | **VERIFIED** |
| F4 third price book | **PARTIALLY REFUTED** — units paise ✓, but price is *already fenced* on main; M-1 scope narrows |
| F5 claims integrity | **VERIFIED + SHARPENED** — blanket `rdVerified: true` is seed data; POS imports bypass the RD review gate |
| F6 customizations vehicle | **VERIFIED** — exists end-to-end (schema → validation → server pricing → checkout) |
| F7 slug map | **VERIFIED** — finalized as `m0-final-slug-map.csv` |
| I-1 D-19 status | **MERGED** — `b1ac202` (PR #50) is an ancestor of the pinned SHA; server + client halves both present |

No open decision was improvised. Contradictions found are filed in §12 (stop-and-ask register).

---

## 1. Check §2.1 — menu_items schema (`lib/db/src/schema/menuItems.ts`)

Columns present @ 2341b60:

| Payload need | Column | Cite |
|---|---|---|
| slug (apply key) | `slug` varchar(128) NOT NULL UNIQUE | menuItems.ts:29 |
| display name | `name` varchar(200) | menuItems.ts:30 |
| price (integer paise) | `pricePaise` integer NOT NULL | menuItems.ts:32 |
| category | `category` varchar(64) free-form (Petpooja's drifting `categoryname` lands here — lib/petpooja.ts:225-226) | menuItems.ts:33 |
| veg mark | `isVeg` **boolean** | menuItems.ts:37 |
| availability | `isAvailable` boolean + `unavailableReason` / `unavailableUntil` | menuItems.ts:38, 97-98 |
| macros | `macros` jsonb **nullable** + `macrosAreEstimate` | menuItems.ts:49-69 |
| RD claims | `rdVerified`, `rdNote`, `allergenReviewState` (CHECK-constrained) | menuItems.ts:70-78, 125-128 |
| modifiers | `customizations` jsonb (groupName / single\|multiple / options{name, priceModifier, default?}) | menuItems.ts:83-93 |
| POS identity | `tags` jsonb with `petpooja:<id>`, GIN-indexed | menuItems.ts:40, 117-120 |

**Gaps → M-2 migration set (additive):**

1. `section_order` — absent. No section concept anywhere.
2. `sort_rank` — absent. No rank column of any kind.
3. `veg_class` — **`isVeg` boolean cannot express the payload's tri-state** (`veg` / `non-veg` / `egg`; 19 payload rows are `egg`).
4. `badge` — absent (`tags` exists but is POS-identity-bearing; overloading it would put curated data inside the POS-written column — see §3).
5. `archived` — absent. §8's CUT/MERGE/DELIST → `archived=true` has no landing column.

`unavailableReason`/`unavailableUntil` (menuItems.ts:97-98) fit the SEASONAL "winter return Oct–Feb" note without new columns.

---

## 2. Check §2.2 — GET /menu/ranked mechanics (F3)

`artifacts/api-server/src/routes/menu.ts:79-161` — **computed, not read**:

- Source: `getMergedCatalog()` (menu.ts:102) → static `DISHES` array order + CMS-only rows appended (`lib/menuResolver.ts:83-187`). **The base order is the seed array's literal order**; there is no persisted ordering input.
- Annotation layer: `fit_band` (menu.ts:107-124), `rank_reason_codes` (126-137), synthetic `nutrition_snapshot_id` = `snap-${id}-${slug}` (143).
- Final rank: high-band first (max 8), then rest, `rank = idx + 1` (menu.ts:150-158).
- **`/menu/ranked` applies no `isAvailable` filter** (only the `rdReviewState` patient-safety filter, menu.ts:103-105). Acceptance §7.6 ("disabled dishes render nowhere") is currently not a property of this endpoint — an M-5 dependency, recorded not fixed.

**Where payload ranks land (F3 answer):** `section_order` + `sort_rank` as persisted `menu_items` columns (M-2), surfaced through the resolver merge, consumed as the ranker's base order before personalization annotates. Personalization may re-rank but never hides (manual §4 M-5); section 13 exclusion from boosts is an M-5 rule on top.

---

## 3. Check §2.3 — push-menu upsert column set (F2, F4)

`artifacts/api-server/src/routes/petpooja.ts:47-126` — the upsert's `set` (lines 99-114) writes exactly:

```
name, description, category, isVeg, isAvailable, imageUrl,
tags, allergens, cuisineTags, macros, customizations, updatedAt
```

- **`pricePaise` is already excluded** (petpooja.ts:102-103). The TNM-ADM-01 **ADM-28** fix (handler doc comment, petpooja.ts:34-46) made the catalog the sole price authority; an inbound push that tries to change an existing row's price is audit-logged as `menu.price_write_rejected` instead of applied (petpooja.ts:77-89). A replay test exists: `routes/petpooja.priceAuthority.test.ts`. Brand-new rows still take their initial price from the payload (petpooja.ts:91-96) — by design, no operator price exists yet.
- **Overlap with R-1's curated set** (the remaining clobber hazard M-1 removes): `name` (→ display_name), `category`, `isVeg` (→ veg_class proxy), and **`isAvailable`** — the F2 smoking gun: a full push whose items are `active`/`in_stock` (lib/petpooja.ts:231-233) flips every matched row available. `section_order`/`sort_rank`/`badge`/`archived` don't exist yet, so they can't be clobbered *today* — M-1 must guarantee the upsert never writes them once M-2 adds them.
- **`customizations` is also upsert-written** (petpooja.ts:112). M-4-authored option groups on own-app rows would be overwritten by the next POS sync. R-1's exclusion list should be extended to cover `customizations` on own-app-managed rows (or M-4 stores groups outside the clobber set). Recorded as an M-1×M-4 interaction.
- **Stock webhooks are a second availability writer:** `item_stock` / `item_stock_off` set `isAvailable` by `petpooja:<id>` tag containment (petpooja.ts:829-837, 878-886). Once M-3 archives the cut set, a stock-on webhook must not revive archived rows — M-1 scope, or a render-layer rule that `archived` is master.
- **Outbound observation (out of §3 scope, recorded):** `fetchmenu` serializes the entire `menu_items` table — including the direct-book `pricePaise` — back to Petpooja (petpooja.ts:131-156). R-2 keeps aggregator prices out of own-app rows; nothing keeps own-app prices from flowing out to the POS side. Owner awareness item.
- Slug identity for POS rows: `slugify(itemname)` (lib/petpooja.ts:210-215, 223) — lowercase, non-alphanumeric runs → `-`, trimmed. This is the transform the slug map was validated against (§6).

---

## 4. Check §2.4 — addon/customizations capability (R-4 verdict, F6)

**The modifier vehicle exists end-to-end** @ 2341b60:

1. **Schema:** `menuItems.customizations` jsonb — `{groupName, type: "single"|"multiple", options: [{name, priceModifier, default?}]}` (menuItems.ts:83-93).
2. **Editor API:** `PATCH /menu/items/:slug` validates groups (≤20 groups, ≤20 options, integer `priceModifier` −10⁶..10⁶) — routes/menu.ts:246-259, 277.
3. **Server-side pricing:** `resolveCustomizations` (lib/dishCustomizations.ts:51-100) is the **only** place `priceModifier` is read (its header, lines 3-20). Fail-closed: unknown group/option → 422 (71-73, 90-93); `single` caps at one selection (75-80). Units are paise (dishCustomizations.test.ts:17-28 — 1500 = ₹15).
4. **Checkout:** `price = dish.price + customization.modifierPaise`, server-computed; the client never asserts a price (routes/checkout.ts:148-166).
5. **POS import** builds the same shape from Petpooja variations/addons (lib/petpooja.ts:280-341).

**Capability vs manual §6 needs:**

| §6 need | Expressible today? |
|---|---|
| Priced add-ons (optional multi, e.g. omelette +3000) | **Yes** — `multiple` + `priceModifier` |
| Single-select group with priced options (wok protein Veg 0 / Egg +3000 / Chicken +5000) | **Yes** — `single` + modifiers |
| **Required** single-select (sauce chooser, pasta base must be chosen) | **No** — empty/absent selection is always valid and prices as zero (dishCustomizations.ts:24-27, 55-57). No `required` flag exists anywhere in the shape. |
| Per-piece quantity (boiled egg 1500/pc) | Not in the customization shape — but not needed: model as a unit-priced row (payload already does: Boiled Egg (1 pc) ₹15) and let cart `qty` carry the count. |

**R-4 verdict (deliverable c): take the modifiers path.** The vehicle is real and wired through the money path; M-4's branch must add `required` semantics as a small additive change (a `required?: boolean` on the group + a fail-closed branch in `resolveCustomizations` + checkout coverage), and must resolve the M-1 interaction in §3 so POS syncs don't clobber authored groups. **No variants fallback is needed.** (Parking spec detail for M-4, not acted on here.)

**Known addons.ts read-modify-write finding: already closed on main.** The attach path runs in a transaction with `SELECT … FOR UPDATE` and no longer mutates the order total (routes/addons.ts:283-305; rationale comment 275-282).

---

## 5. Check F1 — route mount reality

- Routers mount under `/api`: `app.use("/api", router)` — `artifacts/api-server/src/app.ts:241`; `menuRouter` at routes/index.ts:103 → **`/api/menu/*` is the real public surface** (`/api/menu` rate-limit at app.ts:185 corroborates).
- The v1 spec: `openApiContract.ts:192` serves `/api/v1/openapi.json` with `servers: [{url: "/api/v1"}]` (line 125) and declares `"/catalog/skus"` (line 127) → resolved path `/api/v1/catalog/skus`.
- **The declared path is genuinely dead, and the mechanism is a double-prefix bug:** `catalog.ts:101` registers the literal path `"/api/v1/catalog/skus"` on a router that is itself mounted under `/api` (routes/index.ts:74 + app.ts:241) — so it actually serves **`/api/api/v1/catalog/skus`**. The working sibling is `catalog.ts:109` (`"/catalog/skus"` → `/api/catalog/skus`). F1 confirmed at source; strengthens the standing remove-or-complete ruling on the OpenAPI artifact. Not fixed here (out of program scope).

---

## 6. Check §2.5 — slug map (F7) → `m0-final-slug-map.csv`

Method: replicated `slugify` (lib/petpooja.ts:210-215) in the cross-check; validated every row's `live_slug` against (a) the 116 static-seed slugs in `lib/menu-catalog/src/index.ts` and (b) `slugify(maps_from)` for POS-created rows.

**Result — 92 rows, zero conflicts:**

- **66 MATCH** — provenance: 52 static-seed slugs, 21 POS-derived (`slugify` of the aggregator name), 2 db-only.
- **9 FUZZY → all CONFIRMED**: 7 are exact static-seed slugs (`avocado-toast-with-sunny-side-up`, `high-protein-chicken-omelette`, `spinach-mushroom-omelette`, `plain-omelette`, `exotic-egg-bhurji`, `cream-of-mushroom`, `lemon-mint-ice-tea-smoothie`); 2 are db-only rows semantically consistent with their names (`aglio-olio-pasta-v`, `ragi-dates-eggless-brownie`).
- **10 ABSENT-CREATE + 7 NEW** — verified genuinely absent: no `maps_from` name of any create-row slugifies to an existing static slug.
- The 2 db-only rows (plus the 21 POS-derived ones) exist only in production `menu_items`; M-3's read-before-write plan phase re-confirms them against the live DB before applying. **Apply by slug, never by name** stands.

---

## 7. Check §2.6 — macros coverage (Law 8 baseline)

- **Static seed:** all 116 dishes carry non-zero macros (no `"calories": 0` rows). However `scripts/src/backfill-macros.ts:1-10` documents that **90%+ of the catalog's macros are a duplicated placeholder bucket** (`macrosAreProvisional`) — values exist but are placeholder-quality. Feeds F5 (§9).
- **DB rows:** Petpooja imports null-guard macros — an empty nutrition panel maps to `null`, not zeros (lib/petpooja.ts:243-278). Consistent with F5's "only 5 dishes empty" production observation.
- **Merged-catalog hazard for acceptance §7.4:** CMS-only rows with `macros: null` are emitted with **zero-filled macros** (`{calories: 0, …}` — menuResolver.ts:167-175). "Zero rows available with null macros" must therefore be asserted against the **DB column**, not the merged output, or zeros will masquerade as coverage.
- **Payload rows that will need macros:** 8 rows carry `needs-macros` (Edamame & Corn Salad, Turkish Eggs, Make Your Own Omelette, five Off-the-Wok) **plus** the two NEW meal-box rows with no macro source (`Paneer Meal`, `Veggie Meal`) = **effective set of 10**, vs manual §4 M-6's "nine". Stop-and-ask filed (§12.1).

---

## 8. Check §2.7 — price render path (I-4)

- **Storefront reads server paise everywhere that matters.** `lib/format.ts:1-5` (`formatPaise`, display-only per its own comment) is used across 108 component files; menu surfaces read `dish.price` from the server payload (components/menu/DishDrawer.tsx:8,71,136; components/menu/PdpBuyLedger.tsx:8,144). Checkout is server-priced (§4).
- **Rendered ₹ literals found (2):**
  1. `components/landing/Section03B2BEnterprise.tsx:86` — `₹180 / meal` (B2B enterprise section).
  2. `app/(focus)/trial/page.tsx:13` — "Three RD-designed lunches for ₹399 …" (trial copy).
  (Other grep hits are comments/prop-docs, not renders.)
- **Gate reach:** `scripts/lint-prices.ts` scans **only `artifacts/tanmatra/src`** (lint-prices.ts:9) — the storefront is un-gated for price literals. Both literals above are **listed M-5 dependencies** per interaction I-4, folding into the standing server-token program. Not fixed here.

---

## 9. Checks F2/F5 + §2.8/§2.9 — availability flip, claims integrity, millet, wok recipes

**F2 (availability flip) — mechanism VERIFIED:** two code paths overwrite `isAvailable` wholesale: the push-menu upsert (petpooja.ts:106, from `active`+`in_stock`, lib/petpooja.ts:231-233) and the stock webhooks (petpooja.ts:829-837, 878-886). A full re-sync with an all-active menu produces exactly the observed 0-of-145-unavailable state. The audit-baseline→now flip is a data event the repo cannot date; the suspect is confirmed *capable*. Consequence stands: M-3's disable set performs the entire cleanup, and M-1 must land first.

**F5 (claims integrity) — VERIFIED and sharpened:**

- The static seed stamps `rdVerified: true` on **113 of 116** dishes while the macros beneath are largely placeholder (§7) — blanket-true is seed data, exactly as suspected.
- DB overlay: when a `menu_items` row exists, its `rdVerified` wins (menuResolver.ts:118); POS-created rows set `rdVerified: false` (lib/petpooja.ts:358) — so production showing `rdVerified: true` on all 145 implies DB rows were flipped or seeded true post-import. Repo cannot confirm which; the render risk is real either way.
- **`rdReviewState` is `allergenReviewState`** surfaced through the resolver (menuResolver.ts:127, 185, 199-205, fails closed). The public menu hides anything not `reviewed` (routes/menu.ts:45-53). **But POS imports arrive pre-`reviewed`** (lib/petpooja.ts:359 sets `allergenReviewState: "reviewed"` on every import) — POS rows bypass the RD patient-safety gate entirely. A rendered RD claim on dishes no RD reviewed is exactly the compliance defect F5 warned about; recorded for the owner (fix belongs to a claims-integrity branch, not this program).
- Where `rdVerified` renders: storefront `components/protocol/ProtocolDishRail.tsx:23,86` (gates the "clinical" rail and shows the RD badge) and `components/landing/SpecSheetCard.tsx:52,99-106` (fails closed).

**§2.8 millet — BLOCKED (owner/kitchen fact).** Repo evidence: the static seed's pasta display names carry **no** "Millet" ("Alfredo Pasta - Veg/Chicken/Prawns", "Pesto Pasta (Veg/Chicken/Prawns)"), while the historical aggregator names in the rationalization data do ("Alfredo Millets Pasta (Chicken)" …). The payload already flags all four pasta rows `millet-confirm-N1`. If the answer is "still millet" → mechanical rename to "… Millet Pasta"; if not → payload names stand.

**§2.9 wok recipes — BLOCKED (kitchen).** `recipesTable` exists with `foodCostPaise` and full nutrition-label fields (lib/db/src/schema/recipes.ts) — the landing slot for COGS + macros when recipes arrive. The kitchen dataset (`scripts/data/kitchen-data-collection.json`, ~365 recipe-prose entries) contains **none of the five Off-the-Wok dishes** (the only "Lemon Chicken" hits are "Broccoli Lemon Chicken Salad"). **0 of 5 have a recipe on file in-repo** → M-6 scope is all five wok rows; F-coded prices stay estimates pending COGS ratification.

---

## 10. Interaction I-1 — D-19 status

**MERGED.** `b1ac202` — "fix: propagate dish availability to menu, PDP, and cart (D-19)" — landed via PR #50 (`claude/storefront-availability-propagation`, merge `162f029`) and **is an ancestor of the pinned SHA** (verified with `git merge-base --is-ancestor`). Both halves exist at 2341b60:

- **Server:** checkout rejects unavailable dishes with 422 `dish_unavailable` (routes/checkout.ts:132-138).
- **Client:** availability propagation across menu/PDP/cart (storefront `lib/cartStore.ts`, `components/cart/AddToCart.tsx`, `components/menu/PdpBuyLedger.tsx`, `e2e/specs/availability.spec.ts` all carry D-19 markers).

I-1's constraint ("M-3 never alone") is therefore satisfiable: the enforcement is merged. One residual ops check at M-3 time: confirm the **deployed** build is ≥ `b1ac202` (F2's production observation is a data-state issue — flags flipped true — not evidence of missing enforcement).

---

## 11. Downstream implications (findings, not fixes)

- **M-1 (fence) scope narrows and shifts:** price is already fenced (ADM-28). Remaining work: exclude `name`, `category`, `isVeg` from the upsert on own-app-managed rows; never write the M-2 columns; decide the `isAvailable`/`archived` policy for both the upsert and the stock webhooks (archived rows must be un-revivable); extend the exclusion to `customizations` (M-4 interaction); §7.2 replay test on top of the existing `petpooja.priceAuthority.test.ts` pattern.
- **M-2 is required** (not conditional): `section_order`, `sort_rank`, `veg_class`, `badge`, `archived` — all five absent.
- **M-3:** slug map is apply-ready (`m0-final-slug-map.csv`); 23 rows resolve only against production DB and get re-confirmed in the plan phase; disable set = `tanmatra-menu-rationalization.csv` action column per §8; D-19 is merged so the I-1 gate reduces to a deploy-version check.
- **M-4:** modifiers path per §4 verdict; add `required`; per-piece via unit rows.
- **M-5:** dependencies logged — `/menu/ranked` lacks the availability filter (§2); two storefront ₹ literals (§8); veg tri-state render depends on M-2's `veg_class`.
- **M-6:** scope pending §12.1 resolution (9 vs 10 rows); wok macros/COGS blocked on kitchen recipes (§9).

---

## 12. Stop-and-ask register (owner decisions, nothing improvised)

1. **needs-macros count:** manual §4 M-6 says **nine** rows; payload flags 8 `needs-macros` and leaves the two NEW meal-box rows (Paneer Meal, Veggie Meal) unflagged with no macro source → effective **10**. Confirm M-6's row list (or confirm Make Your Own Omelette derives from Plain Omelette + add-on math, making it 9 + derivation).
2. **Millet rename** (§2.8): kitchen fact required before the mechanical rename decision.
3. **Wok recipes** (§2.9): kitchen to supply five recipes (macros + COGS); until merged those rows stay `is_available=false` per §8.
4. **Claims-integrity defect (outside this program):** POS imports enter pre-`reviewed` (lib/petpooja.ts:359) and seed `rdVerified` is blanket-true on placeholder macros — wants its own remediation ruling.
5. **Outbound price flow:** `fetchmenu` exports direct-book prices to the POS side (§3) — confirm this is acceptable under R-2's two-book model.

---

## 13. Proposed §1 ledger line (for the Drive manual; not applied to the canonical doc from here)

> 2026-08-15 · **M-0 filed @ 2341b60** (`docs/TNM-MENU-01/M0-FINDINGS.md`) — checks 1–9 + I-1 complete. Slug map finalized (66+9+10+7, 0 conflicts). R-4 → **modifiers path** (`required` flag is M-4's additive gap). D-19 **merged** (PR #50). M-2 confirmed required: section_order · sort_rank · veg_class · badge · archived. M-1 re-scoped: price already fenced (ADM-28); remaining = name/category/veg/availability/customizations + stock-webhook revival policy. Stop-and-asks: M-6 row count (9 vs 10) · millet · wok recipes · POS rows bypass RD gate · outbound price flow.
