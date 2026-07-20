# Tanmatra — Register of Illogical / Irrational Instances

**Date:** 2026-07-20 · **Tree:** merged `main` @ `ec69eff` (live in production) · **Scope:** entire customer-facing surface (web `artifacts/tanmatra` + mobile `artifacts/tanmatra-mobile`)
**Method:** four parallel correctness-scan lanes, each computing actual values and reporting only hard contradictions with both-sides `file:line` evidence; every pricing figure recomputed by hand from `lib/subscription-rules/src/pricing.ts`. This is a *consistency/logic* scan, not a design-taste audit.

> **Why the earlier LIFT/CRO audits missed most of this:** they evaluated each surface for **internal** honesty ("does this component render its own price truthfully?") — and each passed in isolation. These defects are **cross-surface invariant violations**: individually-honest components that disagree with each other. A within-surface heuristic audit is structurally blind to them.

---

## A. Pricing — the same product renders up to 4 different prices

**Root architectural cause:** PR #255 single-sourced the *rate function* (`computeDeliveryPricePaise`) but left **four competing price constructs** live: (1) per-surface hardcoded meal counts, (2) the wizard's generic 14-meal default, (3) `RdPlan.pricePerWeekPaise` legacy fields, (4) `PLAN_FROM_PRICE_PER_WEEK_PAISE`. Nothing keeps them equal.

| # | Sev | Contradiction | Evidence (both sides) | Computed |
|---|---|---|---|---|
| A1 | **Crit** | `?plan=` discards the plan's meal basis: every plan slug defaults to 14 meals in the wizard | card `HomeRecommendedPlans.tsx:25` (5 meals→₹3,800) vs `Subscribe.tsx:202-228` (`!directPlan` guard → slots `{lunch,dinner}`×`everyday`=14) → `:932-935` | ₹3,800 → **₹10,474** (2.76×), *every* plan slug |
| A2 | **Crit** | Monthly path multiplies the bug: `cycleMeals = 14 × 6` | `HomePricing.tsx:44-54` ("6-Week Reset" 30 meals→₹21,660) vs `Subscribe.tsx:448` (`weekMeals 14 × CYCLE_WEEKS.monthly 6 = 84`) | ₹21,660 → **₹56,228** (2.6× overcharge) |
| A3 | **Crit** | "3-Day Trial" priced 3 ways, incl. at checkout | `computeTrialPricePaise(3)`=₹1,499 (`HomePricing.tsx:24`) vs `(9)`=₹5,316 (`HomeDualFunnel.tsx:21`, `SubscriptionPlansLanding.tsx:255`, `MetabolicLandingView.tsx:137`, and the actual wizard quote via `?trial=1`) vs `PLAN_FROM…`=₹3,458 (`GoalPlanChooser.tsx:99`) | ₹1,499 / ₹5,316 / ₹3,458 (up to 3.5×). **₹5,316 is what's billed.** |
| A4 | **Crit** | The ₹260/meal ghost PR #255 "eliminated" is still live under a new name | `rdPlans.ts:472` `PLAN_FROM_PRICE_PER_WEEK_PAISE = Math.round(14*26000*0.95)` = ₹3,458 (26000 = the retired ₹260/meal), read in `GoalPlanChooser.tsx:99`, `RdPlans.tsx:168,262`, `RdPlanDetail.tsx:77,200` | ₹3,458 identical "from" for all 6 structurally-different plans |
| A5 | **Crit** | "Healthy Everyday" shows 4 prices, 2 on the same page | `SubscriptionPlansLanding.tsx` D2C card ₹3,800 (`:401-409`) vs RD Goal card ₹5,490 (`:426,493` reading `rdPlans.pricePerWeekPaise`) vs GoalPlanChooser ₹3,458 vs wizard ₹10,474 | 4 numbers, one plan |
| A6 | **High** | UI prices from `pricePerWeekPaise` despite an explicit "do not price UI from it" comment | `rdPlans.ts:469` comment vs reads in `MetabolicLandingView.tsx:324-326,437`, `CareLandingView.tsx:363-366`, `SubscriptionPlansLanding.tsx:426,493` | ₹5,490/5,990/6,290/7,490 drift |
| A7 | **Crit** | Discount copy overstates the billed rate | `Cart.tsx:244` "save 10%" & `Checkout.tsx:2098` "save up to 15%" vs `CADENCE_DISCOUNT.weekly=0.95` (=5%) | weekly is 5%, not 10%; 15% is monthly-only |
| A8 | **High** | Even the override table contradicts `CADENCE_DISCOUNT` | overrides `pricing.ts:49-57` vs list price meals×750×1.05 | real discounts 3.49% / 5.90% / 8.32%, not 5/10/15% |
| A9 | **High** | High-Protein card's meal count ≠ its own link's config | `SubscriptionPlansLanding.tsx:90` (6 meals, ₹4,489) vs `?protocol=performance` → `Subscribe.tsx:84-88` (2×5=10, ₹7,481) | ₹4,489 → ₹7,481 |
| A10 | **Med** | "/week" label on a fortnightly full-cycle total | `Subscribe.tsx:1621` mandate "Up to {total}/week" (total is 2-week charge for fortnightly) | mislabeled unit |
| A11 | **Low** | 4th latent trial price waiting to leak | `rdPlans.ts:286` `three-day-trial-pack.pricePerWeekPaise = 210000` (₹2,100) | unused today; sits on an object others read unguarded (A6) |

**Corporate subsidy calculator (`CorporateWellnessView.tsx:87-90`) is the clean baseline** — it derives directly from `PER_MEAL_PAISE` + GST. That is the pattern every other surface must adopt.

---

## B. Flow & state logic

| # | Sev | Contradiction | Evidence |
|---|---|---|---|
| B1 | **Crit** | Subscribe sticky CTA label lies at the charge step | `Subscribe.tsx:1910-1927`: step 5 (Review) says **"Pay & start"** but only `goToStep(6)`; step 6 (Payment) says **"Continue"** but `submit()` charges. Plus a 2nd correctly-labeled pay button co-mounted (`:1639-1648`) → two charge controls on the pay screen |
| B2 | **High** | Cart's own "save 10%" link dead-ends on a **blank Step 0** | `Cart.tsx:244` → `/subscribe?fromCart=1`; `Subscribe.tsx:217` `showChooser = !effectivePlan && !fromCart` → both branches false → `renderS1Recommendation` returns `null` |
| B3 | **Crit** | SubscriptionBridge "Start my 6-week plan" configures a 1-week plan with dead params | `SubscriptionBridge.tsx:124` passes `slots/daysMode/duration` (never read anywhere) + `cadence=weekly` (=1-week per `CYCLE_WEEKS`), label says 6-week |
| B4 | **High** | Two persistent bottom navs at the same fixed rect, conflicting IA | `BottomNav.tsx:329` (z-40, Eat/Plan/Orders/Community/Account) + `theme.css:218` `.bdock` (z-60, Home/My Plans/Track/Healthy) both `fixed bottom-0`; both mount on `/`,`/menu`,`/orders`,`/account`,`/subscriptions`,`/recipes`,`/challenges` (`root.tsx:299,301`) |
| B5 | **High** | Home can show two "checkout" bars at once | `Home.tsx:148` `StickyBottomBar` (→builder mode on non-empty cart, z-900) + `root.tsx:300` global `StickyCheckoutBar` (z-45, visible on `/`) overlap in the 58–72px band |
| B6 | **Med** | CheckoutStepper can never show "Review" as current | `Checkout.tsx:1714` `stepperStep = confirmOpen ? "payment" : "address"` — binary; sits on "Delivery" during the review scroll |
| B7 | **Med** | "View Program" CTA drops into the same purchase wizard as "Start" siblings | `HomePricing.tsx:44-54` |

---

## C. Mobile app (`artifacts/tanmatra-mobile`) — fabricated state & a non-commerce shell

| # | Sev | Instance | Evidence |
|---|---|---|---|
| C1 | **Crit (LIVE)** | Fake "Connected · Last sync 2 mins ago" | `index.tsx:140` `isConnected` defaults `true`; `:143-146` fabricates `lastSyncedAt = now`; `:127-130` `relativeTime()` **hardcodes "2 mins ago"**, ignoring its arg; rendered `:695-698` with a "Disconnect" button — for a user who never connected. Real typed `WearableLink{connected,lastSyncedAt}` from `GET /wellness/today` exists and is ignored |
| C2 | **Crit (LIVE)** | Pairing "succeeds" with zero server validation; recovery points at the wrong domain | `index.tsx:288-314` accepts any `length>=8` string, writes SecureStore, fires `pairing_success` + success haptic **before any network call**; `:643` tells users to open **`tanmatra.health/...`** — the real domain is **`tanmatra.food`** (`app.json:40`, ~120 refs) |
| C3 | **Crit (LIVE)** | Value-prop bait-and-switch: the shipped app is not a meal app | grep of `index.tsx` for `meal|menu|cart|subscribe|checkout|dish` → **0 hits**; only a wearable-pairing/sync utility; no standalone signup — the sole entry is pasting a web-generated token |
| C4 | **High (LIVE)** | Pull-to-refresh + sign-out cache-clear are no-ops | `index.tsx:212-214` `refreshAll` only `setRefreshing(false)` (never set true); `:216` `queryClient = {clear:()=>{}}` shadows the real provider |
| C5 | **High (LIVE)** | Live screen bypasses the design system; ships a 3rd palette | `index.tsx:19-29` inline `c` (emerald `#10b981`, bg `#09090b` ≠ the app's own `#050505`); never imports `constants/colors` (whose primary is sage `#7D9E7E`) |
| C6 | **Med** | `constants/colors.ts` still ships retired tokens | `:13-16` `gold #D4AF37` / `blue #6BA3C8` — "retired on web, alive on mobile" |
| C7 | **High (DEAD-latent)** | 3 unmounted components carry false claims | `HyperlocalHeader.tsx:56,71` "32 MINS"/"25–40 mins" (vs web "40–45 min") + fake "Use Live Device GPS" that never uses GPS (`:112`); `MenuCard.tsx:42-44` hardcoded plan prices + invented "25% off"; `:72` **"RD Advisory Board Verified"** — the exact string `scripts/verify-honest-claims.ts` exists to fail the build on, but the gate doesn't scan the mobile package; `ProtocolSwitcher.tsx:93,96` fake "Garmin & Apple Watch Sync Active / Biometrics Updated 11:00 AM" (no Garmin integration exists) |
| C8 | **Low** | A go-live QA doc certifies mobile features that don't exist | `audit/golive-readiness/tanmatra_cro_wearable_qa_matrix.md` §6 grades PASS on components with 0 repo matches |

---

## D. Fix architecture (elite standard — one source, derived everywhere, regression-locked)

1. **Canonical basis** — each `RdPlan` declares `defaultMealsPerWeek` + `defaultCadence` (+ `slots`/`daysMode` that produce it); one `TRIAL_MEALS` constant. Every price on every surface = `computeDeliveryPricePaise(plan.defaultCadence, plan.defaultMealsPerWeek)` / `computeTrialPricePaise(TRIAL_MEALS)`. Delete `PLAN_FROM_PRICE_PER_WEEK_PAISE`; stop reading `pricePerWeekPaise` for UI.
2. **Subscribe inherits** the plan's canonical basis on `?plan=`/`?protocol=` (kill the `!directPlan` bypass); fix the monthly `cycleMeals` overcharge and the `?fromCart=1` blank screen.
3. **Derived discount copy** — `MAX_CADENCE_DISCOUNT_PCT` / `cadenceDiscountPct()` (added to `pricing.ts`); no literal "%".
4. **Regression test** — assert card price == wizard-default price per slug, one trial value everywhere, no legacy-constant reads. The test that would have caught this.
5. **Flow/nav + mobile** fixes per §B/§C.

### Business decisions required before pricing values are final (flagged for the review gate)
- **D-1 Trial size:** is a "3-Day Trial" **3 meals (₹1,499)** or **9 meals (₹5,316)**? Today it *bills* 9 (₹5,316); one surface advertises ₹1,499. Default taken: match billing (9/₹5,316) unless the intent is a discounted 3-meal acquisition offer.
- **D-2 Per-plan weekly meal count:** cards imply weight-loss=5, pcos=5, lean-muscle=10, healthy-everyday=5. Confirm; set diabetic/senior/low-fodmap (no card) default = 5.
- **D-3** Deprecate legacy `pricePerWeekPaise` for pricing (recommend yes; keep as display-only `calorieTarget`-style metadata or remove).

---

## E. Copy-vs-behavior contradictions (lane 4)

### ⛔ E1 — MOST SEVERE: the "one-time, no auto-renewal" trial silently registers a **live recurring UPI Autopay mandate** (Critical — money + regulatory)

Six surfaces promise the 3-Day Trial does **not** auto-renew — `HomeDualFunnel.tsx:64`, `HomeFAQ.tsx:23-24`, `HomePricing.tsx:24`, `GoalPlanChooser.tsx:68`, `MetabolicLandingView.tsx:402`, `SubscriptionPlansLanding.tsx:248,580` — and the wizard **hides** the Autopay disclosure for trials (`Subscribe.tsx:1611` `{!isTrial && …}`). But the trial's cadence is hardcoded `"weekly"` (`Subscribe.tsx:446`) and the mandate machinery keys **only on cadence, never on trial state**:
- `payments.ts:191` — `if (sub.cadence === "weekly" || "fortnightly") isRecurring = true` → **trial enters the recurring branch**
- `payments.ts:214-221` — attaches a Razorpay recurring token (auth_type otp, **10-yr expiry, max ₹15,000**)
- `payments.ts:383` — `registerAutopayMandate(...)` fires unconditionally after trial payment
- `razorpayRecurring.ts:106-148` — inserts an **active** mandate, `nextChargeAt = now + 7 days`
- `chargeMandateScheduler.ts:41-62` — sweeps active mandates and **charges** them; no trial exclusion

**A customer told "one-time payment, does not auto-renew" is given a live recurring debit authorization that a scheduler will attempt to charge in 7 days.** This is the top-priority fix (undisclosed recurring authorization). *(Backend logic, but customer-money impact — surfaced here regardless of scope.)*

### E2 — Delivery-time promise is incoherent and inconsistent (Critical/High)
- **Incoherent with the product:** "Cooked fresh… 40–45 minutes" / "fired only after you order" (`HomeHero.tsx:80`, `FreshVsColdModule.tsx:24,29`, `MetabolicLandingView.tsx:93,401`) vs. the **same** `?trial=1` flow being a scheduled booking — `Subscribe.tsx:250` startDate = today+2, `:339` "24-hour kitchen preparation window", `:1647` CTA "Pay … **and Start Monday**". Two mutually exclusive fulfillment models one click apart. **Crit.**
- **Three live numbers:** Hero "40–45" vs `Menu.tsx:634` / `Checkout.tsx:1797` / `Premium.tsx:135` "**25–40 min**" vs the homepage's own `Home.tsx:6` meta description "25–40 minutes" (contradicts its own H1). Plus static fallbacks: `Checkout.tsx:1151` flat **25 min**, `ZenTracker.tsx:18` **20 min**. Dead components `TrustHeader.tsx:104`/`MetaDishCard.tsx:49` still say "25–40" — proof of a half-finished migration to "40–45". **High.**

### E3 — Delhi/Gurgaon advertised but **only 8 Noida pincodes are serviceable** (Critical)
Header city-switcher `HomeHeader.tsx:26` `SERVED_CITIES = ["Noida","Delhi","Gurgaon"]` (selecting Delhi persists + renders "Now serving Delhi"), footer `HomeFooter.tsx:47` "Delhi, Noida, and Gurgaon", `SubscriptionPlansLanding.tsx:136`, `Checkout.tsx:1797` — all vs `serviceablePincodes.ts:19-29` = **8 Noida pincodes only**, everything else rejected (`:43`). Self-contradicted in one file: `SubscriptionPlansLanding.tsx:136` "Delhi·Gurgaon" vs `:585` FAQ "Across Noida." (Matches commit `88fa5bc "restrict delivery to Noida only"`.) A user can pick Delhi/Gurgaon in nav, then be rejected at checkout.

### E4 — Hardcoded macro claims 2–4× overstated on the primary conversion rail (High)
`HomeRecommendedPlans.tsx:26` `macrosText: "Avg 32g Protein · 25g+ Fiber"` (and `:35` "45g", `:44` "34g") are **static literals, no data dependency** — but the plan's real rotation (`rdPlans.ts:78-91` → `menu-catalog` dishes) averages **~14.8g protein / 6g fiber** per lunch; even a full day ≈36g/12g, under the plan's own `proteinTargetGrams:90` / "25g fibre/day" (`rdPlans.ts:66-71`). The same app does this **honestly** elsewhere — `HomeProofStrip.tsx:55-65` dynamically finds a real dish ≥32g. The conversion rail does not.

### E5 — "Anytime" without the 24h qualifier on commit-adjacent CTAs (High)
Enforced `SKIP_SWAP_CUTOFF_MS = 24h` (`subscription-rules/index.ts:15`) is honored in some copy (`Subscribe.tsx:1487`, `SubscriptionPlansLanding.tsx:163`) but dropped next to commit CTAs: `HomePricing.tsx:35,64`, `HomeTrustWall.tsx:37`, `Subscriptions.tsx:1466` (above "Continue"), `Checkout.tsx:2099`, `GoalPlanChooser.tsx:75`.

### E6 — Discount overstatement (Critical) — confirms A7/A8
`Checkout.tsx:2098` "save up to 15%", `Cart.tsx:244` "save 10%", `Subscriptions.tsx:1467` "save up to 15%" for the **weekly** cadence, which the engine fixes at **5%** (`pricing.ts:26`) — correctly labeled in the cadence selector itself (`Subscribe.tsx:1079-1080`). 2–3× overstatement at the commitment moment.

### ✅ Cleared (checked, no contradiction)
Free-delivery scoping (à-la-carte ₹500 threshold vs subscription "free" — correctly scoped); FSSAI `22725926001018` + ISO 22000 consistent everywhere; Dr. Anjali Nair "17 yrs / PhD AIIMS" matches `teamData.ts`; `HomeSocialProof` renders only real `/dish-reviews` data, nothing fabricated.

---

## Severity roll-up (all 4 lanes)

**Critical (money / regulatory / charged-at-checkout):** E1 trial auto-renewal mandate · A1 `?plan=` basis (₹3,800→₹10,474) · A2 monthly 2.6× overcharge · A3 trial priced 3 ways · A4 ₹260 ghost · A5/A6 legacy-field pricing · A7/E6 discount overstatement · E2 delivery-model incoherence · E3 serviceability false coverage · B1 pay-CTA label · B3 SubscriptionBridge · C1/C2/C3 mobile fabricated state/pairing/bait-switch.
**High:** A8/A9, B2/B4/B5, C4/C5/C7, E4/E5.
**Med/Low:** A10/A11, B6/B7, C6/C8.
