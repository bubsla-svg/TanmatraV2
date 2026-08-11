# Prebuilt component & feature inventory

Mechanical import-graph sweep of `artifacts/storefront` (821 source files), cross-checked
by hand where the result was surprising. Full machine output: the inventory JSON
generated for this sweep is reproducible via the method in `verification-report.md`
(not committed — regenerate rather than trust a stale copy). Numbers below are exact
counts from that run.

## Summary

| Category | Count |
|---|---|
| Total storefront source files (`.ts`/`.tsx`, excl. `node_modules`/`.next`) | 821 |
| Routes (`app/**/page.tsx` + `route.ts`) | 61 |
| Zero-importer files, active tree, excluding tests/Next-special files | 28 |
| Quarantined route files (`quarantine/app/**/page.tsx`) | 72 |
| Quarantined non-route files | 144 |
| Basename collisions (active vs. active, or active vs. quarantine) | 140 |
| `lib/` exported symbols with zero production callers (test-only or fully dead) | 72 |
| api-server route handlers | 435 |
| Storefront call sites hitting those routes | 131 |

## A. Active, reusable, correctly wired (sample — not exhaustive)

These are load-bearing shared primitives already in the active import graph; the
Stitch reconciliation should compose new work through them rather than re-authoring
equivalents (§8 of the sweep spec). Confirmed by import-graph reach from at least one
route:

`components/ui/SafeImage.tsx`, `components/ui/drawer.tsx` (Vaul primitive — bottom-sheet
contract, scrim invariant), `components/ui/button.tsx`, `components/FocusHeader.tsx`,
`components/cart/CartDrawer.tsx` / `MiniCartBar.tsx` / `CartProvider.tsx`,
`components/checkout/plan/PlanCheckout.tsx`, `components/account/ManageDeliverySheet.tsx`
(9.2, partial — see `defects.md`), `components/menu/MenuFilterSheet.tsx` (5.3),
`components/metabolic/MetabolicExplorer.tsx` (11.1), `lib/moneyPath.ts`,
`lib/verifyRetry.ts`, `lib/subscriptionsApi.ts` (15 exported functions, all reachable),
`lib/apiClient.ts`.

## B. Unwired components with zero production importers (active tree)

Excludes Next.js special files (`page`/`layout`/`route`/`loading`/`error`/etc., which are
framework-invoked, not import-invoked) and `.test.ts(x)` files.

### B1 — the dish-review subsystem (major finding)

`components/menu/DishReviews.tsx` (127 lines), `components/menu/DishReviewForm.tsx`,
and the client they both call, `lib/dishReviewsApi.ts`, form a **complete, tested,
server-backed customer review feature**: `GET/POST /dish-reviews` on the api-server
(`artifacts/api-server/src/routes/menuEngineering.ts:235-290`), order-eligibility
gating (only a customer who ordered the dish may review it, enforced server-side),
an AI-generated review digest (`dish_review_summaries`), and a privacy-safe display
label so reviewer identity never leaks. `lib/dishReviewsApi.test.ts` covers the client.

**Zero active importer reaches either component.** The live PDP route
(`app/(focus)/dish/[slug]/page.tsx`, Stitch 5.5) hand-rolls its own markup — hero
image, macro strip, two accordion sections, `PdpBuyLedger` — and never mounts
`DishReviews`. A customer can never see or leave a dish review anywhere in the
product. See `defects.md` DEF-RECON-5.5-REVIEWS-001.

### B2 — an alternate/superseded PDP cluster

`components/menu/ProductDetailView.tsx` (177 lines), `DishGallery.tsx`,
`DishPairing.tsx`, `DishThumbnail.tsx`, `DishBuyBar.tsx`, `PdpAddToCart.tsx` — six
components under `components/menu/` with zero importers, none composed by the
others (`ProductDetailView.tsx` imports only `SafeImage`, cart primitives — not the
other five). Read as leftover fragments from a prior PDP design pass, superseded by
the currently-wired inline 5.5 implementation. `REUSE_DECISION`: assess individually
before either restoring or removing — `DishGallery`/`DishPairing` in particular could
usefully extend 5.5's Stitch-approved "Full Clinical Detail" contract, which the
current inline PDP does not fully meet (no gallery, no "frequently paired with" rail).

### B3 — auth/account scaffolds, apparently pre-Firebase

`components/account/AccountDrawer.tsx` (33 lines, `useState` shell with a comment
`"Expose methods via imperative handle or context in a real app"` — reads as a
scaffold, not a finished component), `components/auth/AuthBoundary.tsx` (implements
its own local `isAuthenticated` state, disconnected from the app's actual
Firebase-phone-OTP + session-cookie auth — superseded by the "auth-gated islands"
pattern CLAUDE.md documents and every wired account page already uses),
`components/auth/ReturnRouteGuard.tsx`, `components/plans/DraftRestorationBoundary.tsx`
(recovers an unsaved plan draft — directly relevant to Journey 2's required "Refresh
restores and revalidates the draft" invariant, currently unimplemented; assess for
reuse when Journey 2 is rebuilt rather than re-authoring draft-restoration from
scratch).

### B4 — compliance primitive not used where it duplicates

`components/primitives/FssaiMark.tsx` exists as a dedicated component but the FSSAI
licence badge is hand-inlined separately in `Footer.tsx`, `MobileBottomNav.tsx`,
`CheckoutPay.tsx`, `AlacarteDetails.tsx`, and `app/(b2b)/partners/gyms/page.tsx` — five
independent copies of the same compliance string. Not a functional defect (all five
render correctly and pull the same `SITE.fssai`/company-profile source), but a DRY
violation worth consolidating onto the existing primitive.

**Correction to the mechanical pass:** `components/primitives/DpdpaConsentCapture.tsx`
was flagged zero-importer by the import-graph regex but is in fact actively wired —
`AlacarteDetails.tsx`, `PlanDetails.tsx`, `MemberIntake.tsx`, and `AlacarteCheckout.tsx`
all import it. The regex likely missed a re-export path. Recorded here so the false
positive isn't repeated in a future run of this sweep.

### B5 — Stitch-tracked unwired (already in the defect register)

`components/feedback/MealFeedback.tsx` (10.9) — see `defects.md` DEF-10.9-FEEDBACK-001.

## C. Quarantine inventory

`artifacts/storefront/quarantine/` mirrors a large fraction of the active tree: 72
route files and 144 component/lib files, almost all under the exact same relative
path as an existing **active** file of the same name (`app/about/page.tsx`,
`app/legal/page.tsx`, `app/legal/[slug]/page.tsx`, `app/faq/page.tsx`,
`components/checkout/plan/PlanCheckout.tsx`, `components/checkout/AlacarteCheckout.tsx`,
etc.). Per §2.2, quarantine status is a candidate signal, not a verdict — each pair
was diff-sampled rather than assumed identical.

**Restoration candidates confirmed genuinely absent from the active tree** (i.e., no
live counterpart exists anywhere else, unlike the checkout/account examples above
which are legitimate historical duplicates of code that has since moved):

| Quarantined file | Live counterpart? | Restoration candidate |
|---|---|---|
| `app/about/page.tsx` (114 lines) | **None.** `/about` is a dead footer link (see `route-reconciliation.md`). | **Yes** — restore after content-approval check (§14). |
| `app/faq/page.tsx` (57 lines) | **None.** `/faq` is a dead footer/AccountHub link. | **Yes** — restore after content-approval check. |
| `app/legal/page.tsx` (49 lines) + `app/legal/[slug]/page.tsx` (44 lines) | **None** at the `/legal/*` paths `lib/nav.ts` actually links (`/legal/terms`, `/legal/privacy`, `/legal/refunds`, `/legal/shipping`, `/legal/disclaimer`, `/legal/grievance`) — the quarantined route is a single `[slug]` catch-all, and `lib/content/legal/*.ts` (terms/privacy/refunds/shipping/disclaimer/grievance/company) already exists **active** and unused by any route, giving this restoration a ready content source. | **Yes** — highest-priority restoration; six dead links resolve from one route. |
| `components/legal/LegalArticle.tsx` + `LegalMasthead.tsx` | None active. | Candidate renderer for the above, pending compatibility check against current tokens (uses `dark:` Tailwind variants — same pattern as the pantry scanner finding in `defects.md`, needs a token-compliance pass, not a blind restore). |
| `app/wellness/page.tsx` (42 lines) | **Partial.** `/wellness` is a dead link from `lib/nav.ts`'s Track group ("Wellness — Preventive, everyday nutrition"), but `/account/wellness` (a *different*, active route hosting `WellnessHub`) exists and is wired. These are not the same product surface — `/wellness` reads as a public/marketing landing page, `/account/wellness` as the logged-in tracker. | Needs a product decision (§14/product-decision gate), not a mechanical restore: is `/wellness` meant to exist as a separate public page, or was the nav link meant to point at `/account/wellness`? Recorded as `BLOCKED_BY_PRODUCT_DECISION` in `defects.md`. |
| `app/group/[code]/page.tsx` quarantine copy | Active route at the same path is a **placeholder**, not a real implementation (see `route-reconciliation.md` and `service-authority-map.md`). | Assess: does the quarantined copy implement the join/host/close/pay flow, or is it the same placeholder? (Not diffed in this pass — flagged for Phase 3.) |

Every other quarantine/active pair sampled (checkout, plans, account, corporate,
wellness-tracker, mealplan, marketplace, rd-partners, kitchen/admin) has a **newer,
wired active-tree equivalent already in production** — these are historical
snapshots, not lost work, and are **not** restoration candidates. Blind-copying them
back would reintroduce superseded contracts (old `PhoneAuth`/`CheckoutFlow` shapes,
pre-token styling) — exactly what §2.2 warns against.

## D. Duplicate implementations (non-quarantine)

The mechanical sweep found 140 basename collisions; the overwhelming majority are the
active/quarantine pairs already covered in §C. Non-quarantine duplicates worth
recording:

- `CustomBuildHub.tsx` (active) is **byte-identical** in every state-name marker to
  its quarantined twin — confirms there is no separate "real" wizard implementation
  hiding in quarantine; the required 12-stage Journey 4 state machine genuinely does
  not exist anywhere in the repository (see `stitch-code-matrix.md`, 7.2–7.10).
- `PantryVisionScanner.tsx` / `WellnessHub.tsx` exist both active
  (`components/wellness/`) and quarantined, and the active copy is the one actually
  wired into `/account/wellness`. The quarantined copy is a stale historical snapshot,
  not a superior candidate (both carry the same inert "Add to Subscription" button —
  see `defects.md` DEF-RECON-PANTRY-001).

## E. Missing backend contracts surfaced by this sweep

- **10.9 Meal Feedback**: no `/meal-feedback` (or equivalent) route exists anywhere
  in `artifacts/api-server/src/routes/`. `dish_reviews` is the nearest analog but
  models a different entity (a customer's standing review of a *dish*, one per
  customer per slug) — not a per-*delivery* meal-satisfaction signal with reasons and
  an "improve my recommendations" opt-in. Do not overload `dish_reviews` for this.
- **Group-order host-close-pay**: the lifecycle functions exist client-side
  (`lib/groupOrdersApi.ts`) and server-side (`POST /group-orders`, `/group-orders/:code`,
  `/group-orders/:code/items`, `/group-orders/:code/close`) — the backend contract is
  not missing. What's missing is the **UI**: `/group/[code]/page.tsx` is a literal
  placeholder (see `route-reconciliation.md`).
- **Marketplace payment**: `POST /marketplace/checkout` exists server-side and
  `lib/marketplaceApi.ts` has a matching, tested `payForMarketplace()` — the contract
  is complete on both ends. What's missing is the **caller**: no marketplace PDP or
  cart surface invokes it (see `service-authority-map.md`).

Full raw counts (zero-importers, duplicates, quarantine listing, dead links,
zero-caller `lib/` exports, api-server route/call-site cross-reference) are
reproducible by the sweep method recorded in `verification-report.md`.
