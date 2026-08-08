# Build Gap Analysis & Roadmap — Tanmatra Master UX/UI Plan (P0 + Phases 1–13B)

**Date:** 2026-08-08
**Location:** `docs/architecture/BUILD-GAP-ANALYSIS.md`
**Method:** The master implementation plan was analyzed phase-by-phase against the live tree at current HEAD. Every requirement was graded DONE / PARTIAL / MISSING / DIVERGED with file-level evidence, and every DONE claim was then adversarially re-verified against the codebase. One DONE claim was **refuted** on re-check (global Cart Drawer mount coverage — see Stitch Wiring section) and has been downgraded to PARTIAL here. Components that exist only under `components/quarantine/` or `quarantine/app/` are counted as MISSING (excluded from the build via `artifacts/storefront/tsconfig.json:44`).
**Standing owner decisions honored (not relitigated):** Astryx/DS-0 adoption for the storefront (CLAUDE.md, 2026-07-27); `clinical-governance-engine` package removed (docs/architecture/clinical-governance-review.md, 2026-08-08) with clinical safety riding on the live rails (`lib/preferences-match`, `checkoutSafety.ts`, advisory `clinicalGuardrailEngine.ts`, PHI encryption); `account-conflict` auth step parked pending product decision; owner direction 2026-08-08: *"when in doubt cut it out — focus on shipping core business operations without extra complexity."*

---

## 1. Executive Summary

The structural core of the build is real: route-group shells, the 58-page route tree, the server-authoritative money path (both legs), the subscription pricing spine, and the corporate entitlement ledger are implemented, wired, and tested (storefront suite 540/540 green; `verify.yml`/`storefront.yml` gates passing). The honest bad news splits three ways: **(1)** several "Complete"-marked phases verify at 65–85%, not 100% — dead CTAs, orphaned-but-finished components, and unwired flags account for most of the gap; **(2)** three money-path guarantees are unmet (sponsored activation, unresolved-payment state, create-route idempotency); **(3)** Phase 13's traceability/acceptance layer was retracted (`docs/stitch/PHASE-13-RETRACTION.md`) and has not been re-established — the formal record is an honest NO-GO even though its triggers are largely fixed.

| Phase | Plan doc status | Verified completeness | Biggest gap |
|---|---|---|---|
| P0 — Clean-state & architecture baseline | NO-GO on record | **~90%** — all 8 blocking triggers verifiably fixed | `p0-baseline.json` verdict is a stale NO-GO pinned to 3aea38dc; no re-issued baseline/GO at current HEAD |
| Phase 1 — Layouts, chrome, shell system | "Complete" | **~80–85%** | Scroll ergonomics (hide-on-scroll chrome) unimplemented in live shell; desktop primary nav renders zero links |
| Phase 2 — Commerce & craving funnel | "Complete" | **~65–70%** | Dead CTAs across /meal-deals, /meal-recommendations, /recipes (404 detail links) and homepage need-state/Smart Match chips |
| Phase 3 — Plans, clinical & therapeutic funnel | — | **~70–75%** | /metabolic is a placeholder; /care/[condition] is an unvalidated generic stub (compliance risk) |
| Phases 4–6 — Discovery / plan config / custom build | — | **~50% vs. plan; higher vs. 02-series spec** | Repo deliberately implements the docs/spec 02-series model; no pre-checkout lineup, renewal choice, or rules wizard |
| Phases 7–8 — Checkout & subscription mgmt | — | **~65–70%** | No storefront client/UI for swap/reschedule/window/add-item (server endpoints exist); 3 money-path guarantees unmet |
| Phases 9–10 — Account + wearables | — | **P9 ~70% / P10 ~50%** | Wearables frontend is a hardcoded mock never joined to the real, tested backend; clinical-profile UI orphaned (Health tab 404s) |
| Phase 11 — Corporate/partner/entitlements | — | **~60%** | Front door severed: /corporate/invite/[token] is a mockup while wired `CompanyInvite` sits orphaned; /corporate, /team are stubs |
| Phase 12 — Clinical care, RD, coach, community | — | **~60%** | No claims-governance register; /care/[condition] renders therapeutic copy for **any** slug; 4 nav-linked placeholder routes |
| Phase 13A/13B — Traceability & acceptance | GO **retracted** | **~35%** | Manifest stale (validator fails 71/74, not in CI); 0/74 container/staging/prod evidence; 0 legitimate visual or a11y reviews |
| Stitch wiring (74-screen matrix) | — | **49/74 wired** | Verification spine absent: 3/74 marker-instrumented, 0 marker-keyed e2e; 11 screens have no live implementation |

---

## 2. Per-Phase Detail

### P0 — Clean-State, Legacy Quarantine, Architecture Baseline (~90%)

**Verifiably done (all confirmed on adversarial re-check):**
- Route groups replace imperative layout switching: `app/(global)/layout.tsx`, `app/(focus)/layout.tsx`, `app/(b2b)/layout.tsx`; the old gates (`B2BLayout.tsx`, `FocusChromeGate.tsx`, `InternalSurfaceGate.tsx`) are deleted, surviving only in comments.
- `/account/wearables` → 308 → `/account/connections` (`next.config.ts:93`).
- Analytics sanitizer enforced at the sole production capture chokepoint (`lib/analyticsSanitizer.ts` + `components/PostHogProvider.tsx:4,38`; autocapture off, session recording off).
- `clinical-governance-engine` genuinely gone from the git tree (verified via `git ls-tree`, not sparse-checkout illusion); owner decision recorded.
- Quarantine isolation holds: `tsconfig.json:44` excludes it; zero live imports.
- Legacy SPA serves no customer routes (`artifacts/tanmatra/src/routes.ts`: admin/RD only); toolchain pinned (`pnpm@9.15.5`, node 22, `--frozen-lockfile` in deploy.yml/storefront.yml).
- All 44 contract routes exist (58 pages total); four-tab nav exact (`components/MobileBottomNav.tsx`); 20 domain invariants documented with honest grading (`domain-invariants.json`); test baseline green (540/540) with deploy sha-assert + smoke gates.

**Partial:** `?step=` login contract live minus parked `account-conflict`; `routes.json`/`layout-assignments.json` pinned to pre-refactor SHA 3aea38dc; `/api/build` still advertises 42/74 vs 58 actual routes; **formal verdict still NO-GO** despite all triggers fixed.

**Missing:** constraint-precedence doc (11-level model — zero hits in `docs/architecture/`); accessibility-baseline contract doc.

**Diverged (settled):** Satoshi → IBM Plex Sans (recorded TNM-UIF-01 decision, `app/layout.tsx:3,43`).

---

### Phase 1 — Foundation, Global Wrappers & Route-Shell System (~80–85%; doc says "Complete")

**Verifiably done:** three-shell system with per-shell chrome guarded by `e2e/specs/single-chrome.spec.ts` (4 tests) + `layout-vrt.spec.ts`; every §8 route in its prescribed shell; exact 4-tab bar mounted only from `(global)`; B2B 56px shell for all 8 routes with the invite exception on `(focus)`; token/theme bridge (`lib/tokens/src/tokens.css` → `globals.css` → `lib/themes/tanmatraTheme.ts`, tested); bottom-sheet system (`components/ui/drawer.tsx` Vaul + scrim invariant, `--z-nav:50 < --z-modal:100`, `useOverlayHistory` back-gesture); chrome components all wired (`Header.tsx`, `Footer.tsx`, `CommandMenu.tsx`, `lib/nav.ts` + test).

**Partial:** GlobalHeader — address cluster and static RD badge exist, but no trust-explainer sheet and no Account Drawer (avatar is a plain link); SafeImage contract violated by raw `<img>` on the live homepage hero (`components/landing/Section01ClinicalHero.tsx:70,130`) with no lint gate; `MobileBottomNav.test.ts` asserts the superseded home/menu/care/account tab set.

**Missing:** §13 scroll ergonomics — live `Header.tsx` is plain `sticky`, `MobileBottomNav.tsx` plain `fixed`; the only hide-on-scroll implementation (`components/primitives/Headers.tsx`) is mounted solely by `/styleguide`. Desktop primary nav: `PRIMARY_NAV` and `ThemeToggle` are dead imports in `Header.tsx` — zero nav links render.

**Diverged (settled):** token system is better than the plan's raw classes (Astryx); ghost/link button variants ship and frosted-glass secondary doesn't (DS-0 revocations); no shared FocusHeader — each focus flow owns its canvas per the layout's documented contract; §6.6 conditional-FocusLayout replaced by in-page sheets (route groups can't switch layouts).

---

### Phase 2 — Commerce, Discovery & Instant Craving Funnel (~65–70%; doc says "Complete")

**Verifiably done:** the money spine — `lib/moneyPath.ts` (`verifyWithRetry` 5xx-only, adapter never authors an amount) + `moneyPath.alacarte/verifyRetry/cartStore` tests (21/21), `AlacarteCheckout.tsx` with `alc-<uuid>` idempotency key and PhoneAuth island, server price-integrity proven by `payments.integrity.test.ts` (tampered client amount ignored). Serviceability end-to-end (`lib/addressServiceability.ts`, `serviceabilityApi.ts`, api-server `serviceability.ts`/`serviceabilityInterest.ts`, 2 e2e specs). Cart Drawer core (`CartDrawer.tsx` Vaul sheet, steppers, single Checkout CTA, `CartUpsellRail` over real catalog via `lib/upsell.ts`, `MiniCartBar` in `(global)` layout). Dish quick-view sheet (`DishDrawer.tsx`, URL-driven via `/menu?dish=`). Zero-CLS menu skeleton (`app/(global)/menu/loading.tsx`).

**Partial:** `/dish/[slug]` PDP lacks portion selector, therapeutic customization, PairingRail — `DishPairing.tsx`/`ProductDetailView.tsx`/`PdpAddToCart.tsx` exist orphaned; marketplace catalog cards lack `+ Add` (PDP-only), no variant selector/usage accordion; `/meal-recommendations` has a hardcoded `{ goal: "lose_weight" }` mock and no selectors; cart summary rows deliberately absent (server owns amounts) but empty-cart CTA missing.

**Missing / broken:** homepage need-state chips and Smart Match "Add to Today" are dead `<button>`s; `/meal-deals` "Select Bundle" is a gold button with no handler or href; every `/recipes` card 404s into the quarantined `/recipes/[slug]`; no dish search/filter bottom sheet on `/menu` (⌘K searches nav routes only); none of the §16 `home_*/menu_*/cart_*/dish_pdp_*` analytics events exist anywhere.

**Diverged (settled):** vertical clinical menu list is owner-confirmed (Stitch Route Brief 02 v3); gold `+ Add` upsell buttons in the cart drawer are consistent with DS-0's "gold is the only action colour" but contradict this slice's one-primary-CTA rule — worth a one-line owner ruling; `/meal-guides/[dishSlug]` pivoted from reheating guide to clinical pairing content.

---

### Phase 3 — Subscription Plans, Clinical & Therapeutic Funnel (~70–75%)

**Verifiably done (confirmed):** `/trial` end-to-end (`TrialStart.tsx`, `lib/trial.ts` pricing via `computePlanQuote("trial_3day")`, server tests incl. `payments.trialCreditback.test.ts`, e2e `cuj-04-trial.spec.ts`); `/performance` and `/clinical` landers via `ProtocolView.tsx` + compliance-rewritten `content/landing/protocol.ts` (FSSAI §7.6 diet-descriptive copy, `CARE_SAFETY` disclaimer, real `protein_build`/`steady` plans); the pricing spine — `lib/subscription-rules` (`PLAN_CATALOG`, `computePlanQuote`, 28 tests) + storefront `lib/plans.ts` invariant-tested by `pricingInvariants.test.ts` (card = checkout base = quote for every plan) + `POST /subscriptions/quote` with tests; meal planner core (`components/mealplan/*`, `routes/mealPlans.ts` full CRUD/generate/swap/accept).

**Partial:** `/care/[condition]` is a 40-line generic template ignoring the live, compliance-vetted `content/landing/care.ts` (`CARE_CONFIG`, `isCareCondition`); real components (`CareHero`/`CareEvidence`/`CareRdRoster`) quarantined; shipped 404 back-link to nonexistent `/care`. Shared primitives (`OptionCards.tsx`, `StickyLedger.tsx`) proofed only in `/styleguide`. Analytics: `cuj_*` events fire from GoalRouter/PlanBuilder/Waitlist/TrialStart/CheckoutFlow but `cuj_plan_viewed` never emits; no quick-setup/planner/care events; `funnel.ts` header admits the sink is still pending.

**Missing:** `/metabolic` — literal "Clean slate placeholder"; `content/landing/metabolic.ts` imported by nothing live; no `metabolic` key in `PROTOCOL_CONFIG`.

**Diverged (settled):** `/plans` and `/plan/[planId]` rebuilt on the CUJ-v2 goal-router / configure-by-exception architecture (02d/02f briefs cited in code); `/custom-build` repurposed into a dish-customization hub; per-surface state instead of a unified client state model (PHI kept local-only by design).

---

### Phases 4–6 — Discovery / Plan Configuration / Build-Your-Own (~50% vs. plan as written)

**The dominant fact:** the repo implements the recorded `docs/spec/` 02-series model (goal-tap → single-axis PlanBuilder → server quote → checkout, plus a *post-purchase* weekly planner), not the plan's mealtime→goal→generated-lineup→rules-wizard funnel. The plan's exact domain model survives only as two orphaned zero-importer type files (`artifacts/storefront/lib/types.ts`, `types/domain.ts` — `PlanDraft`, `QuoteSnapshot`, `renewalPreference`, `lockedMealIds`).

**Done (confirmed):** P4 route + router into builder (`GoalRouter.tsx:20` → `/plan/${planId}`; waitlist fallback = zero dead ends); P5 "Continue to checkout" CTA (`PlanBuilder.tsx:193` → validated `/checkout` params); P5 server-quote exit (`POST /subscriptions/quote`, `usePlanQuote` clears-and-gates on every input change, `planCheckout.test.ts` asserts no client price field).

**Partial:** serviceability context absent from `/plans` itself; SwapDialog shows constraint-safe alternatives (server-filtered) but no image/fit-reason/±₹, and only post-purchase; delivery schedule fixed (`nextWeekdayISO`, `12:30–13:30`) with a copy drift — `content/copy/plans.ts` says "10:00 PM cutoff" vs the 24h `SKIP_SWAP_CUTOFF_MS`; wizard resilience — `DraftRestorationBoundary.tsx` is a dead stub (zero importers, no-op Restore button).

**Missing:** Keep/lock + single Undo (nowhere in `mealPlanner.ts`/`routes/mealPlans.ts`); accompaniment editor; renewal-preference UI or wire field; sample-meals preview and "How plans work" disclosure on the purchase path; the 12-item pre-checkout FAQ (live `FaqAccordion` serves B2B pages only); duration 3/5/15 model (cycles are weekly/monthly/quarterly by design).

---

### Phases 7–8 — Checkout & Order Creation; Planner & Subscription Management (~65–70%)

**Done (confirmed):** `/checkout` host with plan validation/waitlist bounce; `/order/confirmed/[orderId]` with not-found/unreachable states; order creation both legs server-authoritative and transactional (`subscriptions.ts:843` create + `createOrderForNewSubscription` with `sub-<id>` idempotent externalOrderId; `checkout.ts` with DPDP 400 / serviceability 422); payment UX discipline (CTA disabled on busy, verbatim server amount, "Confirming your payment…" state); meal-planner full stack; cutoffs shared via `@workspace/subscription-rules` with six 409 `past_cutoff` enforcement sites and `ChangePlanPanel` importing the same package's pricing.

**Partial:** checkout content lacks delivery-schedule display, voucher entry, terms/cancellation links; timeout handling — `verifyWithRetry` + idempotent server verify + webhook reconciliation exist, but after the 3rd failed verify `PlanCheckout.tsx:132-140` re-enables the pay CTA (re-pay-after-capture risk); idempotency chain strong except **`POST /subscriptions` has no server-side idempotency key** (only the client `createdRef` guards duplicates); confirmation page lacks first-delivery/address/meals/plan-total/"View Meal Plan"; subscriptions console (`SubscriptionManager`, `ChangePlanPanel` with Razorpay reauth leg, billing ledger) lacks next-charge date and lifecycle history.

**Missing:** **sponsored/zero-payable activation** — `payments.ts:272` 409s on `authoritativePaise <= 0` and `moneyPath.ts` always creates a Razorpay order, so a fully-credited create dead-ends; **Manage-Delivery UI** — server ships cutoff-enforced `swap/reschedule/delivery-window/add-item` endpoints but `lib/subscriptionsApi.ts` exposes only skip/unskip, so meal/time/address changes on an active subscription are unreachable from the storefront; financial disclosure before pause/skip/cancel (only change-plan meets the bar).

**Diverged:** QuoteSnapshot-with-expiry replaced by recompute-on-request + server re-pricing at create — functionally safe, but no owner-decision doc records the substitution.

---

### Phases 9–10 — Account Surfaces + Health & Wearables (P9 ~70% / P10 ~50%)

**Done (confirmed):** all 13 account routes + `/vouchers` + `/premium` exist and most are wired with tested clients (orders, subscriptions, addresses with single-default transactional invariant, billing, loyalty, appointments, favorites, symptoms — notes encrypted at rest); `/account/connections` canonical + 308 redirect; the never-silently-modify-meals rule holds (UI copy + advisory-only `clinicalGuardrailEngine`, no meal-plan writes in `routes/wearable.ts`).

**Partial:** Account Hub has 1 of 7 priority cards (live order) and its nav omits wellness/favorites/connections while the "Health" tab links to a route that only exists in quarantine (**live 404**); preferences lack notifications/theme/hard-vs-soft-exclusion split; history has totals but no trends/source labels; symptoms lack the mandated "Observed overlap — not a diagnosis" label (ships stronger "Correlated with:" language); PHI encryption path is complete end-to-end (`encryptPreferencesPatch`, `CLINICAL_KMS_MASTER_KEY`, erasure route) **but the UI is orphaned** — `HealthInfoHub`/`ClinicalForm` are imported by no live page.

**Missing:** feature-level influence controls (nothing reads/writes `wearableInfluenceEnabled`; meanwhile rollups already feed `effectiveCalorieTarget()` with no toggle); the Phase-10 frontend/backend join — `WearablesHub.tsx` is a hardcoded `useState` mock (fake "Today, 11:30 AM" sync, no API calls) against a real, tested backend (`routes/wearable.ts` consent-gated connect, webhook ingest, rollups); no `lib/wearableApi.ts` exists; 2 of 9 required connection states modeled.

**Diverged (flag for owner):** wellness became a tracker studio (incl. `BloodReportOCR`) rather than observational insights; `POST /wearable/biometric-anomaly` accepts `glucoseReadingMgDl` despite the plan's explicit CGM exclusion (advisory-only mitigations documented in code, but it's a scope expansion the plan forbids). `MealFeedback.tsx` exists with correct ratings/reasons and `isPermanentExclusion:false`, but has zero importers and no API route.

---

### Phase 11 — Acquisition, Corporate, Partner, Entitlements (~60%)

**Done (confirmed on adversarial re-check):** the entire commercial substrate — subsidy reserve→commit→release under advisory lock inside the shared pricing transaction (`corporateSubsidy.ts`, called from `loyaltyEngine.ts:1103`, `payments.ts:513/870/964`, `orders.ts:306`; double-commit and concurrent-commit races tested across 725 lines of tests); entitlement differentiation (invite token cleared-on-accept, voucher lifecycle with DB CHECK constraint and HMAC-verified guarded transitions, gift-card fields, wallet `credit_ledger`, monthly `company_budget_usage`); no parallel checkout engine anywhere; `/corporate/[slug]/lunch-planner` (admin-gated over 456-line `b2bPlanner.ts`); `/corporate-wellness` lander with real lead capture; `/challenges/[slug]` with join/leave/posts; `/vouchers` redeem surface.

**Partial / broken front door:** `/corporate` and `/corporate/[slug]` are placeholder stubs with `CompanyLanding.tsx` orphaned; `/corporate/invite/[token]` renders `CorporateInviteClient.tsx` — a **hardcoded mockup** (`token.includes('google')` picks fake discounts, accept() is a setTimeout into unread query params) while the fully wired `CompanyInvite.tsx` + `companyApi.ts` (getInvite/acceptInvite, 403 email-mismatch handling) sit orphaned one directory away; `/rd-partners` + `/partners/dietitians` render a mock form (`setSubmitted(true)`, no API) while `PartnerWizard.tsx` + `rdPartnerApi.ts` + 658-line `rdPartners.ts` backend sit orphaned; `/team` is a stub over a ready API; `AcquisitionContext` is types-only (zero importers, duplicated in two files); no expiry on vouchers/invites.

**Diverged (settled-ish):** gym/fitness-club pages are owner-acquisition landers (Stitch brief 17) — the member-facing benefit/verification journeys exist nowhere.

---

### Phase 12 — Clinical Care, RD, Coach, Community (~60%)

**Done (confirmed):** coach end-to-end with deterministic pre-model refusal gate (`REFUSAL_PATTERNS`: treatment/diabetes/pregnancy/allergy-judgement), read-only card tools, allergen filtering, server-side RD-booking-card synthesis on refusal, 8 pinned eval cases; `/rd` directory (credentials, specialties, languages, server-priced fees, zero fabricated ratings) + full paid booking with Razorpay money path and 409 slot-taken retry; `/qa` forum (RD attribution badge, zero popularity mechanics); `/performance` and `/clinical` landers (see Phase 3).

**Partial:** `/challenges/[slug]` live but missing regimen/eligibility/benefits fields; RD booking is inline on `(global)` profile (recorded divergence) with cancel but no reschedule and no policy text.

**Missing:** `/metabolic`, `/team`, `/challenges` index, `/challenges/tracker` — all nav-linked placeholders with APIs/clients ready and components finished (mostly in quarantine); **claims-governance register** — no claim→evidence→owner→approval→review-date system anywhere (discipline lives in file-header annotations only); **compliance defect:** `/care/[condition]` validates nothing — any slug (e.g. `/care/cancer`) renders "Therapeutic Care Plan… Biweekly RD consultation" copy, defeating the vetted-conditions design.

---

### Phase 13A/13B — Traceability & Acceptance (~35%)

**Done (confirmed, re-run live):** the automated gate substrate — typecheck, unit (540/540), integration w/ postgres service, 18-spec Playwright CUJ suite, `lint:tokens` (clean since commit 84921fd), `lint:filecap` (658 files), `lint:test-reach` (215/280, no new unreached), Docker/Cloud Build, sha-asserting deploy smoke; the 12-dimension review rubric is defined (`phase-13a-final-acceptance.md` §5).

**Broken / missing:** the 74-entry manifest lacks 7 plan-required fields, all 74 `implementation` paths are stale post-route-group refactor, `verify:stitch` **fails (71/74)** and runs in **no workflow**; reference artifacts (`artifacts/stitch/**`) aren't in the tree; container/staging/production runtime evidence 0/74; domain invariants ~6/20 genuinely automated (analytics sanitizer and login returnTo fixed since the re-grade; PlanBuilder invariants 2/3/4 untested; 7/9/12/17 cite nonexistent services); no component-test layer, no security-scan CI gate; **13B effectively not started** — the 20-screen dark signoff was a retracted single-timestamp bulk approval, light reviews 0/15, a11y audits 0/9 (and 5–6 of the 9 audit subjects don't exist as shipped components); production identity drift documented (`storefront-00081-pz5` served 250e5f59, not RC cffbf957). Current honest status: **NO-GO**, per the repo's own retraction.

---

### Stitch 74-Screen Wiring (49/74 wired)

Current-tree tally against the 2026-08-06 reconciliation (41/74): **49 wired** (deltas verified: DishDrawer, CartDrawer/MiniCartBar, empty cart, quick-setup ×3, RD booking, unserviceable-address flow), 1 partial (menu filter is inline, not an overlay), 1 unwired source (`MealFeedback.tsx`, zero importers), **11 missing** (Mealtime Sheet, Change Dish Sheet, Accompaniment Editor, Manage Delivery Sheet, gym verification, quote-expired recovery, menu-no-match, plan-generation loading/error, payment-processing, payment-timeout), **12 deliberately replaced** (9-stage custom-build wizard + 3 plan-config states → CustomBuildHub / configure-by-exception PlanBuilder).

**Downgraded per refuted verification:** "Global Cart Drawer mounted once via all three layouts" is **PARTIAL, not DONE** — `MiniCartBar` mounts **only** in `app/(global)/layout.tsx:37`; `(focus)` and `(b2b)` layouts explicitly document *no* MiniCartBar, so the cart drawer is not reachable from focus-shell commerce surfaces (dish PDP, marketplace PDP, checkout, trial, custom-build), which own their bottom edges by design. This is likely the *correct* product behavior for a focus shell, but the plan claim as stated is false and should be recorded as a divergence, not completion.

Verification spine: 3/74 screens carry `data-screen-id` markers (in a divergent `MOB-*` scheme, not numeric promptIds), `data-screen-state` appears nowhere, zero e2e specs reference markers, no `e2e/stitch-runtime/` suite, `lib/stitchRoutes.ts` maps only 16 screens for theming, and the Python validator replaced the specced `.mjs` one with narrower coverage.

---

## 3. Recommended Build Order

Sequenced per the owner's direction: **core business operations first** (money path, subscription lifecycle, checkout fully live), then dependency order, then risk. Sizes: S ≤ 1 day, M = 2–4 days, L = 1–2 weeks.

### Wave 1 — Make the money path complete and turn it on

1. **Unresolved-payment state (S/M).** After `verifyWithRetry` exhausts, replace the generic error + re-enabled pay CTA in `components/checkout/plan/PlanCheckout.tsx:132-140` (and the same seam in `AlacarteCheckout.tsx`) with a terminal "We're confirming your payment — don't pay again" state offering status-check/help, backed by the already-idempotent server verify (`payments.ts:467`) and webhook reconciliation. Highest-severity live risk: double charge on captured money.
2. **Server idempotency key on `POST /subscriptions` (S).** Accept a client key in `routes/subscriptions.ts:843` (mirror the à-la-carte `externalOrderId` pattern in `checkout.ts`); have `lib/planCheckout.ts` send it. Closes the network-duplicate double-subscription hole the client `createdRef` only papers over.
3. **Zero-payable / sponsored activation (M).** Branch in `runCheckout`/`finishPlanPayment` (`lib/moneyPath.ts`) and `routes/payments.ts:272`: when the server quote's payable is 0, activate without creating a Razorpay order. Required before corporate subsidies/credits can fully cover an order. Test alongside `payments.integrity.test.ts`.
4. **Live-checkout cutover (S, ops).** Execute `docs/LIVE-CUTOVER.md` and set `NEXT_PUBLIC_LIVE_CHECKOUT=1` (`lib/flags.ts:18`) once 1–3 land. The entire flow is dark by default today.

### Wave 2 — Subscription lifecycle: close the client gap

5. **Manage-Delivery client + sheet (M).** Extend `lib/subscriptionsApi.ts` beyond skip/unskip to the already-shipped, cutoff-enforced endpoints — `/subscription-deliveries/:id/{swap,reschedule}`, `/subscriptions/:id/delivery-window`, `/subscriptions/next-delivery/add-item` (`subscriptions.ts:1645-2127`) — and surface them from `DeliveryList.tsx` via a `ui/drawer.tsx` bottom sheet. This is the single biggest functional gap in core operations: customers cannot change a meal or time on an active subscription.
6. **Financial disclosure before pause/skip/cancel (M).** Small server preview endpoint (credit amount for a skip, effect of cancel — reuse the skip-credit computation at `subscriptions.ts:1673-1712`) rendered in confirm dialogs, replacing `window.confirm` in `SubscriptionManager.tsx:79`. Also fix the cutoff copy drift: `content/copy/plans.ts` "10:00 PM" vs the 24h `SKIP_SWAP_CUTOFF_MS`.

### Wave 3 — Fix shipped defects (compliance + dead UI)

7. **`/care/[condition]` slug validation (S, compliance-urgent).** Gate `app/(global)/care/[condition]/page.tsx` on `isCareCondition` from `content/landing/care.ts` with `notFound()`; render `CARE_CONFIG` content; fix the `/care` back-link (redirect to `/clinical` or restore the quarantined directory page). Today any slug mints an unvetted therapeutic-claims page.
8. **Wire the corporate invite (S).** Replace `CorporateInviteClient.tsx` with the orphaned, fully wired `components/corporate/CompanyInvite.tsx` over `lib/companyApi.ts` (backend complete at `corporate.ts:254-357`). Unblocks the entire B2B entitlement front door; the subsidy ledger behind it is done and race-tested.
9. **Kill dead CTAs in the craving funnel (S/M).** Homepage need-state chips → route pushes; Smart Match card → `/meal-recommendations`; `/meal-deals` "Select Bundle" → add-bundle-to-cart via the existing `cartStore` (or cut the page); `/recipes` cards → stop 404ing (restore a minimal `/recipes/[slug]` or link to `/meal-guides`). These violate the plan's own non-negotiables 11/14 on live surfaces.
10. **Mount the clinical profile (S).** Create a live `/account/health-information` page mounting the orphaned `HealthInfoHub`/`ClinicalForm` (the encryption/consent/erasure API is fully built and tested), fixing `AccountNav`'s 404 "Health" tab. Add wellness/favorites/connections to hub SECTIONS while there.

### Wave 4 — Cheap re-wiring of finished-but-orphaned surfaces

11. **`/metabolic` (S).** Add a `metabolic` key to `PROTOCOL_CONFIG` (`content/landing/protocol.ts`) reusing `ProtocolView` — the compliance-annotated content module already exists.
12. **`/rd-partners` apply (S).** Mount `PartnerWizard.tsx` + `WhatsAppOptIn.tsx` (658-line backend + tested `rdPartnerApi.ts` are idle); replace the mock form in `RdPartnersClient.tsx`.
13. **`/challenges` index + `/challenges/tracker` (S).** Wire `ChallengeCard.tsx` and `ChallengeTrackerView.tsx` to `challengesApi.getChallenges` — both components and API are live-tree and tested; only the pages are stubs.
14. **`/corporate` + `/corporate/[slug]` (S/M).** Mount the orphaned `CompanyLanding.tsx` over `companyApi.getCompany`; or, per cut-complexity, redirect `/corporate` → `/corporate-wellness` until B2B landing content is a priority. `/team`: wire `teamApi` or cut the nav link.
15. **Account Hub priority cards (M).** Add active-subscription + next-delivery cards to `AccountHub.tsx` from data `subscriptionsApi` already returns; defer the other four card types.

### Wave 5 — Re-establish the verification spine

16. **Re-issue the P0 baseline (S).** Fresh audit at merge SHA: flip `p0-baseline.json` to GO, regenerate `routes.json`/`layout-assignments.json`, fix `/api/build` counts (42/74 → actual), drop the stale `clinical-governance-engine` row from CLAUDE.md. The recorded verdict currently contradicts remediated reality.
17. **Re-baseline the Stitch manifest (M).** Shrink 74 to the real post-divergence screen set (drop the 12 replaced wizard/config screens; record the cart-drawer mount divergence), fix all paths to `(group)/` form, add the missing schema fields for surviving entries, wire `verify:stitch` into `storefront.yml`, and rewrite `MobileBottomNav.test.ts` against the shipped tab contract while in there.
18. **Invariant automation (M).** PlanBuilder tests for invariants 2/3/4 (`components/plans/PlanBuilder.tsx` currently untested); reconcile `domain-invariants.json` summary vs entries; add a security-scan gate (CodeQL or `pnpm audit`) to `verify.yml` (S).
19. **13B human reviews (M, human time).** Run the defined 12-dimension rubric over the re-baselined priority set and the a11y checklist over the overlays that actually exist (CartDrawer, DishDrawer, account sheet, SwapDialog, CommandMenu, address switcher) — legitimately this time, one artifact per screen.

---

## 4. Explicitly Deferred

Per the owner's "when in doubt cut it out" direction, the following plan items are **deliberately not scheduled**. Each should be carried as a recorded exception, not silent debt:

- **`account-conflict` auth step** — parked by owner decision pending product definition (`loginRoute.ts` header; `docs/architecture/README.md:44-52`).
- **Wearables frontend/backend join + influence controls** — the real join (`lib/wearableApi.ts`, 9-state machine, consent primer, per-feature toggles) is a Phase-10 project, not core commerce. *Interim requirement if deferred:* either hide `/account/connections` behind a "coming soon" state or add one line of honesty to the mock — a fake "connected, synced 11:30 AM" status is worse than nothing. **Flag for owner regardless of deferral:** `POST /wearable/biometric-anomaly` accepts `glucoseReadingMgDl`, which the plan explicitly excludes (CGM telemetry), and rollups already feed `effectiveCalorieTarget()` with no user toggle.
- **Persisted QuoteSnapshot + expiry/difference-acceptance UI** — recompute-on-request with server re-pricing at create is safe and simpler; record the substitution as an owner decision in `docs/architecture/README.md` instead of building it.
- **Pre-checkout generated-lineup layer (Keep/Shuffle/Undo), accompaniment editor, mealtime sheet, renewal-preference choice, 9-stage custom-build wizard** — all belong to the plan's funnel model that the 02-series spec superseded; delete the orphaned scaffolds (`lib/types.ts`, `types/domain.ts`, `DraftRestorationBoundary.tsx`) rather than wiring them.
- **Scroll ergonomics (hide-on-scroll chrome)** — polish, not operations; the primitive exists in `components/primitives/Headers.tsx` when wanted. Same bucket: desktop primary nav (either render `PRIMARY_NAV` or delete the dead imports in `Header.tsx` — the deletion is the cut-complexity answer), Account Drawer, trust-explainer sheet.
- **Member-facing gym/fitness-club benefit journeys** (verification, member pricing) — the shipped owner-lander divergence stands until partner volume justifies it.
- **Voucher purchase/gifting UI** — server-side purchase exists; redeem-only is fine for now.
- **Meal feedback loop** — `MealFeedback.tsx` needs an API route and import sites to be real; wire or delete when retention work starts, not before.
- **§16 browse-funnel analytics vocabulary** — analytics are dormant in prod by decision; the `cuj_*` checkout funnel is the one that matters when the beacon sink lands.
- **Component-test layer (RTL), 74-screen marker/e2e contract, container/staging runtime evidence chain** — superseded in practice by the CUJ e2e suite + re-baselined manifest (Wave 5); revisit only if a formal acceptance gate is re-instituted.
- **Full claims-governance register** — start with the minimal doc in Wave 5 (`docs/architecture/claims-register.md` listing existing public claims → evidence file → owner); the plan's full workflow (approval cycles, expiry) is deferred.
