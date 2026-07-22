# AGENT BRIEF — Pricing & Monetization: Make It Live

**Date:** 2026-07-21 · **Repo:** chan8822/Wellness-Foods (current live build) + rebuild app when it exists **You are executing, not designing.** Every design decision in this brief is already made and documented. Your job is faithful implementation with proof.

> Transcribed into the repo from the Google Doc source (`19fDRuby-SfRc0_UHJDIjYHX03lglutnVdRGhSaWH7lY`) on 2026-07-22. Known discrepancy, reported per §0: the actual repo is `scigazetteofficial-beep/wellness-foods`, not `chan8822/Wellness-Foods` — see `PLAN-CROSSCHECK.md` §2.

## 0. Load before touching anything

Start at 00-tanmatra-master-index.md — it gives the dependency graph, precedence order, and the per-session loading map; load only what your session type requires. Then read fully, in this order: (1) HFEP SKILL.md — your operating protocol; blast-radius calibration applies and this work is **maximum rigor: it touches money**. (2) IMPECCABLE.md — binding UI contract; its conflict rule applies to this brief too: if anything here conflicts with repository reality, stop and call it out — never silently improvise. (3) tanmatra-frontend-rescue-plan.md §3 (fix-before-port) and §7 (anti-rot rules). (4) tanmatra-monetization-amendment-02.md + tanmatra-repricing-and-menus-02a.md — the what and why. (5) Data files: tanmatra-stageA-prices.csv (apply now) and tanmatra-catalog-repricing.csv (final targets, rebuild only).

**Epistemic rules that override urgency:** never invent a value; never resolve a data ambiguity by guessing; if a file, flag, or mechanism this brief references doesn't exist in the repo, report the discrepancy instead of approximating it.

## 1. Scope split — which build gets what

| Change | Old build (this session) | Rebuild (rescue-plan phases) |
|---|---|---|
| Stage-A prices (median ₹130→₹169, max raise +49%) | ✅ ship | superseded at cutover |
| Final target prices (median ₹199) | ❌ **forbidden** | ✅ Phase 2 |
| Server price authority (§3.1) | ✅ ship — same session, before or with prices | carried over |
| Ragi Brownie containment | ✅ ship | permanent fix after kitchen confirms |
| Macro-chip precision gating | ✅ ship (display gate only) | full chip system Phase 1–2 |
| Plans (Desk Fuel / Steady / GLP-1 / Protein Build), RD bump, Evening Add, dual-channel display, copy system, layout | ❌ forbidden on old build | ✅ Phase 2–3 per §3 below |
| Catalog imports + new SKUs | data-entry only, pending_review | surfaced when RD-signed |

Rationale you must preserve: a +200% correction never lands on an unchanged storefront; Stage-A is capped at +49% per SKU and 65 of 117 SKUs already reach final target there.

## 2. Session A — old build, live this week

### A1. Trace the price flow first (read-only)

Map catalog → database → API → client. Answer in writing before any edit: does the live DB re-seed from lib/menu-catalog/src/index.ts, or was it seeded once (drifted)? Does any client component hold a hardcoded or bundled price? Does any cached layer (service worker, static props, CDN) serve stale prices? **Exit: a short PRICE-FLOW.md note in the repo with the answers.** If the DB does not track the catalog file, the price change targets the DB *and* the file, atomically.

### A2. Apply Stage-A prices — mechanically

Source of truth: tanmatra-stageA-prices.csv, column stageA_paise. Match rows by id (fall back to exact name and report any mismatch — do not fuzzy-match). Do **not** recompute, round, or "improve" any value; the arithmetic was done upstream deliberately so you don't do arithmetic. One commit, message `pricing: stage-A raises per repricing amendment 02a (117 SKUs)`, containing only price data changes — this commit is the rollback unit.

### A3. Server price authority — lands with or before A2

Per rescue plan §3.1: order creation recomputes the amount server-side from line items against the canonical price table; client-supplied totals are advisory; mismatch → typed PRICE_MISMATCH rejection; Razorpay webhook signature verification; idempotency key per order intent. **Acceptance: an automated tamper test (modified client amount) fails safely in staging, and a normal order succeeds end-to-end at new prices.** Raising prices while the server still trusts the client widens the exploit — A2 without A3 is forbidden.

### A4. Ragi Dates Eggless Brownie — contain, don't resolve

The SKU is named "eggless," carries isVeg: false and an Eggs allergen. **You do not have the authority to decide which is true — only the kitchen does.** Set the dish unavailable (isAvailable: false) or rdReviewState: "blocked" — whichever the existing menu-filter path actually enforces (verify by reading the public menu route), and leave a code comment linking the discrepancy. Report it as a blocking question for Chandan. Guessing a veg/allergen status is the single worst action available to you in this codebase.

### A5. Macro-chip precision gate

Inspect estimatedMacros.ts and dishIntegrity.ts for an existing "estimated" marker (the overlay pattern suggests one exists — the allergen system has allergensDerived/allergensReviewed; macros likely mirror it). If a marker exists: gate every numeric macro display on it — estimated SKUs render no per-dish numerals (label-only or range), verified SKUs render numbers. If no marker exists: derive one conservatively (macros exactly equal to the category default in estimatedMacros.ts ⇒ estimated) and say so in the PR. Do not add new schema without flagging it.

### A6. Deploy gates & rollback (run every deploy)

Pre: Playwright money path green at current prices → apply changes → green again at new prices; tamper test passes; lint:colors and existing test suites green; rollback documented (revert A2 commit + DB restore path). Deploy: staging smoke (menu renders new prices, cart total = server quote, payment test-mode succeeds), then production, then 30-minute watch. **Rollback triggers: payment success rate drops >2pts · any PRICE_MISMATCH storm (indicates cached client prices) · menu→cart conversion falls below the 28.1% baseline over the first 48h** — on trigger, revert prices first, investigate presentation second, per Amendment 02a §7.

## 3. Sessions B — rebuild implementation map

Execute inside the rescue-plan phase structure; each unit's full spec lives in the cited section. Do not pull units forward across phases.

| Unit | Phase | Spec | Acceptance sketch |
|---|---|---|---|
| Chip system (12 glyphs, max 3/card, mono numerals, FSSAI untouchable) | 1 | Amd 02 §4, IMPECCABLE §6/§9 | verified-macros gate from A5 carries over |
| Final prices + dual-channel line ("₹259 here · ₹339 on delivery apps") | 2 | 02a §2/§5, tanmatra-catalog-repricing.csv | server quote is the only price source (IMPECCABLE §10.1) |
| Plan builder: 4 plans + weekly entry tiers + Teams page | 2 | Amd 02 §2, 02a §4 menus | Steady & GLP-1 ship **only** with RD-signed pools (see §4) |
| RD order bump at plan review | 2 | Amd 02 §5 acceptance criteria | one bump, silent decline persists, server total updates in place |
| Evening Add +₹599/week post-purchase | 2 | 02a §4 correction | one-tap, charges to subscription, never blocks confirmation |
| Meal-card payment rail | 2, behind flag | Amd 02 §5 | flag stays off until Pluxee/Sodexo merchant credentials exist — build plumbing, don't fake the button |
| Subscription CUJ v2 (router, defaults, onboarding beats) | 2–3 | Amd 02d full spec | funnel events instrumented per 02d §9; happy path = 5 decisions; router skippable always |
| Checkout breeze flow (3 screens, load budgets, no coupon field) | 2 | Amd 02c full spec | Playwright asserts screens/taps/fields per §4 budget; returning user = 0 typed fields |
| 3-Day Taste Test (₹399, creditback, one-per-phone) | 2 | Amd 02b full spec | server-enforced eligibility; no auto-convert; credit math exact: trial+weekly = ₹1,199 |
| Copy system + layout rhythm + wall-of-text law | 2–3 | Amd 02 §3/§6 | no commerce paragraph >2 lines; one "The science" collapse per PDP |

## 4. Catalog additions (data-entry, both builds)

Add as RAW_DISHES entries with rdReviewState: "pending_review" so the existing checkout/menu gate keeps them invisible until the RD signs: 4× millets pastas (direct ₹249 / agg ₹319), Grilled Paneer w/ Sautéed Veggies (₹259/₹329), Boiled 3-Egg w/ Sautéed Veggies (₹199/₹249). New-SKU proposals (Sattu Protein Shake ₹149, Millet Khichdi Bowl ₹219, tofu high-protein bowl) enter only after Chandan supplies recipes — you never author ingredients or allergens.

## 5. Hard prohibitions

No final-target prices on the old build · no new plan pages, bumps, add-ons, or trial flow on the old build · no admin-app changes · no invented macros, allergens, GI values, or recipes · no meal-card UI without credentials · no redesigning old-build surfaces "while you're in there" — Session A is data, safety, and gating only.

## 6. Definition of done (per session, all boxes or not done)

[ ] PRICE-FLOW.md written and accurate · [ ] price data applied byte-exact from CSV, single revertible commit · [ ] tamper test + money-path Playwright green pre and post · [ ] Ragi SKU contained and escalated, not resolved · [ ] macro numerals gated on verification status · [ ] deploy gates run, rollback triggers armed, 30-min watch logged · [ ] every conflict between this brief and repo reality reported, none silently patched.
