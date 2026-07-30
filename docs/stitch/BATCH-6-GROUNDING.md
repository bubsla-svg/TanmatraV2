# Batch 6 Grounding — Corporate / Group Commerce (G2)

> Reconciliation input for Route Briefs 34–39. Establishes, per route, the real
> backend contract and the logic that must survive wiring — written **before**
> any Stitch generation, following the pattern `BATCH-3-GROUNDING.md`,
> `BATCH-4-GROUNDING.md` and `BATCH-5-GROUNDING.md` set.
>
> Per `BATCH-4-5-SCOPE.md`: multi-actor flows (host, invitee, HR admin) with
> real money paths. Batch 3 already built the B2B acquisition front door
> (`/corporate-wellness`); this batch is what happens after a company signs —
> it inherits that vocabulary but needs its own briefs, since none of these six
> routes currently uses any of the landing kit (expected — they're app-shell
> surfaces, not marketing pages).

## Route → real path map

| Route | Page | Main component(s) | Route weight |
|---|---|---|---|
| `corporate` | `app/corporate/page.tsx` | `CorporateLeadForm` (170) + `ProofStrip`, `StickyCtaBar` (landing kit) | 356 |
| `corporate/[slug]` | `app/corporate/[slug]/page.tsx` | `CompanyLanding` (85) | 105 |
| `corporate/[slug]/lunch-planner` | `app/corporate/[slug]/lunch-planner/page.tsx` | `LunchPlanner` (95) → `DietProfileForm` (106), `LunchPlanPreview` (73) | 115 |
| `corporate/invite/[token]` | `app/corporate/invite/[token]/page.tsx` | `CompanyInvite` (65) | 85 |
| `office-lunch/[id]` | `app/office-lunch/[id]/page.tsx` | `OfficeLunch` (87) → `OfficePicker` (54) | 108 |
| `group/[code]` | `app/group/[code]/page.tsx` | `GroupOrderView` (112) | 137 |

Every component is well under the 400-line `.tsx` cap; no file-cap risk anywhere
in this batch. `/corporate` at 356 lines (route weight, not file length) is
the largest unbriefed route in the whole app, but its actual component
(`CorporateLeadForm`, 170 lines) is modest — the weight is mostly the
already-Batch-3 landing-kit pieces it reuses.

## Contracts that must survive wiring

### `corporate` — public lead capture, already partially wired into the landing kit

`lib/corporateApi.ts`: `submitCorporateLead(input) → POST /api/corporate-leads`,
public, no auth. Client-side validation only (name ≥2, email regex, company
≥2, a required team-size band); server is authoritative. 429 gets a
rate-limit-specific message. Already reuses `ProofStrip` + `StickyCtaBar` from
the Batch-3 kit and links out to `/corporate-wellness`. One color-token
inconsistency found and fixed pre-design (see Defects below); nothing else to
fix — restyle only.

### `corporate/[slug]` — session-gated company workspace, client-derived admin link

`lib/companyApi.ts`: `getCompany(slug)`. 401 → `needsAuth` → inline
`PhoneAuth`, the correct island pattern. `Company.perEmployeeMonthlyBudgetPaise`
is a **monthly** figure, shown as "…/person/month" — do not confuse with the
per-meal figure on `office-lunch/[id]` (see below, they are different units on
different cadences and are not currently reconciled by the code). The
"Open the lunch planner" link is a **client-side role check**
(`membership?.role === "admin"`), not a separate admin token — real
enforcement is server-side on the planner's own endpoints.

### `corporate/[slug]/lunch-planner` — admin-only, two-stage (profile → plan)

`lib/b2bPlannerApi.ts`: `getDietProfile`/`saveDietProfile` (PUT),
`getCurrentPlan`, `generatePlan`, `schedulePlan(id, {scheduledHour,
perEmployeeBudgetPaise})`. Admin gate: client-side `membership.role==="admin"`
check inside `load()`, reinforced by real server 403s if bypassed — belt and
suspenders, not a separate token. **Known limitation, not fixed in this
batch**: `LunchPlanner` schedules every plan at a hardcoded
`PER_EMPLOYEE_PAISE = 40000` (₹400) local constant — it fetches `Company` only
for `membership.role` and never reads or reconciles the company's configured
monthly budget shown on `corporate/[slug]`. A design brief for this route
should not assume the two money figures are linked; that is a product
decision for the owner, not a Batch 6 defect fix (see `BATCH-4-5-SCOPE.md`'s
"still genuinely open" pattern — this is the same class of decision).

### `corporate/invite/[token]` — public preview, auth required only to accept

`lib/companyApi.ts`: `getInvite(token)` (public GET, any failure → "missing"),
`acceptInvite(token)`. 401 on accept → redirect to `/login?next=...`; 403 =
email-mismatch (the invited email doesn't match the signed-in user) shown
inline. Nothing to fix — restyle only.

### `office-lunch/[id]` — session-gated RSVP + admin close

`lib/companyApi.ts`: `getOfficeOrder`, `pickOfficeOrder` (maps
`code==="over_budget"`), `closeOfficeOrder` (soft-fails silently by design).
401 → `needsAuth` → inline `PhoneAuth`. Admin-only "Close picks" gated the
same client-side-role-check way as `corporate/[slug]`. `formatPaise` used for
budget, aggregate total, and per-person totals — all real, server-sourced
figures (this is a genuine **per-order** budget set at schedule time, distinct
from the planner's hardcoded constant that created it).

**Known limitation, not fixed in this batch**: the dish picker
(`OfficePicker`) is fed `AVAILABLE = DISHES.filter(...).slice(0, 30)` — the
first 30 "available" dishes from the global static catalog, not scoped to the
company, kitchen, or this specific order. A design brief should treat the
RSVP menu as an unscoped global subset, not a curated one. Same class of
decision as the planner budget above — flagged, not fixed, per YAGNI: scoping
the menu is a feature, not a bug in the code as written.

### `group/[code]` — public read, host-only close, participant add-flow was dead

`lib/groupOrdersApi.ts`: `getGroup` (public), `addItem`, `removeLine`,
`closeGroup`, `groupSubtotalPaise`. `isHost` is client-derived
(`group.hostUserId === userId`), no dedicated host token — consistent with
every other admin/host gate in this batch. Close-and-checkout re-hydrates the
**local** cart from the server-closed group's lines (server-returned
`unitPrice`, local catalog lookup for name/slug) and routes to `/checkout`,
reusing the existing money path.

**Real defect found and fixed pre-design** (see below): the non-host "Add your
items" CTA linked to `/menu?group=CODE`, but `AddToCart.tsx` never read the
`group` query param — the `GroupAdd` sub-component it already defined was dead
code. Fixed so the flow this route's own copy describes ("Anyone with the
link can add their own items") actually works.

## Shared landing-kit vocabulary available (Batch 3, `/corporate-wellness`)

`LandingHero`, `BenefitGrid` (grid/tiles/steps variants), `ProofStrip`,
`StickyCtaBar`, `SubsidyCalculator`, `FaqAccordion`, `LandingIcon`,
`lib/lpEvents.ts` (`LpEventName` union). `/corporate` already reuses
`ProofStrip` + `StickyCtaBar` and links to `/corporate-wellness`. The other
five routes in this batch are session-gated app-shell surfaces (workspace,
planner, invite, RSVP, group order) — not marketing landers — so they should
**not** adopt hero/proof-strip/FAQ patterns; they get their own card/list
vocabulary, consistent with how Batch 5's account-depth routes did not borrow
Batch 3's landing kit either.

## Defects fixed before design wiring

1. **`/group/[code]`'s participant add-flow was dead code.**
   `components/cart/AddToCart.tsx` defined a full `GroupAdd` component (POSTs
   via `groupOrdersApi.addItem()` when the URL carries `?group=CODE`) plus a
   `GROUP_CODE` regex and unused `useSearchParams`/`Suspense` imports — but
   the exported `AddToCart` component unconditionally rendered `CartAdd` and
   never read the search param. Fixed: `AddToCart` now wraps a
   `useSearchParams()` read in `Suspense` (fallback: the ordinary `CartAdd`,
   which is also the correct behavior for the ~100% of callers with no
   `?group=` param) and renders `GroupAdd` only when a valid group code is
   present. This makes the copy `GroupOrderView` already shows non-host
   participants — "Anyone with the link can add their own items" — actually
   true.
2. **`GroupOrderView`'s error path conflated a transient failure with "not
   found."** A non-404 error from `getGroup` (network blip, 500) left `state`
   at `"ready"` with `group` still `null`; the render logic's `!group` check
   showed the exact same "Group X was not found — it may have been closed or
   the code is incorrect" copy as a genuinely nonexistent code. Fixed: added
   a distinct `"error"` state with its own "Couldn't load this group order —
   Try again" message and a retry action, so a transient failure no longer
   tells the user their code is wrong.
3. **`CorporateLeadForm.tsx` used `text-destructive` where every sibling
   component in this batch uses `text-[var(--danger)]` for the identical
   error-text semantic.** Both resolve to the same color
   (`--destructive: var(--danger)` in `globals.css`), so this was cosmetic
   naming drift, not a broken class — fixed for consistency within the batch.

## Known limitations, deliberately not fixed (product decisions, not bugs)

- `LunchPlanner`'s hardcoded ₹400/meal schedule constant vs. the company's
  configured monthly budget (see `corporate/[slug]/lunch-planner` above).
- `OfficePicker`'s unscoped first-30-dishes menu (see `office-lunch/[id]`
  above).
- Several typed-but-unrendered fields exist on the wire (`CompanyMember.status`/
  `.joinedAt`, `OfficeOrderAddress.label`/`.phone`/`.pincode`,
  `OfficeOrderPickItem.image`, `GroupOrderLine.customizations[]`/`.image`,
  `GroupParticipant.name` beyond a count) — available for a brief to surface,
  not assumed absent from the API, but not a defect that the current UI omits
  them.
