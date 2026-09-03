# Tanmatra Mobile-First Customer Experience Engineering Brief — v3.1 (validated against `origin/main`)

_2026-09-03 · This is the v1 manual, kept intact in structure, rules and intent, with its ground truth realigned to `bubsla-svg/TanmatraV2` `origin/main` = `156fea9`. The UX/UI to replicate is the **delivered storefront revision** (the Replit build, screen-recorded 2026-09-03). The implementation target is **`artifacts/storefront`** (Next.js App Router), the app that serves tanmatra.food. Product shape — routes, flows, steps, data, business rules, API contracts — is preserved as it exists today; this brief changes design and cosmetics on top of the existing flows. Earlier drafts (v1 manual, v2 audit) are not in this repo and are not needed: this document is self-contained and wins on conflict._

> **v3.1 repo-alignment note (2026-09-03, validated file-by-file against `156fea9`).** Every authority this brief cites is repo-resident. Where v3 pointed at owner-workspace documents that do not exist here, v3.1 points at what does: the ten laws are stated in the table below from their in-repo citations; the design-system plan is `docs/ASTRYX-ADOPTION-RUNBOOK.md` + `tasks/PR-03-tokens-and-a11y.md` + `lib/tokens/src/tokens.css`; the gate order is `.github/workflows/storefront.yml`; refund/renewal consequences are `lib/subscription-rules/src/index.ts`, `lib/subscription-rules/src/planCatalog.ts`, `lib/planDecisionFacts.ts` and the `autopayDisclaimer` the verify response returns; account content order is `components/account/AccountHub.tsx` as shipped; "known gaps" are named by file and line, not by ticket id. The one external input is the delivered storefront revision itself (owner-supplied; see "Product source"). Corrections are marked **[v3.1]**.

### The ten laws, as this repo cites them

The "Experience Contract — ten laws" text is not in the repo (`docs/red-team/PHASE-0-TRIAL-FLIPBOOK.md` and `docs/TNM-MENU-01/M0-FINDINGS.md` both record this). The laws are nevertheless enforced individually in source; each row below is the law as the cited file applies it, and that file is the authority for this brief.

| Law | Rule as enforced | Repo anchor |
|---|---|---|
| 1 | Show first, ask second: what arrives, when, and the server's price are on screen before any ask. | `components/start/QrTrio.tsx`, `components/trial/TrialStart.tsx` |
| 2 | A sheet or gateway takes over with our summary still on screen behind it. | `e2e/specs/stitch-runtime/trial-flipbook.spec.ts` |
| 3 | Every step has a visible way back; back goes exactly one step. | `components/menu/PersonalizedMenu.tsx`, `lib/useScrollRestore.ts`, `lib/focusRouteBack.test.ts` |
| 4 | Never ask twice for something the customer already gave. | `components/wizard/QuickSetupWizard.tsx`, `components/start/QrStart.tsx` |
| 5 | State only what the backend can act on; no phantom cadences, prices or options. | `lib/planDecisionFacts.ts`, `components/start/ReferralWelcome.tsx` |
| 6 | Customer-visible copy is customer words, never a server machine code. Gate: `scripts/lint-copy-vocabulary.ts`. | `lib/orderErrors.ts`, `components/checkout/plan/MemberIntake.tsx` |
| 7 | Ask for nothing the flow cannot use; no medical questions in the funnel. | `components/checkout/plan/PlanDetails.tsx`, `components/checkout/plan/PlanCheckout.tsx` |
| 8 | No dish representation without its macros. | `lib/trialTrio.ts`, `lib/planOffer.ts` |
| 9 | Every state ends with what happens next. | `components/account/DeliveryList.tsx`, `components/start/QrStart.tsx` |
| 10 | No reachable state that is merely blank, and none that lies. | `components/start/ReferralWelcome.tsx`, `components/start/QrStart.tsx` |

The "flipbook" is likewise this repo's existing verification pattern, not an external process: `e2e/specs/stitch-runtime/menu-flipbook.spec.ts` and `e2e/specs/stitch-runtime/trial-flipbook.spec.ts` capture a screenshot per reachable state; every screen PR adds or extends a spec in that directory.


## Mission

Replicate the delivered Tanmatra storefront revision — its visual system, hierarchy, voice and interaction grammar — across every customer-facing screen of `artifacts/storefront`, starting from mobile and extending outward only after the mobile journey is complete.

The product should feel:

- Fast to understand for a first-time visitor.
- Easy to use with one hand.
- Clear about meals, nutrition, delivery, trust, and price.
- Calm during loading, validation, payment, and recovery.
- Consistent across a-la-carte meals, plans, wellness content, pantry/marketplace content, and account journeys.

This is an implementation brief, not an invitation to redesign the product architecture. Preserve existing business rules, API contracts, copy intent, and the delivered revision's visual direction unless a ticket below explicitly requires a change. This brief, issued by the owner, supersedes the current black/gold palette locked in `lib/themes/tanmatra.css` and `tasks/PR-03-tokens-and-a11y.md`: the delivered revision's palette and type replace it.

**Shape-preservation test, applied to every change:** if a screen's route, its sequence of steps, the questions it asks, the actions it offers, or the data it shows changes, it is not in this brief — stop and log it under "Known gaps" (see the implementation matrix).

---

## CRO and ROI operating model

Optimize for completed, repeatable customer value rather than maximum click volume. The best path is the shortest path that gives the customer enough confidence to act and enough value to return.

### Revenue priority

Implement and measure these paths in this order, as they exist today:

1. **Quick meal:** Home → `/menu` → dish sheet or `/dish/[slug]` → cart drawer → `/checkout` (identity → address → pay) → Razorpay → `/order/confirmed/[orderId]`.
2. **Meal plan:** Home or `/plans` or `/quick-setup` or `/start` (QR) → `/plan/[planId]` preview → plan checkout → Razorpay → active plan (`/account/subscriptions`, `/meal-planner`).
3. **Retention:** Confirmed order → reorder or plan invitation → saved preferences → next order.
4. **Relevant expansion:** Active meal or plan → contextual add-on (`EveningAddOffer`, `CartUpsellRail`), marketplace item, meal deal, or wellness action.

Do not force the plan funnel on a customer who clearly wants a single meal. Do not force a long onboarding flow on a customer who is ready to buy. Use progressive profiling: ask for the minimum information needed for the next safe, valid step, then collect optional information when it improves the next experience.

### Conversion principles

- Show the customer what they get, what it costs, and when it arrives before asking for commitment.
- Keep one dominant action per screen and one clear recovery action when the dominant action cannot proceed.
- Prefer a visible, concrete next step over a large set of equally weighted choices.
- Let customers browse and add to bag before requiring account creation unless the API or legal requirement makes authentication necessary earlier.
- Ask for phone verification at the point where it protects an order, saves a plan, or enables account continuity.
- Never hide fees, plan cadence, renewal behavior, delivery constraints, or cancellation behavior until after payment intent.
- Use defaults only when they are safe, reversible, and clearly shown.
- Preserve intent across login, route changes, payment dismissal, errors, and refresh.
- Offer one relevant cross-sell at the moment it helps the current goal; do not interrupt the primary purchase.
- After success, propose one next action that improves retention. Never obscure the receipt or confirmation with an upsell.

### Funnel metrics and guardrails

Track the funnel by first-time versus returning customer, quick-meal versus plan intent, signed-out versus signed-in, viewport, payment method, and failure reason:

- Home view → primary CTA tap.
- Menu view → dish view.
- Dish view → add to bag.
- Bag view → checkout start.
- Checkout start → Razorpay open.
- Razorpay open → payment captured.
- Payment captured → server verified.
- Verified payment → confirmation viewed.
- First order → reorder or plan-start action.
- Plan preview → plan payment start.
- Plan payment → active subscription.
- Add-on shelf view → add-on attach rate.
- Login prompt → OTP verified.

Events are emitted through the existing vocabularies (`lib/funnel.ts`, `lib/lpEvents.ts`, PostHog via `lib/analyticsSanitizer.ts`). Existing event names are never renamed; see "Analytics realignment" under the E2E plan.

Guardrails:

- Do not optimize for checkout starts if payment completion falls.
- Do not optimize for plan starts if cancellations, support contacts, or failed deliveries rise.
- Do not count a payment as complete until server verification (`POST /payments/razorpay/verify`) succeeds.
- Do not count a subscription as active until the backend confirms it.
- Do not use urgency, discount, or scarcity claims unless the server supplies the claim and its validity window. The first-order offer (`GET /orders/first-order-offer`) is 25% capped at ₹80, display-only, auto-applied at finalize; never promise it before a 200 for a signed-in user.
- Every experiment must name one primary metric, one safety metric, the audience, and the rollback condition.

### CRO experiment discipline

Build the experience so a future agent can test one variable at a time:

- CTA wording and placement.
- Dish-card information density.
- Guest checkout versus earlier login prompt.
- Onboarding length.
- Quick meal versus plan entry point.
- Order summary placement.
- Cross-sell timing.
- Post-purchase plan prompt.

Do not run simultaneous changes to payment orchestration, pricing logic, fulfillment rules, and the visual shell. Instrument first, then experiment.

---

## Non-negotiable scope rules

1. **Mobile is the source of truth.**
   - Design and implement at 393px wide first (iPhone 15 Pro — the device of the thumb audit landed in `156fea9`).
   - Also verify 320px, 375px, 412px (Pixel 7 — the current e2e merge-gate project), 430px, and 768px.
   - Do not use desktop layout decisions to solve a mobile problem. The delivered revision was recorded at desktop width; obtain its 393px render before replicating any screen.
   - Desktop/tablet adaptations happen only after the mobile acceptance criteria pass.

2. **Customer-facing only.**
   - Work in `artifacts/storefront` only.
   - Do not touch `artifacts/tanmatra` (the Vite app is the internal Admin ERP + RD console **and still serves `/images/*` for 46 of 95 live dishes**), `artifacts/tanmatra-mobile` (Expo, not deployed), or `artifacts/api-server` (except where a ticket names a documentation-only change).
   - **[v3.1]** Do not touch `artifacts/storefront/quarantine/**` (210 tsconfig-excluded files, including stale copies of `CheckoutFlow`, `PhoneAuth`, `PlanCheckout`). Every path in this brief means the copy under `artifacts/storefront/components` or `lib`, never the quarantine copy.
   - `(b2b)/*` and `/corporate/*` routes are a separate brief.

3. **Use real data paths.**
   - Do not invent API endpoints, request bodies, response shapes, prices, eligibility rules, delivery rules, or payment outcomes.
   - Contract: `lib/api-spec/openapi.yaml` for the operations it documents; for the money path (undocumented in the spec today) the contract is `artifacts/storefront/lib/api.ts` + `docs/MONEY-PATH-VERIFICATION.md` + `docs/RATE-LIMITS.md`. The generated client (`lib/api-client-react`, `lib/api-zod`) does not cover checkout, subscriptions, payments, addresses or OTP — do not "use the generated client" for those.
   - Prices, ratings, badges, emails and dish imagery in the delivered revision are mock data. Render only what the server returns.
   - Keep local fixtures only for explicitly unimplemented endpoints and label those states honestly.

4. **Every interaction must have a state.**
   - Idle.
   - Pressed/tapped.
   - Loading.
   - Success.
   - Empty.
   - Validation error.
   - Network/server error.
   - Retry or recovery.
   - Restyling a component keeps every state it has today; no state is added or removed.

5. **Preserve the delivered shell pattern.**
   - Persistent mobile navigation (`components/MobileBottomNav.tsx` — scroll hide/reveal with hysteresis, `inert` when hidden, suppressed while sheets open).
   - Clear current-location state (`Header.tsx` / `HeaderShell.tsx` location trigger — Law 1 keeps it visible).
   - Thumb-reachable primary actions.
   - Small, reversible surfaces for secondary actions (Vaul drawer, `components/ui/drawer.tsx`).
   - Bag/cart feedback without forcing a full page transition (`components/cart/CartDrawer.tsx`, `MiniCartBar.tsx`, `AddToCart.tsx` — cart stays a drawer per `docs/STOREFRONT-ROUTE-PARITY.md` decision 2).
   - `/start` has no back control and no bottom nav by tested contract (`lib/focusRouteBack.test.ts`, `docs/QR-ACQUISITION.md`); the checkout shell has no tab bar (Law 3).

6. **No silent failures.**
   - A failed request must show a useful message and a retry action.
   - A rejected checkout must preserve the bag and entered form data.
   - A refresh or route change must not unexpectedly erase a saved bag or selected plan.

---

## Ground truth and resources

### Product source

- Repository: `https://github.com/bubsla-svg/TanmatraV2.git` (`main`). pnpm workspace, Node 22, `pnpm@9.15.5`.
- Implementation target: `artifacts/storefront/` — Next.js 16 App Router, Tailwind v4, Astryx tokens. `pnpm --filter @workspace/storefront run dev`.
- API server: `artifacts/api-server/` (Express). `pnpm --filter @workspace/api-server run dev`.
- Design reference: the delivered storefront revision (Replit build), exported into `docs/design-reference/storefront-revision-2026-09/` — read its `README.md` first: provenance, the token table, the contrast audit, and the list of reference traits the brief overrides. **[v3.1]**

### Delivered reference implementation → production counterpart

Use the delivered revision as the visual and composition reference; implement in the production counterpart. The revision is exported under `docs/design-reference/storefront-revision-2026-09/src/` (six hand-written files; its shadcn `ui/*` are stock and not copied). It is a standalone Vite app with six routes and mock data — never copy behavior from it. **[v3.1]**

| Delivered revision (reference) | Production counterpart in `artifacts/storefront` |
|---|---|
| `docs/design-reference/storefront-revision-2026-09/src/components/storefront-shell.tsx` | `components/HeaderShell.tsx`, `components/Header.tsx`, `components/FocusHeader.tsx`, `components/MobileBottomNav.tsx`, `app/layout.tsx` |
| `docs/design-reference/storefront-revision-2026-09/src/components/dish-card.tsx` | `components/DishCard.tsx`, `components/menu/*`, `components/ui/SafeImage.tsx` |
| `docs/design-reference/storefront-revision-2026-09/src/hooks/use-storefront.tsx` | `lib/cartStore.ts`, `components/cart/CartProvider.tsx` (behavior stays; no new store) |
| `docs/design-reference/storefront-revision-2026-09/src/lib/catalog.ts` | `lib/catalog.ts` (server-backed; the reference catalog is mock) |
| `docs/design-reference/storefront-revision-2026-09/src/pages/storefront-pages.tsx` (+ `src/App.tsx` routes) | `app/(global)/*`, `app/(focus)/*` |
| `docs/design-reference/storefront-revision-2026-09/src/index.css` | `lib/themes/tanmatra.css` (`light-dark()` tokens), `lib/tokens/src/tokens.css`, `app/globals.css` — consume one token layer per `docs/ASTRYX-ADOPTION-RUNBOOK.md` and `tasks/PR-03-tokens-and-a11y.md`; do not add a fifth |

Payment and auth are **live** in the storefront, not preserved references:

- `artifacts/storefront/lib/api.ts`
- `artifacts/storefront/lib/moneyPath.ts`
- `artifacts/storefront/lib/razorpayAdapter.ts`
- `artifacts/storefront/lib/verifyRetry.ts`
- `artifacts/storefront/lib/otpFlow.ts`, `lib/phoneAuth.ts`
- `artifacts/storefront/lib/checkout.ts`, `lib/planCheckout.ts`, `lib/checkoutCycle.ts`, `lib/postCheckout.ts`
- `artifacts/storefront/components/checkout/*` — **[v3.1]** the live money surfaces are `AlacarteCheckout` → `AlacarteDetails` (inline pincode/address, `DeliverySlotPicker`, `AllergenAckControl`, `AlacarteOrderSummary` → `QuoteBreakdown`, `AlacartePayBar` → `PaymentMethodsRow`), `PhoneAuth`, `EveningAddOffer`, `UnresolvedPaymentPanel`, and `plan/*` (`PlanCheckout` → `PlanIdentityGate`, `PlanServiceabilityGate`, `PlanOfferPreview`, `PlanDetails` → `MemberIntake`, `PaymentMethodsRow`). `CheckoutFlow` / `CheckoutIdentity` / `CheckoutAddress` / `CheckoutPay` / `StepDots` are the `NEXT_PUBLIC_LIVE_CHECKOUT=0` fallback (`lib/flags.ts`; production sets it to `1` in `deploy.yml`) and make no money-path calls — restyle them only for local-dev parity, never as the checkout.
- `artifacts/storefront/components/premium/PremiumMembership.tsx`
- `artifacts/storefront/app/(focus)/checkout/page.tsx`

They are the behavioral source of truth for Razorpay sequencing, retry, captured-payment recovery, and subscription versus a-la-carte orchestration. Restyle their surfaces; do not re-sequence, re-wire, or port them anywhere.

### API and backend

- API base path is `/api`. Session-cookie auth is the default for every operation (openapi.yaml line 14; no operation overrides it).
- Documented in `lib/api-spec/openapi.yaml` and used as listed:
  - `GET /orders/first-order-offer` (401 signed-out)
  - `POST /orders/finalize` — documented (`Idempotency-Key` header required; 409 on key reuse with a different body; replays carry `Idempotent-Replay: true`) but **not called by the storefront**; it is the loyalty route gated by `ORDER_FINALIZE_DISABLED` (503)
  - `POST /marketplace/checkout` — same idempotency contract; called from `lib/marketplaceApi.ts`
  - `GET/PATCH/PUT /preferences`
  - `GET /dish-reviews/{slug}` (no response schema in the spec; inherits cookie auth despite "public" in its summary), `POST /dish-reviews`
  - `POST /dish-rationales`
  - `GET /wellness/today`
  - `GET/PUT /meal-plan-settings`
  - `GET /meal-plans`, `POST /meal-plans/generate` (201, `{plan, usedFallback}`), `GET /meal-plans/{id}`, `POST /meal-plans/{id}/regenerate-day`, **`PATCH /meal-plans/{id}/slot`**, `POST /meal-plans/swap-suggestions`, `POST /meal-plans/{id}/accept`, `POST /meal-plans/{id}/discard`
- Real but undocumented in the spec (contract = `lib/api.ts` + `docs/MONEY-PATH-VERIFICATION.md`): `POST /auth/phone/send-otp`, `POST /auth/phone/verify-otp` (OTP itself is Firebase-sent; the server exchanges the idToken for the `sid` cookie), `POST /orders`, `POST /subscriptions`, `POST /subscriptions/quote`, `/subscriptions/:id/*`, `POST /payments/razorpay/order`, `POST /payments/razorpay/verify`, `/addresses`, `GET /credit-ledger`, `POST /orders/claim`, `/vouchers`.
- Rate limits the UI must render as states (`docs/RATE-LIMITS.md`): payments 10/min and orders/checkout/subscriptions 30/min are **fail-closed**; addresses 30/min is fail-open **[v3.1]**; send-otp 20/hr per IP and 5/hr per phone, verify-otp 30/hr per IP (route-level in `artifacts/api-server/src/routes/auth.ts`, not in the table).
- Live kill-switches: `PLAN_CHECKOUT_DISABLED` (`artifacts/api-server/src/lib/flags.ts`, enforced in `artifacts/api-server/src/routes/subscriptions.ts`; unblock is the next engineering task, tracked separately) and `ORDER_FINALIZE_DISABLED`.

### Skills and governance docs to load before implementation

Load only what is relevant to the work being performed. Skills are the repo's own (`agent-skills/skills/*`, `.claude/skills/*`); the repo docs win on conflict. **[v3.1]**

| Concern | Repo skill | Repo authority |
|---|---|---|
| Visual and interaction system | `agent-skills/skills/frontend-ui-engineering/SKILL.md`, `.claude/skills/frontend-design-direction`, `.claude/skills/design-system` | The ten laws table above; `docs/ASTRYX-ADOPTION-RUNBOOK.md`; `tasks/PR-03-tokens-and-a11y.md`; `docs/NATIVE-FEEL-STOREFRONT-PLAN.md` §1 |
| Mobile variants, state comparison | `agent-skills/skills/browser-testing-with-devtools/SKILL.md`, `.claude/skills/browser-qa` | `docs/pixel-pipeline.md` S3–S6, `docs/wiring-guide.md` |
| Bringing a component into iteration / graduating it | `.claude/skills/stitch-skill`, `.claude/skills/image-to-code-skill` | `docs/pixel-pipeline.md` S3 (extract spatial spec) → S4 (implement) → S5 (pixelmatch ≤1.5%, geometry ±2px) → S6 (divergence ledger) |
| Frontend conventions | `agent-skills/skills/frontend-ui-engineering/SKILL.md`, `.claude/skills/kg/SKILL.md`, `.claude/skills/react-patterns` | `CLAUDE.md`, `artifacts/storefront/e2e/support/locators.ts` (role/accessible-name locators), `docs/audit/COHERENCE-SWEEP-2026-08-13.md`; gate order = `.github/workflows/storefront.yml` |
| Checkout, subscriptions, purchase behavior | `agent-skills/skills/source-driven-development/SKILL.md` | `docs/MONEY-PATH-VERIFICATION.md`, `docs/RATE-LIMITS.md`, `lib/subscription-rules/src/index.ts`, `lib/subscription-rules/src/pricing.ts`, `lib/subscription-rules/src/planCatalog.ts`, `lib/planDecisionFacts.ts`, `docs/audit/P0-2-PLAN-CHANGE-CONTRACT-TRACE.md` |
| Third-party connections | `agent-skills/skills/api-and-interface-design/SKILL.md` | `lib/razorpayAdapter.ts`, `lib/phoneAuth.ts` — Razorpay and Firebase OTP only; no substitute provider, no client-side amount |
| Funnel and conversion events | — | `lib/funnel.ts`, `lib/lpEvents.ts`, `lib/analyticsSanitizer.ts`, `lib/moneyFunnel.test.ts` |
| Persistence / production data | — | `lib/db` — not touched by this brief |
| Preview workflow | `agent-skills/skills/using-agent-skills/SKILL.md` | `CLAUDE.md` run commands (always `--filter`) |
| Repeatable validation | `agent-skills/skills/test-driven-development/SKILL.md`, `.claude/skills/e2e-testing`, `.claude/skills/verification-loop` | `pnpm --filter @workspace/storefront run typecheck`, the storefront gates in `.github/workflows/storefront.yml` — `lint:tokens`, `lint:css-vars`, `lint:dark-forks`, `lint:unregistered-color-utility`, `lint:component-drift`, `lint:landmarks`, `lint:placeholder-assets`, `lint:icon-font`, `lint:copy-vocabulary`, `lint:stitch-markers`, `lint:client-nav`, `lint:filecap` — `scripts/lint-test-reach.ts`, `pnpm --filter @workspace/storefront run test` (968 DB-free tests), `e2e/` mobile project. **[v3.1]** `lint:colors` / `lint:prices` scan `artifacts/tanmatra/src` only (`scripts/lint-colors.ts:9`) and are not storefront gates. |
| Publishing | `agent-skills/skills/shipping-and-launch/SKILL.md`, `.claude/skills/delivery-gate` | `docs/LIVE-CUTOVER.md`, `docs/DOMAIN-CUTOVER.md`, `.github/workflows/deploy.yml` |

### External reference

- Live customer site for content and behavior comparison: `https://tanmatra.food`. Audit it at a mobile viewport only.
- Delivered revision preview (Replit) for look and hierarchy: audit at 393px only.
- Precedence: the delivered revision wins on look, type, colour, spacing and voice; the repository wins on behavior, data, routes and business rules; the ten laws (table above) win over both. When live behavior conflicts with the API contract or source repository, stop and resolve the discrepancy before implementing.

---

## Mobile interaction contract

Apply these rules to every customer-facing screen. Items marked **[shipped]** exist on `main` (`docs/NATIVE-FEEL-STOREFRONT-PLAN.md` §1 "protect this"; `156fea9` thumb audit) — verify they survive the restyle; do not rebuild them.

### Touch and gesture

- Interactive targets must be at least 44px by 44px; 48px on money-path controls **[shipped: `.touch-target-min`, money-path class]**.
- Keep adjacent destructive and primary actions visually and physically separated.
- Use `touch-action: manipulation` on buttons, chips, toggles, and quantity controls **[shipped]**.
- Provide a visible pressed state within the same tap.
- Do not rely on hover for meaning, disclosure, or access to an action.
- Horizontal shelves must support touch scrolling and show an intentional continuation cue.
- Do not trap the user in a horizontal scroller.
- Avoid nested horizontal scrollers.

### Navigation

- Keep the mobile quick-navigation bar persistent on customer screens **[shipped: `MobileBottomNav.tsx`; exempt: `/start`, checkout shell]**.
- The active destination must be obvious.
- Preserve scroll position when opening a temporary surface and restore it when the surface closes **[shipped: `lib/useScrollRestore.ts`]**.
- Use route changes for meaningful destinations.
- Use a bottom sheet/drawer for contextual actions, cart previews, filters, and confirmations **[shipped: Vaul `components/ui/drawer.tsx` — canonical; `components/primitives/Overlays.tsx` is the second system to fold into it]**.
- A sheet must have a clear close affordance, escape behavior where supported, and a swipe/tap-outside exit; the back gesture closes it **[shipped: `components/ui/useOverlayHistory.ts`]**.

### Sticky actions

- Use a sticky bottom action for the next high-value step when the user is inside a long journey **[shipped: `primitives/StickyLedger.tsx`, `checkout/AlacartePayBar.tsx`, `cart/MiniCartBar.tsx`, `landing/StickyCtaBar.tsx`]**.
- Add safe-area padding with `env(safe-area-inset-bottom)` **[shipped: `viewportFit: "cover"` in `app/layout.tsx`, `env()` on every fixed bar]**.
- Never cover the last form field, error message, quantity control, or legal text.
- Keep one primary action per sticky region; sticky regions stay under 10% of viewport height.
- Disable only while the request is actively submitting.
- Show progress inside the action instead of moving the user to a blank loading page.

### Forms and validation

- Phone fields ship as `inputMode="numeric"` + `autoComplete="tel"` (`PhoneAuth.tsx:246`, `AlacarteDetails.tsx:269`) **[v3.1]** — keep as is; switching to `inputMode="tel"` is a behaviour change and goes to a ticket, not a restyle.
- Use `autoComplete` values appropriate to the field (`one-time-code` on the OTP field — **[shipped: `PhoneAuth.tsx`]**).
- Disable autocorrect and auto-capitalization where they would corrupt a name, address, or code. (Coupon fields do not exist: `lib/checkout.ts` `FORBIDDEN_ELEMENTS` makes `coupon_field` and `cod_option` unrepresentable.)
- 16px minimum input font so iOS does not zoom **[shipped]**.
- Validate on blur and on submit; keep errors inline and close to the field.
- Never move the submit action off-screen when an error appears.
- Preserve input values after failed requests.
- Do not clear a valid address, phone number, or order selection because of a server error.

### Loading and recovery

- Use skeletons that match the final shape to prevent layout shifts **[shipped: `components/ui/skeleton.tsx` CLS contract — re-measure after restyle]**.
- Keep headings and key CTA positions stable during loading.
- For actions under one second, preserve the page and show local pending feedback.
- For longer actions, show an explicit progress state.
- Render empty states with a reason and a next action (`components/primitives/Feedback.tsx` `EmptyState`).
- Render network errors with retry and preserve local state (`InlineError`, `components/SegmentError.tsx`).

### Accessibility and observability

- Use semantic headings in order (the 2026-08-01 audit found h1→h3 skips on five routes; restyle changes tags' styles, never their levels downward).
- Every icon-only control needs an accessible name.
- Use `aria-pressed` for toggles and saved/favorite controls.
- Use `aria-expanded` and `aria-controls` for accordions.
- Use `role="status"` or an equivalent live region for cart, save, and checkout feedback.
- Respect reduced-motion preferences.
- Test IDs: the e2e convention is role + accessible name via `e2e/support/locators.ts` and page objects in `e2e/support/pages`. Add `data-testid` only where role and name are ambiguous (quantity steppers, status regions, checkout step markers) and register each in the page object. A restyle that breaks an existing locator has changed shape — revert.
- Fire analytics only after the UI action is accepted, not merely when a component renders.

---

## Customer-facing screen map

Treat these route families as one coherent mobile product. All routes below exist in `artifacts/storefront/app` unless marked.

### Acquisition and core shopping

- `/q/[src]` and `/r/[code]` — route handlers (QR scan log → 302 `/start?src=`; referral attach). No UI; a `page.tsx` audit misses them.
- `/start` — QR cold landing (fixed trio, all-in price, window, one PIN ask; no back, no menu, no window picker).
- `/`
- `/menu`
- `/dish/[slug]` (focus)
- `/custom-build` (focus)
- Cart drawer — not a route (`components/cart/CartDrawer.tsx`); `/cart` is a recorded non-route.
- `/checkout` (focus)
- `/order/confirmed/[orderId]` (focus)
- `/track/[orderId]`
- `/plans`, `/plan/[planId]` (focus), `/trial` (focus), `/quick-setup` (focus)
- `/group/[code]` (focus)
- `/login` (focus)
- `/marketplace`, `/marketplace/[slug]` (focus)
- `/meal-deals`
- `/vouchers`
- `/premium`

### Nutrition and wellness

- `/meal-recommendations`
- `/meal-planner`
- `/metabolic`
- `/performance`
- `/care`, `/care/[condition]`
- `/clinical`
- `/coach`
- `/recipes` — **`/recipes/[slug]` does not exist; `app/(global)/recipes/page.tsx:23` links to it and every card 404s. Known gap; fix is a separate ticket, not a restyle.**
- `/meal-guides/[dishSlug]`

### Trust, education, and community

- `/about`
- `/how-it-works`
- `/faq`
- `/rd`, `/rd/[slug]`
- `/team`
- `/challenges`, `/challenges/[slug]`, `/challenges/tracker`

### Account and operational support

- `/account`
- `/account/orders`
- `/account/subscriptions`
- `/account/addresses`
- `/account/preferences`
- `/account/favorites`
- `/account/wellness`
- `/account/history`
- `/account/loyalty`
- `/account/billing`
- `/account/connections`
- `/account/appointments`
- `/account/symptoms`
- `/offline`
- `/legal`, `/legal/[slug]`

Path hygiene: the 308 map in `docs/STOREFRONT-ROUTE-PARITY.md` (`/orders`→`/account/orders`, `/rewards`→`/account/loyalty`, bare `/track`→`/account/orders`, `/subscribe`→`/plans`) is a one-canonical-URL decision; do not reintroduce a legacy path. `/qa` and `/styleguide` are dev-only.

For each route, document:

1. The user's job-to-be-done.
2. The primary next action.
3. The money or retention path it feeds.
4. The data dependencies.
5. The loading, empty, error, and recovery states.
6. The mobile sticky action, if one is needed.

---

## Onboarding flow

Onboarding is a conversion assistant, not a registration wall. It must help the customer reach the right product path quickly and collect only information that changes the recommendation, price, delivery, or safety of the next step.

**Realigned:** onboarding already exists as `/quick-setup` (`components/wizard/QuickSetupWizard.tsx`: goal, diet, allergens → plan), the `/plans` discovery sequence, `/start` for QR traffic, and `/trial`. This brief restyles those surfaces in the delivered revision's language. It does not add, remove, or reorder questions. The on-page "60-second assessment" quiz was removed from the home hero (`components/landing/Section01ClinicalHero.tsx` header comment) and stays removed.

### Entry points

Support these entry states, as they exist:

- First-time visitor who taps the plan CTA on `/` → `/quick-setup` or `/plans`.
- Visitor who chooses a plan from `/plans` → `/plan/[planId]`.
- Visitor who selects personalization from `/meal-recommendations`, `/meal-planner`, `/metabolic`, or `/performance`.
- Returning customer who wants to update preferences from `/account/preferences`.
- Checkout customer who needs to verify a phone number (`components/checkout/PhoneAuth.tsx`) or save delivery information (`CheckoutAddress.tsx`).
- QR visitor landing on `/start`.

The quick-meal CTA must bypass the full onboarding flow. A customer can go directly to `/menu`, choose a dish, add it to the bag, and complete checkout.

### Plan-onboarding sequence (as it exists; maximum four short steps before value)

#### Step 1: Intent

The home screen's two CTAs are the intent step: quick meal → `/menu`; plan → `/quick-setup` / `/plans`. Do not add an interstitial question. Do not ask plan questions after the customer has chosen quick meal.

#### Step 2: Goal

`/quick-setup` goal step. One choice per row with a clear selected state; "not sure yet" where the wizard supports it; explain the selection can be changed later; no diagnosis framing. Goal labels are the ones the wizard and `PLAN_CATALOG` carry today — do not add a label the backend cannot act on.

#### Step 3: Food preferences

`/quick-setup` diet and allergen steps: dietary pattern (the wizard's `STYLES` are `vegetarian | omnivore` **[v3.1]**; asked once per journey — Law 4), allergens (`ALLERGIES`: dairy, gluten, nuts, …), and any dislike/spice control the wizard already has. "None"/"skip" stay valid. Preference is kept separate from allergy; no medical questions in the funnel (Law 7). Sensitive inputs live only on `/account/symptoms` with consent.

#### Step 4: Routine and plan fit

`/plans` → `/plan/[planId]`: mealtime, cadence (builder cycles are weekly/monthly/quarterly; `lib/checkoutCycle.ts`), start date, delivery window. Each selection is reflected immediately through `POST /subscriptions/quote`. Do not ask for a value the backend will ignore; do not surface "fortnightly" until the builder does (Law 5).

### Value reveal and account creation

After the short sequence, as implemented on `/plan/[planId]` and plan checkout:

1. Show the personalized plan preview.
2. Show the server-quoted price, cadence, delivery expectation, and what is included; the sample dishes carry their macros (Law 8).
3. Let the customer edit one preference from the preview without restarting.
4. Ask for phone verification only when the customer saves the plan, starts checkout, needs order continuity, or opens a signed-in-only feature.
5. OTP: `lib/otpFlow.ts` + `lib/phoneAuth.ts` (Firebase-sent, server exchanges idToken for `sid`) — `RESEND_COOLDOWN_SEC = 30`, 10-digit phone, 6-digit code, stages `collapsed|phone|code`, error keys `captchaUnavailable | sessionExpired | invalidPhone | invalidCode | serverError`.
6. Preserve the intended route, plan selection, bag, and answers through OTP.
7. Return the customer to the exact interrupted step after verification.
8. On OTP failure, keep the phone value, show the specific error, and provide a resend path with the visible 30 s cooldown; render the 5/hr-per-phone server limit as an honest wait state, not a generic error.
9. On successful verification, save the minimum supported preferences and continue.

### Onboarding micro-interactions

- Show a compact progress indicator with step names or meaningful counts (`StepDots.tsx` pattern).
- Support back navigation without clearing later answers unless the answer becomes invalid.
- Use tap-to-select rows with an immediate selected state.
- Use a sticky "Continue" action that changes to "See my plan" at the value reveal step.
- Keep the selected answers visible when the keyboard opens.
- Use a brief local pending state for preference saves.
- Do not auto-advance after a choice if the next question needs explanation; do auto-advance only for obvious single-choice steps where it reduces effort.
- Show a completion confirmation before sending the customer into payment.
- If the customer abandons onboarding, retain a resumable draft locally only if it contains no sensitive data, and show a clear resume or discard choice.

### Onboarding acceptance criteria

- A quick-meal customer reaches the menu without entering plan onboarding (Law 7).
- A plan customer sees a meaningful, server-quoted preview after no more than four short steps (Law 1).
- Every required answer has a reason connected to recommendation, delivery, price, or safety.
- "Skip" or "I'm not sure" never creates an invalid API payload.
- OTP interruption returns the customer to the correct intended action (Law 3).
- Plan preview price and cadence are server-backed (Law 5).
- The customer can change a preference without losing the selected plan.
- Abandonment does not create a subscription, order, payment attempt, or misleading success event.
- The restyled wizard asks exactly the questions it asks today.

### Onboarding events

Existing: `identity_verified` (= OTP verified), `cuj_plan_viewed`, `cuj_checkout_start`, `assessment_{start,step,complete,skip}` (landing vocabulary — leave as is). New, added to `lib/funnel.ts` with the guard test updated in the same PR:

- `onboarding_started`
- `onboarding_intent_selected`
- `onboarding_goal_selected`
- `onboarding_preferences_completed`
- `onboarding_routine_completed`
- `onboarding_preview_viewed`
- `onboarding_edit_started`
- `onboarding_skipped`
- `login_prompted`
- `otp_sent`
- `onboarding_abandoned`
- `onboarding_completed`

---

## Logged-in end-user experience

Treat sign-in as continuity for the customer, not a separate product. After OTP verification, the user should immediately see current order status, plan status, saved choices, and the next useful action.

### Authentication behavior

1. A signed-out visitor can browse public customer content and build a bag.
2. Prompt for sign-in only at a meaningful boundary:
   - Checkout submission.
   - Save plan.
   - Save preferences.
   - Review submission.
   - Join a challenge.
   - Open account-only history or wellness data.
3. Use the existing OTP surfaces (`components/checkout/PhoneAuth.tsx` in-flow; `components/auth/LoginCard.tsx` on `/login` with sanitized `next`, `lib/loginRoute.ts`). Restyle both in the delivered revision's language; consolidating them into one sheet is a shape change — log it.
4. Preserve:
   - Current route.
   - Scroll position.
   - Bag contents.
   - Selected dish and quantity.
   - Selected plan and onboarding answers.
   - Checkout form values.
5. Handle expired sessions by reopening the same action after verification.
6. On sign out, clearly state which local state remains and which server state is no longer available.

### Logged-in route map

Restyle these end-user screens in place. Content order is the order `components/account/AccountHub.tsx` renders today (the audit's "Phase 9: Account and telemetry" in `docs/audit/P0-CHECKPOINT.md` passed against it). **[v3.1]**

#### `/account`

Account home must answer:

- What is my next delivery or active order?
- What plan or subscription is active?
- What can I reorder now?
- Which saved meal or preference should I use next?

Order of content (existing; restyle, do not reorder): action required → active order or plan status → primary next action → reorder or continue-plan action → saved preferences and favorites → wellness and loyalty summaries → support and settings. Do not lead with a settings list when the user has an active order.

#### `/account/orders`

- Show current orders first, then history.
- Make status and next expected action scannable.
- Support order detail, reorder where allowed, and support/recovery.
- Preserve the original order context when opening a detail view.
- A cancelled, failed, or delayed order needs a recovery action rather than a dead status label.

#### `/account/subscriptions`

- Show active plan, next billing/delivery event, cadence, meal count, and delivery window.
- Make pause, resume, skip, change, and cancel behavior explicit and reversible where supported. Skip/swap/reschedule are gated by the shared 24 h cutoff (`SKIP_SWAP_CUTOFF_MS`, `lib/subscription-rules`); past cutoff, show the reason. Change plan is next-cycle only (`docs/audit/P0-2-PLAN-CHANGE-CONTRACT-TRACE.md`; the double-bill containment there is open).
- Show the consequence before confirmation: exact refund, credit, wallet, future-charge and delivery effect, exactly as `components/account/SubscriptionManager.tsx` and `components/account/DeliveryList.tsx` state it today from `lib/subscription-rules` (`applyTrialCreditPaise`, `trialCreditExpiry`, `SKIP_SWAP_CUTOFF_MS`). **[v3.1]**
- Never hide renewal or cancellation behavior behind a vague button label.
- Use the live subscription APIs and `GET /meal-plans`, `GET /meal-plan-settings` rather than client-only status.

#### `/account/addresses`

- Show the active delivery address and clearly marked alternate addresses.
- Support add, edit, delete, and select only if the backend supports each operation (`/addresses`).
- Validate pincode/serviceability before payment intent.
- Do not erase a previously valid address when a new address fails validation.

#### `/account/preferences`

- Make saved dietary, taste, goal, and delivery preferences editable in place.
- Show pending, saved, and failed states near the changed field.
- Use `GET/PATCH/PUT /preferences`.
- Do not claim a preference changed until the server confirms it.

#### `/account/favorites`

- Show saved dishes with direct add and detail actions.
- Provide a useful empty state that leads to menu discovery.
- Keep saved state synchronized with dish cards and detail pages.

#### `/account/wellness`

- Show today's useful summary first.
- Use `GET /wellness/today`.
- Keep wearable connect, disconnect, and sync actions explicit.
- If there is no data, explain how to create the first useful data point.
- Do not turn wellness data into a forced purchase prompt; observational wording only, no causation.

#### `/account/history`

- Combine relevant past meals, plans, and actions into a reorder-oriented history.
- Make repeated behavior easier than fresh discovery.
- Do not expose sensitive entries without the same session protections as the rest of account data.

#### `/account/loyalty`

- Show current balance, how it was earned, how it can be used, and the next useful action.
- Explain expiration or restrictions before a customer attempts to redeem.
- Apply credits only through server-confirmed order or subscription flows.

#### `/account/billing`

- Show payment history, billing status, and recovery actions only for data supported by the backend.
- Never display sensitive payment credentials.
- Link failed or pending payment states to a recovery action.

#### `/account/connections`

- Show connected wellness services and current sync status.
- Use explicit connect, sync, and disconnect confirmations.
- Handle provider failure without making the account page unusable.

#### `/account/appointments`

- Show upcoming appointment and payment status first.
- Keep appointment checkout separate from meal checkout while using the same mobile interaction contract.
- Preserve an unpaid appointment when payment is dismissed.

#### `/account/symptoms`

- Treat symptom and health inputs as sensitive.
- Ask for explicit consent where required.
- Keep the purpose, storage, and deletion behavior understandable.
- Never use a symptom entry as an automatic diagnosis or guaranteed treatment claim.

### Logged-in retention loops

Use the following low-friction loops where they exist today; loops that do not exist yet (post-order plan offer — `lib/postCheckout.ts` carries no next-action logic) are known gaps, not restyle tasks:

- Completed order → reorder the same meal.
- Completed order → compare a relevant plan without losing the receipt.
- Active plan → edit the next delivery before offering unrelated products.
- Saved favorite → add directly from account home.
- Wellness progress → suggest a relevant meal discovery path only when it matches the user's stated goal.
- Failed payment → recover the existing order or subscription instead of starting over (`UnresolvedPaymentPanel`).

---

# Critical customer journeys

## CUJ 1: First-time discovery to trial purchase

### Goal

Move a new visitor from "What is Tanmatra?" to a confident first meal or trial-plan selection without requiring desktop-like scanning.

### Screens and states

- Home hero.
- Delivery area and next-delivery context.
- Featured dish or featured meal shelf.
- First-order offer eligibility.
- Menu discovery.
- Dish detail (sheet and `/dish/[slug]`).
- Bag preview (cart drawer).
- Trial selection (`/trial`: 3 days × 1 lunch, **₹399 all-in** (`lib/trial.ts` `TRIAL_PRICE_PAISE` = `computePlanQuote("trial_3day")`, `flatPricePaise: 39900`), ₹399 credit back on plan start, 7-day validity — the only trial shape) **[v3.1]**.

### Implementation instructions

1. Keep the first screen focused on one proposition, one proof point, and one primary action. Home section order stays as it is today **[v3.1]** (`app/(global)/page.tsx`: `Section01ClinicalHero` → compact `DishCard` rail → `SectionTrialPush` → `Section04ProtocolsGrid` → `Section04bMarketplace` (the parked pantry grid) → `Section07ProofKitchen` → `Section10FaqAccordion`); restyle each section in the delivered revision's language.
2. Put the primary action in the lower thumb zone when the page is long.
3. Load the first useful content quickly; use skeletons that preserve hero, feature shelf, and CTA geometry — re-measure skeleton dimensions after the restyle.
4. Make delivery location relevant without forcing a full address form before the user understands the menu; the location trigger stays visible in the header (Law 1).
5. Fetch first-order eligibility from `GET /orders/first-order-offer` only for eligible signed-in contexts.
6. Never imply a discount is guaranteed before eligibility is confirmed.
7. Make the first interaction from the home screen either open the menu, open a dish, or select a trial path.
8. After adding a dish, show local confirmation and the expandable cart drawer rather than replacing the page.
9. Preserve the visitor's last discovery position when they return from a dish detail (`lib/useScrollRestore.ts`).
10. Every dish representation — card, sheet, rail, cart line, confirmation — carries its macros (Law 8). The delivered revision's cards omit them; the replicated card adds a macros row.
11. All food imagery through `components/ui/SafeImage.tsx`; real photos, never the reference's placeholder plates.

### Acceptance criteria

- A new user can reach a dish detail or trial plan within two intentional taps from the home screen.
- The add-to-bag action shows immediate pressed and success feedback.
- Loading does not move the primary action by more than 8px.
- The bag remains available from every customer route.
- Delivery and offer copy never contradicts the server response.
- Macros visible on every dish card at 393px.

### Events to instrument

Existing: `view_dish`, `trial_checkout_start` (use for trial path selected). New: `home_viewed`, `home_primary_cta_tapped`, `delivery_context_opened`, `first_order_offer_viewed`, `first_order_offer_applied`, `dish_added_from_home`.

---

## CUJ 2: A-la-carte and single-meal purchase

### Goal

Let a customer buy one meal without being pushed into a subscription, while making the purchase mode and delivery timing explicit.

### Implementation instructions

1. On dish detail, the existing one-time / on-a-plan segmented control (`DishDrawer`, `PdpBuyLedger`) is restyled in place; it appears where the dish is plan-eligible.
2. Preserve the selected mode across quantity changes and sheet openings.
3. Use the Vaul drawer for quantity, add-ons or customization, delivery timing, and cart preview.
4. Delivery timing: the existing server-backed `DeliverySlotPicker` (`POST /orders` reserves `deliverySlotId`) provides ASAP and future slots; restyle it, do not replace it with a custom calendar.
5. Native input types and `inputMode` must match the value wherever the picker uses inputs.
6. Show price impact next to any add-on or mode change — figures from the server quote.
7. Keep the primary action sticky while the customer reviews a long ingredient or macro section.
8. If the dish is unavailable, keep the existing recovery path and related meals; restyle only.

### Acceptance criteria

- One-time purchase is visible and usable without entering the plan flow.
- A user can select ASAP or a future slot without losing the dish or quantity.
- Add-ons update the visible total before the user confirms.
- The cart drawer opens without a full page reload.
- Invalid or unavailable slots show inline recovery and preserve the selected dish.

### Events to instrument

Existing: `view_dish`. New: `purchase_mode_selected`, `schedule_mode_selected`, `slot_selected`, `addon_selected`, `dish_added`, `cart_preview_opened`.

---

## CUJ 3: Goal-based nutritional filtering

### Goal

Help customers choose meals by outcome and understand the nutritional trade-offs without reading dense desktop tables.

### Implementation instructions

1. Use the outcome-first entry points that exist (`SectionChipBar`, `/metabolic`, `/performance`, protocol rails) with the goal labels already present in the product.
2. Horizontal rails where content is comparative — consolidate the ad-hoc `overflow-x-auto` rails (`menu/PantryRail.tsx`, `menu/SectionChipBar.tsx`, `protocol/ProtocolDishRail.tsx`, `mealplan/WeekCalendarStrip.tsx`, `account/AccountNav.tsx`, `metabolic/MetabolicExplorer.tsx`, and the snap-x rail mode inside `primitives/CardSection.tsx` used by `care/NeedStateRail.tsx` and `care/ConditionRail.tsx` **[v3.1]**) onto one restyled `Rail` primitive with a continuation cue and no nesting. The b2b calculators' rails are out of scope.
3. Accordions for macro breakdown, ingredient rationale, allergen information, and "why this meal" — one shared `Disclosure` primitive with `aria-expanded`/`aria-controls`, replacing the two bespoke FAQ accordions' duplicated logic while keeping their content.
4. Keep one summary row visible before expansion: protein, calories, fiber, or the product-approved metrics.
5. Place delivery-day toggles and selection controls in the lower thumb zone.
6. Make filters reversible and display the active filter state; filters persist in the route query as they do today.
7. Preserve selection when a user opens and closes a dish detail.
8. Use `POST /dish-rationales` for personalized explanations when the user is authenticated and the feature is enabled.
9. Do not infer clinical guidance in the UI beyond the approved product copy and API response.

### Acceptance criteria

- A user can reach a goal-specific meal shelf without navigating a desktop-style table.
- Macro details expand and collapse without shifting the sticky action unexpectedly.
- Active filters are visible, removable, and persist while browsing.
- Delivery day selection is reachable with one hand on a 393px viewport.
- Every health or nutrition claim has a source or approved product copy.

### Events to instrument

New: `goal_selected`, `meal_shelf_scrolled`, `nutrition_details_expanded`, `dish_rationale_viewed`, `delivery_day_selected`, `goal_dish_added`.

---

## CUJ 4: Cross-sell and pantry/marketplace monetization

### Goal

Increase order value with relevant add-ons while keeping the customer anchored to the active meal order.

### Implementation instructions

1. Use the `Rail` primitive for relevant add-ons, pantry goods, bundles, and wellness products (`CartUpsellRail`, `EveningAddOffer`, `components/meal-deals/BundleCard.tsx`, `MarketplaceGrid`).
2. Keep each shelf item scannable: product name, short reason to care, price, one thumb-sized add action. Inside the cart drawer, add-on CTAs are secondary, never the primary accent (as `components/cart/CartUpsellRail.tsx` renders them today).
3. Add items asynchronously to the mini-cart (`lib/cartStore.ts`).
4. Show the new item, quantity, and total change in local feedback.
5. Quantity controls: build one shared `QuantityStepper` (48px, disabled at zero, pending state) and migrate the five per-surface implementations **[v3.1]** (`cart/AddToCart.tsx` — consumed by `DishDrawer` and `PdpBuyLedger`; `cart/CartDrawer.tsx`; `menu/PdpBuyLedger.tsx` has its own; `checkout/AlacarteOrderSummary.tsx`; `cart/MarketplaceAddToCart.tsx` — consumed by `MarketplaceGrid`) — same behavior, one skin.
6. Prevent double additions from rapid taps: disable only the affected control during the request; repeated taps idempotent at the client boundary.
7. Do not open a new route for a simple cross-sell add.
8. `POST /marketplace/checkout` (`lib/marketplaceApi.ts`, `MarketplaceBuyNow.tsx`) remains the marketplace order path with its own `Idempotency-Key`.
9. Keep meal checkout and marketplace checkout distinct in code and copy.

### Acceptance criteria

- A customer can add a cross-sell item without losing the active meal bag.
- Mini-cart feedback appears within the local interaction surface.
- Quantity changes are easy to hit and never produce negative quantities.
- Repeated taps do not duplicate a line unexpectedly.
- Marketplace totals and meal totals are not silently mixed.

### Events to instrument

New: `cross_sell_shelf_viewed`, `cross_sell_item_viewed`, `cross_sell_added`, `mini_cart_opened`, `marketplace_checkout_started`.

---

## CUJ 5: Checkout and retention flywheel

### Goal

Complete payment and delivery with minimal mobile friction, while creating a clear path back to plans, reorders, and wellness value.

### Implementation instructions

1. **[v3.1]** Checkout keeps its existing shape per mode. **A-la-carte** (`/checkout?mode=alacarte`) is one screen: `AlacarteCheckout` gates identity with `PhoneAuth`, then `AlacarteDetails` holds pincode + address (inline, `autoComplete="postal-code"` / `"street-address"`), `DeliverySlotPicker`, `AllergenAckControl`, `AlacarteOrderSummary` (`QuoteBreakdown`) and the sticky `AlacartePayBar` (`PaymentMethodsRow`); recovery is `UnresolvedPaymentPanel`. **Plan** (`/checkout?plan=…`, `LIVE_CHECKOUT_ENABLED`) is `PlanCheckout`: `PlanIdentityGate` → `PlanServiceabilityGate` → `PlanOfferPreview` / `PlanDetails` (`MemberIntake`, `PaymentMethodsRow`) → pay. The manual's six visible stages map onto those surfaces, not onto new screens: contact = `PhoneAuth` / `PlanIdentityGate`; delivery + timing = the address block + `DeliverySlotPicker` / `PlanServiceabilityGate`; order review + payment = the summary + pay bar; confirmation = `/order/confirmed/[orderId]`. `lib/checkout.ts` (Breeze `identity | address | pay`, `CheckoutFlow`, `StepDots`) is the flag-off fallback and carries the load budgets only. Do not expand to six routes or six screens.
2. Keep the current step and total visible without forcing the user to scroll to understand progress.
3. Use `inputMode="tel"` for phone numbers, appropriate `autoComplete` values, `autoCorrect="off"` and `spellCheck={false}` where correction is harmful.
4. Validate inline and keep the sticky submit action in place.
5. Present one-tap payment options prominently as the connected Razorpay account supports them (UPI intent, Google Pay; Apple Pay where supported) — `PaymentMethodsRow.tsx` restyled, options from the adapter, none invented.
6. Do not invent payment provider behavior. Read `docs/MONEY-PATH-VERIFICATION.md` first.
7. Standard order path is `POST /orders` (a-la-carte) and `POST /subscriptions` (plan), each followed by `POST /payments/razorpay/order` and `POST /payments/razorpay/verify` — `lib/moneyPath.ts`. `POST /orders/finalize` is not the storefront's path.
8. `POST /marketplace/checkout` for marketplace orders with its idempotency requirements.
9. The idempotency key exists (`sub-<uuid>` header in `PlanCheckout.tsx`; `alc-<uuid>` as body `externalOrderId` in `AlacarteCheckout.tsx`). **Known gap, tracked separately:** it lives in `useRef` and does not survive refresh; fixing that is behavior work, not restyle.
10. Treat a replayed idempotent response as a successful recovery, not as a duplicate order.
11. On payment or server failure: keep the bag, form values, selected delivery slot; show the failed step; provide retry and alternate payment recovery where supported.
12. On success: show order number and delivery expectation; offer the next useful action: view order, start a plan, save preferences, or return to menu.
13. Retention hooks must be contextual. Existing: reorder after a completed order; pre-checkout add-on (`EveningAddOffer`). Not existing (known gaps): plan offer after a one-time order; preference capture after a meal choice; wellness follow-up.

### Acceptance criteria

- A customer can complete checkout one-handed at 393px without a submit action disappearing behind the keyboard or sticky footer.
- Invalid fields are identified inline without clearing valid fields.
- A retry cannot create a second order or second charge.
- A successful order survives refresh and has a clear confirmation state.
- The plan or reorder prompt never blocks confirmation of the current purchase.
- The restyled checkout has the same three screens, fields, and actions as today.

### Events to instrument

Existing (never rename): `begin_checkout` (= checkout started), `payment_opened`, `payment_failed` (with `error_code`; `"dismissed"` on cancellation), `checkout_complete` (= checkout completed), `subscription_created`. `lib/moneyFunnel.test.ts` asserts these by name. New: `checkout_step_viewed`, `checkout_field_error`, `payment_method_selected`, `checkout_submitted`, `checkout_retry`, `plan_offer_viewed_after_order`, `reorder_started`.

---

## Razorpay payment-page experience

Razorpay is a continuation of the Tanmatra purchase journey, not a separate product experience. The pages and pre-payment surfaces around the gateway must use the same mobile interaction contract, terminology, hierarchy, and recovery behavior as the storefront.

### Required payment sequence

Implemented in `lib/moneyPath.ts` for both a-la-carte and plan, in this exact order — restyle the surfaces, never re-sequence:

1. Server creates or prepares the Tanmatra order (`POST /orders`) or subscription (`POST /subscriptions`).
2. Server creates the Razorpay order using the server-owned amount (`POST /payments/razorpay/order` with `{orderId}` or `{orderId, subscriptionId}`; the plan bills its first-cycle order — there is no client-side Razorpay Subscription or mandate; the autopay mandate is server-side and its disclaimer is rendered verbatim from the verify response).
3. Client opens Razorpay Checkout with the returned order ID, amount, currency, and public key data (`lib/razorpayAdapter.ts`).
4. Razorpay returns payment facts to the client.
5. Client sends the payment facts to the server for signature verification (`POST /payments/razorpay/verify`, `lib/verifyRetry.ts`: 3 attempts, backoff 400/1200 ms, retries transport and 5xx only).
6. Client shows success only after server verification succeeds.
7. Client routes to `/order/confirmed/[orderId]` or the appropriate confirmed account destination; `lib/postCheckout.ts` carries perks to the confirmation page via sessionStorage.

Zero-charge cycles (`ref.settled === true`, credit covers the cycle) skip step 2 by design — the server 409s a gateway order.

Never:

- Send a client-calculated amount to create a Razorpay order.
- Trust a client-calculated total as proof of payment.
- Mark an order or subscription active on a gateway callback alone.
- Create a second Razorpay order just because verification is slow or the modal was dismissed.
- Expose secret credentials in browser code.
- Retry verify on a 4xx.

### Pre-payment page

Before opening Razorpay, the pay surface (`AlacarteDetails.tsx` with `AlacarteOrderSummary.tsx` / `QuoteBreakdown.tsx` / `AlacartePayBar.tsx`; plan review in `components/checkout/plan/PlanDetails.tsx` **[v3.1]**) shows:

- Selected meal or plan, with macros (Law 8).
- Quantity, cadence, and start date where applicable.
- Delivery address and delivery window.
- Item total, applicable discount/credit, delivery fee (₹50; free at subtotal ≥ ₹500; GST 5% — all server-computed, never hardcoded), and final server-provided amount.
- Renewal or repeat-delivery explanation for plans — the plan facts `lib/planDecisionFacts.ts` supplies to `components/checkout/plan/PlanDetails.tsx` and `PlanIdentityGate.tsx` (cadence, next charge, skip/swap cutoff, renewal), plus the `autopayDisclaimer` rendered verbatim from the verify response (`PlanCheckout.tsx:154`). No line is added or dropped. **[v3.1]**
- Consent and terms links required by the current business flow (`AllergenAckControl`, 48px consent rows).
- One primary "Pay securely" action (`AlacartePayBar`).

Rules:

- Keep the final amount visible without requiring a second summary screen.
- Let the customer edit the bag or delivery details without losing the current payment attempt context.
- If the server changes the total, update the review and ask for explicit confirmation before opening the gateway.
- Do not add unrelated cross-sells at the moment of payment.
- Show an expected time and state transition after the customer taps pay.
- The canvas behind the Razorpay sheet is themed in the delivered revision's palette with the order summary visible (Law 2). A white void behind the modal is a release blocker.

### Razorpay Checkout configuration

Use the existing adapter pattern:

- `lib/moneyPath.ts` owns orchestration.
- `lib/razorpayAdapter.ts` owns the browser gateway adapter (`confirm_close: true`).
- `lib/verifyRetry.ts` owns post-capture verification recovery.

Configure only provider-supported options and values returned or approved by the backend:

- Merchant display name.
- Product or plan description.
- Server-created Razorpay order ID.
- Server-provided amount and currency.
- Public key ID.
- Customer name, phone, and email only when already available and consented.
- Tanmatra order or subscription reference in provider notes where supported.
- Supported payment methods and UPI behavior based on the connected Razorpay account.

Do not override provider behavior with a custom fake payment page. Wrap it with Tanmatra-owned context before and after the gateway so the customer understands where they are and what happens next. The Razorpay modal's own theme colour is set from the delivered revision's accent token.

### Payment states and micro-interactions

#### Preparing payment

- Keep the order summary visible.
- Change the primary action to a pending state ("Opening payment…").
- Prevent duplicate taps.
- Do not disable back navigation for unrelated routes.
- If preparation fails, show the exact recovery action and preserve the bag.

#### Gateway open

- Keep the page behind the modal stable.
- Do not clear the bag or form state.
- Do not fire `checkout_complete` yet.
- Do not show a success toast before verification.

#### Customer dismisses the gateway

- Treat dismissal as an abandoned payment attempt, not an order failure (`RazorpayDismissed`; copy "Payment cancelled — you haven't been charged.").
- Keep the server-created order reference.
- Return to the payment review with "Resume payment" and "Change payment method" actions; resume reuses the existing order/subscription.
- Do not create a duplicate order when the customer resumes.

#### Payment captured, verification in progress

- Change copy immediately to "Confirming your payment…" (the existing `verifying` state in `AlacarteCheckout.tsx` / `AlacarteDetails.tsx`, `PlanCheckout.tsx` / `PlanDetails.tsx`) **[v3.1]** — do not reword the state copy.
- Keep the customer on a stable confirmation state.
- Persist the payment facts needed for retry in memory or safe session state. **Known gap:** `paidFactsRef` is in-memory only; refresh loses it. Behavior work, tracked separately.
- Do not ask the customer to pay again while verification is retrying.

#### Verification succeeds

- Show confirmed order or active-plan status from the server response.
- Show order reference, amount, delivery expectation, and next action.
- Offer reorder, manage plan, or return to menu only after the confirmation is clear.

#### Verification is temporarily unavailable

- Explain that payment was received and confirmation is still being checked (`UnresolvedPaymentPanel`).
- Offer "Check status again" (verify-only retry).
- Never rerun server order creation or open a new gateway order for a payment that has already been captured.
- Provide a support path if bounded retries are exhausted.

#### Payment fails before capture

- Keep bag, address, schedule, and plan selection.
- Show a concise failure reason where available (server machine code → customer words, Law 6).
- Offer retry and an alternate supported payment method.
- Keep the customer's last safe position in the checkout flow.

#### Network loss after gateway completion

- Treat the result as unknown until the server confirms it.
- Do not show "payment failed" based only on a client timeout.
- Attempt verification with the captured payment facts.
- If verification cannot complete, show a pending-confirmation state and preserve the order reference.

#### Rate limited

- A 429 on `/payments/*` (10/min, fail-closed) or `/orders` is its own state with honest copy and a wait, not a generic error.

### Payment-page CRO rules

- Put the final amount and what happens next above the fold.
- Keep the primary payment action sticky on the pre-payment page.
- Remove nonessential fields from the payment step (returning user: 0 typed fields; ≤ 3 taps to UPI — `lib/checkout.ts` budgets).
- Prefill only verified customer details.
- Use order context in every error message.
- Let customers resume from `/account/orders`, `/account/subscriptions`, or the confirmation route.
- After a successful one-off order, offer a plan comparison using the customer's actual purchase context (known gap — not a restyle task).
- After a successful plan purchase, send the customer to plan management, not back to a generic home page.
- Ask for a review or referral only after the customer has received value; do not place it before payment.

### Razorpay E2E acceptance criteria

- A-la-carte checkout opens Razorpay with a server-created order.
- Plan checkout opens Razorpay with the first-cycle amount owned by the server (once `PLAN_CHECKOUT_DISABLED` is lifted; until then the plan route's gated state is itself a state to restyle honestly).
- The client never sends a price to create a Razorpay order.
- A dismissed modal returns to a recoverable review state.
- A captured payment never creates a second gateway order during verification retry.
- A verification replay is handled as success when the server says the payment is already confirmed.
- A payment timeout does not falsely report a failed payment.
- An order or subscription is not marked successful before server verification.
- Refresh or re-entry can recover a pending order using its server reference (known gap; criterion stands, owned by the behavior ticket).
- Success routes show authoritative order or subscription state.
- The payment journey works with touch, keyboard, slow network, and reduced motion.

---

## CUJ 6: Trust, authority, and clinical credibility

### Goal

Make hygiene, FSSAI, registered dietitian, ingredient, preparation, and review information easy to verify on a phone without overwhelming the purchase path.

### Implementation instructions

1. Replace hover-dependent disclosures with touch-first patterns: `Disclosure` accordion, Vaul sheet, inline expandable row; short toast only for transient confirmation.
2. Keep one sentence of trust proof visible near the relevant action (the FSSAI · ISO 22000 · Dietitians badge on the dish sheet stays).
3. Put detailed proof behind a disclosure with an explicit label; the home trust grid (`components/landing/Section07ProofKitchen.tsx`) stays a dense 2×2 with long-form text behind a sheet.
4. Use `GET /dish-reviews/{slug}` for dish review content; document its response schema in the spec before building on it.
5. Use `/rd/[slug]` and `/team` data for authority claims rather than hardcoded claims where data exists.
6. Explain what each macro estimate means and whether it is ingredient-derived.
7. Do not use clinical language that implies diagnosis, treatment, or guaranteed outcomes unless approved by the product and API.
8. Trust disclosures must not push the primary action permanently off-screen.

### Acceptance criteria

- A user can verify preparation and authority claims without leaving the current purchase context.
- All trust disclosures work with touch, keyboard, and screen readers.
- Review loading and empty states are explicit.
- Expanding trust content does not break the sticky action or bottom navigation.
- Unsupported clinical claims are not introduced by the UI.

### Events to instrument

New: `trust_signal_viewed`, `trust_detail_expanded`, `review_section_viewed`, `review_opened`, `team_profile_opened`.

---

# Screen-by-screen implementation checklist

For every customer-facing screen:

## Before coding

- Identify the user goal and the one primary action.
- Identify the preceding and following screen in each CUJ.
- Identify all API calls and auth requirements.
- Identify money impact, if any.
- Identify whether the screen uses a sticky action, bottom sheet, horizontal shelf, or accordion today.
- Capture the screen's current states (loading, empty, error, retry, success) in a "before" flipbook at 393px.
- Obtain the delivered revision's render of the same screen at 393px with real photos and macros.

## While coding

- Start at 393px.
- Reuse the storefront shell and existing component primitives before adding a new pattern; the only new primitives this brief introduces are `Rail`, `Disclosure`, `QuantityStepper`, and a `StickyAction` base — each replacing duplicated implementations, none adding behavior.
- Keep data fetching and mutation logic out of purely presentational components.
- Keep the bag/store state centralized (`lib/cartStore.ts`).
- Use route state for shareable filters and destinations.
- Use local state for transient sheet, accordion, and pressed states.
- Consume tokens from `lib/themes/tanmatra.css`; no hardcoded colours (`lint:tokens`, `lint:css-vars`, `lint:unregistered-color-utility`, `lint:dark-forks` — and their committed baselines in `scripts/*-baseline.txt` are re-generated deliberately, never hand-edited) **[v3.1]**; prices come from the server quote, never a literal.
- Add accessible names and state attributes before visual polish.
- `git diff --stat` must show no changes under `lib/moneyPath*`, `lib/verifyRetry*`, `lib/razorpayAdapter*`, `lib/api.ts`, `lib/cartStore.ts`, `lib/checkout.ts`, `app/**/route.ts`, `middleware.ts`.

## Before closing the screen

- Test at 320px and 393px with a long content variant.
- Test with the keyboard open.
- Test tap, double tap, rapid tap, and back navigation.
- Test offline or rejected request behavior.
- Test an empty response.
- Test a slow response with the network throttled.
- Verify the sticky action does not cover content.
- Verify safe-area padding.
- Verify reduced-motion behavior.
- Verify route refresh and direct deep link.
- Produce the "after" flipbook; every state present before is present after; pixelmatch ≤ 1.5% against the delivered revision's 393px render where one exists, geometry ± 2px.

---

# Prioritized implementation matrix

## Quick wins: complete before broad route expansion

1. Standardize the mobile shell and active navigation state — **exists; restyle** `HeaderShell`, `Header`, `FocusHeader`, `MobileBottomNav`.
2. Shared bottom-sheet pattern for bag previews, filters, and disclosures — **exists (Vaul, 6 call sites)**; `Overlays.BottomSheet` has exactly one caller, the dev-only `/styleguide` page **[v3.1]** — migrate it and delete `BottomSheet` from `components/primitives/Overlays.tsx`; delete the orphan `components/ui/NativeBottomSheet.test.ts`.
3. Shared loading, empty, error, and retry components — **exist; restyle** `skeleton.tsx`, `Feedback.tsx`, `SegmentError.tsx`.
4. Shared sticky-action and safe-area utilities — **exist; extract** one `StickyAction` base from the four bars.
5. Dish detail purchase-mode selector — **exists; restyle**.
6. Inline quantity controls with pending feedback — **build `QuantityStepper`**, migrate five implementations.
7. Native phone/date/time input configuration — **verify** on `PhoneAuth`, `AlacarteDetails` (address block), `PlanIdentityGate`, `DeliverySlotPicker` **[v3.1]**.
8. Accordion disclosure for macros, ingredients, allergens, and trust — **build `Disclosure`**, migrate the two bespoke FAQ accordions.
9. Live-region feedback on core money controls; test IDs only where role+name is ambiguous.
10. Route-query persistence for filters and saved dishes — **exists; verify** after restyle.
11. Intent-first onboarding — **exists (`/quick-setup`, `/plans`, `/start`); restyle**.
12. OTP interruption/resume pattern at checkout and plan save — **exists (`PhoneAuth`, `LoginCard`); restyle**.
13. Account home, orders, subscriptions, addresses, preferences, favorites — **exist; restyle** in the order `AccountHub.tsx` renders today.
14. Pre-payment review around Razorpay — **exists; restyle** with the six disclosure lines and themed canvas (Law 2).
15. Payment-capture and verify-only recovery states — **exist (`UnresolvedPaymentPanel`); restyle**.

## Foundations (first, before any component work)

0. **Tokens PR:** the stylesheet is exported and its tokens are already tabulated in `docs/design-reference/storefront-revision-2026-09/README.md` (surface `38 42% 94%`, ink `164 25% 17%`, primary `164 33% 27%`, amber accent `31 61% 53%`, sage chips, radius 1rem, `--shadow-soft`/`--shadow-lift`, `rise-in` stagger motion). Write them into `lib/themes/tanmatra.css` `light-dark()` tokens; remap `tokens.css`, `tanmatraBridge.css` and the shadcn aliases to them rather than duplicating. Type: Fraunces display + DM Sans body through the existing `next/font` pipeline in `app/layout.tsx`, the revision's Space Mono `.font-data` role mapped onto the mono face `layout.tsx` already loads — max two new families, no new dependency, `pnpm-lock.yaml` untouched. Contrast gate (computed in the README): the **green primary is the button token and passes at 6.82:1**; the amber accent fails at 2.54:1 with cream text and as text on cream, so at `53%` lightness it is decorative only (underline, icon, focus ring) and any amber text or filled control uses `31 61% 37%` or darker; `--muted-foreground` moves to `164 10% 41%` to clear 4.5:1 on dish descriptions. Every text/surface pair ≥ 4.5:1 body, 3:1 large. Theme toggle keeps working (`theme-toggle.spec.ts`, storage key unchanged). Flipbook shows the whole app in the new palette, unrestyled — ugly but correct — before any component PR. **[v3.1]**

## Strategic upgrades: after quick wins pass

Product-shape items. **Out of scope for this brief.** Gaps are named by source anchor; `tasks/00-INDEX.md` carries no tickets for them yet, and this brief does not require any — a restyle PR simply must not touch the anchors. **[v3.1]**

1. `POST /orders/finalize` connection — not the storefront's path; no action.
2. Marketplace `POST /marketplace/checkout` — already connected.
3. Idempotent checkout retry surviving refresh — the `alc-`/`sub-` key and `paidFactsRef` live in `useRef` (`components/checkout/AlacarteCheckout.tsx`, `components/checkout/plan/PlanCheckout.tsx`); moving them to sessionStorage is behaviour work.
4. First-order eligibility and offer application — display exists; server auto-applies.
5. Goal-based personalization and dish rationales — exists where enabled.
6. Meal-plan generation, editing, swapping, acceptance, discard — exists; restyle `/meal-planner` only.
7. Wellness dashboard and preference synchronization — exists; restyle only.
8. Reviews, team/RD profiles, trust disclosures from live data — restyle; spec the reviews schema first.
9. Retention prompts after completed purchases (post-order plan offer) — new behavior; separate ticket.
10. Analytics for the funnel events — new events added per the realignment below, after behavior is stable.

Also tracked separately, not restyle: `PLAN_CHECKOUT_DISABLED` unblock (next engineering task); CI money-integration dead list (`docs/DEFECT-VERIFY-MONEYPATH-DEADLIST-001.md`: 15 of 100 test files execute, 85 dead **[v3.1]**); `/recipes/[slug]` 404 (`app/(global)/recipes/page.tsx:23`); change-plan double-bill (`docs/audit/P0-2-PLAN-CHANGE-CONTRACT-TRACE.md`); the pantry grid on the home page (`components/landing/Section04bMarketplace.tsx`, still rendered); pricing truth across catalog, rules layer, live app and spec.

## Do not combine in one change

- Checkout provider selection and visual shell refactoring.
- Database/schema changes and broad screen migration.
- Subscription behavior and pantry/marketplace behavior.
- Analytics taxonomy changes and payment mutation changes.
- Internal/admin route work (`artifacts/tanmatra`) and customer storefront work.
- Onboarding questions and payment-provider orchestration.
- Account information architecture and database/schema changes.
- Tokens PR and any component PR.
- Any restyle PR and any behaviour change to the anchors listed under "Strategic upgrades" (idempotency/paidFacts persistence, kill-switch lift, `/recipes/[slug]`, plan-change billing).
- Anything and `pnpm-lock.yaml`.

---

# E2E test plan

Existing suite: `artifacts/storefront/e2e/` — 36 specs (`e2e/specs/*.spec.ts`, config `e2e/playwright.config.ts`) **[v3.1]**; projects `chromium` (Desktop Chrome), `mobile` (Pixel 7 — the only merge-gate project), `vp-375` / `vp-1024` / `vp-1440` (run `layout-vrt.spec.ts` only), `firefox` / `webkit` (`core-funnel.spec.ts`, nightly). Locators: role + accessible name (`e2e/support/locators.ts`), page objects in `e2e/support/pages`, viewport-dependent labels encoded once.

Add to the merge gate: `iphone-15-pro` (393×852, touch) and `vp-320` (320×800) for `core-funnel` and `layout-vrt`; reduced-motion, slow-3G and offline/reconnect variants of `core-funnel`. Re-baseline `layout-vrt` snapshots once, deliberately, in their own commit after the tokens PR and again after each screen PR. The flipbook is produced from the mobile project for every branch.

Use a real mobile browser context with:

- Viewport: 393 x 852.
- Additional viewport: 320 x 800.
- Touch enabled.
- Reduced-motion test variant.
- Slow network test variant.
- Offline/reconnect test variant.

## Core navigation

- Home loads with no runtime error.
- Mobile navigation is visible and the active tab is correct.
- Each customer route can be opened directly.
- Back navigation returns to the expected scroll position where appropriate.
- A deep link does not render the generic not-found screen for a valid customer route.
- `/start` renders no back control and no bottom nav.

## Discovery and menu

- Home primary CTA opens the menu.
- Menu skeletons preserve layout.
- Search filters dishes.
- Category filter changes results.
- Vegetarian filter changes results.
- Saved-dish filter shows an honest empty state.
- Dish card opens detail.
- Every dish card shows macros.
- Favorite state updates immediately and survives refresh.

## CRO and onboarding

- A quick-meal visitor can bypass onboarding and reach the menu.
- A plan visitor completes no more than four short onboarding steps before a value preview.
- "I'm not sure" and "skip" choices do not create invalid requests.
- Back navigation preserves previously entered answers.
- Onboarding can be abandoned without creating an order, subscription, or payment attempt.
- The preview shows server-backed plan information before asking for payment.
- OTP send shows pending, resend cooldown (30 s), invalid-code, expired-code, rate-limited, and success states.
- OTP success returns the user to the exact interrupted action.
- A signed-out bag survives the OTP flow.
- CRO events distinguish intent, funnel stage, customer state, and payment outcome.

## Dish detail

- One-time mode is selectable.
- Subscription/plan mode is selectable where supported.
- Quantity changes work from a thumb-sized control.
- Macro and ingredient disclosures expand and collapse.
- Delivery timing supports ASAP and future selection.
- Add-to-bag shows local success feedback.
- Bag preview opens without losing dish state.

## Bag and money

- Bag count updates after add.
- Quantity increments and decrements are correct.
- Removing a line updates totals.
- Delivery fee and free-delivery threshold match the server response.
- Plan selection appears as the correct bag line.
- Refresh preserves the bag.
- Checkout submission disables only the affected action.
- Failed checkout preserves bag and form state.
- Repeated submit does not create a duplicate order.
- Success shows confirmation and a next action.

## Razorpay payment

- Pre-payment review shows the selected items, final server amount, delivery details, and plan cadence where applicable.
- The pay action has pending, pressed, disabled, and retry states.
- A-la-carte payment creates a server order before opening Razorpay.
- Plan payment creates or prepares the subscription before opening Razorpay.
- Razorpay opens with the server-created order ID and server-owned amount.
- The client does not send a price as the source of truth.
- Gateway dismissal returns to a resume-payment state.
- Payment captured plus slow verification shows "received, confirming" rather than failure.
- Verify retry reuses captured payment facts and does not create another gateway order.
- A duplicate submit or replayed response does not create a second order.
- Network loss after gateway completion leads to pending confirmation and status recovery.
- Success is shown only after server verification.
- Confirmation can be recovered through the order or subscription account screen.
- The canvas behind the Razorpay modal is themed with the summary visible.

## Wellness and goal paths

- Goal selection updates the visible meal shelf.
- Horizontal shelf scroll is touch-friendly.
- Macro accordions work without clipping.
- Delivery-day selection remains reachable in the lower thumb zone.
- Meal-plan generation shows progress and recovery.
- Meal-plan swap and regenerate actions preserve the selected plan.
- Preference changes show saved/pending/error states.

## Logged-in end user

- OTP login preserves the intended destination and current bag.
- Account home prioritizes active order or plan status over settings.
- Orders show current status, detail, reorder, and recovery actions.
- Subscriptions show cadence, next event, plan contents, and supported management actions, with the 24 h cutoff explained.
- Addresses preserve valid data after an invalid edit.
- Preferences show server-confirmed save state.
- Favorites can add directly to the bag and have a useful empty state.
- Wellness shows today's summary and explicit connection/sync states.
- Loyalty explains balance, earning, use, and restrictions.
- Billing never exposes sensitive payment credentials.
- Appointments retain unpaid state after payment dismissal.
- Sensitive symptom data is guarded and never rendered as a diagnosis.

## Marketplace and cross-sell

- Cross-sell shelves scroll horizontally.
- Add action updates the mini-cart.
- Rapid tap does not create an accidental duplicate.
- Plus/minus controls cannot go below zero.
- Marketplace checkout uses its own order path.
- Meal order state is not lost when browsing marketplace content.

## Trust and support

- FSSAI/hygiene/preparation disclosure opens by touch.
- RD/team profile links work.
- Reviews show loading, populated, empty, and error states.
- FAQ accordions are keyboard and touch accessible.
- Offline state offers retry and preserves local bag state.

## Analytics realignment

- Never rename an existing event: `begin_checkout`, `payment_opened`, `payment_failed`, `checkout_complete`, `subscription_created`, `identity_verified`, `view_dish`, `plan_toggle`, `subscribe_cta_click`, `subscription_{skipped,unskipped,paused,resumed,rescheduled,cancelled}`, `order_claim_offered`, `order_claimed`, `qr_landing_view`, `qr_pincode_{serviceable,unserviceable}`, `trial_checkout_start`, `cuj_*`, `assessment_*`, `lp_*`.
- New events go into `lib/funnel.ts`; `lib/moneyFunnel.test.ts` is updated in the same PR.
- The PostHog sanitizer allow-list (`event_name, route, timestamp, device_type, plan_id, cart_item_count, checkout_step, payment_provider`) is extended deliberately with `customer_state`, `auth_state`, `intent`, `viewport_bucket`, `payment_method`, `failure_reason` (server machine code only) — never a phone, pincode or address.
- Events fire after the UI accepts the action.

## Quality gates

- No horizontal page overflow at 320px or 393px.
- No critical action is smaller than 44px (48px on the money path).
- No console errors during the happy paths.
- No unrecoverable blank states.
- No important action depends on hover.
- No button text or form error is hidden behind the keyboard.
- No route relies on a desktop-only interaction.
- No customer is forced through plan onboarding when they have chosen quick meal.
- No post-payment upsell blocks the order or plan confirmation.
- No payment event is counted as complete before server verification.
- No experiment changes more than one major funnel variable without an explicit reason.
- No text/surface pair below 4.5:1 (3:1 large); `lint:tokens`, `lint:css-vars`, `lint:dark-forks`, `lint:unregistered-color-utility`, `lint:component-drift` green **[v3.1]**.
- No existing e2e locator edited to make a restyle pass.
- No state removed from any screen; no question, step, route or action added.

---

# Agent execution order

1. Read `CLAUDE.md`, the ten-laws table above, `docs/NATIVE-FEEL-STOREFRONT-PLAN.md` §1, `docs/QR-ACQUISITION.md` non-goals, `docs/MONEY-PATH-VERIFICATION.md`, `tasks/00-INDEX.md`. Build the repo graph (`python3 .kg/kg_extract.py . .kg/graph.json`) and run `python3 .kg/kg.py code docs/MOBILE-FIRST-CX-BRIEF.md` — every path this brief names must resolve; report drift before editing.
2. Inventory current customer routes (`find artifacts/storefront/app -name page.tsx` plus `route.ts` handlers) and mark admin/internal routes out of scope.
3. Confirm the storefront runs (`pnpm --filter @workspace/storefront run dev`) and capture the 393px "before" flipbook for `/`, `/menu`, `/dish/[slug]`, `/plans`, the cart drawer, `/checkout`, `/start`.
4. Render the delivered revision at 393px for `/`, `/menu`, `/dish/:slug`, `/plans`, `/about` (run `docs/design-reference/storefront-revision-2026-09/src/` with its `package.reference.json`, or capture from the 2026-09-03 recording); these five are the only screens with a pixel-match target — everything else is graded on tokens and the ten-laws table and logged in the divergence ledger. **[v3.1]**
5. Tokens PR (Foundations 0). Flipbook. Contrast gate. Merge before any component work.
6. Primitives PRs, one each, no behavior change: `Rail`, `Disclosure`, `QuantityStepper`, `StickyAction` base, sheet consolidation onto Vaul. Migrate call sites in the same PR; flipbook proves zero state loss.
7. Complete CUJ 1 and CUJ 2 (home, menu, dish sheet and PDP, cart drawer) — restyle against the delivered revision.
8. Complete CUJ 5 surfaces (checkout three screens, pre-payment review, payment states, confirmation) — restyle only; `git diff` shows no money-path logic changes.
9. Complete CUJ 3 and CUJ 6 across nutrition, education, and trust screens.
10. Complete CUJ 4 across marketplace, meal deals, pantry, and relevant wellness cross-sells.
11. Onboarding (`/quick-setup`, `/plans`, `/plan/[planId]`, `/trial`, `/start`, OTP surfaces) and the account routes.
12. Everything else in the screen map.
13. Add analytics only after the restyle is stable; guard test updated in the same PR.
14. Run the full mobile E2E matrix at every milestone; re-baseline `layout-vrt` deliberately.
15. Run typecheck, build, all storefront lint gates, route smoke tests, and browser console checks in the `.github/workflows/storefront.yml` order.
16. Verify the deployed storefront at 393px and 320px before presenting the work; attach the flipbook and the divergence ledger (pixel-pipeline S6).

## Final definition of done

The work is complete only when:

- Every in-scope customer-facing route renders in the delivered revision's visual system and uses the shared mobile interaction contract.
- All six CUJs are traversable on a touch viewport at 393px and 320px.
- All money paths keep their explicit pending, success, failure, retry, and idempotency behavior — unchanged in logic, restyled in presentation.
- All critical actions are reachable in the lower thumb zone where required.
- The bag and entered customer data survive recoverable failures.
- Loading and empty states prevent layout shift and explain the next action.
- Trust and nutrition details are touch-first and accessible; macros appear on every dish representation.
- One token layer is consumed; the contrast gate is green; the palette lock is replaced by the delivered revision's tokens.
- The mobile E2E matrix passes at 393px and 320px with no locator edits.
- Typecheck, production build, and all lint gates pass; `pnpm-lock.yaml` is untouched.
- Zero product-shape diffs: no route, step, question, action, data field, API call, or business rule added, removed, or reordered.
- The flipbook (`e2e/specs/stitch-runtime/*-flipbook.spec.ts` screenshots) is attached and reviewed against the ten-laws table; the storefront preview runs cleanly with no browser console errors.
