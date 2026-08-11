# Tanmatra E2E UX/UI Fidelity Audit

> Adversarial, evidence-based audit against the approved Tanmatra UX/UI architecture.
> Conducted 2026-08-11 at commit `e16684e` (branch `claude/tanmatra-e2e-ux-ui-audit-63tfdo`, identical to `main` tip).
> Method: repository inspection + local production-build runtime testing + Playwright execution + unit-suite execution.
> **No staging/production URL, seed data, or test credentials were supplied.** Every requirement that depends on
> those inputs is reported NOT VERIFIED, never PASS, per the audit charter §1.

---

## A. Executive Verdict

```
OVERALL STATUS:      PARTIAL
Overall score:       61 / 100
Confidence:          MEDIUM-HIGH on code & local runtime; LOW on deployed-environment fidelity
Environment tested:  Local production build (next build + next start, localhost:3000)
                     Chromium 1.49.1 @ mobile (Pixel 7) and desktop (1280x720)
Repository commit:   e16684e (2026-08-11T06:27:43+05:30)
Application version: /api/build → {"sha":"unknown","uiGeneration":"stitch-74"} (local build; sha injected only at deploy)
Audit date:          2026-08-11
```

### What is genuinely implemented

The **structural spine is real and materially better than the repository's own most recent
self-assessment records.** Five findings deserve explicit credit because each was verified
first-hand, not inherited from a document:

1. **Route-group layout ownership is now structural, not imperative.** `app/(global)/`,
   `app/(focus)/`, `app/(b2b)/` exist with distinct `layout.tsx` files. Focus routes cannot
   leak global chrome because `Header`/`Footer`/`MobileBottomNav`/`MiniCartBar` are *not imported*
   into `app/(focus)/layout.tsx` at all — a React-tree composition guarantee, not a CSS hide.
   `grep -rIn "B2BLayout|FocusChromeGate|InternalSurfaceGate|isB2BRoute|isFocusRoute"` finds
   **zero live matches**. This closes the single explicit P0 NO-GO trigger recorded in
   `docs/architecture/layout-contracts.md` ("Layout ownership remains imperative or ambiguous").
2. **The B2B shell now renders real chrome.** `app/(b2b)/layout.tsx:16-56` renders a sticky
   business header with `<nav aria-label="Business">`. Confirmed at runtime: `curl /corporate`
   returns that exact nav. The prior "10 routes with zero navigation" HIGH defect is **fixed**.
3. **The money path's re-pay-after-capture risk is closed.** `PlanCheckout.tsx:169-189` and
   `AlacarteCheckout.tsx:242-260` route *any* post-capture failure to a terminal
   `UnresolvedPaymentPanel` whose only action is an idempotent verify-only re-ask. Pinned by
   a unit test that asserts `createCalls===1, openCalls===1` (executed: PASS) and a Playwright
   spec that drives the real component. BUILD-GAP-ANALYSIS Wave-1 item 1 is **fixed**.
4. **The analytics privacy sanitizer is genuinely wired and genuinely tested.**
   `lib/analyticsSanitizer.ts` is a real module; the *only* `posthog.capture` call site in the
   entire tree routes through it; `autocapture:false` and `disable_session_recording:true` are
   explicit; and `domainInvariants.test.ts:5` now **imports the shipped module** instead of
   re-declaring it. The prior FAIL in `privacy-analytics-contract.md` is **fixed**.
5. **The open-redirect guard is hardened and now tested.** `lib/loginRoute.ts:59-76` uses a
   WHATWG-URL origin comparison (not a regex), correctly rejecting `//evil.com`,
   `https://evil.com`, and the backslash-normalisation bypass `/\evil.example` that would defeat
   the previously-shipped regex. `lib/loginRoute.test.ts` — 14 tests, executed: **14/14 PASS**.

Also verified green first-hand: production build succeeds (60+ routes, zero errors);
**586/586 storefront unit tests pass**; `lint:tokens` passes with zero raw colour literals;
zero component-level `fetch()`/`axios` bypassing the `lib/` client layer; **zero live imports
from `quarantine/`** (234 quarantined files, still fully isolated); server-authoritative pricing
with idempotency keys on both money legs; and, under the correct mobile viewport, **10/10
nav-contract + single-chrome Playwright tests pass**, including "b2b shell: exactly one business
header, no consumer chrome" and "focus shell: no chrome at all".

### What is only present in code

A recurring, systemic pattern dominates this audit: **finished components exist but are not
wired to the routes that need them.** In each case below the component is real, the API client
is real and often tested, and the route renders a literal placeholder:

| Route | Renders | Finished implementation sitting unused |
|---|---|---|
| `/corporate` | `Clean slate placeholder pending implementation` | `CompanyLanding.tsx` (real `getCompany` calls) |
| `/corporate/[slug]` | same placeholder | same — **and this is where a successful invite-accept redirects** |
| `/office-lunch/[id]` | same placeholder | `OfficeLunch.tsx` (budget-bounded picker) |
| `/group/[code]` | same placeholder | `quarantine/.../GroupOrderView.tsx` (`closeAndCheckout`) |
| `/metabolic` | same placeholder | `content/landing/metabolic.ts` + reusable `ProtocolView` |
| `/team` | same placeholder | `teamApi` client |
| `/account/health-information` | **does not exist** | `HealthInfoHub`/`ClinicalForm` (quarantined) |
| `/recipes/[slug]` | **does not exist** | quarantined; every `/recipes` card 404s |
| `/care/[condition]` | unvalidated generic copy | `CARE_CONFIG` + `isCareCondition` (zero importers) |

### What is missing

- **No slug validation on `/care/[condition]`** — verified at runtime, not merely in code.
- **No dead-link gate**: 8 legal/company footer routes 404 on every globally-shelled page.
- **No zero-payable payment branch** — fully-credited checkouts cannot complete.
- **No client-side allergen-acknowledgement UI** for a 422 the server actively returns.
- **No accessibility tooling of any kind** — no axe, no jest-axe, no `eslint-plugin-jsx-a11y`.
- **No automated evidence** that any funnel is completable keyboard-only or screen-reader-only.
- **No clinical content review-status mechanism** (draft/approved/expired) anywhere.

### Can high fidelity be claimed?

**No.** Six independent BLOCKER-class purchase dead-ends, 22 CRITICAL defects, and a
purpose-built regression spec (`ghost-ui.spec.ts`) that **fails on 4 of 4 routes tested against a
live build** rule out a high-fidelity claim. The repository's own guard tests are red.

### Can production readiness be claimed?

**No.** Beyond the blockers: the entire live-checkout E2E scenario set (`E2E_LIVE_CHECKOUT=1`)
executes **only** in `e2e-remote.yml`, which is `workflow_dispatch:`-only — it never runs on any
PR, push, or schedule. Purchase completion has no automatic CI gate.

### Top five blockers/risks

1. **BLK-01 — Zero-payable checkout dead-ends after entitlement is granted.** A fully
   credit/subsidy-covered subscription is *activated server-side*, then the client unconditionally
   calls `createRazorpayOrder`, gets `409 order has no payable amount`, and shows a retry loop that
   can never succeed. The customer's entitlement is consumed and they see an error.
2. **BLK-02 — Guest à-la-carte checkout is unwinnable for any allergen-flagged dish.** The server
   returns `422 allergen_ack_required`; the storefront has no acknowledgement control anywhere
   (`grep allergenAck` → one unused type declaration). Retry resends the identical order forever.
3. **BLK-03 — `/care/[condition]` renders therapeutic claims for arbitrary slugs.**
   Runtime-confirmed: `/care/totally-invalid-condition-xyz-123` → HTTP 200, `<h1>… Therapeutic Care
   Plan</h1>`, "Biweekly RD consultation", no disclaimer, no `noindex`. `/care/cancer` works the
   same way. This is a live regulatory exposure, not a UX nit.
4. **BLK-04 — `/trial`'s only purchase CTA disappears when the cart is non-empty.**
   `TrialStart.tsx:120` gates the whole sticky footer on `cart.lines.length === 0`, assuming a
   `MiniCartBar` fallback that structurally cannot mount on a `(focus)` route.
5. **BLK-05 — Marketplace and group-order carts have no reachable payment path at all.**
   Items add to the cart; `AlacarteCheckout` filters them out; `payForMarketplace` has zero live
   callers. Money is addable but not payable.

---

## B. Evidence and Environment

| Item | Value |
|---|---|
| Repository | `tanmatra6-wq/Wellness-Foods` |
| Branch | `claude/tanmatra-e2e-ux-ui-audit-63tfdo` |
| Commit | `e16684eab70b0e85e969ab2b2967c053230b9e5f` |
| Baseline compared against | `3aea38dc` (2026-08-06 P0 docs) — **120 commits / 408 files stale** |
| Secondary baseline | `docs/architecture/BUILD-GAP-ANALYSIS.md` (2026-08-08) — 3 days stale |
| Runtime | Local `next build` + `next start` on `localhost:3000` |
| Browser | Chromium 1.49.1 (`/opt/pw-browsers/chromium`) |
| Viewports exercised | Pixel 7 (mobile project), 1280×720 (chromium project) |
| Themes exercised | `theme-toggle.spec.ts` only (passed); no visual theme matrix |
| Node / pnpm | v22.22.2 / 9.15.5 |
| Backend | **None** — no `DATABASE_URL`, no `REDIS_URL`, no api-server instance |
| Feature flags | `NEXT_PUBLIC_LIVE_CHECKOUT` unset locally; set to `1` in `deploy.yml:907` |
| CI evidence | Actions API: `Storefront`, `Verify`, `Deploy`, `Synthetic Prod Check` all **success** on `main` @ `e16684e` |

### Commands executed (first-party evidence)

```
pnpm install                                             → exit 0
pnpm --filter @workspace/storefront run build             → exit 0, 60+ routes, 0 errors
pnpm --filter @workspace/storefront run test              → 586 pass / 0 fail
node --test --import tsx ./lib/loginRoute.test.ts         → 14 pass / 0 fail
node --experimental-strip-types scripts/lint-tokens.ts …  → PASS (0 raw colour literals)
playwright --project=mobile  nav-contract single-chrome   → 10 passed
playwright --project=chromium ghost-ui one-gold theme-toggle → 11 passed / 4 failed
```

### MISSING INPUT

> **MISSING INPUT: Production/staging URL**
> Impact: Deployed-artifact fidelity cannot be confirmed. The local build is *not* proof the
> deployed image behaves identically — `API_UPSTREAM`/`IMAGE_UPSTREAM` are build-time-only and
> `NEXT_PUBLIC_LIVE_CHECKOUT` differs between local and deploy.
> Requirements unverifiable: deployed route reachability, real payment behaviour, CDN/image
> delivery, production security headers, SSR/ISR cache behaviour.
> Recommended evidence: staging URL + `/api/build` sha matching the audited commit.

> **MISSING INPUT: Test credentials for every user state**
> (standard user, active subscriber, paused subscriber, corporate sponsored, corporate co-pay,
> wearable-connected)
> Impact: **All authenticated surfaces were audited as guests only.** Auth-gated islands,
> subscription management, corporate entitlement consumption, and account state restoration
> could not be exercised.
> Requirements unverifiable: §11.2 subscription lifecycle at runtime, §11.3 entitlement
> activation, §13 post-auth state restoration, §21's ~24 account-state scenarios.
> Recommended evidence: seeded accounts per state + a seed script.

> **MISSING INPUT: Live API server / seeded database**
> Impact: Every data-dependent state (cart persistence server-side, quote expiry, inventory
> change mid-checkout, delivery-capacity change, payment retry) is untestable.
> Recommended evidence: `DATABASE_URL` + `pnpm --filter @workspace/db run push` + seed fixtures.

> **MISSING INPUT: Approved UX/UI architecture document, Phase 1–13 runbooks, design files,
> visual-regression baselines, analytics-event specification, supported-browser list**
> Impact: "Visual fidelity vs. approved design" is **unscoreable as a comparison**. Findings in
> §E are measured against the rules embedded in the audit charter and `CLAUDE.md`/DS-0, not
> against approved comps. No pixel-diff was possible: `layout-vrt.spec.ts`'s baseline projects
> (`vp-375`/`vp-1024`/`vp-1440`) are invoked by **no workflow at all**.
> Recommended evidence: the design source of truth + committed VRT baselines.

No secrets are included in this report.

---

## C. Route Coverage Matrix

Legend — **D**efined / **P**resent / **R**eachable / **F**unctional / **H**igh-fidelity / **PR**oduction-ready.
`—` = not verifiable this session.

### C.1 Commerce (16)

| Route | Shell | D | P | R | F | H | PR | Notes / evidence |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| `/` | global | ✓ | ✓ | ✓ | ⚠ | ✗ | ✗ | Real SSR + DTR personalisation; **2 dead CTAs** (`page.tsx:65-69`, `:130`); raw `<img>` hero |
| `/menu` | global | ✓ | ✓ | ✓ | ✓ | ⚠ | ⚠ | Only route with `loading.tsx`; no dish search/filter sheet; no unavailability signal |
| `/dish/[slug]` | focus | ✓ | ✓ | ✓ | ✓ | ⚠ | ⚠ | `notFound()` verified (404 at runtime); allergen "None declared." falsehood (CRT-17) |
| `/marketplace` | global | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠ | Browse-only by design; honest empty state |
| `/marketplace/[slug]` | focus | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | **BLK-05** — adds to cart, no payment path exists |
| `/plans` | global | ✓ | ✓ | ✓ | ✓ | ⚠ | ⚠ | Real `GoalRouter`; 8 ghost footer links |
| `/plan/[planId]` | focus | ✓ | ✓ | ✓ | ✓ | ⚠ | ⚠ | Real spine quote + `sessionStorage` draft; waitlist silently discards contact (CRT-07) |
| `/checkout` | focus | ✓ | ✓ | ✓ | ⚠ | ✗ | ✗ | Unresolved-payment **fixed**; **BLK-01/BLK-02** open; 307→`/plans` when unparameterised |
| `/custom-build` | focus | ✓ | ✓ | ✓ | ⚠ | ✗ | ✗ | Single-dish customiser, not the specified rules wizard (divergence); 8-dish cap |
| `/meal-deals` | global | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | **CRT-06** — "Select Bundle" dead on every card |
| `/order/confirmed/[orderId]` | focus | ✓ | ✓ | ✓ | ⚠ | — | ✗ | Renders "Order confirmed" title for a **fabricated orderId**; see §G |
| `/quick-setup` | focus | ✓ | ✓ | ✓ | ⚠ | ⚠ | ✗ | **CRT-19** — allergen save silently fails for signed-out users |
| `/track/[orderId]` | global | ✓ | ✓ | ✓ | — | — | — | Requires live order data |
| `/trial` | focus | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | **BLK-04** — CTA vanishes when cart non-empty |
| `/vouchers` | global | ✓ | ✓ | ✓ | — | — | — | Redeem surface; needs auth |
| `/group/[code]` | focus | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | **BLK-05** — literal placeholder; whole feature unreachable |

### C.2 B2B (11)

| Route | Shell | D | P | R | F | H | PR | Notes |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| `/corporate` | b2b | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | **CRT-04** placeholder; `CompanyLanding.tsx` orphaned |
| `/corporate/[slug]` | b2b | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | **CRT-04** — invite-accept redirect target is a stub |
| `/corporate/[slug]/lunch-planner` | b2b | ✓ | ✓ | ✓ | ✓ | ⚠ | ⚠ | Real admin flow; "back to workspace" dead-ends |
| `/corporate/invite/[token]` | focus | ✓ | ✓ | ✓ | ✓ | ⚠ | ⚠ | **Fixed since 2026-08-08** — now real `CompanyInvite` + `companyApi` |
| `/corporate-wellness` | b2b | ✓ | ✓ | ✓ | ✓ | ⚠ | ⚠ | Real lead capture; 2 simultaneous gold CTAs; subsidy-calculator pricing cliff |
| `/office-lunch/[id]` | focus | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | **CRT-01** placeholder; `OfficeLunch.tsx` orphaned |
| `/partners/gyms` | b2b | ✓ | ✓ | ✓ | ⚠ | ⚠ | ✗ | Lander; 2 gold CTAs |
| `/partners/fitness-clubs` | b2b | ✓ | ✓ | ✓ | ⚠ | ⚠ | ✗ | Lander |
| `/partners/dietitians` | b2b | ✓ | ✓ | ✓ | ⚠ | ⚠ | ✗ | Mock form path; `PartnerWizard` orphaned |
| `/rd-partners` + `/rd-partners/apply` | b2b | ✓ | ✓ | ✓ | ⚠ | ⚠ | ✗ | `/apply` is **new since routes.json** |
| `/team` | global | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | **MAJ** placeholder; footer- and sitemap-linked |

### C.3 Clinical (10) — **score-capped at 69, clinical approval unverified**

| Route | Shell | D | P | R | F | H | PR | Notes |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| `/care/[condition]` | global | ✓ | ✓ | ✓ | ⚠ | ✗ | ✗ | **BLK-03** — no slug validation (runtime-confirmed) |
| `/clinical` | global | ✓ | ✓ | ✓ | ✓ | ⚠ | ⚠ | Compliance-rewritten `ProtocolView` copy |
| `/coach` | global | ✓ | ✓ | ✓ | ✓ | ⚠ | ⚠ | Real refusal gate + pinned evals (api-server) |
| `/metabolic` | global | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | **CRT-03** placeholder, footer + ⌘K linked |
| `/performance` | global | ✓ | ✓ | ✓ | ✓ | ⚠ | ⚠ | Real protocol lander |
| `/premium` | global | ✓ | ✓ | ✓ | — | — | — | Not exercised |
| `/rd`, `/rd/[slug]` | global | ✓ | ✓ | ✓ | ✓ | ⚠ | ⚠ | Server-priced fees, zero fabricated ratings |
| `/account/appointments` | global | ✓ | ✓ | ✓ | — | — | — | Auth-gated |
| `/account/connections` | global | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | **CRT-09** — pure `useState` mock, no API exists |
| `/account/symptoms` | global | ✓ | ✓ | ✓ | ⚠ | ✗ | ✗ | **MAJ** — no "not a diagnosis" disclaimer |
| `/account/wellness` | global | ✓ | ✓ | ✓ | ⚠ | ✗ | ✗ | **BLK-06** dead CTA after real AI scan; DS-0 colour violations |

### C.4 Account / Content / Identity / System

| Route | D | P | R | F | H | PR | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| `/account` | ✓ | ✓ | ✓ | ⚠ | ✗ | ✗ | 1 of 7 priority cards; nav omits favorites/wellness/connections |
| `/account/{orders,addresses,billing,loyalty,history,preferences,subscriptions,favorites}` | ✓ | ✓ | ✓ | — | ⚠ | ⚠ | Tested clients exist; **auth-gated, not exercised** |
| `/account/health-information` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | **CRT-08** — `AccountNav` "Health" tab 404s from 11 pages |
| `/account/wearables` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **308 → `/account/connections` verified at runtime** (prior doc wrong) |
| `/login` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Hardened sanitiser, 14/14 tests pass |
| `/meal-planner` | ✓ | ✓ | ✓ | ⚠ | ⚠ | ✗ | Regenerate silently discards manual swaps |
| `/meal-recommendations` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | **CRT-11** — hardcoded `{goal:"lose_weight"}`, allergens always empty |
| `/recipes` | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | **CRT-10** — every card 404s |
| `/challenges`, `/challenges/{[slug],tracker}` | ✓ | ⚠ | ✓ | ⚠ | — | — | Index/tracker thin |
| `/meal-guides/[dishSlug]` | ✓ | ✓ | ✓ | ⚠ | ✗ | ✗ | "Clinical Breakdown" is static boilerplate |
| `/qa` | ✓ | ✓ | ✓ | ✓ | — | — | Publicly routable, no declared owner |
| `/styleguide` | ✓ | ✓ | ✓ | ✓ | ⚠ | — | DS reference; contains a raw `<img>` |
| `/about`, `/faq`, `/legal/*` (8 routes) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | **CRT-28 — all 404; quarantined but still footer-linked** |

---

## D. Three-Funnel Verdict

### Funnel 1 — Instant Craving · **CONDITIONAL FAIL**

- **Entry**: `/menu` (HTTP 200, `<h1>The menu</h1>`, real skeleton).
- **Tested path**: `/menu` → `/dish/[slug]` → `CartDrawer` → `/checkout` → `/order/confirmed/[id]`.
- **Exit state**: Cannot be driven to a completed purchase without a live API + credentials.
- **Conversion blockers**: BLK-02 (allergen-ack dead-end), BLK-05 (marketplace lines silently
  excluded from the order), CRT-17 (allergen "None declared." for unreviewed dishes).
- **State preservation**: Cart persists via `localStorage` (`storefront:cart:v1`) with a validating
  parser, mounted at the **root** layout so it survives focus↔global transitions — verified in code
  and by 586-test suite. Menu search/filter/scroll restoration on back: **not implemented**.
- **Accessibility**: single `<h1>` holds across every checkout state traced; Radix supplies real
  focus trapping. Keyboard/SR completion: **NOT VERIFIED**.
- **Visual fidelity**: `one-gold.spec.ts` passes on its 5 covered surfaces. Elsewhere,
  multiple simultaneous gold CTAs on `/meal-deals` and 4 B2B routes.
- **Transaction integrity**: server owns every amount; idempotency key `alc-<uuid>`; tampered
  client amount ignored (`payments.integrity.test.ts`). **Strong.**

### Funnel 2 — Therapeutic Transformation · **FAIL**

- **Entry**: `/care/[condition]` — **BLK-03**, accepts any slug (runtime-confirmed).
- **Tested path**: condition → assessment → `/trial` or `/plan/[planId]` → `/checkout` → `/meal-planner`.
- **Conversion blockers**: BLK-03 (compliance), BLK-04 (`/trial` CTA vanishes), BLK-01 (zero-payable).
- **Note**: there is **no `/quiz` route**; the assessment is delivered via `/quick-setup` and
  in-page components. This is a divergence from the audited architecture, not necessarily a defect —
  but CRT-19 shows the `/quick-setup` allergen promise silently fails for signed-out visitors.
- **Required plan invariants**: Keep/lock + single Undo are **still absent**;
  invariants 2/3/4 remain implemented-untested (no `PlanBuilder` test file exists).
- **Sticky ledger**: renders one total; **does not** disclose a distinct future-renewal amount
  when credit discounts today's bill — a §10.4 requirement.

### Funnel 3 — Retention & B2B · **FAIL**

- **Meal Planner**: real week/day/slot model; "Regenerate week" **silently discards all manual
  swaps** with no confirmation. `subscriptionsApi` still exposes only skip/unskip, so meal/time/
  address changes on an active subscription remain unreachable despite shipped server endpoints.
- **Subscription management**: pause/resume/reactivate fire with **zero confirmation and zero
  financial-effect disclosure** — a direct §11.2 violation.
- **Corporate invite**: **materially improved** — now the real `CompanyInvite` over `companyApi`
  with server-verified email match and single-use token. But accept **redirects into the
  `/corporate/[slug]` placeholder**, so the journey ends on "Clean slate placeholder".
  Raw token is not leaked to analytics (verified).
- **Public B2B**: correct shell + real business nav; `/corporate` and `/team` are stubs.
- **No duplicate lifecycle systems found** — one pricing spine, one checkout, one subsidy ledger,
  reused across organic/corporate/partner paths. This is a genuine architectural strength.

---

## E. Design-System Compliance

| Contract | Verdict | Evidence |
|---|---|---|
| **SafeImage** | **FAIL** | Component itself is well-built (ratio reserved, `object-fit`, branded fallback). But 6 bypasses ship: homepage hero raw `<img>` ×2 (largest above-fold visual, pointing at a design-tool CDN), `/trial` trio via direct `next/image`, RD headshot on `/plan/:id`, raw `<img>` in the shared `EmptyState` primitive. **No lint gate catches any of it.** |
| **Primary CTA** | **PARTIAL** | Primitive is correct: `bg-primary` → `--gold`, `--gold-ink` text, real focus ring. But ≥5 routes render 2+ simultaneous gold CTAs, and several primary CTAs have no handler at all. |
| **Secondary CTA** | **DIVERGED (sanctioned)** | Frosted-glass secondary not shipped; ghost/link variants ship — explicitly permitted by DS-0 revocation in `CLAUDE.md`. Not scored as a defect. |
| **Ghost-button prohibition** | **REVOKED for storefront** | Per DS-0. Not scored. |
| **Semantic tokens** | **PASS** | `lint:tokens` executed live: zero raw hex/rgb/hsl/oklch in `app/`+`components/`. The 5 apparent hits are PR references inside comments. |
| **Theme behaviour** | **PARTIAL** | `next-themes` pre-paint script + `data-stitch` dark-canvas script both present; `theme-toggle.spec.ts` passes. **But** `components/wellness/*` (~12 files) uses raw `dark:` Tailwind variants driven by OS `prefers-color-scheme`, decoupled from the app's own theme state — those tabs can render dark chrome in light mode. |
| **Typography / spacing / radius / elevation** | **NOT VERIFIED** | No approved comps supplied; no VRT baselines executed. |
| **Motion** | **PARTIAL** | Transitions are transform/opacity-based. `prefers-reduced-motion` coverage not confirmed across drawers/quiz. |
| **Status colours** | **PASS (funnel)** / **FAIL (wellness)** | Money path and all core routes are gold-only — a targeted grep for non-gold solid-background CTAs outside `components/wellness` and `components/rd` returned **zero hits**. Inside Wellness Studio, `bg-sky-900` and `bg-amber-500` are used as action colours. |
| **Selected states** | **PASS** | `aria-current="page"` on the bottom nav (non-colour fallback for SC 1.4.1), verified in source and by passing spec. |
| **Sticky UI** | **PARTIAL** | Bottom nav: safe-area padding, 12px scroll hysteresis, `inert` when hidden — genuinely good, and its 6 specs pass. But the PDP money bar lacks `safe-area-inset-bottom`; the plan-builder CTA floats 64px above a shell with no bottom nav; `/custom-build` has no persistent mobile CTA. |

---

## F. Accessibility Report

**This section is deliberately incomplete. Per the audit charter, unverified ≠ pass.**

### Automated findings
**None available.** No `axe-core`, `jest-axe`, `@axe-core/playwright`, or `eslint-plugin-jsx-a11y`
appears in any `package.json` in the workspace. There is **no automated a11y gate in CI at all**.
`docs/` contains no completed, dated a11y review — corroborating the prior "a11y audits 0/9" record.

### Static (code-level) findings — verified
- **Single `<h1>` per route holds** across menu, PDP, all checkout states (traced through a 4-way
  state machine), and account routes.
- **Heading skip on the PDP**: `ProductDetailView.tsx` goes `h1` (61) → `h3` (79, 146) with no `h2`.
- **Overlay semantics are real, not stubbed**: verified by reading the *installed* Radix Dialog
  source — `FocusScope` with `trapped`, `role="dialog"`, `modal=true`, and wired
  `onOpenAutoFocus`/`onCloseAutoFocus` (real initial focus and focus-return). `DrawerTitle`
  renders a true `<h2>`.
- **`aria-current`** used for active nav state; **`inert`** correctly applied to the hidden bar.
- **Back-gesture handling** via `useOverlayHistory` on the account sheet.

### NOT VERIFIED (no browser/AT this session)
Logical focus order · skip-to-content operation · unintended focus traps · Escape safety ·
focus return to trigger · horizontal rail keyboard operation · **all** screen-reader announcements
(loading, errors, selection, quantity, cart, price, overlay titles, progress, route changes) ·
**all** measured contrast ratios · touch-target sizes at runtime · 200% text zoom · reflow without
horizontal scroll · reduced-motion behaviour.

### Critical gap
**No test evidence, in either direction, that the purchase funnel is completable keyboard-only or
screen-reader-only.** Every "keyboard" reference in the 38-spec suite is an Escape-key dismissal or
a content rail — none traverses a purchase. The audit charter names this exact failure mode
CRITICAL. Recorded as CRT-25 and as a **score cap**.

---

## G. State and Recovery Report

| Scenario | Result | Evidence |
|---|---|---|
| **Auth interruption → restoration** | **PASS (code) / NOT VERIFIED (runtime)** | `safeNextPath` hardened + 14/14 tests; auth-gated surfaces are islands rendering `<PhoneAuth>` in place, never a `/login` redirect that would lose state |
| **Open-redirect defence** | **PASS** | `//evil.com`, `https://evil.com`, `/\evil.example`, `javascript:` all rejected — traced and test-pinned |
| **Cart across auth** | **PASS (code)** | `CartProvider` at root layout; `localStorage` + validating parser that never throws |
| **Plan draft across refresh** | **PASS (code)** | Per-plan `sessionStorage` `draftKey` in `PlanBuilder.tsx:26-28,70-83` |
| **Quick-setup draft** | **FAIL** | CRT-19 — draft cleared *before* a fire-and-forget save whose 401 is swallowed by an empty `.catch(() => {})`; no reconciliation on later sign-in |
| **Entitlement consumed during auth** | **PASS** | No voucher/entitlement consume call in the auth path |
| **Address change with populated cart** | **PARTIAL** | Serviceability revalidates; ambient header address is **not** wired into à-la-carte checkout prefill — two sources of address truth |
| **Payment failure → safe retry** | **PASS** | Terminal `UnresolvedPaymentPanel`; server verify idempotent (`PAID_STATES` replay) |
| **Zero-payable settlement** | **FAIL — BLK-01** | Server settles; client 409-loops |
| **Quote expiry / stale quote** | **NOT VERIFIED** | `expiresAt` handling has no executing test; needs live backend |
| **Inventory / delivery-capacity change mid-checkout** | **NOT VERIFIED** | Requires live backend |
| **Session expiry** | **NOT VERIFIED** | Requires credentials |
| **Offline / network interruption** | **NOT VERIFIED** | Not exercised |
| **Fabricated success URL** | **⚠ NEEDS RUNTIME RECHECK** | `/order/confirmed/fake-order-id-12345` returned **HTTP 200 with `<title>Order confirmed`** against a build with **no API reachable**. The page ships a client error boundary and the RSC payload contains error-state chunks, so this is very likely the not-found/error branch rendering under a static title rather than a fabricated success. **It could not be disambiguated without a live API and must be re-tested against a real backend before release.** Charter §9.4 treats "query parameters alone cannot fabricate success" as BLOCKER-class. |

---

## H. Architecture and Data Integrity

**This is the strongest area of the build.**

- **Domain boundaries — PASS.** `grep -rn "fetch(" app/ components/` (excluding `lib/`) returns
  **zero raw fetch calls** (all ~50 hits are TanStack `.refetch()`); zero `axios` anywhere.
  Every screen composes typed `lib/*Api.ts` clients. CLAUDE.md's contract holds structurally.
- **Quarantine isolation — PASS, re-verified.** 234 tracked quarantined files (unchanged across
  120 commits); `grep -rn "quarantine" --include=*.ts{,x} app components lib | grep -v .test.` → **0**.
  `tsconfig.json:44` excludes them and they are structurally route-ineligible.
- **Pricing integrity — PASS on the money path.** No client-authored authoritative total; the two
  arithmetic hits found are display-only line formatting. `pricingInvariants.test.ts` scans the
  tree for rupee literals against a **shrink-only 4-entry DEBT register** — a genuinely good
  control. Two register entries remain live and customer-visible (`₹180/meal` homepage claim
  matching no spine amount; a 3.77× per-meal pricing cliff at the 10-seat boundary in the
  corporate subsidy calculator).
- **Entitlement integrity — PASS server-side.** Subsidy reserve→commit→release under advisory lock
  inside the shared pricing transaction, with double-commit and concurrent-commit race tests.
- **Idempotency — PASS.** `alc-<uuid>` / `sub-<uuid>` client keys; a real server-side
  `middlewares/idempotency.ts`; `subscriptions.idempotency.test.ts` exercises the real route
  (could not execute — needs Postgres).
- **Mock-data leakage — PARTIAL.** `fetchMenu()` returns `source: "api" | "fallback"`, and `/menu`
  and the PDP render a visible `FallbackMenuBanner`. **9 other live call sites discard `source`**,
  including `/trial` — a paid funnel step that would silently serve the static bundled catalog
  during an API outage with no indication.
- **No duplicate lifecycle systems — PASS.** One plan generator, one checkout, one scheduler, one
  subscription manager, one pricing spine, reused across all acquisition paths.
- **Incomplete migration — the systemic root cause.** For at least 6 live routes the Route layer
  reaches *no* controller: the real component was either promoted to `components/` and never
  imported, or left in quarantine with zero live callers of its backing service functions.

---

## I. Privacy and Clinical Safety

| Area | Verdict | Evidence |
|---|---|---|
| **Analytics sanitizer** | **FIXED** | Real module; sole `posthog.capture` site routes through it; `autocapture:false`; `disable_session_recording:true`; regression test now **imports the shipped module** |
| **Residual analytics gap** | **MODERATE** | `sanitizeAnalyticsEvent` filters only app-supplied properties. `posthog-js` merges its own `$current_url`/`$pathname` at send time — so a PHI-bearing URL (e.g. `/care/<condition>`) would still ship in `$pageview`. Dormant today (env vars unset) but not structurally closed. |
| **Invite-token exposure** | **PASS** | Raw token never reaches an analytics property or log |
| **PHI encryption at rest** | **PASS (design)** | `CLINICAL_KMS_MASTER_KEY` + `crypto.ts`; symptom notes encrypted |
| **Clinical content approval** | **FAIL — no mechanism exists** | No draft/review-required/approved/expired/rejected status field anywhere in `content/landing/*`. **Caps clinical-route score at 69 per charter §23.8.** |
| **Unvetted clinical claims live** | **BLOCKER — BLK-03** | `/care/<any-slug>` renders therapeutic copy; the compliance-vetted `CARE_CONFIG`/`isCareCondition` gate exists with **zero importers** |
| **Symptom-tracker language** | **MAJOR** | Ships correlation language with no reachable "not a diagnosis" disclaimer |
| **Wearables** | **CRITICAL — CRT-09** | `WearablesHub` is a pure `useState` mock: Connect flips a local boolean and fabricates `lastSync:"Just now"`; a refresh silently reverts it. No `lib/wearableApi.ts` exists despite a real, tested backend. Users are shown a fake connected health-data state. |
| **No auto-mutation from wearables** | **PASS** | Advisory-only; no meal-plan writes from this path; no wearable prompt in checkout |

---

## J. Defect Register

143 raw findings were produced across 19 parallel verification agents; after de-duplication
(five agents independently found the `/corporate` stub, three found `/office-lunch`, two found
the group-order dead end) the register is **6 BLOCKER · 22 CRITICAL · 40 MAJOR · 53 MODERATE · 12 MINOR**.
Full machine-readable register: `docs/audit/e2e-fidelity-defects-2026-08-11.json`.

### BLOCKERS

**BLK-01 — Zero-payable checkout dead-ends after entitlement is granted**
Severity BLOCKER · Route `/checkout` (plan + à-la-carte) · Guest & authenticated
*Precondition*: server-quoted payable is ₹0 (credit, corporate subsidy, or voucher fully covers it).
*Steps*: reach checkout with a fully-covered quote → tap Pay.
*Observed*: `subscriptions.ts:1063-1084` + `subscriptionOrigination.ts:108-148` correctly settle the
subscription server-side; the client nonetheless calls `createRazorpayOrder` unconditionally
(`lib/moneyPath.ts:142,240`) and receives `409 order has no payable amount`
(`payments.ts:271-274`) *before* `razorpay.open()`. `paidFactsRef` is never set, so the
unresolved-payment safeguard never engages; the catch re-enables the normal Pay CTA. Re-tapping
repeats the same 409 forever. À-la-carte never grants the entitlement at all.
*Expected*: payable ₹0 skips the Razorpay leg and routes to confirmation.
*Remediation*: branch in `runCheckout`/`finishPlanPayment` and the à-la-carte equivalent when
server payable is 0. *Regression test*: required — extend `payments.integrity.test.ts`.

**BLK-02 — Guest à-la-carte checkout unwinnable for any allergen-flagged dish**
Severity BLOCKER · Route `/checkout?mode=alacarte` · Guest
*Observed*: `checkoutSafety.ts:79-98` sets `required=true` for guest + flagged dish + no ack;
`checkout.ts:390-398` returns `422 {code:"allergen_ack_required"}`. Storefront-side, `grep allergenAck`
finds **only an unused type declaration** (`lib/api.ts:164`); `humanizeOrderError()` has no case for
the code; `ApiError` drops the server's `allergens`/`dishes` fields; `AlacarteDetails.tsx` (356 lines)
contains no allergen control. Retry resends the identical unacked order → 422 forever.
*Remediation*: surface the flagged dish + a real acknowledgement control setting `allergenAck:true`,
or route the guest to declare prefs pre-payment. *Regression test*: required.

**BLK-03 — `/care/[condition]` renders therapeutic claims for arbitrary slugs**
Severity BLOCKER (regulatory) · Route `/care/[condition]` · All states
*Steps*: `curl http://localhost:3000/care/totally-invalid-condition-xyz-123`
*Observed (runtime-confirmed, this session)*: **HTTP 200**, `<title>Totally Invalid Condition Xyz 123
Therapeutic Care Plan | Tanmatra</title>`, page renders "Therapeutic Care Plan" with "Biweekly RD
consultation & WhatsApp progress tuning". `/care/cancer` → "Cancer Protocol … designed specifically
for Cancer management." No allowlist check, no `notFound()`, no `CARE_SAFETY` disclaimer, no
`noindex`. The compliance-vetted `isCareCondition`/`CARE_CONFIG` (`content/landing/care.ts:24-26`)
has **zero importers**. Also omits the required food-strategy and evidence sections.
*Remediation*: gate on `isCareCondition` with `notFound()`; render `CARE_CONFIG`; fix the `/care`
back-link. *Regression test*: required — assert 404 for an unvetted slug.

**BLK-04 — `/trial` primary CTA disappears when the cart is non-empty**
Severity BLOCKER · Route `/trial` · All states
*Precondition*: any item already in the cart.
*Observed*: `TrialStart.tsx:120` wraps the entire sticky footer — described at line 113 as "the ONE
money-bearing CTA on this screen" — in `{cart.lines.length === 0 && (…)}`. The guard assumes
`MiniCartBar` substitutes, but `MiniCartBar.tsx:26-30` mounts **only** from `app/(global)/layout.tsx`
and `/trial` is a `(focus)` route. `CartProvider` is global (`app/layout.tsx:212`), so cart state
crosses the boundary while the fallback UI cannot. Result: no purchase path on the ₹399 trial.
*Remediation*: render the CTA unconditionally on `(focus)` routes. *Regression test*: required.

**BLK-05 — Marketplace and group-order carts have no reachable payment path**
Severity BLOCKER · Routes `/marketplace/[slug]`, `/group/[code]`, `/checkout`
*Observed*: `MarketplaceAddToCart.tsx:7-30` only mutates the local cart; `AlacarteCheckout.tsx:76-78`
filters to `kind==="dish"` and renders a dead-end "buy them from their own product page" message
(`:296-308`). `payForMarketplace` has **zero live callers** — its only caller is quarantined, and
`lib/marketplaceApi.ts:5-9` documents it as the fix for a prior *revenue leak*. Separately,
`/group/[code]` is a literal placeholder; no live code calls `POST /group-orders` to create a code,
and `closeGroup()` has zero live callers, so a host can never close and pay a group order (the
invitee add-path via `?group=CODE` **is** live and functional).
*Remediation*: wire `payForMarketplace` into checkout; promote `GroupOrderView` out of quarantine.
*Regression test*: required for both.

**BLK-06 — Dead conversion CTA at the terminal step of a working AI feature**
Severity BLOCKER · Route `/account/wellness` (Pantry Vision tab) · Authenticated
*Observed*: `PantryVisionScanner.tsx:104-107` — the "Add to Subscription" button rendered for every
`suggestedTanmatraAddOns` item has **no `onClick`**. The scan itself is a genuine async round-trip,
so the user uploads a photo, waits for a real AI result, and lands on a non-functional CTA. Also
`bg-sky-900` — a second DS-0 action-colour violation.
*Remediation*: wire to the cart/subscription mutation and repoint to `--gold`.

### CRITICAL (22, de-duplicated)

| ID | Title | Route | Key evidence |
|---|---|---|---|
| CRT-01 | `/office-lunch/[id]` dead stub; admin told "members can now pick their meals" | `/office-lunch/[id]` | `page.tsx:7-19` vs `LunchPlanPreview.tsx:22-23,67` |
| CRT-02 | `/care/[condition]` no slug validation (see BLK-03) | `/care/[condition]` | `page.tsx:17-63` |
| CRT-03 | `/metabolic` placeholder, linked from footer + ⌘K | `/metabolic` | `page.tsx:7-19`; `lib/nav.ts:66,134` |
| CRT-04 | `/corporate` + `/corporate/[slug]` stubs; invite-accept redirects here | `/corporate*` | `CompanyInvite.tsx:31` → placeholder |
| CRT-05 | `/group/[code]` placeholder; whole feature unreachable | `/group/[code]` | `page.tsx:7-19` |
| CRT-06 | "Select Bundle" dead on every bundle | `/meal-deals` | `page.tsx:59-61`, no `onClick` |
| CRT-07 | Waitlist discards contact info, shows false success | `/plan/[planId]` | `Waitlist.tsx:25-34` |
| CRT-08 | `AccountNav` "Health" tab 404s from 11 subpages | `/account/*` | `AccountNav.tsx:9,40` |
| CRT-09 | `WearablesHub` is a client-only fake | `/account/connections` | `WearablesHub.tsx:16-47` |
| CRT-10 | Every `/recipes` card 404s | `/recipes` | `page.tsx:22` |
| CRT-11 | `/meal-recommendations` hardcodes prefs; allergen badge can never fire | `/meal-recommendations` | `page.tsx:12` `// mock pref` |
| CRT-13 | "Add to Today" dead gold primary CTA | `/` | `page.tsx:130` |
| CRT-15 | 4 need-state chips with hover affordance, no handler | `/` | `page.tsx:66` |
| CRT-16 | "Claim Family Rewards Pass" dead + `bg-amber-500` | `/account/wellness` | `BadgeShowcase.tsx:73` |
| CRT-17 | PDP renders unreviewed allergens as "None declared." | `/dish/[slug]` | `page.tsx:106-108` vs `allergenCopy.ts:37-77` |
| CRT-19 | Quick-setup allergen save silently fails for guests | `/quick-setup` | `QuickSetupWizard.tsx:81-92` |
| CRT-24 | Entire live-checkout scenario set never runs on any auto CI trigger | CI | `e2e-remote.yml:9-19` dispatch-only |
| CRT-25 | No evidence funnel is completable keyboard-/SR-only | funnels | grep of all 38 specs |
| CRT-28 | **8 legal/company footer links 404 site-wide** | all global routes | `lib/nav.ts:141-157`; triple-confirmed |

> **CRT-28 detail (highest-confidence finding in this report — three independent methods).**
> `ghost-ui.spec.ts` failed on 4/4 routes tested against the live build, each reporting the same 8
> ghosts: `/about`, `/faq`, `/legal/{terms,privacy,refunds,shipping,disclaimer,grievance}`.
> Direct `curl` confirms **404 on all 8**. Root cause: the pages are fully built but live in
> `artifacts/storefront/quarantine/app/`, excluded from the build, while `lib/nav.ts` still points
> the Footer at those hrefs. Terms of Service, Privacy Policy, Refund & Cancellation, Shipping, and
> Grievance Redressal are statutory disclosures for an Indian food-delivery business.

### Selected MAJOR findings

- Desktop global header renders **zero** primary navigation links — `PRIMARY_NAV` is an unused
  import in `Header.tsx:3` (confirmed by live HTML inspection: the rendered nav contains only the
  address switcher and brand link).
- **No single `GlobalOverlayRoot`** — three independent overlay/portal mechanisms coexist with no
  shared coordination layer (charter §5.1 requires one).
- `PLAN_CHECKOUT_DISABLED=1` gates the plan-subscription purchase path server-side despite a fully
  wired client — the flagship subscription funnel is dark.
- Six SafeImage bypasses + **no lint gate** to prevent regression.
- `/menu` has no dish search and no filter sheet (3-option chip row only).
- Meal-planner "Regenerate week" silently discards manual swaps.
- Pause/Resume/Reactivate fire with no confirmation and no financial disclosure.
- A unit test named "swapSlot rejects swapping in an allergen-laden dish" **does not exercise
  swapSlot's rejection branch** — the same self-contained-fixture anti-pattern this repo has
  documented before.
- Wellness Studio's `dark:` variants follow OS preference, decoupled from app theme state.

---

## K. Missing Coverage

**Untested routes** (existence confirmed, behaviour not exercised): all 11 auth-gated `/account/*`
subpages, `/track/[orderId]`, `/vouchers`, `/premium`, `/challenges/*`, `/rd/[slug]`,
`/corporate/[slug]/lunch-planner`, `/office-lunch/[id]`, `/group/[code]`.

**Untested account states**: standard user, active subscriber, paused subscriber, corporate
sponsored, corporate co-pay, wearable-connected, dietitian-referred. **Only guest was exercised.**

**Untested browsers**: Firefox, WebKit/Safari (WebKit matters here — the repo's own
`synthetic-prod-check.yml` notes cross-site-cookie login breakage previously lived undetected there).

**Untested themes**: no light/dark visual matrix; no OS-preference-change-while-open case; no
theme × viewport grid.

**Untested viewports**: small mobile (320), large mobile, tablet portrait/landscape, large desktop.
Only Pixel 7 and 1280×720 ran. `layout-vrt.spec.ts`'s `vp-375`/`vp-1024`/`vp-1440` projects are
invoked by **no workflow**, and no VRT baselines were available to diff.

**Missing backend conditions**: quote expiry, inventory change mid-checkout, delivery-capacity
change, payment failure/retry against a real gateway, double-payment activation, webhook
reconciliation, session expiry, offline.

**Missing design references**: approved architecture doc, Phase 1–13 runbooks, design files,
component catalogue/Storybook, analytics-event spec, VRT baselines, supported-browser list.

**Of the ~40 scenarios in charter §21: 0 are fully verified end-to-end this session.**

---

## L. Remediation Plan

### P0 — Release blocking

| # | Item | Routes | Owner | Validation | Regression test |
|---|---|---|---|---|---|
| 1 | Gate `/care/[condition]` on `isCareCondition` + `notFound()` + disclaimer + `noindex` | `/care/*` | Frontend + Clinical/Compliance | `curl` an unvetted slug → 404 | Assert 404 for unvetted slug |
| 2 | Restore the 8 legal/company routes (promote from quarantine) or remove the footer links | site-wide | Frontend + Legal | `ghost-ui.spec.ts` green | Already exists — make it a required check |
| 3 | Zero-payable branch in `runCheckout`/`finishPlanPayment` + à-la-carte | `/checkout` | Money-path (lockstep) | Fully-credited order completes | Extend `payments.integrity.test.ts` |
| 4 | Allergen-acknowledgement UI + `humanizeOrderError` case + preserve `ApiError` fields | `/checkout` | Money-path + Clinical | Guest completes a flagged-dish order | New spec |
| 5 | Remove the `cart.lines.length === 0` gate on `/trial`'s CTA | `/trial` | Frontend | CTA present with non-empty cart | Add to `cuj-04-trial.spec.ts` |
| 6 | Wire `payForMarketplace`; promote `GroupOrderView`; or remove both Add-to-Cart entry points | marketplace, group | Money-path | Purchase completes or CTA is gone | New specs |
| 7 | Run the live-checkout E2E set on a real trigger, not `workflow_dispatch`-only | CI | Platform | PR shows the specs executing | — |

### P1 — Required for a high-fidelity claim

8. Wire the 6 orphaned route implementations (`/corporate`, `/corporate/[slug]`, `/office-lunch/[id]`,
   `/metabolic`, `/team`, `/account/health-information`) — components and clients already exist.
9. Fix all remaining dead CTAs (homepage chips + Smart Match, `/meal-deals`, wellness tabs) and add
   `ghost-ui.spec.ts` to the required PR gate.
10. Replace the `WearablesHub` mock with a real `lib/wearableApi.ts`, **or** show an explicit
    "coming soon" state — a fabricated "Connected · synced just now" is worse than nothing.
11. Fix `/meal-recommendations` to read real user preferences (allergen safety badge currently
    can never fire).
12. PDP allergen tri-state: never render "None declared." for unreviewed data.
13. Financial-effect disclosure before pause/skip/cancel; replace bare `window.confirm`.
14. Add an a11y toolchain (`eslint-plugin-jsx-a11y` at error + `@axe-core/playwright` on key routes)
    and one keyboard-only + one screen-reader-assisted purchase walkthrough.
15. Add a SafeImage lint gate; fix the 6 bypasses.
16. Fix waitlist contact capture (currently discarded with a false success state).
17. Fix quick-setup allergen persistence for signed-out users.

### P2 — Quality and conversion

18. Consolidate to one `GlobalOverlayRoot`. 19. Render or delete `PRIMARY_NAV` in the desktop header.
20. Menu search + filter sheet; product-unavailability signal. 21. Surface `source==="fallback"` on
the remaining 9 call sites, `/trial` first. 22. Menu state restoration on back-navigation.
23. Regenerate-week confirmation + lock affordance. 24. Manage-Delivery client surface for the
already-shipped swap/reschedule/window endpoints. 25. Future-renewal amount on the sticky ledger.
26. Retire the two live pricing-DEBT entries (`₹180/meal`; the 10-seat cliff).

### P3 — Non-blocking polish

27. PDP/plan sticky-CTA safe-area handling. 28. PDP heading hierarchy (`h1→h3`).
29. Wellness Studio DS-0 colour + `dark:`-variant alignment. 30. Fix `/api/build`'s hardcoded
`canonicalRoutes:42 / totalScreens:74` (`app/api/build/route.ts:28-29`) — it under-reports a
60+ route tree and is the endpoint every deploy assertion compares against.
31. Regenerate `routes.json` / `layout-assignments.json`, both still pinned to `3aea38dc` and
now materially wrong about the layout mechanism. 32. Declare an owner for `/qa` or unpublish it.

---

## M. Final Certification

```
NOT CERTIFIED
```

**The implementation does not yet satisfy the approved Tanmatra UX/UI architecture with
sufficient fidelity or evidence.**

Certification is withheld on multiple independent grounds, each individually disqualifying under
charter §24:

1. **6 BLOCKER and 22 CRITICAL defects remain open**, including four distinct ways a purchase
   cannot complete and one live regulatory exposure.
2. **Critical purchase funnels are untested** — no scenario in §21 was verified end-to-end, and the
   live-checkout suite runs on no automatic trigger.
3. **Checkout integrity is only partially verified.** The re-pay-after-capture risk is genuinely
   closed and well-tested — credit where due — but zero-payable settlement and allergen-ack
   recovery are broken, and quote-expiry handling has no executing test.
4. **Accessibility cannot be claimed in either direction.** No tooling, no gate, no keyboard or
   screen-reader evidence for any funnel.
5. **Clinical content approval is unverified** — no review-status mechanism exists at all, and
   unvetted therapeutic copy is live for arbitrary URLs.
6. **Only one theme and two viewports were exercised**, with no VRT baselines available.

### Score derivation and caps

| Dimension | Weight | Score | Basis |
|---|---:|---:|---|
| Route completion | 20% | 68 | Routes/layouts/guards strong; ~8 nav-linked placeholder stubs |
| Visual fidelity | 20% | **60 (capped)** | Charter §23.8: viewport matrix not run, no baselines |
| Interaction fidelity | 20% | 55 | `ghost-ui` red on 4/4; dead CTAs across 6+ routes |
| Accessibility | 15% | 50 | No tooling, no gate, funnel completion unverified |
| Domain & transaction integrity | 15% | 70 | Structurally excellent; 2 money blockers |
| Privacy / clinical / operational | 10% | 55 | Sanitizer fixed; clinical approval absent; BLK-03 live |
| **Weighted total** | | **61** | |

Applicable caps: **BLOCKER present → max 69**; only-happy-paths → max 79; single viewport → visual
max 60; clinical approval unverified → clinical-route max 69. The computed 61 already sits below
the binding cap, so no downward adjustment was needed.

**Interpretation (charter §23.7): 50–69 — "Major architectural or UX gaps."**

### The honest summary

This is not a weak codebase. The architecture is sound, the money path is server-authoritative and
carefully reasoned, the test suite is large and mostly genuine, the token system is disciplined,
and several of the most serious findings from the repository's own prior audits have been properly
fixed since. The route-group refactor, the unresolved-payment state machine, the hardened redirect
sanitizer, and the wired analytics sanitizer are all real, verifiable engineering wins.

The gap is not architecture — it is **completion and connection**. Repeatedly, the hard part was
built and the last wire was never run: finished components with zero importers, statutory pages
sitting in quarantine while the footer links to them, an entitlement ledger with race tests behind
a checkout that cannot spend a full subsidy, a compliance-vetted condition allowlist that nothing
imports. The most valuable next step is not new construction. It is a systematic sweep for
"finished but unwired", followed by making the repo's own already-written guard tests
(`ghost-ui`, live-checkout) blocking on every PR — because those tests were already telling the
truth, and nothing was listening.

---

*Report generated 2026-08-11 · commit `e16684e` · 19 parallel verification agents,
2.75M tokens, 1,038 tool calls · local production runtime + Playwright + unit-suite execution.*
*No code was modified during this audit.*

---

# ADDENDUM — Production verification (2026-08-11, later same day)

The original audit above was conducted at `e16684e` with no deployed target, no backend, and
no credentials. All three gaps have since been closed. This addendum records what changed.
**The original assessment is left intact above; corrections are stated here explicitly.**

## A1. Environment finally achieved

| Input | Resolution |
|---|---|
| Runtime URL | **Both.** Full stack stood up locally (native PostgreSQL 16 — no Docker daemon in the sandbox), *and* the deployed site tested via `e2e-remote.yml` |
| Credentials | **Never needed and never read.** GitHub Actions secrets are write-only by design; `deploy.yml:913-923` bakes `NEXT_PUBLIC_FIREBASE_*` in as build args, so the deployed build already carries them |
| Feature flags | Recovered from `deploy.yml:498,905-923` |
| Design reference | Still **MISSING** — no approved architecture doc, no committed VRT baselines |

Local stack: `initdb` → `pnpm --filter @workspace/db run push` → api-server:3000 + production
storefront:3001 with `API_UPSTREAM` baked in. Result: **106 passed / 25 failed / 7 skipped**.
Of the 25, ~21 were environment (no Firebase config → phone-auth UI cannot render, per
`lib/firebase.ts:22-25`; no seeded accounts; desktop project running mobile-only specs; no VRT
baselines). Only the ghost-ui failures were real.

Production run (`e2e-remote.yml` → `https://tanmatra.food`, `E2E_LIVE_CHECKOUT=1`, run
[31465762750](https://github.com/tanmatra6-wq/Wellness-Foods/actions/runs/31465762750)):
**123 passed / 8 failed / 10 skipped.**

**No deploy lag.** `curl https://tanmatra.food/api/build` → `sha c842289…`, built `05:56:57Z`,
identical to `main` tip. Every production failure below is against fully-current code.

## A2. Corrections to the original report

**CORRECTION 1 — BLK-02 (allergen ack) is FIXED and DEPLOYED.**
Commit `5f5502a` (merged after the audit commit) adds `lib/allergenAck.ts` + test, a labeled
checkbox `data-testid="allergen-ack"` at `AlacarteDetails.tsx:280-289`, and threads
`allergenAck: true` into the order payload at `AlacarteCheckout.tsx:228`. Proven live: the
production run's `checkout-allergen` failure is a *strict-mode violation* because
`getByText('Avocado Toast')` matched both the cart line **and the live ack text
"This order has Gluten in …"** — the ack is rendering in production. **BLK-02 is closed.**
The spec's selector is too loose; that is a test bug, not a product bug.

**CORRECTION 2 — `PLAN_CHECKOUT_DISABLED=1` is not a defect.**
The original report flagged this as MAJOR. `lib/flags.ts:25-35` documents it as a deliberate
owner containment gate (`docs/MONEY-PATH-VERIFICATION.md §5`) returning a typed 503, mounted
*before* `idempotencyMiddleware` specifically so a gated 503 is not cached against the
customer's key for 24 h after the gate reopens. That is careful engineering. **Reclassified:
intentional gate, not a defect.** Same for `ORDER_FINALIZE_DISABLED`.

**CORRECTION 3 — the "missing input: runtime URL" finding was partly my error.**
`run_e2e.sh` exists at the **repository root** and stands the whole stack up. The original
report should have found it. Its only defect is a hardcoded `/usr/bin/google-chrome`.

**CORRECTION 4 — the unavailability MAJOR is fixed in code.**
Commit `b1ac202` propagates `isAvailable` to menu cards, PDP ledger, and `cartStore.addLine`.

## A3. CONFIRMED in production

**CRT-28 stands — all 8 statutory routes 404 on the live domain**, verified by direct request:

```
/about 404 · /faq 404 · /legal/terms 404 · /legal/privacy 404
/legal/refunds 404 · /legal/shipping 404 · /legal/disclaimer 404 · /legal/grievance 404
```

Note the production `ghost-ui` sweep **passed** on `/`, `/plans`, `/account` — because on the
mobile viewport those links live inside the bottom-nav account sheet, which the sweep never
opens. **The guard test has a coverage hole on the exact defect it exists to catch.** Fixing
the sweep to open the account sheet is a one-line change and worth doing alongside the routes.

## A4. NEW — production-only findings the code audit could not have seen

**PROD-01 · 76 of 145 menu dishes (52%) cannot be added to cart in production.**
Severity **CRITICAL** (commercial). `cuj-01-menu-cart.spec.ts:107` against the live domain:
`Expected: 145, Received: 69`. Commit `b1ac202`'s own message confirms the root cause —
*"76/145 live dishes are `isAvailable:false` yet fully sellable"*. The UI fix is deployed and
correctly renders "Back soon", so this is no longer a checkout-time surprise — but the
underlying fact is that **more than half the catalogue is unbuyable right now**. That is an
operations/data question (is the kitchen really paused on 76 dishes?), not a UI bug, and it is
invisible to any purely static audit.

**PROD-02 · `availability.spec.ts:62` fails against the deployment of its own fix.**
Severity **MAJOR**. "an available dish still adds normally from both surfaces" times out waiting
for an enabled `add to cart` on an *available* dish's PDP. The fix's own regression test does not
pass in production — either the gate over-applies, or the PDP CTA label diverges from the spec's
selector. Needs triage before the availability work is considered done.

**PROD-03 · `checkout-doubletap.spec.ts:31` fails in production.**
Severity **MAJOR** (money path). The "opening payment" busy-state button never appears, so the
single-`POST /api/orders` guarantee under a fast double-tap is **unproven in production**. The
underlying idempotency key and the disabled-while-pending state are both verified present in
source; what is unverified is the deployed behaviour.

**PROD-04 · Two further signed-out surfaces fail in production**: `cuj-account-orders`
("Your orders" heading absent) and `cuj-onboarding-audit` (ServiceabilityBar pin input absent
on `/menu`). Both are signed-out paths that should not need credentials.

**PROD-05 · `cuj-01-menu-cart.spec.ts:107` is now a stale spec.** `b1ac202` deliberately made
some cards non-orderable but did not update the spec asserting *every* card is orderable. It
will fail on every future run until reconciled.

## A5. Net effect on the verdict

The **NOT CERTIFIED** verdict stands, and the score is unchanged at **61/100** — one blocker
closed (BLK-02) is offset by one new critical (PROD-01) and two new majors (PROD-02, PROD-03).
What has changed is *confidence*: the audit is no longer repo-only. Three of the five score caps
(no runtime inspection, only-one-viewport for the funnel specs, checkout integrity unverified)
were driven by missing environment, and two of those are now closed. The remaining caps —
missing design references and absent accessibility tooling — are unchanged.

The most important shift is that the **highest-value finding is now an operations question, not
an engineering one**: 52% of the live menu cannot be bought today, and no code change fixes that.

---

# ADDENDUM 2 — Architecture-Ruling Verification (2026-08-11)

> The approved design reference arrived after the production-verification addendum: the P0 +
> Phases 4–13 UX/UI Architecture Document, the 74-screen Stitch package as visual baseline, and
> five approved route rulings with an explicit precedence rule (later written rulings supersede
> Stitch screens). Five approved architecture rulings were tested directly against production
> routing behavior (`https://tanmatra.food`, deployed sha `c842289` = main tip).

## Compliant rulings

- `/quiz` returns a permanent redirect (308) to `/quick-setup`.
- `/auth` returns a permanent redirect (308) to `/login`.
- The mobile BottomTabBar contains Home, Menu, Care, and Account.

These findings **close the previous compatibility-route findings** for `/quiz` and `/auth`, and
**close the prior finding that the mobile navigation used Plan instead of Care** (the
Home/Menu/Plan/Account baseline in `docs/audit/P0-CHECKPOINT.md` / `p0-baseline.json` is
confirmed stale; the shipped Care tab is the approved contract). They do **not** verify the
functional completeness of assessment, authentication, or navigation scroll behavior.

## Violated rulings

### RUL-01 — Food PDP canonical route inversion (MAJOR)

The deprecated `/dish/[slug]` route serves the PDP, while the approved canonical
`/menu/[productSlug]` route returns 404.

Evidence (production, direct request): `/dish/quinoa-khichdi` → 200; `/menu/quinoa-khichdi` →
404. Every internal link, the sitemap, and SEO indexing use the deprecated route.

This does not currently prevent product-detail access, but it violates the approved route
contract and affects internal links, sitemap behavior, canonical metadata, analytics
normalization, and future compatibility. **The canonical route must be implemented and validated
before the deprecated route is redirected.**

### RUL-02 — Corporate canonical route migration incomplete (MAJOR)

Both `/corporate` and `/corporate-wellness` return HTTP 200. The approved `/corporate` route
contains placeholder content (CRT-04), while `/corporate-wellness` contains the substantive
lead-generation experience.

**The content must first be migrated to `/corporate`. Only after functional and visual
validation should `/corporate-wellness` permanently redirect to `/corporate`.** Redirecting
today would route visitors from a working page to a stub.

The architecture document also confirms `/login?step=phone|otp|account-conflict` was
"Recommended"; the shipped `?next=` contract remains a recorded owner divergence, not a defect.

## Stitch evidence status

The Stitch manifest (`docs/stitch/stitch-screen-manifest.json`, 74 entries) provides
screen-to-route, layout, viewport, and theme mappings. This supports structural traceability
and corroborates the route/layout verification in sections C and E.

However:

- The manifest does not contain an explicit visual-approval field.
- `designDisposition` values of `original` (62) and `rebuild-required` (12) do not establish
  approval. The required vocabulary (`APPROVED TARGET` / `APPROVED WITH NOTES`) appears nowhere
  in the repository or the architecture document (verified by grep across JSON/MD/CSV/TS: 0 hits).
- All 74 declared reference image artifacts (`artifacts/stitch/reference/<promptId>.png`) are
  unavailable to the audit environment — absent from disk and from the entire git history.
- No active Stitch retrieval tool was available in this session.

Accordingly:

- **Structural mapping: verified**
- **Approved visual target status: not verified**
- **Screenshot-to-runtime visual comparison: not verified**
- **Visual-fidelity cap: retained (60)**

Required evidence to lift the cap:

1. Add an explicit `approvalStatus` field to the manifest
   (`approved-target | approved-with-notes | concept | superseded | implementation-capture`).
2. Perform human approval classification of the 74 screens, annotating the two
   rulings-conflicted screens per the precedence rule.
3. Version and expose all 74 referenced artifacts at the paths the manifest already declares.
4. Record approval dates and approving roles.
5. Re-run route-to-screen visual comparisons.

## Net effect

Verdict **NOT CERTIFIED** and score **61/100** unchanged — two MAJOR route-ruling violations
added (RUL-01, RUL-02) and three prior findings closed (the `/quiz` and `/auth` compatibility
findings and the stale Plan-tab baseline); no score cap moves. Route-registry compliance is now
measured against the *approved* contract rather than inferred from the tree: **3 of 5 rulings
hold in production, 2 do not.**
