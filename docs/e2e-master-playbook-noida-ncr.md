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
| 1 | Hero | Diabetes: "Low-GI, measured — not marketed." / PCOS: "Hormone-aware meals, designed by RDs — not influencers." All condition copy is diet-descriptive + service-led per §7.6 — the food never claims a disease effect; the RD consult carries the clinical promise | **[Book a free 15-min RD consult]** → `/rd?protocol=` (existing slot API) |
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
| Skip | One tap from Today strip + week grid; show **cutoff countdown** ("skippable for 3h 20m"); skipped delivery → instant credit note; unskip restores | `subscription-deliveries/:id/skip`/`unskip` + `SKIP_SWAP_CUTOFF_MS` (live) | Global leaders lock far earlier: HelloFresh 11:59 pm PT **5 days** before delivery, Factor Wed 11:59 pm CT for next week, Marley Spoon 6–7 days [V]; NCR: 6meal needs 24h notice [V]; eat.fit has no pause at all (per-meal cancel only) [S]. Tanmatra's near-delivery self-serve skip is a visible superiority — market it |
| Pause | Duration picker (1–4 wks) in a medium-detent sheet; on pause, offer "keep RD chat active" (retention tether); pre-return WhatsApp nudge 48h before resume (Marley Spoon's restart reminder pattern [V]) | `pause`/`resume` (live) | 6meal caps pauses at 15 days [V]; Marley Spoon offers date-picked pause with reminder [V] |
| Swap | Bottom sheet (R2) with macro-equivalent suggestions; allergen/macro-cap rejections already structured — render them as guidance ("this swap drops protein below your floor"), not errors | `swap` + `validateMacroCapForSwap` (live) | HelloFresh's cross-plan weekly recipe choice is the flexibility benchmark [V] |
| Cancel | Two-step: reasons sheet → targeted save-offer (pause instead / RD call / discount from `loyalty_config`) → confirm. Every reason → `funnel_events`. At confirm, show what's lost: credit balance, streaks, RD history — HelloFresh's verified credit-forfeiture steer ("skip instead of cancelling") [V], done transparently rather than punitively | `cancel` (live); credit expiry exists in `credit_ledger` | Meal-kit reality check: only 57% of HelloFresh's Jan-2022 cohort repurchased in month 2; M6 ≈ 16%, M11 ≈ 9% [V: Second Measure] — every mechanic on this row exists to beat those curves |

**Cutoff transparency rule:** every skippable/swappable object displays its own deadline inline. Deadline-at-the-object beats deadline-in-the-FAQ — this is the single most-cited pain in meal-kit subscription reviews.

### 5.4 Gamification — Zen Tracker mechanics (wired to existing backend)

- **Streaks:** protein & veg streaks already computed server-side from orders (`streaks` table via `wellnessAutoLog`, `protein_streak_threshold` in `loyalty_config`). UI = Zone 3 rings + milestone celebrations at 7/30/66 days (66 = average days to habit automaticity, Lally et al. 2010, UCL [V] — also a Part 6 content hook). The 7-day milestone matters most: Duolingo's official data shows 7-day-streak users are **3.6× likelier to complete their course and 2.4× likelier to return next day** [V].
- **Streak Shield:** one auto-equipped protection per week — a skipped delivery or travel day never breaks a streak (Lally: missing one day doesn't impair habit formation [V]; Duolingo: two equipped Streak Freezes *increased* DAU +0.38% — forgiveness beats rigidity [V]). A shield-used state says "protected — back tomorrow," never "broken."
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

## Part 6 — Hyper-Local Online Marketing & Paid Ads Plan (Noida/NCR)

> **Budget-number honesty:** platform mechanics, WhatsApp pricing model and targeting minimums below are verified **[V]**; India CPC/CPM/CPL figures are agency-consensus **[D] directional** — Google/Meta publish no country rate cards. Treat every ₹ band as a planning envelope to be replaced by week-1 actuals.

### 6.1 Geo-targeting map (verified anchors)

**Platform facts first:** Google Ads India supports **no pincode targeting** (India exposes only state/UT/city levels) — hyper-local = **1 km+ radius pins** dropped on campuses and societies (1 km is Google's documented minimum radius) [V]. Meta's API allows **1–80 km radii** (0.63 mi floor — the "1 mile minimum" is UI folklore) [V]. Use the PINs below for delivery-zone logic, CRM segmentation, and serviceability copy — not ad platforms.

| Zone | Sectors | PIN | Radius-pin anchors (verified) |
|---|---|---|---|
| **Tech corridor North** | 62 / 63 / 64 / 65 | 201309 (62) · 201301 (63/64/65) | Candor TechSpace N1, Logix Cyber Park (C-28/29), Stellar IT Park, Okaya Centre (TCS anchor), Barclays GSC, Samsung R&D (legacy) — plus Tanmatra's own Sector 63 kitchen |
| **DND / 16A / 16B** | 16A, 16B, 18 | 201301 | Microsoft IDC (KP Towers, 16B), Max Towers, Film City media cluster (Zee, Network18, India Today, ABP, T-Series), Sector 18 retail |
| **Expressway SEZ belt** | 98, 125–144 | 201304 (93–144 west) · 201305 (142 NEPZ) · 201303 (126) · 201313 (125 Amity) | HCLTech Noida Technology Hub (Sec 126), Adobe (Sec 132 + new Sec 129, 700+ staff), Info Edge/Naukri (Sec 132), Paytm One Skymark (Sec 98), Optum + Publicis Sapient (Oxygen Park, Sec 144), Advant Navis (Sec 142), Candor N2 + Genpact + TCS (Sec 135), Samsung R&D's new Expressway campus |
| **Premium residential** | 93A–104, 128–134, 144, 150 | 201304 · 201310 (150) | Jaypee Greens Wish Town (~1,063 acres, Sec 128–134), Supertech Supernova (Sec 94, ~5,708 units), Gulshan Dynasty (Sec 144, ultra-luxury), ATS One Hamlet (104), ATS Greens Village + Eldeco Utopia (93A), Lotus Boulevard (100), Amrapali Sapphire (45), Tata Eureka Park + ACE Parkway (150) |
| **Central/golf belt** | 37, 38, 43, 44 | 201303 · 201301 (44) | Noida Golf Course (Sec 38), Godrej Woods (Sec 43, possession Oct 2026 — new-mover moment), established premium blocks |

**Why this geography pays:** Gautam Buddha Nagar has UP's highest per-capita income (~₹10.17 lakh, ~10.9× the state average) [S]; Noida's IT workforce is estimated at 4.5 lakh+ professionals [D].

### 6.2 The 30-day blitz calendar

| Week | Theme | Actions |
|---|---|---|
| **W0 (prep)** | Instrument before you spend | Part 8 events live end-to-end (a rupee spent before funnels are measurable is a rupee wasted); 3 LPs shipped; WhatsApp opt-in + template approvals; corporate lead endpoint replacing the `wa.me` leak; Google/Meta pixels + first-party `/events` dual capture |
| **W1** | Intent capture + seed | Google Search on high-intent + brand terms (§6.3 rows 1–2); CTWA ads to tech-corridor radii exploiting the **72-hour free WhatsApp window** [V]; society sampling pilot in 2 Expressway societies (Jaypee Wish Town, ATS 93A); micro-influencer batch 1 briefed (CCPA health-influencer disclosure rules apply — §6.4) |
| **W2** | Visual prospecting + B2B | Meta Reels prospecting on campus radii (Reels CPMs run 25–40% below Feed [D]); lead-form campaigns for corporate pilots aimed at named parks (Candor, Oxygen, Advant, Stellar 135); direct ABM outreach to HR at Adobe/HCL/Paytm/Optum/Genpact; RWA activation #1 (weekend stall + RD table) |
| **W3** | Optimize + activate | Kill bottom-half ad sets on CPL; retargeting ladders (menu viewers → quiz; quiz finishers → trial; cart abandoners → WhatsApp utility nudge); first corporate pilot lunch delivered + photographed; society WhatsApp groups seeded via RWA partnerships |
| **W4** | Scale + referral | 2× budget on winning ad sets only; referral push to first cohort (engine exists); testimonial/outcome content from weeks 1–3 buyers; corporate case card #1 onto `/corporate-wellness`; review round-up (Google Business Profile for the Sector 63 kitchen) |

### 6.3 Tactical execution table

Envelope: **₹5.0 L core 30-day paid media** (₹4.0–6.5 L range) + ₹1.0 L influencer/offline. All CPL/CAC figures [D].

| # | Channel | Target audience | Ad format | 30-day budget | Primary hook |
|---|---|---|---|---|---|
| 1 | Google Search — clinical intent | NCR searches: "diabetic meal delivery noida", "pcos diet food delivery", "low gi tiffin service", "dietitian meal plan noida" (CPC ₹10–45 [D]) | RSAs → `/care/*` LPs | ₹1.2 L (24%) | "RD-designed diabetic-friendly meals, delivered hot in Noida. Free dietitian intro call." |
| 2 | Google Search — lifestyle intent + brand | "healthy tiffin sector 62", "protein meals noida", "office lunch subscription noida", brand terms | RSAs → `/metabolic`, home | ₹0.8 L (16%) | "Your macros, engineered. At your desk in 45 min." |
| 3 | Meta prospecting — Reels-first | 24–45, radius pins on §6.1 tech-corridor + Expressway zones; interest layers: gym, nutrition, diabetes care | 15–20s Reels: kitchen-cam "fired at 12:04, sealed at 12:19, desk by 12:47" | ₹1.2 L (24%) | The fresh-vs-cold-drop contrast (enemy: the 7 AM tiffin fridge) |
| 4 | Meta — CTWA + lead forms | Same radii; lookalikes of quiz completers from W2 | Click-to-WhatsApp ads (opens 72h free messaging window [V]); instant forms for corporate | ₹0.8 L (16%) | "Take the 60-second assessment on WhatsApp — get tomorrow's menu matched to you" |
| 5 | Meta retargeting | Menu/PDP viewers, quiz abandoners, cart abandoners (Part 8 audiences) | Carousel dishes + trial offer; DPA once catalog synced | ₹0.5 L (10%) | "Your assessment is 80% done — your matched menu is waiting" |
| 6 | WhatsApp broadcast (owned) | Opted-in leads + lapsed trials | Marketing templates ≈ ₹0.86–1.09/msg + 18% GST [S]; utility msgs in service window free [V] | ₹0.25 L (5%) | Sunday planner recap · trial-end recap · streak nudges |
| 7 | Corporate ABM | HR/admin at named §6.1 campuses | Direct outreach + LinkedIn organic exec posts; pilot-lunch offers | ₹0.25 L (5%) | "One free pilot lunch for your team of 20. RD on site." |
| 8 | Micro-influencers (Noida food/fitness, 10k–100k) | Corridor professionals via local creators | 6–8 Reels @ ₹5–15k/deliverable [D] + meal barter for nano tier | ₹0.6 L | "I tracked my macros for a week eating only Tanmatra" |
| 9 | Society RWA activations | Jaypee Wish Town, ATS 93A/104, Supernova, Lotus Boulevard | Weekend stalls, RD tasting tables, society-WhatsApp seeding, kitty/club sponsorships | ₹0.4 L | "The Sunday your society tasted its blood-sugar numbers" |

**Guardrails:** CAC ceiling ₹1,800 blended (India D2C food benchmarks ₹1,000–2,500 [D]; global food-subscription CAC ≈ ₹1,250–2,100 [D]); LTV:CAC ≥ 3 target; weekly kill rule = any ad set >2× category CPL after ₹8k spend dies; festive warning — auction costs can ~3× around Diwali/sale events [D], so an October blitz needs a bigger envelope or a January start.

### 6.4 Organic hook strategy

| Pillar | Hook | Format/channel |
|---|---|---|
| Corporate burnout | "The 3 PM crash isn't your workload. It's your lunch." — desk-lunch autopsies, RD explains glucose curves | Reels + LinkedIn |
| Commute economics | "Your tiffin left home at 7 AM. You eat at 1 PM. Do the math." — the cold-chain enemy, localized to Noida commute reality | Reels, society WhatsApp |
| Clinical myth-busting | RD shorts: "sugar-free ≠ diabetic-safe", "why low-GI beats low-carb for desk workers" — RDs must disclose certification per CCPA health-influencer guidelines (Aug 2023) [V] | Reels/YouTube Shorts |
| Sector storytelling | "Feeding Sector 132 this week" — kitchen-to-campus mini-docs; delivery-rider POV to Adobe/HCL gates | Reels + GBP posts |
| Challenge cohorts | RD-led 14-day metabolic reset challenges (product exists — `/challenges`) opened to non-customers with a free tier | Community + WhatsApp |
| Founder/RD authority | Weekly "clinical honesty" note — one ingredient, one number, one decision | LinkedIn + email |

**Channel-mix note:** with no push infrastructure, WhatsApp is both the retention rail and a paid channel — CTWA ads (row 4) are the bridge: paid click → 72h free conversation → opt-in → owned channel forever. This is the cheapest compounding asset in the plan.

---


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

| Say | Never say | Why (see §7.6) |
|---|---|---|
| "low-GI, measured" (GI < 55 per FSSAI methodology), "high-protein", "low-sodium" — with numbers | "treats / reverses / manages / cures diabetes or PCOS" | Disease-suitability claims barred (Reg 10(1)); measurable nutrient claims are permitted (Schedule I) |
| "designed by registered dietitians" (advertising, factual) | "doctor-recommended", "approved by health professionals" — and keep ALL professional-endorsement wording off packaging | Reg 10(2) label prohibition; CCPA endorsement rules |
| "blood-sugar-aware menu", "hormone-aware menu" | "diabetic-friendly = safe for diabetics", "PCOS Care" as an efficacy promise | Diet-descriptive ≠ disease-suitability; DMR Act lists diabetes |
| "clinical honesty", "clinical-grade kitchen & governance" (process claims) | "therapeutic meals", "medical food", "prescription meals" | s.23(1) therapeutic-claim bar; FSMP is a licensed category we are not |
| "cooked fresh this hour" | "home-style/home-cooked" (expressly barred, Reg 9(2)), "farm-to-table" clichés | Reg 9(2) + credibility |

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

### 7.6 Regulatory reality check (FSSAI) — binding on all copy

All primary-verified against the FSS (Advertising & Claims) Regulations 2018 (consolidated 14.12.2022), the FSS Act 2006, and the 2016 Nutra Regulations [V]:

1. **No disease-suitability claims.** Reg 10(1): no claim that a food is suitable for the *prevention, alleviation, treatment or cure* of a disease/disorder/physiological condition. **"PCOS Care" as a plan name and "Diabetic Friendly" framing on the live site need legal review** — rename toward diet-descriptive forms: "Low-GI Protocol", "Hormone-Aware Menu", "Sugar-Conscious Plan". Diabetes is additionally item 9 of the DMR Act 1954 schedule (criminal penalties for remedy ads) [S].
2. **No "doctor-recommended" on labels.** Reg 10(2) bars label words implying the food is recommended/prescribed/approved by medical or health professionals. "Dietitian-designed" in *advertising* is defensible as a factual statement of who designed the menu; on *packaging labels*, keep professional-endorsement language off entirely.
3. **Permitted claims we CAN own loudly** (Schedule I thresholds): **"Low GI"** (GI < 55, defined methodology — item 16), **"high protein"** (≥20% RDA/100g), **"low sodium"** (≤0.12g/100g), **"low sugar"** (≤5g/100g). These measurable claims ARE the brand voice — precision as poetry is also the compliant lane.
4. **No FSDU shelter.** Ordinary cooked meals cannot be classified FSDU/FSMP (Explanation 2, Reg 3, Nutra Regs 2016), FSMP cannot be advertised to the public at all, and FSDU/FSMP still can't carry free-form disease claims (A&C Reg 10(4)). There is no category trick.
5. **"Clinical" is not banned by name** — but s.23(1) (no therapeutic/medicinal label claims), s.24 (no unsubstantiated efficacy guarantees; burden of proof on advertiser) and Reg 4(7) (misleading brand names need front-of-pack disclaimers) mean **"clinical-grade" must always modify the *process* (kitchen, governance, sign-off), never the *food's effect on disease*.** "Therapeutic meal delivery" as a public positioning phrase should be retired in favor of "RD-governed nutrition".
6. **Consequences are live:** up to ₹10 lakh per misleading ad (s.53) + license suspension; FSSAI's ad-monitoring committee logged 170 cases in six months (2023) [V].
7. **Operational display duties:** menu calorie display + "An average active adult requires 2,000 kcal…" statement and allergen info for e-commerce (Labelling & Display Regs 2020, Reg 9 — note the special-order/modified-meal exemption may cover personalized plans); FSSAI license number on all invoices/receipts; license displayed at the kitchen. Wire these into the app footer, dish pages (calorie display already exists) and invoice templates.
8. **Outcome testimonials** must be framed as *service* outcomes (RD consultation + adherence), never food efficacy; health-influencer content follows the CCPA 2022 + Aug 2023 guidelines (certification disclosure, "not a substitute for medical advice") [V].

**The compliant brand thesis in one line:** *we make measurable-nutrient claims about food, capability claims about our process, and outcome claims only about our RD service — never disease claims about a plate.*

---

## Part 8 — Telemetry & Analytics Event Matrix

### 8.1 Current state → activation plan

**What exists:** typed first-party tracker (`src/lib/analytics.ts`, ~90 events, snake_case) → `POST /events` (Zod-validated, PII-scrubbed both sides, always-204) → `funnel_events` table (indexed on `(name, created_at)`, `session_id`). **What's missing:** any read path — `funnel_events` is excluded from the admin "Ask the data" safe schema, no aggregation job, mobile tracker is a console stub, no experiment assignment service (every event ships `experiment_assignments: {}`).

**Activation plan (ordered, all prerequisites for Part 6 W0):**

| # | Action | Detail |
|---|---|---|
| A1 | Add `funnel_events` to the safe-SQL schema + a nightly rollup job | `funnel_daily(name, day, count, distinct_sessions, distinct_users)` + per-flow step tables; expose a Funnels tab in AdminAnalytics |
| A2 | Define the 5 named funnels (§8.3) as materialized queries | Powers weekly WBR "funnel health" section (WBR generator already runs) |
| A3 | Wire the mobile stub | `trackEvent` → `POST /events` with `platform:"mobile"` prop (endpoint + scrubbing already handle it) |
| A4 | Server-side money truth | Emit `order_created`/`payment_succeeded`/`subscription_started` from the API (finalize/webhook paths) with `source:"server"`; client events become corroboration, not truth (Segment-style server confirmation) |
| A5 | Optional vendor dual-write | The tracker already forwards to `window.gtag` when present; if GA4 is added, map names per §8.4 — first-party capture remains the source of truth |
| A6 | Experiment service (deferred flag exists) | Fill `experiment_assignments` from a config-driven bucketing util; unblocks hero A/B (Part 1) and Stitch cut-over A/B (Part 2 P4) |

### 8.2 Event data dictionary (by CUJ)

Convention: **snake_case verb/object names (GA4-compatible), past-state semantics, ≤20 properties/event (Amplitude guidance [V]), names are case-sensitive contracts (Mixpanel warning [V]).** `session_id`, `path`, `app_release`, `experiment_assignments` attach automatically. Status: ✅ = exists in `analytics.ts` today · ➕ = add.

**Acquisition & landing**

| Event | Trigger condition | Properties | Status |
|---|---|---|---|
| `view_home` | Home mount | `city` | ✅ |
| `landing_viewed` | Any `/metabolic`, `/care/*`, `/corporate-wellness` mount | `landing_slug, utm_source, utm_campaign, sector` | ➕ |
| `landing_cta_clicked` | Any LP primary/secondary CTA | `landing_slug, cta_id, target` | ➕ |
| `serviceability_checked` | Pincode chip / delivery check | `pincode, serviceable` | ➕ |
| `waitlist_joined` | Out-of-zone capture submit | `pincode` | ➕ |

**Onboarding & profiling (Part 4)**

| Event | Trigger condition | Properties | Status |
|---|---|---|---|
| `softgate_shown` / `softgate_completed` / `softgate_skipped` | Stage A lifecycle | `goal, allergen_count` (completed only) | ➕ |
| `quiz_opened` | IntakeQuiz mount | `entry` (hero/banner/lp/account) | ➕ |
| `quiz_step_viewed` / `quiz_step_completed` | Per Stage B step (paired, Segment step pattern [V]) | `step` (1–6), `step_name` | ➕ |
| `quiz_completed` | Results step reached | `goal, has_condition:boolean, target_source` (suggested/edited) — **never the condition values themselves** (blocked-keys scrub stays) | ➕ |
| `quiz_abandoned` | Draft TTL expiry or exit ≥24h | `last_step` | ➕ |

**Menu → cart → checkout**

| Event | Trigger condition | Properties | Status |
|---|---|---|---|
| `view_menu` / `pdp_viewed` / `pdp_variant_switched` / `full_nutrition_opened` | existing triggers | existing props | ✅ |
| `add_to_cart` | Add action (any surface) | `dish_slug, price_paise, source` | ✅ |
| `checkout_start` | Checkout mount with items | `cart_value_paise, item_count, is_guest` | ✅ |
| `checkout_step_viewed` / `checkout_step_completed` | Per real checkout step once R1 makes steps real (paired) | `step` (1 review / 2 delivery / 3 payment), `checkout_id` | ➕ |
| `address_added` / `slot_selected` | Address save / slot pick | `is_first_address` · `slot_window, fulfillment` | ➕ |
| `payment_attempted` | Razorpay modal opened | `method_hint, charge_paise` | ➕ |
| `payment_succeeded` / `order_created` | Server verify / finalize (A4 server-emitted) | `order_id, charge_paise, order_kind, priority` | ✅→server |
| `checkout_abandoned` | Session end after `checkout_start` without order | `last_step, cart_value_paise` (derived in rollup, not client-fired) | ➕(derived) |

**Subscribe wizard (7 steps — the highest-value funnel)**

| Event | Trigger condition | Properties | Status |
|---|---|---|---|
| `subscribe_step_viewed` / `subscribe_step_completed` | Per `?step=` transition (paired) | `step` (0–6), `plan, cadence, trial:boolean, entry` (`fromCart`/lp/bare) | ➕ |
| `protocol_duration_selected` / `billing_period_selected` / `plan_dish_swapped` | existing triggers | existing props | ✅ |
| `subscribe_quote_shown` | Quote API resolves on any step | `payable_today_paise, cadence` | ➕ |
| `trial_started` / `subscription_started` | existing (move to server per A4) | `plan, cadence, charge_paise` | ✅→server |
| `mandate_created` / `mandate_authorization_failed` / `predebit_notified` / `mandate_revoked` | existing UPI Autopay lifecycle | existing props | ✅ |

**Retention & clinical (Part 5)**

| Event | Trigger condition | Properties | Status |
|---|---|---|---|
| `delivery_skipped` / `delivery_unskipped` | Skip/unskip confirmed | `hours_before_cutoff, week_index` | ➕ |
| `subscription_paused` / `subscription_resumed` | Pause/resume confirmed | `pause_weeks` | ➕ |
| `subscription_cancelled` | Cancel confirmed | `reason` (enum: price/variety/moving/health/other — RevenueCat-style cause capture [V]), `save_offer_shown, save_offer_accepted` | ➕ |
| `swap_requested` / `swap_rejected` | Swap sheet submit / structured rejection | `rejection_kind` (allergen/macro_cap) | ➕ |
| `planner_week_generated` / `planner_week_accepted` / `planner_day_regenerated` | WeeklyPlanner actions | `week_start` | ➕ |
| `streak_viewed` / `streak_milestone_reached` | Zone 3 render / milestone hit | `kind` (protein/veg), `days` | ➕ |
| `trial_recap_viewed` / `trial_converted` / `trial_expired` | Bridge lifecycle (`trial_bridge_*` partially ✅) | `meals_eaten, streak_days` | ✅/➕ |
| `rd_appointment_booked` / `rd_message_sent` / `rd_lab_shared` / `progress_logged` | Care-hub actions | `kind` (intro/follow-up) · `thread_age_days` · — · `fields_count` | ➕ |
| `challenge_joined` / `challenge_checkin_attended` | Community actions | `challenge_slug` | ➕ |
| `referral_shared` / `referral_redeemed` / `credit_redeemed` | Loyalty actions | `channel` · `award_paise` · `reason` | ➕ |

**B2B & marketing**

| Event | Trigger condition | Properties | Status |
|---|---|---|---|
| `corporate_lead_submitted` | New lead form (Part 3.3) | `company_size_band, park_or_sector, source` | ➕ |
| `corporate_calculator_used` | Subsidy calculator interaction | `team_size_band, subsidy_model` | ➕ |
| `office_order_pick_made` / `office_order_closed` | Group-order flow | `company_slug (hashed), picks_count` | ➕ |
| `whatsapp_optin` / `whatsapp_link_clicked` | Opt-in confirmed / CTWA-origin session | `source` (ctwa/checkout/rwa) | ➕ |
| `gate_unlock` / `allergen_ack` | existing safety gates | existing props | ✅ |

### 8.3 Named funnels & abandonment math

Abandonment for step *N* = `step N viewed − step N completed` (paired-event model [V: Segment]); session-scoped, 30-min timeout; computed in the A1 rollup.

| Funnel | Steps | Primary KPI | Diagnostic it unlocks |
|---|---|---|---|
| F1 Discovery | `view_home/landing_viewed → view_menu → pdp_viewed → add_to_cart` | Visit→cart % | LP quality per UTM/sector |
| F2 Checkout | `checkout_start → step 1→2→3 → payment_attempted → order_created` | Cart→paid % (vs 70.22% avg abandonment baseline [V: Baymard]) | "Step 1 vs Step 3 abandonment" precisely; guest-vs-account delta |
| F3 Subscribe | `subscribe_step_viewed(0…6) → subscription_started` | Step 0→paid %; per-step drop | Which of the 7 steps bleeds; quote-latency impact via `subscribe_quote_shown` |
| F4 Profiling | `softgate_shown → quiz_opened → quiz_step(1…6) → quiz_completed → add_to_cart` | Quiz→cart lift vs non-quiz sessions | ROI of the onboarding engine; SoftGate fix validation |
| F5 Trial→Sub | `trial_started → trial_recap_viewed → trial_converted` | Trial conversion % (meal-kit M2 benchmark: 57% repeat at HelloFresh [V]) | Recap-screen efficacy; mandate failure impact |

Retention KPIs alongside funnels: M1/M2/M6 subscriber retention (benchmark: meal-kit M2 ≈ 57–69%, M6 ≈ 16%, M11 ≈ 5–15% [V: Second Measure] — beat them via clinical lock-in), skip rate, swap rate, streak participation (Duolingo-verified: 7-day streak → 3.6× course completion, 2.4× next-day return [V] — directional analog for Zen Tracker).

### 8.4 Governance rules

1. **Health data never enters events.** The blocked-keys scrub (`allergens, conditions, medicalConditions, phone, email, address, name`) stays on both client and server; new events carry booleans/bands only (`has_condition`, `company_size_band`).
2. **Names are contracts** — case-sensitive, snake_case, no dynamic values in names (values go to properties) [V: Mixpanel]; additions go through the typed `EventName` union (compile-time governance already in place).
3. **Money events are server-truth** (A4); client fires are corroboration. `charge_paise` from `finalizeOrder` is the only revenue number.
4. **GA4 mapping layer** (if/when vendor added): `add_to_cart→add_to_cart`, `checkout_start→begin_checkout`, `slot_selected→add_shipping_info`, `payment_attempted→add_payment_info`, `order_created→purchase` (+`transaction_id` required [V]) — mapping lives at the destination adapter, first-party names never change.
5. **≤20 properties per event; one owner per funnel dashboard; WBR carries funnel deltas weekly** (scheduler exists).

---

## Appendix — Evidence Register & Open Items

**Verification method:** 107-agent deep-research pass (25 sources fetched, 117 claims extracted, 3-vote adversarial verification per claim, 1 claim refuted and excluded) + 5-agent primary-source gap-fill (FSSAI PDFs, GA4/Segment/Stripe/RevenueCat docs, Meta/Google platform docs, India Post PIN API, official help centers). Repo evidence from direct audit of `artifacts/tanmatra`, `artifacts/api-server`, `lib/db`, `artifacts/tanmatra-mobile`.

**Key verified sources:** Baymard (cart abandonment 70.22%; extra-costs 39%; can't-calculate-total 14%; forced account 19%; 5.1 steps/11.3 fields vs 8 needed) · Apple HIG (sheets vs full-screen modality, detents) · ICMR-INDIAB/Lancet 2023 (11.4% diabetes, ~101M) · FSSAI A&C Regs 2018 + FSS Act 2006 + Nutra Regs 2016 (Part 7.6 items) · 6meal/ParaFit/OJO live pricing & delivery pages · HelloFresh/Factor/Marley Spoon/Dinnerly official help pages · Duolingo official blog (streak stats) · Bloomberg Second Measure (meal-kit retention) · HelloFresh FY2024 press release · GA4 & Segment V2 & RevenueCat & Stripe event specs · Meta WhatsApp pricing pages (per-message model, 72h CTWA window) · Google/Meta radius-targeting docs · India Post PIN API + company-owned address pages (Adobe, HCLTech, Paytm, Info Edge, Optum, Godrej).

**Explicitly directional [D] (replace with actuals in week 1–2 of the blitz):** all India CPC/CPM/CPL bands, CAC benchmarks, influencer rates, launch-budget envelopes, Noida IT-workforce count, festive-season multipliers.

**Open items for the team:**
1. Legal review of "PCOS Care" / "Diabetic Friendly" program names and "therapeutic" positioning against Part 7.6 (also re-check the draft FSS Nutra Regulations 2022 supersession status).
2. Extend KMS envelope encryption to consumer `user_preferences` clinical fields before scaling clinical acquisition.
3. Decide GA4 dual-write vs first-party-only (A5) and the experiment-bucketing util (A6).
4. Confirm actual kitchen capacity + rider coverage for the §6.1 zones before making the 40–45-min promise sector-specific.
5. First corporate pilot target list sign-off (named campuses, §6.2 W2).

