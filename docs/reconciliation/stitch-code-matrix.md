# Stitch-to-code traceability matrix

Generated from `docs/stitch/stitch-screen-manifest.json` (the prior audit's own
manifest, itself already the product of a source/render/trigger verification
pass) plus this session's inventory sweep and manual verification of the 12
repo-specific claims. Full field set: `stitch-code-matrix.json`.

| ID | Target | Status | Route | Reuse | Risk | Defects |
|---|---|---|---|---|---|---|
| 4.1 | Dark Design-System Screen | ACTIVE_MATCH | /styleguide | REUSE_AS_IS | LOW | — |
| 4.2 | Light Design-System Screen | ACTIVE_MATCH | /styleguide | REUSE_AS_IS | LOW | — |
| 5.1 | Tanmatra Home: Clinical Feed | ACTIVE_MATCH | / | REUSE_AS_IS | LOW | — |
| 5.2 | Daily Menu: Clinical Selection | ACTIVE_MATCH | /menu | REUSE_AS_IS | LOW | — |
| 5.3 | Menu Filter Bottom Sheet | ACTIVE_MATCH | /menu | REUSE_AS_IS | LOW | — |
| 5.4 | Dish Quick-View Bottom Sheet | ACTIVE_MATCH | /menu | REUSE_AS_IS | LOW | — |
| 5.5 | Dish PDP: Full Clinical Detail | ACTIVE_MATCH | /dish/[slug] | REUSE_AS_IS | LOW | — |
| 5.6 | Cart Drawer: Commerce Overlay | ACTIVE_MATCH | global | REUSE_AS_IS | LOW | — |
| 5.7 | Tanmatra Marketplace: Pantry & Hydration | ACTIVE_MATCH | /marketplace | REUSE_AS_IS | LOW | — |
| 5.8 | Marketplace Product PDP | ACTIVE_MATCH | /marketplace/[slug] | REUSE_AS_IS | LOW | — |
| 5.9 | Meal Deals: Bundles & Combos | ACTIVE_MATCH | /meal-deals | REUSE_AS_IS | LOW | — |
| 5.10 | AI-Assisted Meal Recommendations | ACTIVE_MATCH | /meal-recommendations | REUSE_AS_IS | LOW | — |
| 5.11 | Meal Reheating & Macro Guide | ACTIVE_MATCH | /meal-guides/[dishSlug] | REUSE_AS_IS | LOW | — |
| 5.12 | RD Recipe Library & Rationale | ACTIVE_MATCH | /recipes | REUSE_AS_IS | LOW | — |
| 6.1 | Subscription Plans Discovery | ACTIVE_MATCH | /plans | REUSE_AS_IS | LOW | — |
| 6.2 | Plans Mealtime Preference Sheet | MISSING_IMPLEMENTATION | /plans | REBUILD_MINIMALLY | MEDIUM | DEF-6.2-MEALTIME-001 |
| 6.3 | Plan Configuration: Initial Setup | MISSING_IMPLEMENTATION | /plan/[planId] | REBUILD_MINIMALLY | MEDIUM | DEF-J2-PLANCONFIG-001 |
| 6.4 | Plan Day-by-Day Meal Lineup | MISSING_IMPLEMENTATION | /plan/[planId] | REBUILD_MINIMALLY | MEDIUM | DEF-J2-PLANCONFIG-001 |
| 6.5 | Plan Change Dish Bottom Sheet | MISSING_IMPLEMENTATION | /plan/[planId] | REBUILD_MINIMALLY | MEDIUM | DEF-6.5-CHANGEDISH-001, DEF-J2-PLANCONFIG-001 |
| 6.6 | Plan Accompaniment Editor Sheet | MISSING_IMPLEMENTATION | /plan/[planId] | REBUILD_MINIMALLY | MEDIUM | DEF-6.6-ACCOMP-001, DEF-J2-PLANCONFIG-001 |
| 6.7 | Plan Delivery Schedule Configuration | MISSING_IMPLEMENTATION | /plan/[planId] | REBUILD_MINIMALLY | MEDIUM | DEF-J2-PLANCONFIG-001 |
| 6.8 | 3-Day Clinical Taste Trial | ACTIVE_MATCH | /trial | REUSE_AS_IS | LOW | — |
| 6.9.1 | Quick Setup Step 1: Goal | ACTIVE_MATCH | /quick-setup | REUSE_AS_IS | LOW | — |
| 6.9.2 | Quick Setup Step 2: Dietary Style | ACTIVE_MATCH | /quick-setup | REUSE_AS_IS | LOW | — |
| 6.9.3 | Quick Setup Step 3: Allergens | ACTIVE_MATCH | /quick-setup | REUSE_AS_IS | LOW | — |
| 7.2 | Custom Build Step 1: Goal | MISSING_IMPLEMENTATION | /custom-build | REBUILD_MINIMALLY | MEDIUM | DEF-J4-CUSTOMBUILD-001 |
| 7.3 | Custom Build Step 2: Routine | MISSING_IMPLEMENTATION | /custom-build | REBUILD_MINIMALLY | MEDIUM | DEF-J4-CUSTOMBUILD-001 |
| 7.4 | Custom Build Wearable Interstitial | MISSING_IMPLEMENTATION | /custom-build | REBUILD_MINIMALLY | MEDIUM | DEF-J4-CUSTOMBUILD-001 |
| 7.5 | Custom Build Step 3: Food Preferences | MISSING_IMPLEMENTATION | /custom-build | REBUILD_MINIMALLY | MEDIUM | DEF-J4-CUSTOMBUILD-001 |
| 7.6 | Custom Build Step 4: Plan Intensity | MISSING_IMPLEMENTATION | /custom-build | REBUILD_MINIMALLY | MEDIUM | DEF-J4-CUSTOMBUILD-001 |
| 7.7 | Custom Build Step 5: Duration & Renewal | MISSING_IMPLEMENTATION | /custom-build | REBUILD_MINIMALLY | MEDIUM | DEF-J4-CUSTOMBUILD-001 |
| 7.8 | Custom Build Step 6: Configuration Review | MISSING_IMPLEMENTATION | /custom-build | REBUILD_MINIMALLY | MEDIUM | DEF-J4-CUSTOMBUILD-001 |
| 7.9 | Custom Build Generated Plan Review | MISSING_IMPLEMENTATION | /custom-build | REBUILD_MINIMALLY | MEDIUM | DEF-J4-CUSTOMBUILD-001 |
| 7.10 | Custom Build Pre-Checkout Questions | MISSING_IMPLEMENTATION | /custom-build | REBUILD_MINIMALLY | MEDIUM | DEF-J4-CUSTOMBUILD-001 |
| 8.1 | Secure Focus Checkout: Tanmatra OS | ACTIVE_MATCH | /checkout | REUSE_AS_IS | LOW | — |
| 8.2 | Checkout Quote Expired Recovery | ACTIVE_MATCH | /checkout | REUSE_AS_IS | LOW | — |
| 8.3 | Order Confirmed & Telemetry Opt-in | ACTIVE_MATCH | /order/confirmed/[orderId] | REUSE_AS_IS | LOW | — |
| 9.1 | Meal Planner: Active Protocol Schedule | ACTIVE_MATCH | /meal-planner | REUSE_AS_IS | LOW | — |
| 9.2 | Manage Delivery Bottom Sheet | ACTIVE_PARTIAL | /meal-planner | REUSE_WITH_REFACTOR | LOW — additive to an already-wired, tested sheet. | DEF-9.2-DELIVERY-ROUTE-001, DEF-9.2-ACTIONS-001 |
| 9.3 | Account Active Subscriptions Management | ACTIVE_MATCH | /account/subscriptions | REUSE_AS_IS | LOW | — |
| 10.1 | Account Hub: Clinical Profile & Summary | ACTIVE_MATCH | /account | REUSE_AS_IS | LOW | — |
| 10.2 | Account Order History & Invoices | ACTIVE_MATCH | /account/orders | REUSE_AS_IS | LOW | — |
| 10.3 | Account Saved Delivery Addresses | ACTIVE_MATCH | /account/addresses | REUSE_AS_IS | LOW | — |
| 10.4 | Account Preferences: Diet & Theme | ACTIVE_MATCH | /account/preferences | REUSE_AS_IS | LOW | — |
| 10.5 | Account Wellness & Biomarker Trends | ACTIVE_MATCH | /account/wellness | REUSE_AS_IS | LOW | — |
| 10.6 | Account Consumption History & Macro Trends | ACTIVE_MATCH | /account/history | REUSE_AS_IS | LOW | — |
| 10.7 | Account Symptoms & Food Reaction Log | ACTIVE_MATCH | /account/symptoms | REUSE_AS_IS | LOW | — |
| 10.8 | Health Connections: Apple Health & Android Sync | ACTIVE_MATCH | /account/connections | REUSE_AS_IS | LOW | — |
| 10.9 | Post-Meal Feedback Bottom Sheet | PREBUILT_UNWIRED | /account | REUSE_WITH_ADAPTER | MEDIUM — new backend contract required; must not reuse dish_reviews (wrong entity). | DEF-10.9-FEEDBACK-001 |
| 11.1 | Metabolic Health Program Landing | ACTIVE_MATCH | /metabolic | REUSE_AS_IS | LOW | — |
| 11.2 | Performance Nutrition Landing | ACTIVE_MATCH | /performance | REUSE_AS_IS | LOW | — |
| 11.3 | Clinical Care Protocols Hub | ACTIVE_MATCH | /clinical | REUSE_AS_IS | LOW | — |
| 11.4 | Condition-Specific Clinical Care | ACTIVE_MATCH | /care/[condition] | REUSE_AS_IS | LOW | — |
| 11.5 | Registered Dietitian Directory | ACTIVE_MATCH | /rd | REUSE_AS_IS | LOW | — |
| 11.6 | RD Consultation Booking Focus Flow | ACTIVE_MATCH | /rd/[slug] | REUSE_AS_IS | LOW | — |
| 11.7 | Tanmatra AI Nutrition Coach Conversation | ACTIVE_MATCH | /coach | REUSE_AS_IS | LOW | — |
| 11.8 | Dietitian Verified Community Q&A | ACTIVE_MATCH | /qa | REUSE_AS_IS | LOW | — |
| 12.1 | Corporate Employee Benefit Invite Activation | ACTIVE_MATCH | /corporate/invite/[token] | REUSE_AS_IS | LOW | — |
| 12.2 | B2B Corporate Wellness Acquisition | ACTIVE_MATCH | /corporate-wellness | REUSE_AS_IS | LOW | — |
| 12.3 | Gym & Athletic Facility Partner Landing | ACTIVE_MATCH | /partners/gyms | REUSE_AS_IS | LOW | — |
| 12.4 | Gym Membership Verification State | MISSING_IMPLEMENTATION | /partners/gyms | REBUILD_MINIMALLY | MEDIUM | DEF-12.4-GYMVERIFY-001 |
| 12.5 | Fitness Club & Endurance Community Portal | ACTIVE_MATCH | /partners/fitness-clubs | REUSE_AS_IS | LOW | — |
| 12.6 | Dietitian Referral Patient Activation | ACTIVE_MATCH | /partners/dietitians | REUSE_AS_IS | LOW | — |
| 12.7 | Dietitian Partner Network Onboarding | ACTIVE_MATCH | /rd-partners | REUSE_AS_IS | LOW | — |
| 13.1 | Metabolic Challenges Discovery | ACTIVE_MATCH | /challenges | REUSE_AS_IS | LOW | — |
| 13.2 | Challenge Registration & Clinical Detail | ACTIVE_MATCH | /challenges/[slug] | REUSE_AS_IS | LOW | — |
| 13.3 | Active Metabolic Challenge Tracker | ACTIVE_MATCH | /challenges/tracker | REUSE_AS_IS | LOW | — |
| 14.1 | Empty Cart Drawer State | ACTIVE_MATCH | global | REUSE_AS_IS | LOW | — |
| 14.2 | Menu No Matching Meals Result | ACTIVE_MATCH | /menu | REUSE_AS_IS | LOW | — |
| 14.3 | Plan Generation Loading State | MISSING_IMPLEMENTATION | /plan/[planId] | REBUILD_MINIMALLY | MEDIUM | DEF-14.3-GENLOADING-001, DEF-J2-PLANCONFIG-001 |
| 14.4 | Plan Generation Error Recovery | MISSING_IMPLEMENTATION | /plan/[planId] | REBUILD_MINIMALLY | MEDIUM | DEF-14.4-GENERROR-001, DEF-J2-PLANCONFIG-001 |
| 14.5 | Unserviceable Address Notice | ACTIVE_MATCH | /account/addresses | REUSE_AS_IS | LOW | — |
| 14.6 | Checkout Payment Processing State | ACTIVE_MATCH | /checkout | REUSE_AS_IS | LOW | — |
| 14.7 | Payment Timeout Recovery State | ACTIVE_MATCH | /checkout | REUSE_AS_IS | LOW | — |
