# Stitch Design Coverage Map — Tanmatra

**Purpose.** Verify that every customer/ops journey (CUJ) in the tanmatra app is covered by a Stitch design screen, list the components/routes **not yet designed**, and record the data-integrity standard the rendered screens must uphold.

**Sources.**
- App routes: `artifacts/tanmatra/src/routes.ts` (88 route entries).
- Stitch designs: project **"Tanmatra Premium Home"** (`projects/9545397915295144685`) on the **Nocturnal Nourishment** design system — **127 unique meaningful screens** (prototype/junk frames excluded).
- Rendering status: `/stitch/menu`, `/stitch/dish`, `/stitch/allergen-gate` are the screens **built to production** so far; the rest are designed-but-not-yet-ported.

Legend: **✅ designed** · **◑ partial** (hub/state designed, a sub-screen missing) · **❌ gap** (no Stitch screen) · **⟳ design-ahead** (Stitch screen exists, no app route yet).

---

## 1. Core commerce CUJ — Browse → Dish → Cart → Checkout → Track

| App route / component | Stitch design(s) | Status |
|---|---|---|
| `/` Home | Home (Populated) · Home (Loading) · Home (Error) · iOS Premium Home | ✅ + states |
| `/menu` Menu | Menu (Populated) · Menu (Asymmetric & iOS Refined) · Menu (Loading Skeleton) | ✅ **ported** + states |
| `/dish/:slug` PDP | Dish Detail (Populated / Customise / Variant Swapping / Loading) · PDP Interaction & Macro Analysis · PDP Trust & Recommendations · Premium PDP Hero & Stats · Nutrition Deep Dive Sheet | ✅ **ported** (Customise) |
| `/cart` Cart | Cart Drawer (Empty / Populated / Minimum Nudge) · Cart Drawer Summary | ✅ all states |
| `/checkout` Checkout | Checkout (Tier P0 Refined) · Refactored Checkout Summary · Address Entry / Map Picker / Manual Fallback · Payment Selection · Payment Processing Sheet · Refactored/Secure Payment Redesign | ✅ decomposed |
| `/track/:orderId` ZenTracker | Order Tracker: Placed / Preparing / Out for Delivery / Delivered · ZenTracker (Loading Skeleton) | ✅ full lifecycle |
| `/order/confirmed/:orderId` | Order Success Confirmation | ✅ |
| `/orders` Order History | Order History · Order History (Empty State) | ✅ |
| Allergen safety gate (checkout) | Clinical Allergen Gate · Allergen Acknowledgment Sheet | ✅ **ported** (gate) |
| Meal rating (post-order) | Meal Review & Rating | ⟳ design-ahead (no route wired) |

---

## 2. Subscription / plan CUJ

| App route / component | Stitch design(s) | Status |
|---|---|---|
| `/subscribe` Subscribe | Premium Subscription Plans · Duration / Frequency / Program / Price Review Redesign | ✅ (multi-step) |
| `/subscription-plans` landing | Subscription Plans Landing | ✅ |
| `/subscriptions` My Plans | My Plans (Empty State) · Plan Settings · Modify Commitment | ✅ |
| `/meal-planner` WeeklyPlanner | Weekly Planner (Active) · Metabolic Calendar & Delivery Schedule · Meal Swap Selection (+ Drawer) · Meal Preview Redesign · Skip Day Confirmation · Modification Confirmed | ✅ rich |
| `/account/plan` | Plan Settings | ✅ |
| `/trial/:id` TrialStub | Program Overview Redesign (closest) | ◑ partial |
| `/subscription/bridge` (à la carte→trial) | — | ❌ **gap** |
| `/account/billing` Billing | — (Subscription Analytics is ops-only) | ❌ **gap** |

---

## 3. Onboarding / preferences / clinical profile CUJ

| App route / component | Stitch design(s) | Status |
|---|---|---|
| `/preferences` intake | Allergens & Exclusions (+ Assessment) · Dietary Style Assessment · Cuisine Preferences Assessment · Goals & Activity Selection · Assessment Results Recommendation | ✅ full assessment flow |
| `/account/health-information` | Health Information & Privacy · Clinical Profile & Baseline · Upload Lab Results · Lab Result Detail · Metabolic Labs Overview | ✅ |
| `/login` | Login: Phone Entry · Login: OTP Verification | ✅ |
| `/account` Account | Account & Profile · Account & Clinical Profile · Completion & Account Drawer | ✅ |
| `/account/addresses` | Saved Addresses | ✅ |
| Change health goal | Change Health Goal · Health Goal Management | ✅ |

---

## 4. Health-tracking / wearables CUJ

| App feature | Stitch design(s) | Status |
|---|---|---|
| Wearable sync | Smart Watch Sync · Wearable Sync Dashboard · Sync & Connection Status Dashboard | ✅ (route: partial — health-info) |
| Biometric trends | Biometric & Body Composition Trends · Glucose Stability Detail · Nutrient Trend Overview · Weekly Nutrition Scorecard | ⟳ design-ahead (no dedicated routes) |
| Journals / adherence | Digestive & Energy Journal · Clinical Adherence Summary · Daily Performance Report · Metabolic Performance Overview · Post-Feedback Calibration Summary | ⟳ design-ahead |

---

## 5. Dietitian / consultation / community CUJ

| App route / component | Stitch design(s) | Status |
|---|---|---|
| `/rd`, `/rd/:slug` | Dietitian Clinical Profile · Dietitian Consultation Profile · Select Dietitian | ✅ |
| `/plans`, `/plans/:slug` | Dietitian Marketplace & Plans · Clinical Plan Detail (Standardized) · Dietitian-Signed Guide: PCOS Management | ✅ |
| `/appointments`, `/checkout-appointment` | Consultation Hub · Choose Timeslot · Confirm Booking · Post-Booking Preparation | ✅ |
| Dietitian messaging | Dietitian Messaging | ⟳ design-ahead (no messaging route) |
| `/group/:code` GroupOrder | Team Group Order Lobby · Refined Team Group Order Lobby | ✅ |
| `/rewards` | Metabolic Rewards Center · Loyalty Tiers & Benefits · Metabolic Rewards & Challenges | ✅ |
| `/challenges`, `/challenges/:slug` | Metabolic Rewards & Challenges (hub) | ◑ detail partial |
| `/vouchers` | Referral Hub: Clinical Gift Credit (closest) | ◑ partial |
| `/recipes`, `/recipes/:slug` | Metabolic Cookbook: Editorial Index · Recipe: Wild Salmon & Quinoa Grain Bowl · 404: Recipe Missing | ✅ |
| `/marketplace`, `/marketplace/:slug` | Metabolic Marketplace: Supplements & Snacks | ✅ |
| `/team`, `/team/:slug` | Dietitian Clinical Profile (RD team) | ◑ partial |
| `/rd-console` (RD console) | — (AI Agent Console is admin) | ❌ **gap** |

---

## 6. Corporate / partners CUJ

| App route / component | Stitch design(s) | Status |
|---|---|---|
| `/corporate`, `/corporate/:slug` | Corporate Performance Hub · Corporate Verification Gate / Hub | ✅ |
| `/corporate/:slug/lunch-planner`, `/office-lunch/:id` | — | ❌ **gap** |
| `/corporate/invite/:token` | Corporate Verification Gate (closest) | ◑ partial |
| `/partners/gyms`, `/partners/fitness-clubs` | Gyms & Fitness Landing | ✅ |
| `/rd-partners`, `/rd-partners/apply` | — | ❌ **gap** |
| `/premium` | iOS Premium Home · Premium PDP Hero & Stats | ✅ |

---

## 7. Ops / admin CUJ (designed — surprising depth)

| App route | Stitch design(s) | Status |
|---|---|---|
| `/admin/kds` | Kitchen ERP: Live KDS Queue · Kitchen ERP: Final Clinical Sign-off | ✅ |
| `/admin/supplier`, logistics | Logistics: Cold-Chain Console | ✅ |
| `/admin/cms-agent` | Clinical CMS & Content Sandbox | ✅ |
| `/admin/ops-agent`, `/admin/ai-runs` | AI Agent Execution Console | ✅ |
| `/admin/sales-console`, `/admin/sales-console/:slug` | Sales & Subscription Console | ✅ |
| `/admin/analytics`, `/admin/forecasting` | Subscription Analytics Dashboard | ◑ partial |
| `/admin/menu-engineering`, `/admin/compliance`, `/admin/moderation`, `/admin/support-tickets`, `/admin/rd-applications` | — | ❌ **gap** (5 admin surfaces) |

---

## 8. Legal / marketing / system

| App route / component | Stitch design(s) | Status |
|---|---|---|
| `/terms`, `/privacy` | Privacy Policy & Terms | ✅ |
| `/faq` | FAQ & Support Hub · Trust & FAQ Ecosystem | ✅ |
| `/clinical`, `/wellness`, `/performance` | Clinical Landing Page · Metabolic Performance Overview | ◑ partial |
| `/refunds` | — | ❌ **gap** |
| `*` not-found | 404: Recipe Missing (recipe-specific only) | ◑ partial |
| Global toasts / validation | Global Alerts & Toasts Library · Validation & Interaction States | ✅ (design-system) |

---

## 9. GAP LIST — app components/routes with NO Stitch design (the "not yet designed")

> **These routes are all implemented and wired** (a v2 component or a `pages/*` wrapper serves each one, plus a working `pages/not-found.tsx` for `*`). The gap here is a **design + data-integrity** gap, not a missing screen: none has a dedicated Nocturnal Nourishment Stitch design, and — because they were never part of the Stitch porting — none has been through the honest-health-data rendering pass in §10. So the work to "close" these is (a) design them in Stitch and (b) verify/align them to the §10 standard, **not** build them from scratch. The only genuinely un-routed items are the design-ahead screens listed at the bottom.

**Customer-facing:**
1. `/subscription/bridge` — à la carte → trial bridge (Phase C2/C4)
2. `/account/billing` — billing/invoices
3. `/refunds` — refund policy/flow
4. `/corporate/:slug/lunch-planner` + `/office-lunch/:id` — corporate lunch planning
5. `/rd-partners` + `/rd-partners/apply` — RD partner landing + application wizard
6. `/rd-console` — dietitian-facing console
7. `/challenges/:slug` — challenge detail (only the hub is designed)
8. `/vouchers` — voucher wallet (only referral-credit is designed)
9. `*` generic 404 (only the recipe-404 variant exists)

**Ops/admin:**
10. `/admin/menu-engineering`, `/admin/compliance`, `/admin/moderation`, `/admin/support-tickets`, `/admin/rd-applications` — 5 admin consoles undesigned.

**Design-ahead (Stitch screen exists, no app route yet — build opportunities):** Meal Review & Rating · Meal Comparison Tool · Dietitian Messaging · Biometric/Glucose/Nutrient trend dashboards · Digestive & Energy Journal · Daily Performance Report · Clinical Adherence Summary · Post-Feedback Calibration Summary.

---

## 10. Data-integrity standard (non-negotiable, for every ported screen)

Every screen rendered from a Stitch design **must** uphold honest health-data rendering — verified and CI-enforced:

- **Allergens** via `getAllergenDisclosure()` — an empty/unreviewed list is **"unverified — held for safety"**, never "safe/none" (fail-closed). Enforced by `verify-allergen-gate` (G9) + the runtime strict gate.
- **Macros** hidden when `macrosAreProvisional()`, prefixed `~` / "Est." when `macrosEstimated`. No number shown the record can't back.
- **No unbacked "RD Verified" badge** — removed app-wide (no dish has a reviewer record); enforced by `verify-honest-claims` (CI fails if it returns).
- **Prices** from the dish record (paise); enforced by `lint:prices` (no `₹NNN` literals).
- **Colours** from `@theme` tokens; enforced by `lint:colors` (no hex).

**Coverage summary:** of the app's core CUJs (commerce, subscription, onboarding, dietitian, corporate, ops), **all major flows have Stitch designs**; the gaps are **~10 customer routes + 5 admin consoles** (§9) plus a set of design-ahead health-tracking screens to route. Three screens are ported to production; the rest await porting onto the same honest-rendering, token-backed foundation.
