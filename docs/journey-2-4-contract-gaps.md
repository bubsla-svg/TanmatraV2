# Journey 2 (Plan Configuration) & Journey 4 (Custom Build) — Contract-Gap Record

**Status:** Pre-implementation audit, filed in place of PR A ("Shared plan domain adapters") per the
owner's 2026-08-09 rebuild authorization. Read before starting PR B/C/D.

**Why this exists.** The rebuild authorization frames PR A as "typed adapters to existing backend
services." A full evidence-based audit (four parallel investigations: backend route/schema reads,
full git-history reconstruction of the two prior mockup files, and a live-baseline read of both
routes) found that most of the backend capability PR B–D would adapt to **does not exist**. Building
against it would mean either fabricating frontend-only business logic (explicitly prohibited) or
shipping UI wired to nothing (exactly the defect class that was already found and removed once in
this codebase — see §2). This document is the "explicit contract-gap defect" the authorization
itself calls for, filed instead of code that can't be built honestly yet.

**Three things are true simultaneously and none of them reopen the decision:**
1. The rebuild is still authorized. Plan checkout is still gated. Nothing here argues against building
   Journey 2/4 properly.
2. The current PR sequence (A adapters → B Journey 2 UI → C Custom Build UI → D generated-plan/checkout
   → E reconciliation) assumes backend readiness that isn't there. Sequencing needs to change, not the goal.
3. Two structural facts (§1, §5) weren't visible from the chat spec alone and materially change scope.
   They're surfaced here, not silently worked around.

---

## §1. The Stitch manifest does not back the flow it names

`docs/audit/stitch-74-reconciliation.json` and `docs/stitch/stitch-screen-manifest.json` both carry
entries 6.2–6.7, 14.3–14.4, and 7.2–7.10 with the exact screen names used in the rebuild spec
("Day-by-Day Meal Lineup", "Change Dish Bottom Sheet", "Custom Build Step 4: Plan Intensity", etc.),
each marked `automatedContractStatus: "passed"`.

That status is stale and refers to a defect, not a design. The `implementationComponent` these entries
point to (`PlanConfigClient.tsx`, `CustomBuildClient.tsx`) were non-functional mockups — see §2 — and
`automatedContractStatus: "passed"` was recorded while they were live, before they were correctly
deleted. No `referenceArtifact` PNG the manifest cites (`artifacts/stitch/reference/6.4.png` etc.)
exists anywhere in the repo or git history — the visual design these entries describe was never
actually produced.

The two Stitch HTML mockups that **do** exist on disk and are real design artifacts —
`docs/stitch/route-05-subscribe/plan-config.stitch.html` and
`docs/stitch/route-25-custom-build/custom-build.stitch.html` — describe a **materially simpler** flow
than the rebuild spec: plan-config is a 3-section single page (protein track → billing cycle → static
order summary, hardcoded ₹3,200/₹12,600/₹12,100 literals, no day-lineup/change-dish/accompaniment
concept at all); custom-build is a single "Step 2 of 4: Custom Build" screen picking one dish's base
protein. Neither shows a Mealtime Preference sheet, a Day-by-Day Lineup, a Change Dish sheet, an
Accompaniment Editor, or any of Custom Build's 10 stages.

**Conclusion:** the elaborate flow in the rebuild spec is a fresh specification, not a recovered or
previously-designed one. That's fine — the owner is the product authority and the spec is detailed and
actionable — but "reconcile with the Stitch manifest" (PR E) needs a new manifest entry set, not a
diff against what's there today. Flagging so E isn't scoped against something that doesn't exist.

## §2. There is no prior working implementation to restore

Full git archaeology on `PlanConfigClient.tsx` and `CustomBuildClient.tsx` (the two files commit
`ec04879` deleted, and the ones the stale manifest entries point to):

- Total lifespan: 3 commits. `c8dfe9e` created them from nothing (not a rewrite of an earlier real
  version — confirmed via `git show c8dfe9e~1:<path>` → `fatal: path does not exist` for both).
  `bfa3196` patched one `Link` href. `ec04879` deleted them. They were mockups for their entire
  existence.
- Zero API calls in either file — no `fetch`/`apiPost`/`apiGet`/`useEffect`/`await`, confirmed by grep
  across both files. All state was local `useState` with no persistence, no server round-trip.
- `PlanConfigClient.tsx`: a `proteinTrack` selection state that is set but never read anywhere else in
  the file — not passed to the checkout link, not used in pricing. Discarded silently on continue. Five
  hardcoded rupee literals (₹3,200 / ₹12,600 / ₹500 / ₹0 / ₹12,100), none sourced from a server response
  or shared pricing module — matches the commit message's "-5 fabricated money literals" claim exactly.
- `CustomBuildClient.tsx`: the literal string "Step 2 of 4: Custom Build" with a decorative dot
  indicator and no state machine behind it. Seven hardcoded rupee literals in a local
  `calculateTotal()` with no server round-trip. "Add to cart" is a bare `<Link href="/cart">` that
  carries none of the customer's selections forward.
- `ec04879`'s commit message correctly diagnoses both defects; its one factual slip is attributing the
  literal "Step 2 of 4" string to `PlanConfigClient` when it's actually in `CustomBuildClient` (verified
  directly — `PlanConfigClient`'s stepper is three unlabeled bars, no text). Immaterial to the
  substance: both files were genuinely non-functional.

**What `ec04879` actually did** was restore a *different*, earlier, real implementation that predates
these mockups — `components/plans/PlanBuilder.tsx`, `components/custom/CustomBuildHub.tsx`,
`GoalRouter.tsx`, `OrderBump.tsx`, `Waitlist.tsx`, etc. — which an even earlier commit (`925104f2`) had
quarantined (pure rename, not deleted) rather than lost. That restoration is what's live today, and
it's genuinely well-built: `PlanBuilder.tsx` sources every price from `lib/plans.ts`'s spine-quoted
`planQuoteView`, with an explicit comment that "the server re-quotes authoritatively at checkout."
`CustomBuildHub.tsx` carries a comment stating outright: "This file must never invent its own add-on
system or its own price arithmetic that lands in the cart." These are not stubs to throw away — they
are the honest baseline the rebuild extends, not something the rebuild recovers from a richer prior
state.

**Conclusion:** there is no "gold" implementation of the elaborate flow anywhere in this repo's
history to restore. Journey 2 and Journey 4, as specified, are greenfield builds on top of the current
honest-but-simple `PlanBuilder`/`CustomBuildHub`, not a restoration exercise.

## §3. Journey 2 backend contract gaps

Current live Journey 2 (`/plans` → `/plan/[planId]` → `PlanBuilder`/`Waitlist` → gated checkout) is a
single-screen, three-decision confirm-by-exception flow (diet track, optional cycle, optional RD
add-on). Every one of the following is a genuine gap, not a partial implementation:

| Target capability | Backend reality |
|---|---|
| Mealtime Preference step | No mealtime (breakfast/lunch/dinner slot) capture anywhere pre-builder. `GoalRouter` asks one goal question, not mealtime. |
| Recommended Plan (algorithmic) | `GoalRouter`'s answer maps 1:1 to a hardcoded `PlanId` via `routerAnswer` in `PLAN_CATALOG` — a lookup table, not a recommendation engine. |
| Initial Configuration (goal/mealtime/dietary-pattern/hard-restrictions/duration/meals/pricing as discrete reviewable fields) | `PlanBuilder` only exposes diet track (3-way) and cycle as editable. No dietary-pattern field distinct from track, no hard-restriction/allergen capture at config time, no meals-per-day selector — `mealsPerCycle`/`slots` are fixed per plan in `PLAN_CATALOG`. |
| Plan Generation (loading + real progress + error recovery) | Does not exist for `PLAN_CATALOG` plans. Track/cycle selection is synchronous local state — no async call, hence no loading UI, no generation-error-recovery UI. |
| Day-by-Day Meal Lineup (date/slot/dish/calories/protein/rationale/keep/shuffle/undo/change-dish/accompaniment) | **Zero implementation, and architecturally blocked.** `PlanConfig` (`lib/subscription-rules/src/planCatalog.ts`) has no date field, no per-day array, no per-meal-choice field of any kind — confirmed by full read. A plan is `mealsPerCycle` + `slots` + one `poolQuery` predicate that filters the live dish catalog; it is not a scheduled, per-day itinerary. This is not a missing screen, it's a missing data model. |
| Change Dish (server-filtered candidates + price delta) | The only comparable machinery, `validateMacroCapForSwap` + `POST /subscription-deliveries/:id/swap`, is strictly **post-purchase** (requires an existing `subscriptionId` + `deliveryId` row). Nothing returns safety-filtered, macro-cap-aware, price-differenced candidates pre-purchase. |
| Accompaniment Editor (side/grain/dip/add-on) | Does not exist at any lifecycle stage. "accompaniment"/"side"/"grain"/"dip" appear nowhere in `subscriptions.ts`, `subscriptionPricing.ts`, or `planCatalog.ts`. The only adjacent concept, `lib/dishCustomizations.ts`, is an à-la-carte checkout-cart resolver, structurally unrelated to subscription plan slots. |
| Delivery Schedule (eligible dates/windows/serviceability/cutoff/fee) | No pre-purchase capacity/eligible-dates/serviceability endpoint for subscriptions. `deliveryWindow` is unvalidated free text (`z.string().min(3).max(32)`); `pincode` has no serviceability check wired in — the à-la-carte checkout's `isServiceablePincode` is never imported by `subscriptions.ts`. Capacity (`deliverySlotsTable`) is checked in exactly one place, `POST /subscriptions/:id/convert`, which is post-purchase trial-to-paid conversion, not pre-purchase config. |
| Quote Readiness (composite state) | No subscriptions-equivalent of à-la-carte's `POST /orders/quote`, which bundles cart validation + a serviceability block into one response. `POST /subscriptions/quote` returns a price breakdown only — no readiness/serviceability/capacity composite. It also silently ignores a submitted `dayPlan` for pricing purposes (the field is declared in the schema, never read in the handler body). |

**The closest existing analog** — a real, working, day-by-day lineup with date/slot/dish/macros,
keep/swap/regen, and an accept-and-schedule action — is the AI weekly meal-planner at `/meal-planner`
(`components/mealplan/*`, `POST /meal-plans/*`). It is **not reachable from Journey 2 in either
direction** (zero cross-references confirmed by grep) and is **structurally incompatible as-is**: it
operates on an already-active weekly subscription, explicitly states "NO charge path" in its own code
comments, and has no concept of `PlanId`/`PLAN_CATALOG` selection, diet track, or cycle. Reusing its
architecture is the right instinct (see §6), but it cannot be wired directly onto `PLAN_CATALOG` plans
without either giving `PlanConfig` a day-level schema or redesigning the plan model.

## §4. Journey 4 backend contract gaps + a routing collision

**The route is not empty.** `/custom-build` is live today and serves a real, working, unrelated
feature: pick one dish from the menu, configure its own customization groups (bread/sauce/portion
type), preview-price it, add to cart — server re-prices at checkout. Zero goal/routine/wearable/
intensity/duration inputs. `CustomBuildHub.tsx`'s own header comment: "must never invent its own price
arithmetic that lands in the cart." This is not a stub or a placeholder — it's a shipped feature at the
exact URL the rebuild spec wants for a completely different wizard. **A decision is needed**: does the
Custom Build wizard get a different route, does the existing dish-customization feature move elsewhere,
or does something else resolve the collision? The rebuild spec doesn't address this because it assumes
`/custom-build` is available.

**No backend endpoint accepts the wizard's input shape and returns a plan a customer can buy.** Three
separate "plan" mechanisms exist in this codebase and none of them do this:

1. `PLAN_CATALOG` — a fixed 6-SKU catalog, **selected** via a required `planId`, not generated.
   `POST /subscriptions[/quote]` explicitly reject freeform pricing: `"planId is required...; legacy
   pricing is disabled"` (`code: legacy_pricing_disabled`).
2. The AI weekly meal-planner (`POST /meal-plans/generate`) — real, persisted, takes
   goal/dietaryStyle/allergens/spiceLevel/calorie-protein targets, produces a genuine editable 7-day ×
   3-meal plan. **But `POST /meal-plans/:id/accept` only attaches days to an already-active weekly
   subscription's already-scheduled deliveries — it has no charge path and cannot originate a new
   subscription.** This is the single most load-bearing gap in the whole rebuild: the one real
   generator that persists explicitly cannot be the terminus of a purchase flow.
3. `POST /wellness/precision-planner/generate` — an unauthenticated BMR/TDEE calculator that
   round-robins a 7-day thali plan. No DB write, no cart/checkout linkage at all.

Gap-by-gap against the wizard's 10 stages:

| Target capability | Backend reality |
|---|---|
| Routine (meal-periods/days-per-week/delivery-context) | No endpoint takes this input anywhere. Both generators are hardcoded to 7 days × their fixed meal slots. |
| Wearable connection influencing generation | Wearable sync (`wearableLinksTable`) is real and live, but feeds only the `/wellness/today` calorie *display* — never consumed by either plan generator. |
| Food Preferences: hard allergens vs. soft dislikes | Not actually distinguished server-side. `mealPlanner.ts`'s `buildCandidatePool` hardcodes `dislikedIngredients: []` — soft dislikes currently have zero effect on generation despite the field existing in the preferences schema. |
| Plan Intensity (portion profile, protein/carb direction, up to 3 priorities) | Neither generator models this. Both take only raw `dailyCalorieTarget`/`dailyProteinTargetGrams` numbers. |
| Duration + explicit renewal behavior | No concept for a freely-generated plan. `PLAN_CATALOG` plans have a fixed preset cycle; there is no wizard-selected duration/renewal answer path. |
| Generation → purchasable subscription | **Does not exist.** See the meal-planner "no charge path" gap above — this blocks the entire back half of Journey 4 (generated-plan-review → pre-checkout → ready-for-quote → the gated checkout it's supposed to feed). |

## §5. What's genuinely reusable (the honest PR A deliverable)

Not everything is a gap. These are real, tested, live, and the rebuild should build on them rather
than duplicate them — this is the actual adapter surface PR A can honestly wrap:

- **Preferences save**: `PATCH/PUT /preferences` + `artifacts/storefront/lib/preferencesApi.ts`'s
  `savePreferences()` already round-trips goal/allergens/dietaryStyle/spiceLevel/activityLevel/
  dislikedIngredients/cuisines, and `QuickSetupWizard.tsx` (PR #26) already calls it end-to-end with
  401 → inline `PhoneAuth` handling. Journey 4's Food Preferences stage should call this directly.
- **Goal-to-dish matching**: `lib/recommendations.ts` + `lib/menuFit.ts` (client) and
  `@workspace/preferences-match`'s `evaluateDishForPreferences` (server, shared by both the
  meal-planner's candidate pool and the subscription safety gate) are real and tested.
- **The meal-planner's architecture** (`useMealPlan.ts`'s TanStack Query mutation shape: generate/
  swap/regenDay/accept/discard with a `needsAuth` phase; `DayCard.tsx`'s date/slot/dish/macro/keep/
  swap/regen presentation) is the right *pattern* to follow for both journeys' generation and lineup
  UI, even though the entity itself (`MealPlan`) can't be reused directly without backend changes.
- **`PlanBuilder`/`CustomBuildHub`'s pricing discipline** (spine-quoted, server re-prices at checkout,
  explicit "never invent price arithmetic" comments) is exactly right and should carry forward
  unchanged into whatever replaces them.
- **Quote-readiness pattern**: à-la-carte's `POST /orders/quote` (bundles cart validation +
  serviceability into one response) is the right shape for a `POST /subscriptions/quote`-readiness
  equivalent — it doesn't exist for subscriptions today, but the pattern to copy already exists and
  is tested.

## §6. Recommended sequencing

The original PR sequence (A adapters → B Journey 2 → C Custom Build → D generated-plan/checkout → E
reconciliation) assumed B/C/D could be built against existing backend services. They can't, without
either faking business logic or shipping UI wired to nothing — the exact defect class §2 documents
getting removed once already. Proposed replacement, still ending at the same gate (plan checkout
stays gated; production acceptance is NO-GO until both journeys are reconciled):

1. **PR A (this document)** — contract-gap record. Done.
2. **PR A2 — Backend: pre-purchase plan-configuration contracts.** Design and implement, on the
   api-server, the actual missing capability: a day-level plan schema (or an explicit decision to
   bolt day-level structure onto `PLAN_CATALOG` vs. redesign), a pre-purchase safety+macro-cap+
   price-differenced candidate endpoint, an accompaniment concept, a pre-purchase delivery-capacity/
   serviceability endpoint, a `PLAN_CATALOG`-aware quote-readiness composite, and — the load-bearing
   one for Journey 4 — a real path from "generated plan" to "new subscription." This is genuinely
   backend engineering work, not a frontend adapter, and it's where the actual design decisions live
   (should `PlanConfig` grow a days array? does the meal-planner's `MealPlan` entity get extended to
   originate a subscription, or does a new entity exist alongside it?).
3. **PR B — Journey 2 UI**, built against A2's real endpoints.
4. **PR C — Custom Build UI**, built against A2's real endpoints, with the `/custom-build` routing
   collision (§4) resolved first.
5. **PR D — Generated plan review + pre-checkout**, shared components per the original spec.
6. **PR E — Reconciliation**: this time against a manifest that actually describes what got built
   (§1), since the current one doesn't correspond to any implemented or previously-designed screen.

No frontend work for either journey should land ahead of A2 — building UI for endpoints that don't
exist is precisely how the codebase ended up with `PlanConfigClient`/`CustomBuildClient` in the first
place.

---

_Filed against the 2026-08-09 rebuild authorization. Does not reopen the decision to rebuild; narrows
and resequences how it gets built based on what the backend and design-history audit actually found._
