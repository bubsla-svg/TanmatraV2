// One-shot migration: stitch-screen-manifest.json v1 (18 flat fields, 3 status
// fields) -> v2 (schemaVersion 2, controlled artifact types, structured
// triggers/transitions, canonical 11-field proof model, evidence records,
// replacement dispositions). Committed for provenance; the manifest itself is
// the source of truth after this runs. Re-running is idempotent only against a
// v1 manifest (it refuses to migrate an already-v2 file).
//
// Classification source: docs/architecture/BUILD-GAP-ANALYSIS.md (2026-08-08)
// with three disk-verified deltas at feat/stitch-manifest-v2:
//   9.2  missing -> partial  (ManageDeliverySheet shipped, but on
//        /account/subscriptions, not the approved /meal-planner overlay)
//   14.6 missing -> partial  (inline "verifying" state exists in PlanCheckout,
//        no distinct payment-processing screen state)
//   14.7 missing -> wired    (UnresolvedPaymentPanel shipped and rendered from
//        both checkout legs)
//   11.1 wired   -> partial  (route renders PlaceholderPage — partial stub)
// Replacement dispositions per docs/stitch/replacement-screen-decisions.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "docs/stitch/stitch-screen-manifest.json");
const SF = "artifacts/storefront";
const CLOSE = ["close-button", "escape", "safe-backdrop", "focus-restored"];
const NOW = process.env.MIGRATION_TIMESTAMP ?? new Date().toISOString();

// class: wired | partial | missing | unwired | rebuild
// cls fields: c=class, re=routeEntryPoint, ic=implementationComponent,
// cc=controllerComponent (all repo-relative, null when none exists on disk)
const g = (p) => `${SF}/app/(global)/${p}`;
const f = (p) => `${SF}/app/(focus)/${p}`;
const b = (p) => `${SF}/app/(b2b)/${p}`;
const comp = (p) => `${SF}/components/${p}`;

const CLS = {
  "4.1": { c: "wired", re: g("styleguide/page.tsx") },
  "4.2": { c: "wired", re: g("styleguide/page.tsx") },
  "5.1": { c: "wired", re: g("page.tsx"), ic: comp("landing/Section01ClinicalHero.tsx") },
  "5.2": { c: "wired", re: g("menu/page.tsx"), ic: comp("menu/PersonalizedMenu.tsx") },
  "5.3": { c: "partial", re: g("menu/page.tsx"), ic: comp("menu/PersonalizedMenu.tsx"), d: ["DEF-5.3-FILTERSHEET-001"] },
  "5.4": { c: "wired", re: g("menu/page.tsx"), ic: comp("menu/DishDrawer.tsx") },
  "5.5": { c: "wired", re: f("dish/[slug]/page.tsx"), cc: comp("menu/PdpBuyLedger.tsx") },
  "5.6": { c: "wired", re: g("layout.tsx"), ic: comp("cart/CartDrawer.tsx"), cc: comp("cart/MiniCartBar.tsx") },
  "5.7": { c: "wired", re: g("marketplace/page.tsx") },
  "5.8": { c: "wired", re: f("marketplace/[slug]/page.tsx"), cc: comp("cart/MarketplaceAddToCart.tsx") },
  "5.9": { c: "wired", re: g("meal-deals/page.tsx") },
  "5.10": { c: "wired", re: g("meal-recommendations/page.tsx"), ic: comp("DishCard.tsx") },
  "5.11": { c: "wired", re: g("meal-guides/[dishSlug]/page.tsx") },
  "5.12": { c: "wired", re: g("recipes/page.tsx") },
  "6.1": { c: "wired", re: g("plans/page.tsx"), ic: comp("plans/GoalRouter.tsx") },
  "6.2": { c: "missing", re: g("plans/page.tsx"), d: ["DEF-6.2-MEALTIME-001"] },
  "6.3": { c: "rebuild", re: f("plan/[planId]/page.tsx"), ic: comp("plans/PlanBuilder.tsx"), d: ["DEF-J2-PLANCONFIG-001"] },
  "6.4": { c: "rebuild", re: f("plan/[planId]/page.tsx"), ic: comp("plans/PlanBuilder.tsx"), d: ["DEF-J2-PLANCONFIG-001"] },
  "6.5": { c: "missing", re: f("plan/[planId]/page.tsx"), d: ["DEF-6.5-CHANGEDISH-001", "DEF-J2-PLANCONFIG-001"] },
  "6.6": { c: "missing", re: f("plan/[planId]/page.tsx"), d: ["DEF-6.6-ACCOMP-001", "DEF-J2-PLANCONFIG-001"] },
  "6.7": { c: "rebuild", re: f("plan/[planId]/page.tsx"), ic: comp("plans/PlanBuilder.tsx"), d: ["DEF-J2-PLANCONFIG-001"] },
  "6.8": { c: "wired", re: f("trial/page.tsx"), ic: comp("trial/TrialStart.tsx") },
  "6.9.1": { c: "wired", re: f("quick-setup/page.tsx"), ic: comp("wizard/QuickSetupWizard.tsx") },
  "6.9.2": { c: "wired", re: f("quick-setup/page.tsx"), ic: comp("wizard/QuickSetupWizard.tsx") },
  "6.9.3": { c: "wired", re: f("quick-setup/page.tsx"), ic: comp("wizard/QuickSetupWizard.tsx"), d: ["DEF-6.9.3-CADENCE-001"] },
  "8.1": { c: "wired", re: f("checkout/page.tsx"), ic: comp("checkout/plan/PlanCheckout.tsx"), cc: comp("checkout/CheckoutFlow.tsx") },
  "8.2": { c: "missing", re: f("checkout/page.tsx"), d: ["DEF-8.2-QUOTEEXPIRY-001"] },
  "8.3": { c: "wired", re: f("order/confirmed/[orderId]/page.tsx") },
  "9.1": { c: "wired", re: g("meal-planner/page.tsx"), ic: comp("mealplan/MealPlanner.tsx") },
  "9.2": { c: "partial", re: g("account/subscriptions/page.tsx"), ic: comp("account/ManageDeliverySheet.tsx"), cc: comp("account/DeliveryList.tsx"), d: ["DEF-9.2-DELIVERY-ROUTE-001", "DEF-9.2-ACTIONS-001"] },
  "9.3": { c: "wired", re: g("account/subscriptions/page.tsx"), ic: comp("account/SubscriptionManager.tsx") },
  "10.1": { c: "wired", re: g("account/page.tsx"), ic: comp("account/AccountHub.tsx") },
  "10.2": { c: "wired", re: g("account/orders/page.tsx"), ic: comp("account/OrderHistory.tsx") },
  "10.3": { c: "wired", re: g("account/addresses/page.tsx"), ic: comp("account/AddressManager.tsx") },
  "10.4": { c: "wired", re: g("account/preferences/page.tsx"), ic: comp("account/PreferencesHub.tsx") },
  "10.5": { c: "wired", re: g("account/wellness/page.tsx"), ic: comp("wellness/WellnessHub.tsx") },
  "10.6": { c: "wired", re: g("account/history/page.tsx"), ic: comp("history/MealHistoryDashboard.tsx") },
  "10.7": { c: "wired", re: g("account/symptoms/page.tsx"), ic: comp("symptoms/SymptomTrackerView.tsx") },
  "10.8": { c: "wired", re: g("account/connections/page.tsx"), ic: comp("account/WearablesHub.tsx") },
  "10.9": { c: "unwired", re: null, ic: comp("feedback/MealFeedback.tsx"), d: ["DEF-10.9-FEEDBACK-001"] },
  "11.1": { c: "partial", re: g("metabolic/page.tsx"), d: ["DEF-11.1-PLACEHOLDER-001"] },
  "11.2": { c: "wired", re: g("performance/page.tsx"), ic: comp("protocol/ProtocolView.tsx") },
  "11.3": { c: "wired", re: g("clinical/page.tsx"), ic: comp("protocol/ProtocolView.tsx") },
  "11.4": { c: "wired", re: g("care/[condition]/page.tsx") },
  "11.5": { c: "wired", re: g("rd/page.tsx"), ic: comp("rd/RdCard.tsx") },
  "11.6": { c: "wired", re: g("rd/[slug]/page.tsx"), ic: comp("rd/RdBooking.tsx") },
  "11.7": { c: "wired", re: g("coach/page.tsx"), ic: comp("coach/CoachChat.tsx") },
  "11.8": { c: "wired", re: g("qa/page.tsx"), ic: comp("qa/CommunityQaForum.tsx") },
  "12.1": { c: "wired", re: f("corporate/invite/[token]/page.tsx"), ic: comp("corporate/CompanyInvite.tsx") },
  "12.2": { c: "wired", re: b("corporate-wellness/page.tsx"), cc: comp("corporate/CorporateLeadForm.tsx") },
  "12.3": { c: "wired", re: b("partners/gyms/page.tsx"), cc: comp("partners/PartnerLeadForm.tsx") },
  "12.4": { c: "missing", re: b("partners/gyms/page.tsx"), d: ["DEF-12.4-GYMVERIFY-001"] },
  "12.5": { c: "wired", re: b("partners/fitness-clubs/page.tsx"), cc: comp("partners/PartnerLeadForm.tsx") },
  "12.6": { c: "wired", re: b("partners/dietitians/page.tsx"), ic: comp("rd-partners/RdPartnersLanding.tsx") },
  "12.7": { c: "wired", re: b("rd-partners/page.tsx"), ic: comp("rd-partners/RdPartnersLanding.tsx"), cc: comp("rd-partners/PartnerWizard.tsx") },
  "13.1": { c: "wired", re: g("challenges/page.tsx"), ic: comp("challenges/ChallengeCard.tsx") },
  "13.2": { c: "wired", re: g("challenges/[slug]/page.tsx"), ic: comp("challenges/ChallengeRoom.tsx") },
  "13.3": { c: "wired", re: g("challenges/tracker/page.tsx"), ic: comp("challenges/ChallengeTrackerView.tsx") },
  "14.1": { c: "wired", re: g("layout.tsx"), ic: comp("cart/CartDrawer.tsx"), cc: comp("cart/MiniCartBar.tsx") },
  "14.2": { c: "missing", re: g("menu/page.tsx"), d: ["DEF-14.2-MENUEMPTY-001"] },
  "14.3": { c: "missing", re: f("plan/[planId]/page.tsx"), d: ["DEF-14.3-GENLOADING-001", "DEF-J2-PLANCONFIG-001"] },
  "14.4": { c: "missing", re: f("plan/[planId]/page.tsx"), d: ["DEF-14.4-GENERROR-001", "DEF-J2-PLANCONFIG-001"] },
  "14.5": { c: "wired", re: g("account/addresses/page.tsx"), ic: comp("account/AddressManager.tsx") },
  "14.6": { c: "partial", re: f("checkout/page.tsx"), ic: comp("checkout/plan/PlanCheckout.tsx"), d: ["DEF-14.6-PAYPROCESSING-001"] },
  "14.7": { c: "wired", re: f("checkout/page.tsx"), ic: comp("checkout/UnresolvedPaymentPanel.tsx") },
};
for (const id of ["7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "7.10"]) {
  CLS[id] = { c: "rebuild", re: f("custom-build/page.tsx"), ic: comp("custom/CustomBuildHub.tsx"), d: ["DEF-J4-CUSTOMBUILD-001"] };
}

// Semantic seed. t=artifactType, r=canonicalRoute ("global" = app-level
// surface with no single owning route), s=state, l=layout, trig, tr=transition
// (null => not-applicable), pa=expectedPrimaryAction, cb=closeBehavior,
// tv=triggerDefinition status override ("verified" only where the trigger was
// confirmed in code on this branch).
const btn = (name, src, extra = {}) => ({ type: "button", accessibleName: name, sourceState: src, ...extra });
const nav = (name) => ({ type: "route-navigation", accessibleName: name, sourceState: "any" });
const srv = (code, src) => ({ type: "server-response", accessibleName: code, sourceState: src });
const T = (from, action, to) => ({ from, action, to });

const SEED = {
  "4.1": { t: "design-system-reference", r: "/styleguide", s: "dark", l: "GlobalLayout", trig: nav("Styleguide"), pa: "Inspect design tokens" },
  "4.2": { t: "design-system-reference", r: "/styleguide", s: "light", l: "GlobalLayout", trig: nav("Styleguide (light)"), pa: "Inspect design tokens" },
  "5.1": { t: "route", r: "/", s: "default", l: "GlobalLayout", trig: nav("Home tab"), pa: "Order today", tv: "verified" },
  "5.2": { t: "route", r: "/menu", s: "default", l: "GlobalLayout", trig: nav("Menu tab"), pa: "Add a dish to cart", tv: "verified" },
  "5.3": { t: "overlay", r: "/menu", s: "filter-sheet-open", l: "GlobalLayout", trig: btn("Filter", "menu-default"), tr: T("menu-default", "OPEN_FILTERS", "filter-sheet-open"), pa: "Apply filters", cb: CLOSE, tv: "partial" },
  "5.4": { t: "overlay", r: "/menu", s: "dish-quick-view-open", l: "GlobalLayout", trig: btn("Dish card (dish name)", "menu-default"), tr: T("menu-default", "OPEN_DISH_QUICK_VIEW", "dish-quick-view-open"), pa: "Add to cart", cb: CLOSE, tv: "verified" },
  "5.5": { t: "route", r: "/dish/[slug]", s: "default", l: "FocusLayout", trig: { type: "link", accessibleName: "Dish card", sourceState: "menu-default" }, pa: "Add to cart", tv: "verified" },
  "5.6": { t: "drawer", r: "global", s: "cart-drawer-open", l: "GlobalLayout", trig: btn("View cart", "any-commerce-surface"), tr: T("any-commerce-surface", "OPEN_CART_DRAWER", "cart-drawer-open"), pa: "Checkout", cb: CLOSE },
  "5.7": { t: "route", r: "/marketplace", s: "default", l: "GlobalLayout", trig: nav("Marketplace"), pa: "Add a product to cart", tv: "verified" },
  "5.8": { t: "route", r: "/marketplace/[slug]", s: "default", l: "FocusLayout", trig: { type: "link", accessibleName: "Product card", sourceState: "marketplace-default" }, pa: "Add to cart", tv: "verified" },
  "5.9": { t: "route", r: "/meal-deals", s: "default", l: "GlobalLayout", trig: nav("Meal deals"), pa: "Add combo to cart", tv: "verified" },
  "5.10": { t: "route", r: "/meal-recommendations", s: "default", l: "GlobalLayout", trig: nav("Meal recommendations"), pa: "Add recommended dish", tv: "verified" },
  "5.11": { t: "route", r: "/meal-guides/[dishSlug]", s: "default", l: "GlobalLayout", trig: { type: "link", accessibleName: "Meal guide link", sourceState: "order-history" }, pa: "Reorder dish" },
  "5.12": { t: "route", r: "/recipes", s: "default", l: "GlobalLayout", trig: nav("Recipes"), pa: "Open recipe", tv: "verified" },
  "6.1": { t: "route", r: "/plans", s: "default", l: "GlobalLayout", trig: nav("Plan tab"), pa: "Pick your goal", tv: "verified" },
  "6.2": { t: "overlay", r: "/plans", s: "mealtime-sheet-open", l: "GlobalLayout", trig: btn("Select mealtime", "plans-default"), tr: T("plans-default", "OPEN_MEALTIME", "mealtime-sheet-open"), pa: "Confirm mealtime", cb: CLOSE },
  "6.3": { t: "component-state", r: "/plan/[planId]", s: "initial-configuration", l: "FocusLayout", trig: nav("Plan card"), tr: T("entry", "BEGIN_CONFIGURATION", "initial-configuration"), pa: "Generate my week" },
  "6.4": { t: "component-state", r: "/plan/[planId]", s: "lineup-active", l: "FocusLayout", trig: srv("lineup_ready", "generating"), tr: T("generating", "LINEUP_READY", "lineup-active"), pa: "Continue to schedule" },
  "6.5": { t: "overlay", r: "/plan/[planId]", s: "change-dish-open", l: "FocusLayout", trig: btn("Change dish", "lineup-active", { requiredConditions: ["meal slot is editable", "change cutoff has not passed"], blockedBehavior: { code: "meal_change_unavailable", message: "This meal can no longer be changed.", recoveryAction: "Return to plan" } }), tr: T("lineup-active", "OPEN_CHANGE_DISH", "change-dish-open"), pa: "Replace meal", cb: CLOSE },
  "6.6": { t: "overlay", r: "/plan/[planId]", s: "accompaniment-editor-open", l: "FocusLayout", trig: btn("Edit accompaniment", "lineup-active"), tr: T("lineup-active", "OPEN_ACCOMPANIMENT_EDITOR", "accompaniment-editor-open"), pa: "Save accompaniments", cb: CLOSE },
  "6.7": { t: "component-state", r: "/plan/[planId]", s: "delivery-schedule", l: "FocusLayout", trig: btn("Continue to schedule", "lineup-active"), tr: T("lineup-active", "CONTINUE_TO_SCHEDULE", "delivery-schedule"), pa: "Continue to checkout" },
  "6.8": { t: "route", r: "/trial", s: "default", l: "FocusLayout", trig: nav("Try 3 days first"), pa: "Start my 3-day trial", tv: "verified" },
  "6.9.1": { t: "wizard-stage", r: "/quick-setup", s: "step-1-goal", l: "FocusLayout", trig: nav("Quick setup"), tr: T("entry", "BEGIN", "step-1-goal"), pa: "Continue", tv: "verified" },
  "6.9.2": { t: "wizard-stage", r: "/quick-setup", s: "step-2-food-pattern", l: "FocusLayout", trig: btn("Continue", "step-1-goal"), tr: T("step-1-goal", "CONTINUE", "step-2-food-pattern"), pa: "Continue", tv: "verified" },
  "6.9.3": { t: "wizard-stage", r: "/quick-setup", s: "step-3-cadence", l: "FocusLayout", trig: btn("Continue", "step-2-food-pattern"), tr: T("step-2-food-pattern", "CONTINUE", "step-3-cadence"), pa: "See my plan", tv: "verified" },
  "7.2": { t: "wizard-stage", r: "/custom-build", s: "goal", l: "FocusLayout", trig: nav("Custom build"), tr: T("entry", "BEGIN", "goal"), pa: "Next: Routine" },
  "7.3": { t: "wizard-stage", r: "/custom-build", s: "routine", l: "FocusLayout", trig: btn("Next: Routine", "goal"), tr: T("goal", "NEXT", "routine"), pa: "Next: Preferences" },
  "7.4": { t: "component-state", r: "/custom-build", s: "wearable-interstitial", l: "FocusLayout", trig: btn("Connect wearable", "routine"), tr: T("routine", "OFFER_WEARABLE", "wearable-interstitial"), pa: "Connect or skip" },
  "7.5": { t: "wizard-stage", r: "/custom-build", s: "preferences", l: "FocusLayout", trig: btn("Continue", "wearable-interstitial"), tr: T("wearable-interstitial", "NEXT", "preferences"), pa: "Next: Intensity" },
  "7.6": { t: "wizard-stage", r: "/custom-build", s: "intensity", l: "FocusLayout", trig: btn("Next: Intensity", "preferences"), tr: T("preferences", "NEXT", "intensity"), pa: "Next: Duration" },
  "7.7": { t: "wizard-stage", r: "/custom-build", s: "duration-renewal", l: "FocusLayout", trig: btn("Next: Duration", "intensity"), tr: T("intensity", "NEXT", "duration-renewal"), pa: "Review my build" },
  "7.8": { t: "wizard-stage", r: "/custom-build", s: "review", l: "FocusLayout", trig: btn("Review my build", "duration-renewal"), tr: T("duration-renewal", "NEXT", "review"), pa: "Generate my plan" },
  "7.9": { t: "component-state", r: "/custom-build", s: "generated-plan", l: "FocusLayout", trig: srv("generation_complete", "generating"), tr: T("generating", "GENERATED", "generated-plan"), pa: "Continue to checkout" },
  "7.10": { t: "component-state", r: "/custom-build", s: "pre-checkout", l: "FocusLayout", trig: btn("Continue to checkout", "generated-plan"), tr: T("generated-plan", "CONTINUE", "pre-checkout"), pa: "Proceed to payment" },
  "8.1": { t: "route", r: "/checkout", s: "quote-active", l: "FocusLayout", trig: btn("Checkout", "cart-drawer-open"), pa: "Pay", tv: "verified" },
  "8.2": { t: "recovery-state", r: "/checkout", s: "quote-expired", l: "FocusLayout", trig: srv("QUOTE_EXPIRED", "quote-active"), tr: T("quote-active", "QUOTE_EXPIRED", "quote-expired"), pa: "Refresh quote" },
  "8.3": { t: "route", r: "/order/confirmed/[orderId]", s: "default", l: "FocusLayout", trig: srv("payment_succeeded", "payment-processing"), pa: "Track order", tv: "verified" },
  "9.1": { t: "route", r: "/meal-planner", s: "default", l: "GlobalLayout", trig: nav("Meal planner"), pa: "Swap a meal", tv: "verified" },
  "9.2": { t: "overlay", r: "/meal-planner", s: "manage-delivery-open", l: "GlobalLayout", trig: btn("Manage", "delivery-list"), tr: T("delivery-list", "OPEN_MANAGE_DELIVERY", "manage-delivery-open"), pa: "Save delivery change", cb: CLOSE, tv: "verified" },
  "9.3": { t: "route", r: "/account/subscriptions", s: "default", l: "GlobalLayout", trig: nav("Subscriptions"), pa: "Pause plan", tv: "verified" },
  "10.1": { t: "route", r: "/account", s: "default", l: "GlobalLayout", trig: nav("Account tab"), pa: "Open orders", tv: "verified" },
  "10.2": { t: "route", r: "/account/orders", s: "default", l: "GlobalLayout", trig: nav("Orders"), pa: "View order", tv: "verified" },
  "10.3": { t: "route", r: "/account/addresses", s: "default", l: "GlobalLayout", trig: nav("Addresses"), pa: "Add address", tv: "verified" },
  "10.4": { t: "route", r: "/account/preferences", s: "default", l: "GlobalLayout", trig: nav("Preferences"), pa: "Save preferences", tv: "verified" },
  "10.5": { t: "route", r: "/account/wellness", s: "default", l: "GlobalLayout", trig: nav("Wellness"), pa: "Log a meal", tv: "verified" },
  "10.6": { t: "route", r: "/account/history", s: "default", l: "GlobalLayout", trig: nav("History"), pa: "Review week", tv: "verified" },
  "10.7": { t: "route", r: "/account/symptoms", s: "default", l: "GlobalLayout", trig: nav("Symptoms"), pa: "Log symptom", tv: "verified" },
  "10.8": { t: "route", r: "/account/connections", s: "default", l: "GlobalLayout", trig: nav("Health connections"), pa: "Connect Apple Health", tv: "verified" },
  "10.9": { t: "overlay", r: "/account", s: "rate-meal-open", l: "GlobalLayout", trig: btn("Rate meal", "order-history"), tr: T("order-history", "OPEN_FEEDBACK", "rate-meal-open"), pa: "Submit feedback", cb: CLOSE },
  "11.1": { t: "route", r: "/metabolic", s: "default", l: "GlobalLayout", trig: nav("Metabolic"), pa: "See matching plan" },
  "11.2": { t: "route", r: "/performance", s: "default", l: "GlobalLayout", trig: nav("Performance"), pa: "See matching plan", tv: "verified" },
  "11.3": { t: "route", r: "/clinical", s: "default", l: "GlobalLayout", trig: nav("Clinical"), pa: "See matching plan", tv: "verified" },
  "11.4": { t: "route", r: "/care/[condition]", s: "default", l: "GlobalLayout", trig: nav("Condition care"), pa: "See matching plan", tv: "verified" },
  "11.5": { t: "route", r: "/rd", s: "default", l: "GlobalLayout", trig: nav("Dietitians"), pa: "View dietitian", tv: "verified" },
  "11.6": { t: "component-state", r: "/rd/[slug]", s: "booking-active", l: "GlobalLayout", trig: btn("Book", "rd-profile"), tr: T("rd-profile", "BEGIN_BOOKING", "booking-active"), pa: "Confirm booking" },
  "11.7": { t: "route", r: "/coach", s: "default", l: "GlobalLayout", trig: nav("Coach"), pa: "Ask the coach", tv: "verified" },
  "11.8": { t: "route", r: "/qa", s: "default", l: "GlobalLayout", trig: nav("Q&A"), pa: "Ask a question", tv: "verified" },
  "12.1": { t: "route", r: "/corporate/invite/[token]", s: "default", l: "FocusLayout", trig: { type: "link", accessibleName: "Corporate invite link", sourceState: "external" }, pa: "Activate benefit", tv: "verified" },
  "12.2": { t: "route", r: "/corporate-wellness", s: "default", l: "B2BLayout", trig: nav("Corporate wellness"), pa: "Request a proposal", tv: "verified" },
  "12.3": { t: "route", r: "/partners/gyms", s: "default", l: "B2BLayout", trig: nav("Gym partners"), pa: "Partner with us", tv: "verified" },
  "12.4": { t: "component-state", r: "/partners/gyms", s: "member-verification", l: "B2BLayout", trig: btn("Check my member benefit", "gyms-default"), tr: T("gyms-default", "BEGIN_VERIFICATION", "member-verification"), pa: "Verify membership" },
  "12.5": { t: "route", r: "/partners/fitness-clubs", s: "default", l: "B2BLayout", trig: nav("Fitness clubs"), pa: "Partner with us", tv: "verified" },
  "12.6": { t: "route", r: "/partners/dietitians", s: "default", l: "B2BLayout", trig: nav("Dietitian partners"), pa: "Refer a client", tv: "verified" },
  "12.7": { t: "route", r: "/rd-partners", s: "default", l: "B2BLayout", trig: nav("RD partner network"), pa: "Apply to the network", tv: "verified" },
  "13.1": { t: "route", r: "/challenges", s: "default", l: "GlobalLayout", trig: nav("Challenges"), pa: "View challenge", tv: "verified" },
  "13.2": { t: "route", r: "/challenges/[slug]", s: "default", l: "GlobalLayout", trig: { type: "link", accessibleName: "Challenge card", sourceState: "challenges-default" }, pa: "Register", tv: "verified" },
  "13.3": { t: "route", r: "/challenges/tracker", s: "default", l: "GlobalLayout", trig: nav("Challenge tracker"), pa: "Log activity", tv: "verified" },
  "14.1": { t: "empty-state", r: "global", s: "cart-empty", l: "GlobalLayout", trig: { type: "empty-data condition", accessibleName: "Cart has zero items", sourceState: "cart-drawer-open" }, pa: "Browse the menu", tv: "verified" },
  "14.2": { t: "empty-state", r: "/menu", s: "no-matching-meals", l: "GlobalLayout", trig: { type: "empty-data condition", accessibleName: "Filters match zero dishes", sourceState: "filter-applied" }, pa: "Clear filters" },
  "14.3": { t: "loading-state", r: "/plan/[planId]", s: "plan-generating", l: "FocusLayout", trig: srv("generating", "initial-configuration"), tr: T("initial-configuration", "GENERATE", "plan-generating"), pa: "Wait or cancel" },
  "14.4": { t: "recovery-state", r: "/plan/[planId]", s: "generation-failed", l: "FocusLayout", trig: srv("generation_failed", "plan-generating"), tr: T("plan-generating", "GENERATION_FAILED", "generation-failed"), pa: "Try again" },
  "14.5": { t: "component-state", r: "/account/addresses", s: "unserviceable-address", l: "GlobalLayout", trig: { type: "serviceability result", accessibleName: "Pincode outside delivery area", sourceState: "address-form" }, pa: "Change address", tv: "verified" },
  "14.6": { t: "component-state", r: "/checkout", s: "payment-processing", l: "FocusLayout", trig: srv("payment_verifying", "quote-active"), tr: T("quote-active", "PAY", "payment-processing"), pa: "Wait for verification", tv: "partial" },
  "14.7": { t: "recovery-state", r: "/checkout", s: "payment-unresolved", l: "FocusLayout", trig: { type: "timeout", accessibleName: "Payment verification timed out", sourceState: "payment-processing" }, tr: T("payment-processing", "PAYMENT_TIMEOUT", "payment-unresolved"), pa: "Check payment status", tv: "verified" },
};

const TESTFILE = (id) => {
  const grp = id.startsWith("4.") ? "design-system"
    : id.startsWith("5.") ? "commerce"
    : id.startsWith("6.9") ? "quick-setup"
    : id.startsWith("6.") ? "plan-discovery"
    : id.startsWith("7.") ? "custom-build"
    : id.startsWith("8.") ? "checkout"
    : id.startsWith("9.") || id.startsWith("10.") ? "account"
    : id.startsWith("11.") ? "clinical"
    : id.startsWith("12.") ? "partners"
    : id.startsWith("13.") ? "challenges"
    : "utility-states";
  return `${SF}/e2e/stitch-runtime/${grp}.spec.ts`;
};

const REBUILD_REASONS = {
  J2: "PlanBuilder's configure-by-exception summary removes core approved tasks: server generation visibility, day-by-day lineup, Keep/Shuffle/Undo, Change Dish, accompaniment editing and schedule control. Not contract-equivalent. Rebuild track: Journey 2 UI over the merged A2 plan-draft contracts (PRs #29–#34).",
  J4: "CustomBuildHub (dish customisation) removes the approved 6-stage guided build (goal → routine → wearable → preferences → intensity → duration+renewal → review), the renewal disclosure and the generated-plan review. Not contract-equivalent. Rebuild track: Journey 4 against A2 contracts.",
};

function proofFor(cls, seed) {
  const isRoute = seed.t === "route" || seed.t === "design-system-reference";
  const hasTr = Boolean(seed.tr);
  const base = {
    declared: "verified",
    sourceDefinition: "verified",
    renderChain: "verified",
    triggerDefinition: seed.tv ?? "pending",
    transitionDefinition: hasTr ? (seed.tv === "verified" ? "verified" : "pending") : (isRoute ? "not-applicable" : "pending"),
    localRuntime: "pending",
    containerRuntime: "pending",
    stagingRuntime: "pending",
    productionRuntime: "pending",
    visualApproval: "pending",
    accessibilityApproval: "pending",
  };
  if (cls.c === "partial") {
    base.sourceDefinition = "partial";
    base.renderChain = "partial";
  } else if (cls.c === "missing") {
    base.sourceDefinition = "missing";
    base.renderChain = "missing";
    base.triggerDefinition = "missing";
    if (hasTr) base.transitionDefinition = "missing";
  } else if (cls.c === "unwired") {
    base.renderChain = "missing";
    base.triggerDefinition = "missing";
    base.transitionDefinition = "missing";
  } else if (cls.c === "rebuild") {
    base.sourceDefinition = "missing";
    base.renderChain = "missing";
    base.triggerDefinition = "pending";
    base.transitionDefinition = "pending";
  }
  return base;
}

const v1 = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
if (v1.some((e) => e.schemaVersion === 2)) {
  console.error("Manifest already at schemaVersion 2 — refusing to migrate.");
  process.exit(1);
}

const v2 = v1.map((e) => {
  const cls = CLS[e.promptId];
  const seed = SEED[e.promptId];
  if (!cls || !seed) throw new Error(`No seed/classification for ${e.promptId}`);
  const rebuild = cls.c === "rebuild";
  return {
    schemaVersion: 2,
    promptId: e.promptId,
    stitchScreenId: e.stitchScreenId,
    designName: e.designName,
    artifactType: seed.t,
    canonicalRoute: seed.r,
    state: seed.s,
    layout: seed.l,
    themes: [e.theme],
    viewport: e.viewport,
    // For rebuild-required entries the ORIGINAL design has no implementation;
    // the shipped stand-in is recorded as replacementDecision.interimImplementation.
    implementationComponent: rebuild ? null : (cls.ic ?? null),
    routeEntryPoint: cls.re ?? null,
    controllerComponent: cls.cc ?? null,
    trigger: seed.trig,
    transition: seed.tr ?? "not-applicable",
    expectedPrimaryAction: seed.pa,
    expectedCloseBehavior: seed.cb ?? null,
    referenceArtifact: e.referenceArtifact,
    implementationArtifacts: { dark: e.implementationArtifact ?? null, light: null },
    testId: e.testId,
    testFile: TESTFILE(e.promptId),
    proof: proofFor(cls, seed),
    evidence: [],
    evidenceSha: null,
    defectIds: cls.d ?? [],
    designDisposition: rebuild ? "rebuild-required" : "original",
    ...(rebuild
      ? {
          replacementDecision: {
            status: "rebuild",
            interimImplementation: cls.ic,
            reason: REBUILD_REASONS[e.promptId.startsWith("7.") ? "J4" : "J2"],
            decidedBy: "chandan (standing product decision)",
            decidedAt: NOW,
          },
        }
      : {}),
  };
});

fs.writeFileSync(MANIFEST, JSON.stringify(v2, null, 2) + "\n");
console.log(`Migrated ${v2.length} entries to schemaVersion 2 -> ${path.relative(ROOT, MANIFEST)}`);
