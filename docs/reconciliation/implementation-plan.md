# Implementation plan

Sequenced per §19 of the sweep spec. **No application code has been changed to
produce this plan** — everything below is proposed work, ordered by dependency and
risk, not yet executed. Each phase lists its defect IDs, the reuse decision behind
the fix, and what stays out of scope until a named gate clears.

## Phase 0 — Evidence freeze — DONE

Recorded in `environment.md`. Starting commit `308f9de`, typecheck/storefront-test/
storefront-build all green, tanmatra-test green, api-server-test environment-blocked
(no DATABASE_URL/Redis in this sandbox — not a regression).

## Phase 1 — Inventory — DONE

`prebuilt-component-inventory.md`, `route-reconciliation.md`,
`stitch-manifest.normalized.json`.

## Phase 2 — Mapping — DONE

`stitch-code-matrix.json`/`.md`, `service-authority-map.md`, `defects.json`/`.md`.

## Phase 3 — Safe restoration and shared primitives

Defects: DEF-RECON-DEADLINKS-001, DEF-RECON-PLACEHOLDERS-001 (partial),
DEF-RECON-CARECONDITION-001 (decision only, no code), DEF-RECON-WELLNESS-001
(decision only), DEF-RECON-ROUTE-RULING-001 (decision only).

1. Content-approval check on `lib/content/legal/*.ts` (already written, unused) —
   confirm current before restoring.
2. `RESTORE_FROM_QUARANTINE`: `/about`, `/faq`, `/legal/[slug]` +
   `components/legal/LegalArticle.tsx`/`LegalMasthead.tsx`, after a token-compliance
   pass (quarantined legal components use raw `dark:` Tailwind variants, not the
   storefront's token system — REUSE_WITH_REFACTOR, not verbatim).
3. `RESTORE_FROM_QUARANTINE`: `/team/[slug]` (141 lines) once `/team`'s index is
   rebuilt to link to it (`REBUILD_MINIMALLY` — no active candidate for the index
   itself).
4. `REBUILD_MINIMALLY`: `/office-lunch/[id]`, `/corporate/[slug]`.
5. **Decision gate, not code**: resolve DEF-RECON-CARECONDITION-001 with
   clinical/product ownership (the sweep's own §13 vs. the documented prior
   ruling) before touching `/care/[condition]`.
6. **Decision gate, not code**: resolve DEF-RECON-ROUTE-RULING-001 — migrate
   `/corporate-wellness`'s content onto `/corporate` before any redirect is
   installed, or formally flip canonical status.
7. **Decision gate, not code**: resolve DEF-RECON-WELLNESS-001 — is `/wellness` a
   new page or a nav-link typo for `/account/wellness`?

## Phase 4 — Revenue blockers

Defects: DEF-RECON-ZEROPAYABLE-001, DEF-RECON-TRIALCTA-001,
DEF-RECON-PANTRY-001, DEF-RECON-MARKETPLACE-001, DEF-RECON-GROUPORDER-001.

1. **DEF-RECON-ZEROPAYABLE-001** (highest priority in this phase — silently loses
   fully-covered subscriptions today): add `chargePaise`/`settled` to
   `CreateSubscriptionResponse` and the à-la-carte order-create response; branch in
   `moneyPath.ts` before calling `createRazorpayOrder` — on settled, skip straight
   to `goToConfirmation` using the server's own order/subscription state, per §12's
   explicit sequencing ("verified zero-charge settlement → do not create a Razorpay
   order → display processing or success based on server result → fetch
   authoritative order/subscription state"). Add the regression matrix §12 requires
   (full credit, full subsidy, full voucher, partial subsidy, repeated tap,
   repeated callback) — none of it exists today for the zero-payable branch
   specifically (the positive-payable path is already covered).
2. **DEF-RECON-TRIALCTA-001**: give `TrialStart` its own always-visible sticky CTA,
   not a `MiniCartBar` handoff that doesn't exist in `FocusLayout`.
3. **DEF-RECON-PANTRY-001**: wire the "Add to Subscription" button to the existing
   addons/cart mutation path.
4. **DEF-RECON-MARKETPLACE-001**: wire `payForMarketplace()` from the marketplace
   item PDP, per the intent already recorded in `AlacarteCheckout.tsx`'s own
   comment.
5. **DEF-RECON-GROUPORDER-001**: either build `/group/[code]` against the existing
   lifecycle functions, or gate `AddToCart.tsx`'s join entry point until it exists
   — do not leave a partial revenue journey exposed either way.

## Phase 5 — Journey 2 (recommended plan configuration)

Defect: DEF-J2-PLANCONFIG-001. `REBUILD_MINIMALLY` over the merged plan-draft
contracts (`planDraftLineup.ts`, `planDraftSchedule.ts` server routes already
exist per the Stitch defect register — reuse, don't re-derive). Build the 9-state
model (`initial-configuration` → `generating` → `generation-error` →
`lineup-active` → `change-dish-open` → `accompaniment-editor-open` →
`delivery-schedule` → `validating` → `ready-for-quote`) as one controller under
`/plan/[planId]`, composing `PlanBuilder`'s existing track/cycle selection rather
than discarding it. Keep plan payment gated (per `service-authority-map.md`'s plan-
checkout-gate note) until this phase's acceptance conditions are separately proven.

## Phase 6 — Journey 4 (custom build)

Defect: DEF-J4-CUSTOMBUILD-001. `REBUILD_MINIMALLY`. The active `/custom-build`
route currently hosts an unrelated, working feature (per-dish customization) — do
**not** delete it; it needs its own home (a PDP-level customization affordance, not
a top-level route) once the real 12-stage wizard claims `/custom-build`. Reuse
Journey 2's generated-plan-review/schedule/generation modules once Phase 5 lands
(§11's explicit requirement). Assess `components/wizard/QuickSetupWizard.tsx`
(quarantined, 299 lines) for its wizard-shell pattern before writing a new one.
Terminal state when pricing is unavailable must be the honest message specified in
§11 ("Pricing is not yet available for this custom plan" + Save plan / Choose a
recommended plan / Return to plan options) — never a fabricated total.

## Phase 7 — Remaining Stitch reconciliation

Defects: DEF-RECON-5.5-REVIEWS-001, DEF-9.2-ACTIONS-001,
DEF-9.2-DELIVERY-ROUTE-001, DEF-10.9-FEEDBACK-001, plus `PLACEHOLDERS-001`'s
remaining routes not covered in Phase 3.

1. Compose `DishReviews`/`DishReviewForm` into the 5.5 PDP — `REUSE_AS_IS`, the
   backend contract is complete.
2. Add 9.2's 5 missing action rows (`subscriptionsApi.ts` already exports
   pause/resume — most rows have a ready seam); confirm the `/meal-planner` vs.
   `/account/subscriptions` entry-point ruling.
3. Wire 10.9: mount from an order-history "Rate meal" action, replace the
   hand-rolled overlay with the repo's `Drawer` primitive, add the new backend
   contract (do not overload `dish_reviews`).

## Phase 8 — Verification

Re-run the Phase 0 battery (typecheck, storefront unit tests, storefront build,
tanmatra tests, api-server tests against a provisioned database) after each phase
above, plus the E2E matrix in `verification-report.md`'s "not yet run" section, plus
a fresh `verify:stitch` pass and updated `localRuntime`/`visualApproval` evidence
for every `stitch-code-matrix.json` row this plan touches.

## Explicitly deferred / not in this plan

- Journey 2/4 payment activation — stays gated behind its own acceptance proof
  (§5/§12), independent of the UI work in Phases 5–6.
- `DEF-9.2-DELIVERY-ROUTE-001` — MINOR, entry-point-only; bundled into Phase 7
  rather than given its own phase.
- Visual/theme parity work — blocked on the missing per-screen approval-status
  field (`environment.md`'s governance gap) and on captured screenshot evidence;
  see `visual-evidence.md`.
