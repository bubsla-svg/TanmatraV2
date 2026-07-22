# Tanmatra Plan Cross-Check — corpus vs. repo reality

**Date:** 2026-07-22 · **Branch:** `claude/plan-analysis-dependencies-kbj87v` · **Method:** every claim below was produced by a read-only investigation of the repo and then independently re-verified by a second pass told to *refute* it. Evidence is cited as `file:line`. This document is the deliverable the spec README (`docs/spec/README.md`) forward-references.

> **Reading order.** §0 is the headline. §1 is the dependency/existence map. §2 is "what's already built" (most of it is). §3 is the conflict register with a recommended resolution per row. §4 is the corrected execution sequence. §5 is the blocker escalation list for Chandan. §6 is money defects found incidentally.

---

## 0. Headline

**The plan is sound in intent but stale on contact — twice over.** Two plan layers sit in this repo, both written against snapshots the tree has already moved past:

1. **`tasks/PR-01…PR-10`** (the "Amendment Set 01 / Checklist v1.2" queue, added 2026-07-18). It was *fully executed* as PRs #231–#247 on 2026-07-19/20 — and nearly every brief was found stale at execution. PR-10's own commit calls itself *"Sixth stale sibling brief out of six."* Four of five topology claims in `CLAUDE.tanmatra.md §3` are now false.
2. **The 02-series corpus** (the Google Docs you linked, transcribed into `docs/spec/` this session). Its clean "old build gets prices + safety; experience ships on the rebuild" split **no longer maps to reality**: the rebuild has *already merged* (PRs #256–#281) on the *old* commercial model. So the corpus describes a rebuild that partly happened, on top of a pricing architecture the corpus wants to replace.

**The one thing all three layers (tasks queue, live code, 02-series) genuinely agree on is server price authority** — "server computes, client displays." That invariant is *implemented and shipped* (`paymentIntegrity.ts`, `payments.ts:141`). It is the safe foundation to reconcile everything else onto.

**What is NOT done and is the real remaining work:** the Stage-A repricing itself (catalog still holds pre-Stage-A prices), and the entire 02-series *commercial* architecture — the 4 named plans, the ₹399 full-creditback trial, the RD bump, the evening add, and the goal router. None of it exists in code, and the live commercial model contradicts it (₹750/meal vs ₹199–249/meal; ₹1,499 trial vs ₹399).

**Do not treat this as a green-light to apply prices or rewrite checkout autonomously.** Two hard gates block that: (a) a **safety escalation** — the Ragi Brownie contradiction the corpus is built around *no longer exists in the data* (it now reads `isVeg: true`, no Eggs), which means the SKU was either resolved by the kitchen or "resolved by assumption" (the one thing the brief forbids); and (b) several 02-series plan tracks are **unfillable from the current catalog** (a veg lean-high-protein pool has *zero* dishes). Both must be closed by a human before money moves.

---

## 1. Dependency & existence map

### 1.1 What is now in the repo (this session)
`docs/spec/` holds faithful transcriptions of: `00-tanmatra-master-index.md`, `agent-brief-pricing-live.md`, `tanmatra-trial-plan-02b.md`, `tanmatra-checkout-breeze-02c.md`, `tanmatra-subscription-cuj-v2-02d.md`, `tanmatra-plan-config-02e.md`, `tanmatra-ui-construction-02f.md`, and `tanmatra-stageA-prices.csv` (commit `5f487c2`). These live **only on this branch**, not on `main`.

### 1.2 What the corpus depends on but is MISSING everywhere in the repo
These are load-bearing and absent at every path (verified by full-tree `find`):

| Missing artifact | Role in the plan | Consequence of absence |
|---|---|---|
| **IMPECCABLE.md** | The binding UI constitution every amendment defers to (§2.6 honest commerce, §10.1 server authority, §11 FSSAI/allergens, the 12-chip glyph set) | The corpus is *not executable* without it. Yet recent commits (`3dfe3ad`, `9b7da0c`, `e7d8a3c`) already cite "§11.1" by number — work is running against an **uncommitted, unversioned constitution**. |
| **tanmatra-frontend-rescue-plan.md** | Rebuild architecture, Phase 0–4, §3.1 server-authority statement | Phase sequencing and anti-rot rules are referenced but unauditable. |
| **tanmatra-benchmark-framework.md** | The measurement/scoreboard layer (LCP/CLS/INP budgets, journeys, the 28.1% and 0%→20/20 baselines) | No repo has the perf/journey gates the plan "proves against." No CLS infra exists (PR-04 confirmed the quoted CLS figure was unverifiable). |
| **tanmatra-monetization-amendment-02.md** | The market foundation: the 5 plans, copy system, 12 chips, attach architecture | 02a–02f all cite it; the source of the plan numbers is absent. |
| **tanmatra-repricing-and-menus-02a.md** | Pricing architecture, plan menus, data-integrity gates | The "why" behind Stage-A and the final prices. |
| **tanmatra-catalog-repricing.csv** | The **final** target prices (`new_direct_rs`/`new_aggregator_rs`), rebuild-only | Phase-2 pricing has no source file. (The `final_target_*` columns in the Stage-A CSV are a preview, not this file.) |
| **HFEP SKILL.md** | The agent operating protocol (blast radius, epistemics) | `CLAUDE.tanmatra.md:4` references a "High-Fidelity Engineering Protocol (SKILL.md)" that exists nowhere. |

> `.claude/skills/impeccable/` is the **generic** Anthropic frontend-design skill (v3.9.1), *not* the IMPECCABLE constitution — do not mistake one for the other.

### 1.3 Field-name translation the plan needs (verified data-shape facts)
The pool queries in `02e §3` are written in shorthand that does **not** match the catalog schema:
- There is **no `gi` field** — it is `glycaemicIndex: "low"|"medium"|"high"` (`lib/menu-catalog/src/index.ts:119`), present on all 117 dishes.
- There is **no `kcal`** — macros use `calories` (`index.ts:13-19`).
- `rdReviewState` is **absent from all 117 seed dishes**; it exists only on DB rows (`menu_items.allergen_review_state`, `lib/db/src/schema/menuItems.ts:73-75`) and is treated as "reviewed" when absent for the legacy curated catalog.
- **Two macro truths exist.** The exported `DISHES` overlay replaces macros with `ESTIMATED_MACROS` for **105 of 117** dishes (`index.ts:4643`). Every pool count changes depending on which set you query. **The plan must pin which macro set it computed against** — the customer app consumes the *estimated* set; a naïve grep of `index.ts` returns the *raw* seed.

---

## 2. What is ALREADY built (the plan under-counts this heavily)

| Plan expectation | Reality | Evidence |
|---|---|---|
| **Server price authority** (PR-01, corpus invariant #1) | **Shipped.** `POST /orders` accepts only `{dishId, qty}` — no client prices; `/orders/finalize` explicitly ignores client `price`; Razorpay order billed at `authoritativePaise`; webhook reconciles captured-vs-expected and refuses to promote on mismatch; two idempotency layers. | `routes/checkout.ts:33-41,188`; `lib/loyaltyEngine.ts:525-526,568`; `routes/payments.ts:141,175,679-683`; `lib/paymentIntegrity.ts`; `middlewares/idempotency.ts` |
| Razorpay + webhook signature verification + idempotency | **Shipped.** HMAC-SHA256 with `timingSafeEqual`, order-binding replay guard, raw-body webhook verify, `webhook_inbox` dedup. | `routes/payments.ts:317-367,548-624` |
| Macro **verification gating** (A5 — "gate estimated macros; a marker may not exist") | **Marker exists** and is richer than assumed: `macrosEstimated`, `macrosProvisional`, plus allergen `allergensReviewed`/`allergensDerived` with fail-closed semantics. Provisional macros are suppressed on cards; estimated ones are labelled `~/est`. | `index.ts:88,93,109,118,4643-4653`; `tanmatra-v2/Menu.tsx:836,1190-1196` |
| `rdReviewState` gate (corpus's launch-gate primitive) | **Exists and enforced** in the public menu route, meal planner, and the strict checkout gate (422 `safety_block`/`unreviewed_dish`), fail-closed on unknown values. | `routes/menu.ts:47-49`; `lib/mealPlanner.ts:55`; `lib/preferences-match/src/index.ts:184-190` |
| Subscription plan layer (PR-07) | **~90% shipped** under a more-normalized (cadence-based) schema: `quote`/`create`/`pause`/`resume`/`skip`/`unskip`/`swap`/`change-plan`/`convert`, Razorpay mandates, trial lifecycle states, macro-cap-validated swaps. | `routes/subscriptions.ts:616-2398`; `lib/chargeMandate.ts`, `lib/razorpayRecurring.ts` |
| `/plans` weekly management surface (PR-08) | **Shipped** at `/subscriptions` (naming collision — `/plans` maps to the RD plan *catalog*): unskip with atomic credit clawback, macro-cap/safety toasts, ring gauges, Undo. | `routes/subscriptions.ts:1211-1542`; PR #243 |
| Checkout stepper Review→Delivery→Payment (PR-09) | **Shipped** (single-scroll on mobile with an honest 3-step gate; disabled-with-reason Pay; 6-box OTP; failure/processing states). | `tanmatra-v2/Checkout.tsx:1718,2959-3076`; PR #247 |
| FSSAI marks untouchable (invariant #7) | **Shipped and reinforced** across PDP/cards/cart/order-lines/home. | `components/FssaiMark.tsx`; commits `3dfe3ad`,`8ded01d`,`9b7da0c`,`e7d8a3c` |
| PIN serviceability gate | **Exists** (8-pincode Noida allowlist) but at *address-entry* time, not as a journey-start gate as 02c/02d assume. | `lib/serviceablePincodes.ts:19-46`; `components/location/LocationPickerFlow.tsx` |

**Implication:** the corpus's Phase-2 "money path" is far more built than it assumes. The genuinely-new work is *commercial configuration and copy*, not payment plumbing.

---

## 3. Conflict register (spec vs. repo) with recommended resolutions

Severity reflects launch/money/safety risk. "Resolution" is a recommendation, not an action taken.

### 3.1 CRITICAL

**C1 — Ragi Dates Brownie: the corpus's founding safety premise is false in the data.**
The corpus (agent-brief A4, master-index blocker #1) says the SKU carries `isVeg: false` + an Eggs allergen and must stay *contained* until the kitchen rules. In the repo it is `isVeg: true`, `allergens: ["Dairy","Gluten"]` (no Eggs), `isAvailable: true`, live (`index.ts:3897-3935`). Either the kitchen answered and the corpus blocker is stale, **or the contradiction was "resolved by assumption"** — the single action the brief forbids. Also note the effective (estimated) macros for this SKU are `713 kcal` vs the raw `240 kcal` (whole-bake vs per-serving drift), and `glycaemicIndex: "high"` — so any "diabetic-friendly"/low-GI copy on it would be wrong.
→ **Resolution: STOP. Get an explicit kitchen/RD provenance record for how `isVeg:true`/no-Eggs was decided, before any Stage-A price ships.** This is a §2.6/§11 safety item, not a data-entry item.
→ **UPDATE 2026-07-22 — RESOLVED by removal.** First contained (`isAvailable:false`, commit `edab83c`); then, per product call ("remove Ragi from the catalog"), the SKU record was **deleted from `lib/menu-catalog`** (both the dish entry and its `estimatedMacros` overlay). It is no longer served, so the contradiction is eliminated at the source and Stage-A is no longer gated on it. Re-add only on a kitchen answer that covers premix.

**C2 — Commercial model: the 02-series plan architecture does not exist and contradicts the live one.**
Corpus wants 4 plans (`desk_fuel ₹199/meal`, `steady ₹229`, `glp1_companion ₹5,999 flat`, `protein_build ₹249`) + `teams ₹189`. Live model is `PER_MEAL_PAISE = 75000` (₹750/meal) with cadence discounts and **8 condition-named RD plans** (Weight-Loss Jumpstart, Lean Muscle Builder, PCOS, Diabetic-Friendly, …). Zero corpus plan IDs exist in code. `pricing.ts:22,81-89`; `rdPlans.ts:105-323`.
→ **Resolution: this is a product decision, not a merge conflict.** Chandan must choose: (a) adopt the 02-series 4-plan architecture as a *replacement* (large, touches recurring money — needs the missing Amendment 02/02a + IMPECCABLE first), or (b) treat the 02-series as aspirational and keep the shipped model. Recommend deciding this **before** any 02-series UI work, because 02d/02e/02f all assume the 4-plan world.

**C3 — Trial pricing: ₹399 corpus vs ₹1,499 live, with a different credit mechanic.**
Corpus: ₹399 for 3 lunches, full **39900-paise** creditback within 7 days, one-per-phone, no auto-convert. Live: ₹1,499 all-in (`pricing.ts:70,100-108`), and the only trial-adjacent credit is the *reverse* direction — an à-la-carte→trial 1-free-meal bridge (`lib/bridgeCredit.ts:13`). `/convert` applies **zero** credit (`routes/subscriptions.ts:2266-2398`). The repo now holds *two* authoritative trial prices (docs say ₹399, code bills ₹1,499).
→ **Resolution: gated behind C2.** The credit-carrier exists (`credit_ledger`, paise + `expiresAt` + lot-based expiry, `lib/db/src/schema/loyalty.ts:81-101`) and the existing 3+4-day trial grace window *coincidentally* equals the 7-day credit validity — so if adopted, it is buildable, needing a new ledger reason + a grant hook on trial purchase + a redemption hook in `/convert`. The "no auto-convert" rule already matches the live `trialLifecycleScheduler` spirit.

**C4 — CI does not enforce the invariant the whole plan rests on.**
The money-path unit/integration corpus (`payments.integrity`, `refunds`, `subscriptions.*`, `cartMath`, `marketplace.checkout`) and **all typechecks** run in *no* CI workflow. PR CI runs custom lint gates + a static-build Playwright suite whose payment legs (OTP, Razorpay modal) **skip** unless env vars are set. A PR that broke payment-amount authority would merge green. `.github/workflows/*`; `e2e/specs/cuj_money_paths.spec.ts:124-174`; `payments.integrity.test.ts` (never run in CI).
→ **Resolution: add a CI job that runs `pnpm run typecheck` and the api-server test suite (needs a `DATABASE_URL` service or a Postgres-less split) before any further money-path work. This is the cheapest, highest-leverage fix in this whole document.**

### 3.2 HIGH

**H1 — Checkout shape: 02c deletes what PR-09 just shipped.**
02c mandates 3 screens (Identity/Address/Pay), **no coupon field**, **no slot picker** ("delivery slot is not a decision"). Live checkout (PR-09) is Review→Delivery→Payment with a **voucher input** (`Checkout.tsx:382-387,973`), a `/vouchers` page, and a **slot grid** (`Checkout.tsx:1961-1999`). `docs/wiring-guide.md:80` even names a bindable `TNM50` voucher.
→ **Resolution: gated behind C2.** If 02c is adopted, the voucher/tip/slot UI must be *removed*, not bound. Note the vouchers here are corporate wallet-credit vouchers, not promo codes — a different mechanic that a B2B "teams" motion may still need, so don't delete the corporate-voucher backend, only the consumer coupon surface.

**H2 — Pool queries: several 02-series tracks are unfillable from the current catalog.** (verified against both raw and estimated macros)
- **Veg lean-high-protein (protein≥25 ∧ kcal≤450): ZERO dishes** under either macro set. This is why the corpus queues paneer/tofu/sattu additions — the premise of a veg high-protein pool is *currently false*.
- **High-protein snacks (protein≥18): effectively ZERO** — the single "hit" is a 1009-kcal whole bread loaf (`id 83`), not a snack portion.
- **Veg low-GI mains: 1 (raw) / 5 (estimated); egg low-GI: ZERO.** A per-track low-GI rotation (Steady plan) cannot be built for veg or egg today.
- Roast Chicken Russian (`id 101`) protein = **36 g confirmed** (matches spec).
→ **Resolution:** `steady` and `glp1_companion` **cannot launch their veg/egg tracks** from the current SKU set — exactly what `02e §2` says (`dietTracks` narrowed, launch-gated). Honor the gate: route those tracks to waitlist, do not widen `dietTracks` in code. The 6 new SKUs (millets pasta ×4, grilled paneer, boiled 3-egg) and 3 recipe-pending SKUs (sattu, millet khichdi, tofu bowl) confirmed **not present** — none exist to reconcile.

**H3 — Attach architecture (RD bump, evening add) does not exist.**
No `rd_bump` / `evening_add` anywhere. The nearest recurring upsell is the **₹999/mo premium membership** whose 1 RD-consult/period *overlaps* the corpus's `rd_bump` (₹499/mo RD access). `lib/db/src/schema/premium.ts:34-39`.
→ **Resolution: reconcile rd_bump against premium membership before building** — they sell the same RD value at different prices, and shipping both would confuse the offer. Evening-add is representable today as a `dayPlan`/`mealsPerDelivery` change, not a priced attachment.

**H4 — One-trial-per-phone is not enforced.**
`POST /subscriptions` creates a trial with no prior-trial lookup — a user can buy unlimited trials. Identity foundation is solid (phone-OTP, `users.phone_e164` UNIQUE), and a precedent gate exists (`userIsFirstOrderEligible`). But account deletion cascades subscriptions, so "one per phone *ever*" needs a durable (hashed-phone) record to survive deletion. `routes/subscriptions.ts:659-884`; `lib/db/src/schema/auth.ts:46,65`.
→ **Resolution: add a create-route guard + a deletion-surviving phone→trial ledger** if the ₹399 trial is adopted (gated behind C2/C3).

### 3.3 MEDIUM / drift

- **M1 — Goal router ("What's lunch for?") does not exist.** The nearest is the 2-question onboarding SoftGate and the `/subscribe` GoalPlanChooser — a gap, not an overlap (02d itself calls the router the Goal-Fit's "one-tap cousin"). Net-new if 4-plan world is adopted.
- **M2 — 02f component manifest: only ~2 of 13 exist as named components.** `FssaiMark` (=DietMark) and `Sheet` are real; `Price`/`DishImage` are utils; `StickyBar`/`OrderBump` have non-unified equivalents; the other six are inline per-page. Building the manifest is real Phase-1 work — *if* the 4-plan world is adopted.
- **M3 — Design tokens are dark-only** despite `next-themes enableSystem`; a system-light user gets a `.light` class with no CSS behind it. Corpus/IMPECCABLE assume "both themes, verified contrast." `src/index.css`; `root.tsx:310`.
- **M4 — Doc rot to quarantine.** `BRIEFING.md`/`PROJECT.md`/`handoff.md` describe a *different, closed* mission (Project Sentinel REM-*/MOB-*) with a hardcoded Google-internal path that `AGENT_WORKING_AGREEMENT §4` bans. `CLAUDE.tanmatra.md §3` has 4/5 false topology claims. `wiring-guide.md` per-meal quotes (₹133/179/149) contradict corpus (₹199/229/249). None of these reference the 02-series/IMPECCABLE/rescue/HFEP.
- **M5 — COD copy-vs-function drift.** Checkout trust strip and FAQ advertise "cash on delivery"; no COD code path exists (`Checkout.tsx:2089`; `Faq.tsx:36`). 02c bans COD anyway — so the *copy* is the bug. Fix the copy regardless of plan adoption.
- **M6 — Stage-A CSV `id=1` has an 11-field row** (duplicated `remaining_at_cutover_pct`). Kept byte-faithful, flagged in `docs/spec/README.md`. The meaningful `stageA_paise` is unaffected.

---

## 4. Corrected execution sequence

This replaces the corpus's "old build / rebuild" split (which no longer maps) with reality-ordered phases. Each item names its gate.

**Phase 0 — unblock & make safe (no product decisions needed):**
1. **Resolve C1** (Ragi Brownie provenance) — human/kitchen. Blocks all pricing.
2. **Resolve C4** (add typecheck + money-path tests to CI) — safe, mergeable now, protects everything downstream.
3. Fix **M5** (delete false COD copy) and **M4** (quarantine the 3 stale mission docs + drift-flag `CLAUDE.tanmatra.md`) — safe housekeeping.
4. Locate & commit the **missing dependencies** (§1.2), above all **IMPECCABLE.md** — commits already cite it by section number, so it is being treated as law while absent.

**Phase 1 — Stage-A repricing (the corpus's "ship now", once Phase 0.1 clears):**
5. Write the required **`PRICE-FLOW.md`** (agent-brief A1). Key facts already traced: seeding is **on-demand only** (`scripts/src/seed-menu-items.ts`, `--apply`), the seed **deliberately does not refresh price on slug conflict**, the Petpooja webhook is a second price writer, and the web app **bundles `STATIC_DISHES`** (stale-price window of ≤5 min via React Query `initialData`, plus build-time JSON-LD). So a price change must target the **catalog file *and* the DB**, and the client bundle must be rebuilt.
6. Apply Stage-A prices **byte-exact from the CSV `stageA_paise` column**, matched by `id`, in one revertible commit. **This is max-blast-radius money work; it needs an explicit human go — do not do it autonomously.**
7. Arm the A6 deploy gates (tamper test + money-path E2E green pre/post; rollback = revert the price commit + DB restore).

**Phase 2 — commercial architecture (BLOCKED on the C2 product decision):**
8. Chandan decides: adopt the 02-series 4-plan world, or keep the shipped model. *Nothing in 02c/02d/02e/02f should be built until this is decided* — they all assume the 4-plan world.
9. If adopted: sequence is plan-config → per-plan pool queries (translated to `glycaemicIndex`/`calories`, pinned to a macro set, honoring H2's unfillable tracks) → ₹399 trial + credit ledger (C3) → one-per-phone (H4) → RD bump vs premium reconciliation (H3) → goal router (M1) → 02f component manifest (M2) → 02c checkout de-scope (H1).

**Phase 3 — proof:** locate the benchmark framework, stand up the missing CLS/perf infra, and instrument the funnel to the corpus's `cuj_*` vocabulary (today's events are a comprehensive but differently-named snake_case dictionary — reconcile names, don't rebuild).

---

## 5. Blockers to escalate (Chandan-owned)

1. **Ragi Brownie provenance (C1)** — how was `isVeg:true`/no-Eggs decided? Safety-critical, blocks Stage-A.
2. **The C2 product decision** — 4-plan 02-series architecture vs the shipped 8-RD-plan / ₹750-meal model. Blocks all of Phase 2.
3. **The 7 missing dependency docs (§1.2)** — especially IMPECCABLE.md and the final `catalog-repricing.csv`. Work is already citing IMPECCABLE by section while it is absent.
4. **RD capacity** — gates `steady`/`glp1_companion` launches *and* the rd_bump inventory (H3), *and* is required because the veg/egg low-GI and lean-protein pools are empty (H2).
5. **Recipes for the 3 new SKUs** (sattu shake, millet khichdi bowl, tofu bowl) — agents will not author ingredients/allergens.
6. **Explicit go for Stage-A price application** — Phase 1.6 is money-path; it needs a human's approval, which autonomous execution cannot substitute for.

---

## 6. Money defects found incidentally (not in either plan)

**D1 — Customization price modifiers are displayed but never billed (undercharge / revenue leak).**
The PDP adds selected `priceModifier`s to the displayed unit price (`Dish.tsx:224-236,377`) and checkout sends it (`Checkout.tsx:1195`), but the server bills **base `dish.price` only** and ignores the client price (`loyaltyEngine.ts:525-526,568`; guest `checkout.ts:171` has no customizations field). Concrete case: "Grilled chicken +₹120" (`dishEnrichment.ts:111`) shows base+₹120 but the Razorpay order opens for the base amount — server *safely* bills its own (lower) number and logs the divergence as a warn. Direction is **undercharge + silent display-vs-billed divergence**. No server path prices customizations.
→ Product decision required: either bill modifiers server-side (add a validated customizations input to the order schema) or stop displaying a price delta the customer won't be charged. Either way it is a §2.6 "price shown = price charged" violation today.

**D2 — Client cart math is a hand-synced duplicate of the server's.** `artifacts/tanmatra/src/lib/cartMath.ts` mirrors `artifacts/api-server/src/lib/cartMath.ts` (same GST/threshold/fee constants), kept aligned only by the `AGENT_WORKING_AGREEMENT` "money-path lockstep" comment — and the client copy's tests aren't wired into any runner (`checkoutLedger.test.ts` runs only by manual command). Drift risk on the display half of the money path.

---

*Generated from a 36-agent read-only investigation (7 parallel investigations, each finding adversarially re-verified). Full evidence dump retained in the session scratchpad; per-finding `file:line` citations are inline above.*
