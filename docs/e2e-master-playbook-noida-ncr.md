# Tanmatra — E2E Master Playbook: Hyper-Local Growth, Noida & Delhi NCR

**Version:** 1.0 · **Date:** 2026-07-20 · **Scope:** Live platform (tanmatra.food) + monorepo audit → 8-part actionable blueprint
**Evidence base:** Full repo audit (funnel, design system, backend/telemetry), live-site index, and a 107-agent adversarially-verified research pass (13 surviving high-confidence findings + a second primary-source gap-fill round). Every external number in this document carries a grade: **[V]** verified against a primary source, **[S]** secondary source, **[D]** directional/planning-grade only.

---

## Part 0 — Audit Delta: What the Brief Assumed vs. What the Code Says

The three named UX debts are real but **mislocated**. Fixing them where they actually live is cheaper and higher-impact than a blanket refactor.

| Assumed debt | Audit finding | Actual priority |
|---|---|---|
| **State Amnesia** (back-button resets wizards) | Already remediated in `Subscribe.tsx`: 7-step wizard with `sessionStorage` draft (`tanmatra:subscribe-draft:v1`), `?step=` URL mirroring, and `popstate` handling — back and refresh both survive (`tanmatra-v2/Subscribe.tsx:151,291-352`). **Not** remediated in `Checkout.tsx`: all form fields (slot, instructions, guest phone) are in-memory `useState` only; refresh loses them. `IntakeQuiz` has a 7-day draft but no URL-step persistence. | Port the Subscribe pattern to Checkout + IntakeQuiz + RdPartnersWizard (Part 2, R1). |
| **Phantom Pricing** (hidden totals) | Cart and Checkout both already render always-visible itemized ledgers + sticky mobile pay bars (`Checkout.tsx:1792-2131`, `Cart.tsx:224-260`). The real money bug is a **unit-price contradiction**: SubscriptionPlansLanding advertises **₹260/meal** (`SubscriptionPlansLanding.tsx:52`) while the Subscribe builder prices **₹750/meal** (`Subscribe.tsx:52` `PER_MEAL_PAISE = 75000`). Stitch checkout also hardcodes ₹40 delivery. | Kill hardcoded price literals; single server-quote source of truth (Part 2, R4). |
| **Invisible Interactions** (no active states) | 98 `active:`/`aria-pressed`/`aria-selected` hits across 38 files — coverage is broad. The debt is **fragmentation**: three coexisting selected-state idioms (`.opt on` CSS classes in Checkout/Cart, inline `style={{}}` conditionals in Subscribe, Tailwind conditionals on landing pages). Home rails have no active states. | One `data-state` token idiom (Part 2, R3). |

**New conversion-critical findings the brief did not know about:**

1. 🐛 **Dead onboarding rung** — `SoftGate.tsx` (the designed 15-second first-touch profiler) is fully built but **never mounted**. Because `OnboardingQuizGate` suppresses its "Personalize your menu" banner until `isSoftGateResolved()` is true, and only the unmounted SoftGate ever writes that key, **the quiz-nudge banner is permanently suppressed for nearly all users**. Highest-leverage single fix in this document.
2. **B2B lead leak** — Gyms/fitness-club landing CTAs hand off to a prefilled `wa.me` link; no lead is ever captured in the system — while the backend ships a complete corporate stack (companies, budgets, invites, subsidies, office orders, vouchers, QBR generation) that the acquisition funnel never feeds.
3. **Write-only telemetry** — a typed ~90-event first-party taxonomy already exists (`src/lib/analytics.ts` → `POST /events` → `funnel_events`), but `funnel_events` is excluded from the admin analytics safe schema and no job aggregates it. Rich capture, zero reporting. Mobile tracker is a `console.info` stub.
4. **Three divergent design languages** — legacy `tnm2` Clinical Dark (live funnel), Nocturnal Nourishment `nn-*` (all v2 retention screens + quarantined `/stitch/*` previews), and a third drifted mobile palette (`#D4AF37`/`#6BA3C8` retired on web, alive on mobile, plus an inline green palette in `app/index.tsx`). No shared token package.
5. **Stitch migration ≈ 0% cut over** — 5 polished `/stitch/*` screens with the target aesthetic (rounded-3xl, backdrop-blur, `active:scale`, 44px targets) but dead CTAs and a preview-only cart store.
6. ⚠️ **Compliance flag** — consumer `user_preferences` clinical fields (HbA1c, PCOS history, medical conditions) are stored **plaintext**; only subscription-member clinical arrays go through the AES-256-GCM KMS envelope. Extend the envelope before scaling clinical acquisition (DPDPA exposure).
7. **No push infrastructure** — retention messaging = WhatsApp/SMS (Twilio, built) + SMTP email. The marketing plan (Part 6) and retention loops (Part 5) are therefore **WhatsApp-first by architecture**, which conveniently matches NCR consumer behavior.

**Verified market whitespace (research round 1):** NCR healthy-meal incumbents — 6meal (₹842/day Health Support, thyroid/PCOS/diabetes positioning, Delhi kitchens) [V], ParaFit (fitness-positioned, free nutritionist call, 7–11 AM drop) [V], OJO Life (goal-based only, zero condition-specific plans) [V] — all deliver as a **single blast-chilled morning drop** and none claims clinical-grade governance. Mumbai's Calorie Care proves the condition-specific dietician-led model but does not operate in NCR [V]. **Tanmatra's "cooked fresh, delivered hot in 40–45 min, RD-signed" promise is uncontested in Noida.** That contrast — *fresh-hot vs. cold-chain* — is the spine of Parts 1, 3, 6, and 7.

---

## Part 1 — The Ideal Homepage Layout & Structure

### 1.1 Scroll Architecture for the new `Home.tsx`

Current order (audit): Header → Hero → Recommended Plans → Meals Rail → Featured Meal → How It Works → Trust Wall → Pricing → Dietitian → FAQ → Footer. Two structural gaps vs. strategy: **no B2B entry point anywhere** and **no human social proof** (the live site has zero testimonials).

**Target scroll architecture** (mobile-first, 480px column retained; full-bleed moments marked ◆):

```
┌──────────────────────────────────────────────────────────────┐
│ S0  HomeHeader (sticky, glass)                               │
│     "Serving Noida · Sector {n}" pincode chip — tappable     │
├──────────────────────────────────────────────────────────────┤
│ S1  ◆ HERO — dual-promise                                    │
│     H1: "Clinical nutrition. Cooked fresh,                   │
│          at your desk in 40–45 minutes."                     │
│     Sub: "RD-signed meals for your health goal — never       │
│          blast-chilled, never a 7 AM cold drop."             │
│     [Browse Menu]  [Help Me Choose →  60-sec quiz]           │
│     Live proof chip: "🔴 Kitchen live · Sector 63 ·          │
│          avg delivery today 42 min" (from ETA model)         │
├──────────────────────────────────────────────────────────────┤
│ S2  CLINICAL PROGRAMS band (2×2 → horizontal rail)           │
│     Weight Loss · Muscle Gain · Diabetic-Friendly · PCOS     │
│     Each chip → /plans/:slug (existing routes)               │
├──────────────────────────────────────────────────────────────┤
│ S3  PROOF-OF-PRECISION strip (NEW)                           │
│     3 tiles, tabular-nums: "32g protein ±2g verified" ·      │
│     "Low-GI, sugar impact signed off" · "ISO 22000 kitchen"  │
│     → opens NutritionLabelModal on tap                       │
├──────────────────────────────────────────────────────────────┤
│ S4  MEALS RAIL (existing HomeMealsRail, keep)                │
│     + add active/pressed states to cards (Part 2 R3)         │
├──────────────────────────────────────────────────────────────┤
│ S5  ◆ FRESH-VS-COLD contrast module (NEW — the differentiator)│
│     Split panel: "Their way: cooked 5 AM, chilled, reheated" │
│     vs "Tanmatra: fired when you order, sealed hot, 40–45'"  │
├──────────────────────────────────────────────────────────────┤
│ S6  HOW IT WORKS (existing 3 steps, keep, tighten copy)      │
├──────────────────────────────────────────────────────────────┤
│ S7  SOCIAL PROOF (NEW — currently absent)                    │
│     a) Outcome cards: "HbA1c 8.1→6.9 in 12 weeks, with her   │
│        RD" (real, consented, FSSAI-safe framing — Part 7)    │
│     b) Logo strip: "Delivered daily inside Candor TechSpace, │
│        Advant Navis, Stellar 135…" (delivery-destination     │
│        framing, not client-endorsement framing)              │
│     c) Rating aggregation from dish_reviews (backend exists) │
├──────────────────────────────────────────────────────────────┤
│ S8  RD-GOVERNANCE band (existing HomeDietitian, elevate)     │
│     Dr. Anjali Nair + "Every plate signed off for sodium,    │
│     blood-sugar impact and fats" + [Book free 15-min consult]│
├──────────────────────────────────────────────────────────────┤
│ S9  DUAL-FUNNEL SPLIT (NEW)                                  │
│     ┌───────────────────────┬───────────────────────┐        │
│     │ FOR YOU               │ FOR YOUR TEAM         │        │
│     │ 3-Day Trial ₹___      │ "Subsidized RD-grade  │        │
│     │ no auto-renewal       │ lunches for Noida     │        │
│     │ [Start Trial]         │ teams" [Get a pilot →]│        │
│     └───────────────────────┴───────────────────────┘        │
│     Right card → /corporate-wellness LP (Part 3.3)           │
├──────────────────────────────────────────────────────────────┤
│ S10 PRICING (existing HomePricing: Trial / Weekly / 6-Week)  │
│     Rule: per-meal price MUST come from the quote API (R4)   │
├──────────────────────────────────────────────────────────────┤
│ S11 FAQ (existing) → S12 FOOTER (existing, add corporate link)│
│ S13 StickyBottomBar (existing, context="homepage")           │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Hero — copy system

| Element | Copy | Rationale |
|---|---|---|
| Eyebrow | `Now serving {city} · {pincode}` | Already localStorage-driven (`HomeHero.tsx:70`); add pincode for hyper-local signal |
| H1 (A) | **"Clinical nutrition. Cooked fresh, at your desk in 40–45 minutes."** | Fuses both value props; "desk" speaks to the Sector 62/132 lunch occasion |
| H1 (B, test) | **"Food your doctor would sign off. Delivered hot in 45."** | Authority frame; A/B once experiment assignments exist (Part 8) |
| Subhead | "Dietitian-designed for your health goal — fired when you order in our ISO-22000 Noida kitchen. Never blast-chilled, never reheated." | Direct verified contrast: every NCR incumbent does a single cold morning drop [V] |
| CTA-1 | `Browse Menu` → `/menu` | Keep |
| CTA-2 | `Help Me Choose` → IntakeQuiz | Keep; becomes the primary quiz gateway (Part 4) |
| Proof chip | "Avg delivery today: 42 min · Sector 63 kitchen" | Wire to `etaModel`; honesty > slogan (kill it on bad days rather than fake it) |

### 1.3 Credibility & dual-funnel rules

- **RD-advisory band (S8)** is the trust anchor: named RD, credentials, the sign-off quote, free 15-min intro consult CTA (booking flow already live: `/rd` → `/rd/:slug` → `/checkout-appointment`).
- **Social proof (S7)** must be built from assets that exist in the system: `dish_reviews` and `nps_responses` tables are live — surface aggregate rating + verbatims (consented). Outcome claims must follow Part 7 FSSAI guardrails (no cure/treat language; "with her RD" framing keeps it a service outcome, not a food claim).
- **Dual funnel (S9)**: B2C path = 3-Day Trial (lowest-commitment, no auto-renewal — already true, say it loudly). B2B path = one card, one promise, one CTA into the Corporate Wellness LP; never more than one screen of B2B on the consumer homepage.
- **Delivery-area honesty**: the pincode chip opens the serviceability check; out-of-zone users get a waitlist capture (`lead` event) instead of a dead end.

---

## Part 2 — UX/UI Global Ruleset & Refactor Plan

### 2.1 Global rules (R1–R10) — binding for all new frontend work

**R1 — Wizard state is a contract, not a component detail.**
Every multi-step flow MUST persist: (a) step index in the URL (`?step=`), (b) draft state in `sessionStorage` under a versioned key (`tanmatra:<flow>-draft:v1`), (c) rehydrate-on-mount, (d) `popstate` walks steps, (e) clear-on-success. `Subscribe.tsx` is the reference implementation (`:151,291-352`). **Refactor:** extract it into `src/lib/useWizardState.ts` and adopt in:
- `Checkout.tsx` — persist slot, fulfillment, instructions, guest phone (today in-memory only).
- `IntakeQuiz.tsx` — add `?quiz-step=`; keep the existing 7-day TTL draft.
- `RdPartnersWizard.tsx`, `PostCheckoutWizard.tsx`.
Also: either make Checkout's 3-step `CheckoutStepper` real (gate sections by step) or delete it — a stepper that doesn't step erodes trust in every other stepper. Recommendation: keep single-scroll on desktop, real 3 steps on mobile.

**R2 — Bottom sheets: one primitive, HIG-scoped.**
Adopt the shipped-but-unused `ui/drawer.tsx` (vaul) as the single bottom-sheet primitive; retire hand-rolled overlays (WeeklyPlanner `swapDialog`, Subscriptions swap/skip modals). Scope per Apple HIG (verified): **sheets are for simple, self-contained sub-tasks** — dish swap, portion pick, address pick, filter — at medium detent with grabber, `rounded-t-[24px]` (`--radius-sheet`), `backdrop-blur-md` scrim; **complex/prolonged flows (intake quiz, subscribe builder, checkout) get full-screen modal views, not sheets** [V: HIG Sheets/Modality]. Detents: medium ≈ half, large = full; medium-only caps expansion.

**R3 — Selected/pressed state: one idiom, tokenized.**
Kill the three-idiom split. All selectable components express state via `data-state="selected|unselected"` + `aria-pressed`/`aria-selected`, styled once globally:
```css
[data-state="selected"] { border-color: var(--action); background: var(--action-surface); }
.pressable { transition: transform var(--dur-fast) var(--ease-spring); }
.pressable:active { transform: scale(0.98); }
```
Minimum interactive affordance set: hover (desktop), `active:scale-[0.98]`, selected, focus-visible ring, disabled. 44×44px touch targets (Stitch screens already comply — make it global). Add the missing active states to Home rails (`HomeRecommendedPlans`).

**R4 — Money renders from one source.**
No component may hardcode a price. All price display flows from the server quote (`subscriptionsApi.quote` / `useCartTotals` / `finalizeOrder`'s `chargePaise`). **Immediate fixes:** delete `PER_MEAL = 260` (`SubscriptionPlansLanding.tsx:52`) and `PER_MEAL_PAISE = 75000` fallback (`Subscribe.tsx:52`) → fetch quote; delete `deliveryPaise = 4000` in `StitchCheckout`. This is also the money-path lockstep rule in `docs/AGENT_WORKING_AGREEMENT.md` — enforce with the no-hardcoded-price lint gate.

**R5 — The ledger is always on screen.**
Every paying surface shows a **sticky price ledger**: itemized on demand (expandable), total always visible, savings line always computed. Unify `V2MobilePayBar` + `StickyBottomBar` into one `<PriceLedger context="cart|builder|checkout">` primitive. Evidence: 39% abandon over surprise extra costs; 14% abandon because the total couldn't be calculated up-front [V: Baymard]. GST and delivery are shown from the first screen they are knowable — never introduced at payment.

**R6 — Checkout friction budget: ≤ 8 fields, guest-first.**
Baymard: average checkout is 5.1 steps/11.3 fields; ~8 fields suffice; 19% have abandoned over forced account creation [V]. Tanmatra keeps guest checkout with just-in-time OTP at Place-Order (already implemented — protect it as a rule). Any new checkout field must displace an existing one or justify itself against the 8-field budget.

**R7 — Haptics & kinetic feedback.**
- Web: `active:scale-[0.98]` + `--ease-spring` (already tokenized, `cubic-bezier(0.32,0.72,0,1)`); `navigator.vibrate(10)` on add-to-cart/step-complete where supported (Android Chrome; silently no-op on iOS Safari).
- Mobile (Expo): `expo-haptics` (installed) — `selectionAsync()` on selects, `notificationAsync(Success)` on order placed.
- Reduced motion: all kinetic effects behind `prefers-reduced-motion` guard; `.theme-clinical` (≤150ms motion, no gradients) remains available for clinical-mode users — this is a genuine accessibility differentiator, keep it.

**R8 — One design language: promote NN to the system, kill the forks.**
Decision: **Nocturnal Nourishment (`nn-*`) is the target system** (it's already what all v2 retention screens and Stitch previews render). Plan: (1) formalize `nn-*` + surviving semantic tokens into `lib/design-tokens` (a workspace package exporting CSS vars + a TS object), (2) consume it from web *and* mobile — fixing mobile's three-palette drift (`constants/colors.ts` still ships retired `#D4AF37`/`#6BA3C8`; `app/index.tsx` hardcodes a green inline palette), (3) migrate legacy `tnm2` funnel screens to NN as they're touched (Stitch cut-over below), (4) update `/__styleguide` per CLAUDE.md convention. Squircle geometry: `rounded-3xl` outer cards nesting to `rounded-xl` inner elements on new NN surfaces; token radii (`--radius-card/sheet`) remain the floor for legacy screens.

**R9 — Stitch cut-over is a wiring project, not a design project.**
The `/stitch/*` screens have the target aesthetic but dead plumbing. Cut-over order (risk-ascending): Menu → Dish Detail → Allergen Gate → Subscribe → Checkout. Rules: real `useCartStore` only (delete `stitchCartStore`), real quote API (R4), wizard contract (R1), telemetry parity (Part 8) before each screen flips. Delete `usePersonalisationStore` (orphaned dead store) as part of this cleanup.

**R10 — Z-axis discipline.**
Translucent overlays (`backdrop-blur-md`+) reserved for: sticky chrome, sheets/scrims, and the command palette. Content surfaces stay opaque (`--surface` inks) for text contrast (WCAG AA on the dark canvas). Use the existing z-index token scale; no ad-hoc z values.

### 2.2 Refactor sequencing (engineering plan)

| Phase | Work | Files touched | Risk |
|---|---|---|---|
| P0 (day 1) | Mount `SoftGate` OR remove its gate condition in `OnboardingQuizGate` so the quiz banner fires; delete dead store | `root.tsx`, `OnboardingQuizGate.tsx:65-68`, `usePersonalisationStore.ts` | Trivial, conversion-critical |
| P0 (day 1) | Kill ₹260/₹750 contradiction → quote API | `SubscriptionPlansLanding.tsx`, `Subscribe.tsx` | Money-path: lockstep rule, needs test |
| P1 (wk 1) | `useWizardState` extraction + Checkout adoption | `Subscribe.tsx`, `Checkout.tsx`, new lib | Medium |
| P1 (wk 1) | `<PriceLedger>` unification | `V2MobilePayBar`, `StickyBottomBar` | Medium |
| P2 (wk 2) | `data-state` selection idiom + Home rail states + vaul drawer adoption | global CSS, WeeklyPlanner, Subscriptions | Low |
| P3 (wk 3–6) | `lib/design-tokens` package; mobile palette unification; Stitch cut-over Menu→Dish | new package, `constants/colors.ts`, `/stitch/*` | Medium |
| P4 (wk 6+) | Stitch Subscribe/Checkout cut-over behind flag + telemetry A/B | `/stitch/*`, routes | High — gate on Part 8 dashboards existing first |

---

## Part 3 — Landing Pages Strategy & Architecture

Existing inventory (audit): `/subscription-plans` (D2C plans), `/clinical` + `/performance` (shared `Protocol.tsx`), `/wellness`, `/corporate` (thin), `/partners/gyms`, `/partners/fitness-clubs`, `/rd-partners`. The three NEW pages below slot into the gaps: intent-matched acquisition for (1) metabolic goals, (2) condition-specific care, (3) B2B HR buyers.

**Global LP rules:** every LP owns one audience, one promise, one primary CTA repeated 3×; hero CTA visible without scroll on 390×844; `landing_viewed` + section-scroll + CTA events instrumented (Part 8); price anchor shown vs. "₹800+/day cold-drop plans" market context [V: 6meal ₹842/day, OJO ₹800/day]; all condition copy passes the Part 7 FSSAI guardrails.

### 3.1 `/metabolic` — Metabolic Subscriptions (urban professionals: fat-loss / muscle-gain)

| # | Section | Content & components | Conversion gateway |
|---|---|---|---|
| 1 | Hero | "Your macros, engineered. Your lunch, in 45 minutes." Sub: 32g/45g protein programs, RD-calibrated. Reuse `Protocol.tsx` hero pattern; goal toggle chip `Fat loss ↔ Muscle gain` flips all numbers on page | **[Take the 60-sec assessment]** → IntakeQuiz (goal pre-seeded) |
| 2 | Pain mirror | 3 cards: "Cafeteria roulette" · "6 PM energy crash" · "Protein you can't verify" — Sector 62/132 commuter framing | — |
| 3 | Proof-of-precision | Macro-verified tiles (tabular-nums), sample nutrition label → `NutritionLabelModal` | — |
| 4 | Program cards | Weight-Loss Jumpstart / Lean Muscle Builder (existing `RD_PLANS` data) with per-week price from quote API | **[Start This Program]** → `/subscribe?plan=` |
| 5 | Week-1 preview | Dish carousel from `useMenuCatalog` filtered by program; each → `/dish/:slug` | Add-to-cart (trial path) |
| 6 | Fresh-vs-cold module | Same S5 module as homepage (shared component) | — |
| 7 | Social proof | Outcome cards + `dish_reviews` aggregate | — |
| 8 | Trial band | 3-Day Trial, no auto-renewal, delivered hot | **[Start 3-Day Trial]** → `/subscribe?trial=1` |
| 9 | FAQ + sticky ledger bar | Macro FAQ; sticky CTA bar (R5 primitive, context="landing") | Repeat primary CTA |

### 3.2 `/care/:condition` — Clinical Protocols (PCOS · Diabetes; template scales to thyroid/cardiac)

One template, two launches: `/care/pcos`, `/care/diabetes`. This is the page where **clinical-grade must be provable, not claimed**.

| # | Section | Content & components | Conversion gateway |
|---|---|---|---|
| 1 | Hero | Diabetes: "Eat like your HbA1c depends on it. It does." / PCOS: "Hormone-aware meals, designed by RDs — not influencers." Sub carries the required framing: *supports dietary management of*, never *treats* | **[Book a free 15-min RD consult]** → `/rd?protocol=` (existing slot API) |
| 2 | Credibility block | Dr. Anjali Nair + RD team cards (`/team` data), "every plate signed off for sodium & blood-sugar impact", ISO 22000 + FSSAI license | — |
| 3 | How the protocol works | 3 steps: RD intake → personalized low-GI plan → weekly adjustments via your RD chat (Part 5 surface) | — |
| 4 | The science, honestly | Low-GI methodology, macro caps, allergen governance; India context stat: 11.4% adult diabetes prevalence, ~101M people (ICMR-INDIAB, Lancet 2023) [V] — as market context, not fear copy | — |
| 5 | Program card | PCOS Hormone Balance / Diabetic-Friendly plan (existing `/plans/:slug` data), weekly price from quote API | **[Start This Program]** → `/subscribe?plan=` |
| 6 | Meal evidence | Real dishes with GI badge + full nutrition modal | `/dish/:slug` |
| 7 | Outcome stories | Consented, FSSAI-safe outcome cards ("with her RD" service framing) | — |
| 8 | Safety & scope strip | "Tanmatra complements your doctor's care — it never replaces it. Share our nutrition data with your physician." | Trust, and the compliance shield |
| 9 | Dual CTA close | Consult (primary) / Trial (secondary) | RD consult + `/subscribe?trial=1` |

**Why consult-first here:** condition-motivated buyers convert through credibility, and the free RD intro consult is an existing, zero-marginal-cost asset (`intro_15m` appointment kind) that ParaFit already proves works as an acquisition device in this market [V].

### 3.3 `/corporate-wellness` — Corporate Wellness Hub (HR Directors, Noida IT parks)

**The backend for everything on this page already exists** (companies, budgets, invites, subsidies, office orders, vouchers, QBR). The page's job is to stop the WhatsApp lead leak and feed that machine.

| # | Section | Content & components | Conversion gateway |
|---|---|---|---|
| 1 | Hero | "The lunch benefit that shows up in your health-insurance renewals." Sub: "RD-designed, subsidized team lunches, delivered hot inside {Candor TechSpace · Advant Navis · Stellar 135…}" | **[Book a 20-min pilot call]** → lead form (below) |
| 2 | HR pain math | 3 tiles: absenteeism/energy dip cost · cafeteria attrition · "wellness budget nobody uses" | — |
| 3 | How it works for teams | 3 steps mirroring real product: company account + per-employee monthly budget → employees pick from RD menu in the office order window → one consolidated hot delivery per floor (all real: `office_orders`, `company_budget_usage`) | — |
| 4 | Subsidy models | Cards: full-subsidy / split / voucher-based (real `vouchers` system); interactive calculator: team size × subsidy → monthly cost | Calculator completion fires `corporate_calculator_used` |
| 5 | Clinical differentiator | "Not a caterer: every employee gets allergen-gated, condition-aware meals" + anonymized team wellness reporting (QBR engine exists — productize as "quarterly wellness report for HR") | — |
| 6 | Logos & pilot proof | Delivery-destination logo strip; pilot case card once first pilot closes | — |
| 7 | Lead form (THE FIX) | ≤5 fields: name, work email, company, team size, park/sector. `POST /corporate-leads` (new endpoint) → CRM + `AdminSalesConsole` (exists). WhatsApp becomes a *secondary* contact option, not the pipeline | **[Get pilot pricing]** — primary conversion |
| 8 | FAQ | GST invoicing, minimums, park access/security, trial floors | — |

### 3.4 Routing & reuse

- All three pages are React Router routes + `tanmatra-v2` components reusing: `Protocol.tsx` hero/stat patterns, fresh-vs-cold module (new shared), `PriceLedger` sticky bar, IntakeQuiz mount, quote API.
- Ad-traffic variants (Part 6) use query params (`?utm_*`, `?sector=62`) — sector param personalizes the hero eyebrow ("Delivering into Sector 62 daily at 12:40").

---

## Part 4 — The Clinical Onboarding & Profiling Engine

### 4.1 Assets already in the repo (build on, don't rebuild)

| Asset | State | Disposition |
|---|---|---|
| `IntakeQuiz.tsx` (1,005 lines) | Live 5-step Dialog: Diet → Goals → Cuisine & Spice → Allergens → Targets, + results step; auto-suggested macro targets; 7-day draft TTL; guest→account nudge | **Keep as the engine.** Re-skin + re-mount per below |
| `SoftGate.tsx` (479 lines) | Built, never mounted; its absence permanently suppresses the quiz banner | **Mount it** (P0 fix) as the 15-second first-touch gate |
| `OnboardingQuizGate.tsx` | Global banner, currently dead due to SoftGate bug | Works automatically once SoftGate mounts |
| `PostCheckoutWizard.tsx` | Post-purchase profiling on the tracker | Keep — profile deepening slot |
| `user_preferences` schema | goal, activity, calorie/protein/carb/fat targets, allergens, conditions, HbA1c, PCOS history, height/weight | Complete data model — ⚠️ extend KMS encryption to it before scaling clinical acquisition |
| Preferences context | Server-backed + guest localStorage fallback + login migration | The persistence rail is done |

### 4.2 Target UX flow — Landing → Quiz → Personalized Menu

```
ENTRY (any of):
  Hero "Help Me Choose" · LP assessment CTA · SoftGate (first visit)
  · OnboardingQuizGate banner (returning, un-profiled)
        │
        ▼
┌─ STAGE A · SOFT GATE — 15 seconds, 2 taps ──────────────────┐
│  A1  "What brings you to Tanmatra?"                          │
│      [Lose fat] [Build muscle] [Manage a condition] [Eat     │
│      better]           — one tap, large cards, auto-advance  │
│  A2  "Any allergies we should never break?"                  │
│      [None] [Peanut] [Dairy] [Gluten] [+ more]               │
│  → writes tanmatra:softgate:v1 · menu instantly re-ranks     │
│  → skippable in one tap ("I'll browse first")                │
└──────────────────────────────────────────────────────────────┘
        │  (menu now personalized; banner offers full assessment)
        ▼
┌─ STAGE B · CLINICAL INTAKE — full-screen wizard, ~60s ───────┐
│  HIG rule: complex multi-step flow ⇒ FULL-SCREEN modal view, │
│  not a bottom sheet [V]. One question per screen.            │
│                                                              │
│  B1 Diet style      — iOS-style segmented cards (veg/eggs/…) │
│  B2 Goal + pace     — cards + wheel-style pace selector      │
│  B3 Conditions      — multi-select chips (diabetes, PCOS,    │
│     hypertension, thyroid…) · "🔒 Encrypted, never sold"     │
│     microcopy · optional HbA1c stepper (tabular-nums)        │
│  B4 Allergens       — pre-filled from Stage A, severity tag  │
│  B5 Cuisine & spice — chip grid + spice slider (haptic ticks)│
│  B6 Targets         — RD-suggested macros shown as editable  │
│     defaults ("calculated from your answers — your RD can    │
│     tune this")                                              │
│                                                              │
│  Chrome: thin progress bar (Q n of 6) + step dots ·          │
│  back = URL history (R1 wizard contract) · every step        │
│  auto-saves draft · exit = "Resume assessment" banner        │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ STAGE C · REVEAL — the payoff screen ───────────────────────┐
│  "Your Tanmatra profile" card (shareable, dark, gold accent):│
│  daily targets · protocol match ("PCOS Hormone Balance —     │
│  92% match") · 3 recommended dishes tonight                  │
│  CTA-1 [See my personalized menu] → /menu (re-ranked,        │
│         allergen-gated — gating logic already live)          │
│  CTA-2 [Start my program] → /subscribe?plan={match}          │
│  Condition detected ⇒ CTA-3 [Book free RD consult]           │
│  Guest ⇒ save-profile nudge → OTP login (existing migration  │
│  moves guest prefs to the account)                           │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Premium-feel & friction rules

- **One question per screen, auto-advance on single-selects** — tap count is the metric; target ≤ 12 interactions for Stage B.
- **Progressive disclosure:** HbA1c stepper appears only if diabetes selected; severity tags only if an allergen picked; pace selector only after goal.
- **iOS-grade controls:** large tappable cards (`data-state` idiom, `active:scale-[0.98]`), spring transitions between questions (slide-in-right / slide-out-left, `--ease-spring`), haptic tick on selection (mobile), progress bar animating with `--dur-base`.
- **Clinical trust microcopy at the moment of disclosure** (B3): lock icon + "Encrypted at rest. Used only to design your meals. Never shared, never sold." — must become literally true for consumer prefs (KMS extension, Part 0 flag).
- **Never dead-end:** every stage skippable; skips still write partial profile; the quiz is re-enterable from Account → Health Information (existing route).
- **Interruption-proof:** R1 wizard contract (URL step + draft) — a Sector 62 user interrupted by a standup resumes at lunch exactly where they left.

---

## Part 5 — Retention & Post-Purchase Architecture

### 5.1 Structural insight from the audit

The retention *backend* is largely built (pause/resume/skip/unskip/swap-with-macro-caps, trial conversion, loyalty credits, streaks table, challenges, RD threads). The retention *frontend* is scattered across five surfaces (`WeeklyPlanner`, `Subscriptions` (82KB), `Rewards`, `Challenges`, `Appointments`) with no single "home for my program." The work is **consolidation + one missing UI (streaks)** — not new systems.

### 5.2 The "My Week" dashboard (authenticated home, `/meal-planner` promoted)

```
┌────────────────────────────────────────────────────────────┐
│ HEADER  "Your week, {name}"  ·  streak flame 🔥 12 days    │
├────────────────────────────────────────────────────────────┤
│ ZONE 1 · TODAY strip (always first)                        │
│  Next delivery card: dish, window, live ETA (socket infra  │
│  exists) · [Track] · [Swap dish] (bottom sheet, medium     │
│  detent) · [Skip today] with cutoff countdown              │
├────────────────────────────────────────────────────────────┤
│ ZONE 2 · WEEK GRID (7-day planner — existing WeeklyPlanner)│
│  Day cards: planned dishes + macro chips (tabular-nums)    │
│  Actions per day: Regenerate · Swap slot (sheet) · Skip    │
│  Weekly: [Regenerate week] · [Accept plan]                 │
├────────────────────────────────────────────────────────────┤
│ ZONE 3 · ZEN TRACKER (metabolic habits — NEW UI, existing  │
│  backend `streaks` table: protein & veg, current/best)     │
│  Ring trio: Protein streak · Veg streak · On-plan days     │
│  + weekly trend sparkline · milestone chips (7/30/66 days) │
├────────────────────────────────────────────────────────────┤
│ ZONE 4 · PLAN CONTROLS (from Subscriptions.tsx, demoted    │
│  to a management card): Pause · Resume · Skip a delivery · │
│  Reschedule window · Add delivery · Convert trial ·        │
│  Household members · Billing                               │
├────────────────────────────────────────────────────────────┤
│ ZONE 5 · YOUR RD (care strip): next appointment · [Message │
│  your RD] · latest RD note · [Log progress]                │
├────────────────────────────────────────────────────────────┤
│ ZONE 6 · REWARDS strip: LoyaltyStrip (exists) — "2 more    │
│  deliveries to a free meal" + credit balance + referral    │
└────────────────────────────────────────────────────────────┘
```

**Naming fix:** "Zen Tracker" currently names the *order-tracking* screen (`/track/:orderId`). Rename that surface **"Live Kitchen"** (it already has the calming ring aesthetic) and give the **Zen Tracker** name to the habit/streak surface in Zone 3 — matching the strategic intent ("Zen Tracker metabolic streaks").

### 5.3 Pause / Skip / Swap UX rules (churn-control surface)

| Mechanic | Rule | Backend | Competitive benchmark |
|---|---|---|---|
| Skip | One tap from Today strip + week grid; show **cutoff countdown** ("skippable for 3h 20m"); skipped delivery → instant credit note; unskip restores | `subscription-deliveries/:id/skip`/`unskip` + `SKIP_SWAP_CUTOFF_MS` (live) | 6meal requires 24h notice, 15-day max pause [V] — Tanmatra's self-serve instant skip is a visible superiority; say so in marketing |
| Pause | Duration picker (1–4 wks) in a medium-detent sheet; on pause, offer "keep RD chat active" (retention tether); pre-return WhatsApp nudge 48h before resume | `pause`/`resume` (live) | — |
| Swap | Bottom sheet (R2) with macro-equivalent suggestions; allergen/macro-cap rejections already structured — render them as guidance ("this swap drops protein below your floor"), not errors | `swap` + `validateMacroCapForSwap` (live) | — |
| Cancel | Two-step: reasons sheet → targeted save-offer (pause instead / RD call / discount from `loyalty_config`) → confirm. Every reason → `funnel_events` | `cancel` (live) | — |

**Cutoff transparency rule:** every skippable/swappable object displays its own deadline inline. Deadline-at-the-object beats deadline-in-the-FAQ — this is the single most-cited pain in meal-kit subscription reviews.

### 5.4 Gamification — Zen Tracker mechanics (wired to existing backend)

- **Streaks:** protein & veg streaks already computed server-side from orders (`streaks` table via `wellnessAutoLog`, `protein_streak_threshold` in `loyalty_config`). UI = Zone 3 rings + milestone celebrations at 7/30/66 days (66 = median habit-formation duration — framing, Part 6 organic content hook).
- **Loss-aversion, gently:** streak-at-risk state ("your 12-day protein streak needs 18g more today — tonight's Almond Chicken covers it") → deep-link to the dish. Never guilt; always a one-tap repair.
- **Milestones → loyalty engine:** streak milestones mint `credit_ledger` rewards (engine + notification kind `protein_streak` already exist).
- **Cohort layer:** RD-led `challenges` (exists) = the social streak surface; time-boxed resets with private cohort feed. Cross-link Zone 3 → active challenge.
- **Weekly recap:** WhatsApp template (infra live) every Sunday: adherence %, streaks, next week's plan preview, one-tap swap link. This is the no-push-infra answer: **WhatsApp is Tanmatra's push channel.**

### 5.5 Patient ↔ RD interface (the clinical moat)

Flow (all routes live): `/rd` directory → `/rd/:slug` slot picker (`intro_15m` free / `follow_up_30m/45m` paid) → `/checkout-appointment` → `/appointments` care hub (Schedule / Chat / Progress / Labs tabs).

**Upgrade plan:**
1. **Make chat real-time** — today `rd_messages` refreshes only on mount/send. Socket.IO infra already runs for delivery events; add an `rd:message` room. A "clinical-grade" platform cannot have slower messaging than its delivery tracker.
2. **Assigned-RD surfacing** — Zone 5 card + "Your RD" avatar in the header of every clinical surface; `rd_users` mapping exists.
3. **Structured check-ins** — reuse `rd_progress_logs` (weight, energy, adherence) as a monthly guided check-in wizard (R1 contract), feeding the RD console's adherence-drift panel (exists, incl. AI copilot with plan-proposal approval flow).
4. **Response-time promise** — "RD replies within 24h on weekdays" published in-app; measurable from `rd_messages` timestamps (Part 8 event).
5. **Labs** — upload + share exists; add RD acknowledgment state so a shared lab is never a silent drop.

### 5.6 Post-purchase moments (first 14 days decide LTV)

| Moment | Surface | Action |
|---|---|---|
| T+0 order placed | Live Kitchen (ex-ZenTracker) | Keep `PostPurchaseUpsell` carousel (exists); add "meet your RD" card for program customers |
| T+0 delivered | WhatsApp (exists) | Confirmation + "rate tonight's meal" one-tap (feeds `dish_reviews`) |
| T+2 | WhatsApp | Trial mid-point: "2 meals in — how's energy? Reply 1-5" → NPS table |
| T+3 trial end | `SubscriptionBridge` (exists) + `trial-recap` API (exists) | Recap screen: meals eaten, macros hit, streak started → convert flow with capacity-hold (exists) |
| Week 2 | My Week Zone 3 | First streak milestone celebration + referral prompt (referral engine exists) |
| Lapse (no order 14d) | Loyalty engine winback (exists) | `winback_offer` credit + WhatsApp with RD framing ("Dr. Nair's team kept your protocol on file") |

---

<!-- PART6-INSERT -->

## Part 7 — Brand Positioning Guide

*One-page internal alignment guide — marketers, copywriters, dietitians.*

### 7.1 Manifesto

> **Food is the first prescription.**
> Somewhere between the hospital canteen and the cloud-kitchen "healthy bowl," honest clinical food disappeared. One side is sterile and joyless; the other is a protein claim nobody has verified, cooked at 5 AM and refrigerated until you're hungry.
> Tanmatra exists in the gap. We cook the way a chef insists and measure the way a dietitian insists — every plate signed off for sodium, blood-sugar impact and healthy fats before it leaves our ISO-22000 kitchen in Sector 63. Fired when you order. At your desk hot, in about 40–45 minutes.
> We will never promise a cure. We will always show our numbers.
> This is not diet food. This is food, done with clinical honesty.

### 7.2 Brand voice — four registers, one rule

**The rule: precision is the poetry.** We seduce with specificity (32g, ±2g, 41 min, signed off) — never with superlatives.

| Register | We sound like | Example |
|---|---|---|
| **Authoritative** | An RD who has seen your labs | "Low-GI isn't a vibe. It's a measured glycemic response, and we publish it per dish." |
| **Empathetic** | A colleague who also had a 9-hour day in Sector 62 | "You had back-to-backs since 9. Dinner is the one meeting we'll never make you prepare for." |
| **Premium** | Understated, tactile, dark-and-gold | Short sentences. Tabular numerals. No exclamation marks, no emojis in brand surfaces (WhatsApp utility messages may use at most one). |
| **Scientific** | Confident enough to show uncertainty | "Macros are lab-informed estimates; when a value is provisional, we label it provisional." |

**Vocabulary guardrails**

| Say | Never say |
|---|---|
| "supports dietary management of diabetes" | "treats / reverses / cures diabetes" |
| "RD-designed · RD-signed" | "doctor-approved" (unless a named clinician genuinely approved that item) |
| "blood-sugar-aware", "low-GI, measured" | "sugar-free!" (unless it meets the regulatory threshold), "superfood", "detox" |
| "clinical honesty", "clinical-grade process" | "medical food" / "prescription meals" (regulated category claims) |
| "cooked fresh this hour" | "farm-to-table" clichés |

### 7.3 The Enemy (what we define ourselves against)

1. **The 7 AM cold drop.** Every NCR incumbent delivers the whole day's meals in one blast-chilled morning batch [V: 6meal, OJO, ParaFit]. Our enemy image: *lunch that's been in a fridge since breakfast.* Tagline weapon: **"Health food shouldn't need reheating."**
2. **The unverified macro.** Cloud-kitchen "healthy bowls" with protein claims nobody audits. Weapon: the published per-dish nutrition label + "signed off" language.
3. **Influencer nutrition.** PCOS/diabetes advice sold by follower count, not credentials. Weapon: named RDs with real registrations; free 15-minute consults instead of hot takes.
4. **The sterile hospital tray.** The opposite failure — clinically correct, joyless. Weapon: chef-led menus, Instrument Serif warmth, "this is still dinner, not a dosage."

**We never name competitors.** The enemy is always the *category behavior*, not a brand.

### 7.4 Positioning statement & proof stack

> For health-conscious professionals and clinically-motivated eaters in Noida & Delhi NCR, **Tanmatra is the only meal platform that combines RD-governed therapeutic nutrition with fresh-fired, 40–45-minute hot delivery** — because meals engineered for your metabolism shouldn't spend eight hours in a cold chain.

Proof stack (every claim must trace to one): ISO 22000:2018 kitchen · FSSAI Lic. 22725926001018 · named RD governance (Dr. Anjali Nair, PhD) · per-dish signed nutrition data · STAT clinical delivery tier with 5-min dispatch SLA · KMS-encrypted health profiles · 101M-Indian-adults diabetes context (ICMR-INDIAB) [V].

### 7.5 Audience keys

| Segment | Insight | Lead message |
|---|---|---|
| Tech-corridor professional (25–40, Sec 62/125–135) | Optimizes everything; skeptical of "healthy" claims; eats at desk | "Your macros, engineered. Hot in 45." |
| Clinical-need patient (PCOS, T2D, hypertension) | Exhausted by conflicting advice; wants an authority who listens | "An RD designed this plate for people like you. Talk to her free." |
| HR / People leader (Noida IT parks) | Wellness budget underused; wants visible, low-effort benefit | "The lunch benefit your team actually uses." |
| Household health manager (Expressway societies) | Buys for family incl. a diabetic parent | "One kitchen, everyone's plate handled — including Papa's." |
