# Design ↔ Code Parity Audit — Tanmatra

**Method.** Deep-traversal reconciliation between the Stitch canvas ("Tanmatra Premium Home", 189 frames / ~150 unique meaningful screens incl. the 6 QA-fixed) and the repository at `main` + `claude/tanmatra-ux-clinical-audit-2nsutp` (docs). Every route target was read to its real-UI delegate (wrappers followed); every overlay/chrome component in `components/` traversed; the 12 design-ahead features keyword-searched across `src`. 7 parallel auditors, 129 classified rows, zero elisions.

**Status legend.** `Built` = structural UI + data wiring · `Stubbed` = placeholder/minimal or dead-mounted UI · `Missing` = no code. `NN` = root carries the Nocturnal Nourishment skin (`tnm2 nn`) or NN tokens.

**Headline counts.** 94 route entries → **88 Built / 4 Stubbed / 0 Missing** (+2 intentional-minimal: 404, /profile redirect). Overlays/chrome: **27 Built / 2 orphaned**. Design-ahead: **1 Built / 3 Stubbed(partial) / 8 Missing**. 4 orphaned components found (BillingStub, SoftGate, PersonalisationWizard, DishReviews).

---

## Phase 3 — Parity Matrix

### A. Core commerce (Browse → Dish → Cart → Checkout → Track)

| Expected screen / flow (Stitch design) | Route → file | Status | Missing elements / notes |
|---|---|---|---|
| Home (Populated/Loading/Error · iOS Premium Home) | `/` → `pages/Home.tsx` → `tanmatra-v2/Home.tsx` (124L) | **Built** NN | Composed of 9 home/* section components + IntakeQuiz + StickyBottomBar. |
| Menu (Populated · Asymmetric · Loading Skeleton) | `/menu` → `pages/Menu.tsx` → `tanmatra-v2/Menu.tsx` (1319L) | **Built** NN | Full filters/protocols/match-scoring/bundles/premium-gating. Glucose teaser is honest-locked. |
| Menu (Asymmetric & iOS Refined) — faithful rebuild | `/stitch/menu` → `tanmatra-v2/StitchMenu.tsx` (242L) | **Built** NN | Preview: category chips don't filter; returns null <4 dishes; back/bell/nav inert; gradient image placeholders. |
| Dish Detail (Customise) — faithful rebuild | `/stitch/dish` → `tanmatra-v2/StitchDishDetail.tsx` (329L) | **Built** NN | Preview: ignores `:slug` (hardcoded avocado-toast); back inert; no loading state; gradient hero. |
| Clinical Allergen Gate — faithful rebuild | `/stitch/allergen-gate` → `tanmatra-v2/StitchAllergenGate.tsx` (127L) | **Built** NN | Live allergen profile; Verify only flips local label (no server write); Edit no-op. |
| Checkout (Tier P0) — faithful rebuild | `/stitch/checkout` → `tanmatra-v2/StitchCheckout.tsx` (177L) | **Built** NN | Preview on the *stitch* cart store, not production cart; inputs un-validated; Pay inert — display-only. |
| Premium Subscription Plans — faithful rebuild | `/stitch/subscribe` → `tanmatra-v2/StitchSubscribe.tsx` (159L) | **Built** NN | Real RD_PLANS data; CTAs have no handlers; null if <3 plans. |
| Dish Detail / PDP (Populated·Variant·Loading · PDP Interaction & Macro Analysis · Nutrition Deep Dive · PDP Trust [qa-fixed] · Premium PDP Hero) | `/dish/:slug` → `pages/Dish.tsx` → `tanmatra-v2/Dish.tsx` (972L) | **Built** NN | Fail-closed allergens, nutrition label, swaps, variants, coach widget. DishReviews component exists but is NOT mounted here (orphan). |
| Cart Drawer (Empty/Populated/Min-Nudge/Summary) | `/cart` → `pages/Cart.tsx` → `tanmatra-v2/Cart.tsx` (288L) + `components/cart/CartDrawer.tsx` (1301L, global) | **Built** NN | Conflict blocks, smart swaps, group orders, express UPI in drawer. |
| Checkout (Address Entry/Map/Fallback · Payment Selection/Processing · Refactored/Secure Payment) | `/checkout` → `pages/Checkout.tsx` → `tanmatra-v2/Checkout.tsx` (2599L) | **Built** NN | Multi-step, serviceability, slots, add-ons, subsidy, idempotent submit. Legacy shadcn/lucide inside NN skin (cosmetic debt). |
| checkout layout shell | `routes/CheckoutLayout.tsx` (12L) | **Built** | Intentional `<Outlet/>` shell. |
| Order Tracker Placed/Preparing[qa-fixed]/OutForDelivery/Delivered · ZenTracker Loading | `/track/:orderId` → `pages/ZenTracker.tsx` → `tanmatra-v2/ZenTracker.tsx` (354L) | **Built** NN | Backoff polling, ring, reduced-motion, upsell, fallback. |
| Live tracking hub (timeline + rider map) | `/track` → `pages/Track.tsx` → `tanmatra-v2/Track.tsx` (324L) | **Built** NN | Socket.IO timeline, RiderMap, STAT SLA countdown, packaging return, SupportTicketDialog, PostCheckoutWizard. |
| Order Success Confirmation [qa-fixed] | `/order/confirmed/:orderId` → `pages/OrderConfirmedStub.tsx` (78L) | **Stubbed** NN | h1 + trial-upsell card only; live trial quote + funnel analytics wired, but **no order details** (orderId used only for tracking). Design (incl. qa-fixed pipeline steps) NOT ported. |
| Order History (+Empty) | `/orders` → `pages/Orders.tsx` → `tanmatra-v2/Orders.tsx` (247L) | **Built** NN | Lifecycle stepper, reorder, realtime; no explicit loading indicator (context-backed). |

### B. Subscription / plans / trial

| Expected screen / flow (Stitch design) | Route → file | Status | Missing elements / notes |
|---|---|---|---|
| Subscribe configurator (Duration/Frequency/Program/Price Review) | `/subscribe` → `pages/Subscribe.tsx` → `tanmatra-v2/Subscribe.tsx` (1736L) | **Built** NN | Full configurator + Razorpay + preference-safe swaps. |
| Trial Recap & Upgrade Bridge | `/subscription/bridge` → `pages/SubscriptionBridge.tsx` (294L) | **Built** NN | Live recap, hold countdown, derived saving %. |
| Trial detail (closest design: Program Overview Redesign) | `/trial/:id` → `pages/TrialStub.tsx` (21L) | **Stubbed** NN | Explicit stub: h1 + back link; ignores `:id`. |
| Subscription Plans Landing [qa-fixed v2] | `/subscription-plans` → `pages/SubscriptionPlansLanding.tsx` (597L) | **Built** | Rich (filters, cadence pricing, RD plans) but `clinical-*` palette — Mode-B holdout, not NN. Static data by design. |
| My Plans (Empty) · Plan Settings · Modify Commitment | `/subscriptions` → `tanmatra-v2/Subscriptions.tsx` (1319L) | **Built** NN | Credits, loyalty, swap eval, modals. |
| Plan Settings (dedicated) | `/account/plan` → `pages/PlanStub.tsx` (21L) | **Stubbed** NN | Explicit stub; real management lives in /subscriptions + /account/billing. Design "Plan Settings" unported here. |
| Billing & Invoices | `/account/billing` → `pages/Billing.tsx` (370L) | **Built** NN | Mandate badge, skip cutoff countdown, pause/cancel modals. (`pages/BillingStub.tsx` 21L is an **unrouted orphan** — delete.) |
| Weekly Planner (Active) · Metabolic Calendar · Meal Swap (+Drawer) · Skip Day · Modification Confirmed | `/meal-planner` → `tanmatra-v2/WeeklyPlanner.tsx` (823L) | **Built** NN | generate/regenerateDay, dialogs, fallback flag. |

### C. Onboarding / preferences / account / auth

| Expected screen / flow (Stitch design) | Route → file | Status | Missing elements / notes |
|---|---|---|---|
| Login Phone Entry / OTP Verification | `/login` → `tanmatra-v2/Login.tsx` (217L) | **Built** NN | Firebase OTP, reCAPTCHA, consent, WelcomeModal, next-param sanitizing. |
| Assessments (Allergens/Dietary/Cuisine/Goals/Results) | `/preferences` → `tanmatra-v2/Preferences.tsx` (611L) + `components/preferences/IntakeQuiz.tsx` (1005L) | **Built** NN | DPDPA consent capture; quiz wizard with draft TTL. |
| Account & Profile / Account & Clinical Profile / Completion Drawer | `/account` → `tanmatra-v2/Account.tsx` (456L) | **Built** NN | Hub with loyalty/subscriptions/vouchers/premium queries. |
| Saved Addresses | `/account/addresses` → `tanmatra-v2/Addresses.tsx` (245L) | **Built** NN | CRUD + LocationPickerFlow map picker. |
| Health Information & Privacy · Clinical Profile & Baseline · Upload Labs · Lab Detail · Metabolic Labs | `/account/health-information` → `pages/HealthInformation.tsx` (255L) | **Built** NN | Per-field erasure + account deletion (DPDP). Missing meta/handle exports. Lab upload/detail lives in /appointments, not here. |
| profile alias | `/profile` → `pages/ProfileRedirect.tsx` (23L) | **Stubbed** (intentional) | Redirect-only to /account. |
| auth gate layout | `routes/UserAuthLayout.tsx` (55L) | **Built** | Session check → Outlet/redirect. Uses NN-scoped btn classes outside tnm2 scope (possible unstyled interstitial). |

### D. Health tracking / wellness

| Expected screen / flow (Stitch design) | Route → file | Status | Missing elements / notes |
|---|---|---|---|
| Wellness dashboard (rings, water, manual log) | `/wellness` → `tanmatra-v2/Wellness.tsx` (362L) | **Built** NN | Rings, WeekBars, ManualLogSheet, wearable connect. |
| Smart Watch Sync · Wearable Sync Dashboard · Sync & Connection Status | (embedded card in /wellness only) | **Stubbed** | WearableCard connect/disconnect/sync explicitly "Web preview" (simulated data); no dedicated dashboard, no sync history, none in HealthInformation. |
| Glucose Stability Detail | (teasers in /menu only) | **Stubbed** | Honest-locked teaser + decorative curve; no detail screen. |
| Nutrient Trend Overview | (WeekBars card in /wellness) | **Stubbed** | 7-day macro bars only; no micronutrients, ranges, or drill-in. |
| Biometric & Body Composition Trends | (ProgressTab in /appointments) | **Missing** | Check-in form + plain log list; no charts, no body-comp fields. |
| Weekly Nutrition Scorecard | — | **Missing** | No scoring/summary UI anywhere. |
| Digestive & Energy Journal | — | **Missing** | Only an energy 1–5 field in RD check-ins. |
| Daily Performance Report | — | **Missing** | /performance is a marketing protocol page, not a report. |
| Clinical Adherence Summary (customer) | — | **Missing** | Adherence machinery is RD-side only (RdCopilotPanel). |
| Post-Feedback Calibration Summary | — | **Missing** | No feedback-loop UI (only KDS scale calibration, unrelated). |
| Meal Review & Rating | `components/dish/DishReviews.tsx` (334L) | **Stubbed** (orphan) | Full stars/textarea/AI-summary component wired to /reviews API — **imported by no page**. No post-delivery rating flow. |
| Meal Comparison Tool | — | **Missing** | No side-by-side compare anywhere. |

### E. Dietitian / care / community / content

| Expected screen / flow (Stitch design) | Route → file | Status | Missing elements / notes |
|---|---|---|---|
| Consultation Hub · Choose Timeslot · Confirm Booking · Post-Booking Prep | `/appointments` → `tanmatra-v2/Appointments.tsx` (1052L) | **Built** NN | Tabs: appointments, chat, labs, progress; 9 rdAdvisoryApi calls. |
| Dietitian Messaging | ChatTab inside /appointments | **Built** NN | Customer↔RD thread exists; no realtime push, no unread badges, no dedicated /messages route. |
| Select Dietitian · Dietitian Consultation Profile | `/rd` → `tanmatra-v2/RdDirectory.tsx` (165L); `/rd/:slug` → `RdProfile.tsx` (489L) | **Built** NN | Static directory + live slots; booking → checkout-appointment. |
| Consult checkout | `/checkout-appointment` → `tanmatra-v2/CheckoutAppointment.tsx` (245L) | **Built** NN | Payment via rdAdvisoryApi.book, verbatim-preserved handler. |
| Dietitian Marketplace & Plans · Clinical Plan Detail · PCOS Guide | `/plans` → `tanmatra-v2/RdPlans.tsx` (324L); `/plans/:slug` → `RdPlanDetail.tsx` (240L) | **Built** NN | Preference conflicts, recommendations. |
| Dietitian Clinical Profile (team) | `/team` → `tanmatra-v2/Team.tsx` (74L); `/team/:slug` → `TeamMember.tsx` (153L) | **Built** NN | Static team data + owned dishes from live catalog. |
| RD Console (Client Dashboard · Plan Review Queue designs) | `/rd-console` → `pages/RdConsole.tsx` (985L) | **Built** | Full staff console (claim flow, patients, messages, labs, copilot) — legacy shadcn/lucide, **not NN**; 2-tab NN design unported (port brief batch D). |
| rd auth layout | `routes/RdAuthLayout.tsx` (48L) | **Built** | Gate → Outlet. |
| Team Group Order Lobby (+Refined) | `/group/:code` → `tanmatra-v2/GroupOrder.tsx` (328L) | **Built** NN | Share/participants/host close-&-checkout. Wrapper lacks SEO meta (tokened URL, acceptable). |
| Metabolic Rewards Center · Loyalty Tiers · Rewards & Challenges | `/rewards` → `tanmatra-v2/Rewards.tsx` (448L) | **Built** NN | Referral, ledger, notifications. |
| Challenges hub · Wellness Challenge Detail | `/challenges` → `tanmatra-v2/Challenges.tsx` (212L); `/challenges/:slug` → `ChallengeDetail.tsx` (508L) | **Built** NN | Cohort feed, check-ins, join/leave. |
| Voucher Wallet | `/vouchers` → `tanmatra-v2/Vouchers.tsx` (320L) | **Built** NN | Purchase/redeem; **no loading indicator** (renders empty until fetch resolves). |
| Metabolic Cookbook · Recipe detail · Recipe 404 | `/recipes` → `tanmatra-v2/Recipes.tsx` (155L); `/recipes/:slug` → `RecipeDetail.tsx` (142L) | **Built** NN | Skeletons, error+retry, not-found. |
| Metabolic Marketplace | `/marketplace` → `tanmatra-v2/Marketplace.tsx` (128L); `/marketplace/:slug` → `MarketplaceItem.tsx` (351L) | **Built** NN | Idempotent checkout, bundle-with-meal. |
| Referral Hub: Clinical Gift Credit | (referral section inside /rewards) | **Built** NN | No dedicated route; design maps to the rewards referral block. |

### F. Corporate / partners / landing

| Expected screen / flow (Stitch design) | Route → file | Status | Missing elements / notes |
|---|---|---|---|
| Corporate Performance/Verification Hub | `/corporate` → `tanmatra-v2/Corporate.tsx` (229L) | **Built** NN | **Lead-capture hole:** marketing proposal form is client-only — submit shows a toast, inputs never sent anywhere. |
| Corporate Verification Gate (invite) | `/corporate/invite/:token` → `tanmatra-v2/CorporateInvite.tsx` (121L) | **Built** NN | Accept flow + expired state. |
| Corporate admin hub | `/corporate/:slug` → `tanmatra-v2/CorporateAdmin.tsx` (426L) | **Built** NN | Budget, members, office-lunch scheduler; role-gated. |
| Corporate Lunch Planner | `/corporate/:slug/lunch-planner` → `tanmatra-v2/CorporateLunchPlanner.tsx` (682L) | **Built** NN | Diet shapes, allergen exclusions, weekly plan, schedule. |
| Office Lunch Selection | `/office-lunch/:id` → `tanmatra-v2/OfficeLunch.tsx` (219L) | **Built** NN | Budget-enforced steppers; bare "Loading…" (no skeleton), no distinct error state. |
| Gyms & Fitness Landing [qa-fixed] | `/partners/gyms` → `pages/GymsLanding.tsx` (363L) | **Built** | `clinical-*` (Mode-B holdout). **Lead capture = wa.me link only** ("No partner-lead API exists yet"). |
| Fitness clubs LP [qa-fixed NEW design] | `/partners/fitness-clubs` → `pages/MorningFitnessLanding.tsx` (298L) | **Built** | `clinical-*` (Mode-B). **Lead-capture hole:** form sets success state, **no API call, no WhatsApp — lead silently dropped.** |
| RD Partner Recruitment Landing | `/rd-partners` → `pages/RdPartnersLanding.tsx` (270L) | **Built** | `clinical-*` (Mode-B; design + qa notes exist). |
| RD Partner Apply (5-step wizard designs) | `/rd-partners/apply` → `pages/RdPartnersWizard.tsx` (1021L) | **Built** | Draft persistence, validation, POST, account creation. `clinical-*` (Mode-B). |
| Premium membership (iOS Premium Home · Premium PDP Hero) | `/premium` → `tanmatra-v2/Premium.tsx` (197L) | **Built** NN | premiumApi join/cancel, consult usage. |
| Clinical / Performance protocol landings | `/clinical`, `/performance` → `tanmatra-v2/Protocol.tsx` (186L shared) | **Built** NN | CFG-driven; clinical enables clinical mode. |
| Gyms & Fitness landing (marketing "Clinical Landing Page") | `/wellness` `/clinical` `/performance` covered above | **Built** NN | — |

### G. Legal / system

| Expected screen / flow (Stitch design) | Route → file | Status | Missing elements / notes |
|---|---|---|---|
| Privacy Policy & Terms | `/terms` → `tanmatra-v2/Terms.tsx` (100L); `/privacy` → `Privacy.tsx` (85L) | **Built** NN | Static, DPDP sections, anchors. |
| Refund & Cancellation Policy [new design] | `/refunds` → `tanmatra-v2/Refunds.tsx` (140L) | **Built** NN | Fixed LAST_UPDATED (honesty fix applied). |
| FAQ & Support Hub · Trust & FAQ Ecosystem | `/faq` → `tanmatra-v2/Faq.tsx` (107L) | **Built** NN | Accordion + FAQPage JSON-LD. |
| 404 Page Not Found [new design] | `*` → `pages/not-found.tsx` (45L) | **Built** NN | Intentional minimal; new NN design available for port. |

### H. Admin / ops (desktop)

| Expected screen / flow (Stitch design) | Route → file | Status | Missing elements / notes |
|---|---|---|---|
| admin auth layout | `routes/AdminAuthLayout.tsx` (62L) | **Built** | /admin/me gate + localStorage fallback. |
| Admin directory | `/admin` → `pages/AdminIndex.tsx` (202L) | **Built** | 15 static link cards, 4 sections. |
| Ops dashboard (AI Agent Execution Console design) | `/admin/ops` → `pages/AdminOpsDashboard.tsx` (523L) | **Built** | **"Live Ops" card is hardcoded placeholders** ('-', ₹0, static '18 min'). |
| AI runs telemetry | `/admin/ai-runs` → `pages/AdminAiRuns.tsx` (284L) | **Built** | Loading/error/empty present. |
| Ops agent chat | `/admin/ops-agent` → `pages/AdminOpsAgent.tsx` (424L) | **Built** | NDJSON streaming, live queue, audit. |
| Clinical CMS & Content Sandbox | `/admin/cms-agent` → `pages/AdminCmsAgent.tsx` (1007L) | **Built** | Copy/tags/photos/audit. |
| Forecasting | `/admin/forecasting` → `pages/AdminForecasting.tsx` (610L) | **Built** | 6 sections + reorder agent. |
| Admin Menu Engineering Console [new design] | `/admin/menu-engineering` → `pages/AdminMenuEngineering.tsx` (472L) | **Built** | Matrix + pricing suggestions; failed fetches silently ignored; no loading indicator. NN design unported (batch E). |
| Subscription Analytics Dashboard | `/admin/analytics` → `pages/AdminAnalytics.tsx` (612L) | **Built** | Ask-the-data, WBR, VoC tabs. |
| Admin Support Ticket Console [new design] | `/admin/support-tickets` → `pages/AdminSupportTickets.tsx` (651L) | **Built** | AI triage, draft diff, metrics. NN design unported (batch E). |
| RD Partner Application Review [new design] | `/admin/rd-applications` → `pages/AdminRdApplications.tsx` (463L) | **Built** | Approve/provision; NN design unported (batch E). |
| Admin Moderation Console [new design] | `/admin/moderation` → `pages/AdminModeration.tsx` (291L) | **Built** | Reviews/posts queues; NN design unported (batch E). |
| Community moderation (appeals/cohorts) | `/admin/community-moderation` → `pages/AdminCommunityModeration.tsx` (387L) | **Built** | **Renders with no data and no prompt when token unset.** |
| Sales & Subscription Console | `/admin/sales-console` → `pages/AdminSalesConsole.tsx` (180L); `/:slug` → `AdminSalesAccount.tsx` (299L) | **Built** | Risk ranking; QBR generate/export. |
| Kitchen ERP: Live KDS Queue · Final Clinical Sign-off | `/admin/kds` → `pages/AdminKds.tsx` (364L) | **Built** | Self-described **simulator**; weight-verify + macro-deviation lock. |
| Logistics: Cold-Chain Console | `/admin/supplier` → `pages/AdminSupplier.tsx` (355L) | **Built** | **Product dropdown hardcoded to 4 items**, not inventory-driven. |
| Admin Compliance Console [new design] | `/admin/compliance` → `pages/AdminCompliance.tsx` (276L) | **Built** | **Sample-data banner; synthetic logs; no token input on page** (no-ops without stored token). NN design unported (batch E). |
| Admin login | `/admin/login` → `pages/AdminLogin.tsx` (139L) | **Built** | ⚠️ **Demo-mode client-side auth bypass**: hardcoded credentials write the admin localStorage flag. |

### I. Global overlays & chrome (design: Global Alerts/Toasts · Validation & Interaction States · Cart Drawer set)

| Component | File | Status | Notes |
|---|---|---|---|
| Cart drawer | `components/cart/CartDrawer.tsx` (1301L) | **Built** NN-tokens | Focus trap, express UPI, upsells. |
| Add-to-cart control | `components/cart/AddToCartButton.tsx` (78L) | **Built** | Lifecycle states. |
| Sticky checkout bar | `components/cart/StickyCheckoutBar.tsx` (152L) | **Built** | `clinical-*` (Mode-B holdout). |
| Intake quiz | `components/preferences/IntakeQuiz.tsx` (1005L) | **Built** | shadcn dialog; NN nudge overlay inside. |
| Onboarding quiz gate banner | `components/preferences/OnboardingQuizGate.tsx` (125L) | **Built** | Mounts IntakeQuiz. |
| Welcome modal | `components/auth/WelcomeModal.tsx` (163L) | **Built** NN | No focus trap/Esc. |
| Soft gate | `components/onboarding/SoftGate.tsx` (479L) | **Stubbed** (orphan) | Built UI, **mounted nowhere** — only its helper is imported. |
| Post-checkout wizard | `components/onboarding/PostCheckoutWizard.tsx` (378L) | **Built** NN | Mounted from Track. |
| Personalisation wizard | `components/onboarding/PersonalisationWizard.tsx` (223L) | **Stubbed** (orphan) | Imported nowhere; superseded by SoftGate/IntakeQuiz; off-system tokens. |
| Location picker | `components/location/LocationPickerFlow.tsx` (1062L) | **Built** NN | Maps loader + manual fallback + serviceability. |
| Support ticket dialog | `components/track/SupportTicketDialog.tsx` (183L) | **Built** NN | No focus trap/Esc. |
| STAT cancel dialog/button | `components/track/StatCancelDialog.tsx` (136L) + `StatCancelButton.tsx` (93L) | **Built** | Reason codes, optimistic cancel. |
| Macro overlay | `components/dish/MacroOverlay.tsx` (203L) | **Built** | rdVerified intentionally not rendered (T2.1). |
| Nutrition label modal | `components/dish/NutritionLabelModal.tsx` (262L) | **Built** | %DV, cross-contact, sourcing. |
| Dish reviews | `components/dish/DishReviews.tsx` (334L) | **Stubbed** (orphan) | Full review UI + API wiring, **imported by no page**. |
| Header (desktop) | `components/layout/Header.tsx` (131L) | **Built** | IA nav + ⌘K + cart. |
| Bottom nav + MoreSheet (mobile) | `components/layout/BottomNav.tsx` (367L) | **Built** | 25+ route sheet. |
| Bottom dock (v2) | `components/layout/BottomDock.tsx` (78L) | **Built** NN | Healthy-mode toggle. |
| Sticky bottom bar | `components/layout/StickyBottomBar.tsx` (208L) | **Built** | 4 context modes; `--tnm-*` tokens. |
| Footer | `components/layout/Footer.tsx` (138L) | **Built** | `clinical-*` (Mode-B holdout). |
| Error boundary | `components/layout/ErrorBoundary.tsx` (91L) | **Built** | Beacon reporting. |
| Segment toggle | `components/layout/SegmentToggle.tsx` (39L) | **Built** | `clinical-*` (Mode-B holdout). |
| Command palette | `components/CommandPalette.tsx` (226L) | **Built** | Allergen-blocked dishes disabled. |
| Mobile search sheet | `components/MobileSearchSheet.tsx` (465L) | **Built** | Recent searches, protocol chips. |
| Welcome offer banner | `components/marketing/WelcomeOfferBanner.tsx` (95L) | **Built** | Server-priced offer, display-only. |
| Support agent chat | `components/ai/SupportAgent.tsx` (255L) | **Built** | Streaming, escalation. |
| Coach agent chat | `components/ai/CoachAgent.tsx` (646L) | **Built** | add_to_cart/book_rd action cards. |
| Home header | `components/home/HomeHeader.tsx` (98L) | **Built** | Scroll transition + sheet. |

### J. Canvas frames with no port target (correctly unported)

Design-system libraries (Global Alerts & Toasts, Global Micro-Motion, Validation & Interaction States) · prototypes (Shader, Three.js, Kinetic ZenTracker, Menu Spatial Interaction, Spatial Metabolic Mesh) · assets/junk (`image.png` ×13, `Image from …` ×7, `Animated SVG` ×2, `Extracted text`, `null` ×3) · duplicate frames (Admin consoles ×2 each, Login ×2, Menu Populated ×2, Corporate Hub ×2, Weekly Planner ×2, Loyalty ×2, Modify Commitment ×2, RD Application Review ×2) — reference material, not screens.

---

## Phase 4 — Prioritized next steps

**P0 — money-path stubs & silent data loss (fix first)**
1. `pages/OrderConfirmedStub.tsx` → port the **Order Success Confirmation** design (`qa-fixed/success-confirmation.*`): real order details from `ordersApi`, honest pipeline steps. Route exists; design exists; currently a stub on the money path.
2. `pages/MorningFitnessLanding.tsx` — club-registration form **silently drops leads** (no API, no handoff). Wire to a lead endpoint or the wa.me handoff used by GymsLanding.
3. `tanmatra-v2/Corporate.tsx` — proposal form same hole: client-only success toast. Wire capture.
4. `pages/AdminLogin.tsx` — **remove the demo-mode client-side auth bypass** (hardcoded credentials → localStorage admin flag).

**P1 — mount or delete the orphans**
5. `components/dish/DishReviews.tsx` — mount on the PDP + add the post-delivery rating entry (Meal Review & Rating design passed QA); this closes the biggest design-ahead gap with code that already exists.
6. Delete `pages/BillingStub.tsx` (unrouted, superseded).
7. Decide `SoftGate` vs `PersonalisationWizard` (both unmounted): keep one onboarding pattern, delete the other.
8. `pages/TrialStub.tsx` → real trial detail (closest design: Program Overview Redesign) or redirect to `/subscription/bridge`.
9. `pages/PlanStub.tsx` → redirect to `/subscriptions` (or port the Plan Settings design).

**P2 — the briefed port work (already packaged, PR #140)**
10. Port the 16 gap designs per `agent-nn-port-brief.md` batches A–E (use `qa-fixed/` references where they exist).
11. Batch F Mode-B holdouts: `SubscriptionPlansLanding`, `GymsLanding`, `MorningFitnessLanding`, + shared chrome (`StickyCheckoutBar`, `Footer`, `SegmentToggle`, `ErrorBoundary`) to NN tokens.
12. `RdConsole` → NN 2-tab design (Client Dashboard / Plan Review Queue).

**P3 — design-ahead builds (route + component + data)**
13. Wearable/Sync dashboard (replace the "Web preview" simulated card; designs: Smart Watch Sync, Wearable Sync Dashboard, Sync & Connection Status).
14. Trends: Biometric & Body-Comp, Nutrient Trend Overview, Glucose Stability Detail (wire to wellnessApi + wearables).
15. Weekly Nutrition Scorecard · Daily Performance Report · Clinical Adherence Summary (customer) · Digestive & Energy Journal · Post-Feedback Calibration · Meal Comparison Tool.

**P4 — polish / hygiene**
16. Loading states: `Vouchers` (none), `OfficeLunch` (bare line), `Orders` (context-only), `AdminMenuEngineering` (silent failures), `AdminCommunityModeration` (no-token dead render).
17. Focus-trap/Esc on `WelcomeModal`, `SupportTicketDialog`.
18. `AdminOpsDashboard` Live-Ops placeholders → real metrics or remove. `AdminSupplier` hardcoded product list → inventory-driven. `AdminCompliance` synthetic-data + tokenless no-op.
19. Stitch preview routes (`/stitch/*`): keep as showcases or retire now that the skin is app-wide.
20. `HealthInformation` missing meta/handle exports; `UserAuthLayout` NN-scoped classes outside tnm2 scope.

**No code will be written against this list until the audit is reviewed.**
