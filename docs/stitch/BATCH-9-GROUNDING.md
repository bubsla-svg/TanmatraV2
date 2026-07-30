# Batch 9 Grounding — Secondary Marketing & Standing Pages (G6)

> Reconciliation input for Route Briefs 53+. Establishes, per route, the real
> backend contract and the logic that must survive wiring — written **before**
> any Stitch generation, following the pattern Batches 3–8 set.
>
> Per `BATCH-4-5-SCOPE.md`: *"Mostly static or near-static; `legal` and
> `legal/[slug]` are close to trivial. The genuine work here is `marketplace`
> ... and `subscription/bridge`."* Grounding confirmed that framing, and
> found real defects concentrated in exactly those two places — plus one more
> the scope doc didn't call out: `/premium`.

## Route → real path map

| Route | Page | Main component(s) | Data source |
|---|---|---|---|
| `marketplace` | `app/marketplace/page.tsx` | `MarketplaceGrid` | `marketplaceApi` |
| `marketplace/[slug]` | `app/marketplace/[slug]/page.tsx` | `MarketplaceItemView`, `BundlePicker` | `marketplaceApi` |
| `wellness` | `app/wellness/page.tsx` | `ProtocolView` (shared) | `catalog` + `rdApi` |
| `premium` | `app/premium/page.tsx` | `PremiumMembership` | `premiumApi` |
| `performance` | `app/performance/page.tsx` | `ProtocolView` (shared with `/wellness`, `/clinical`) | `catalog` + `rdApi` |
| `vouchers` | `app/vouchers/page.tsx` | `VoucherRedeem` | `vouchersApi` |
| `subscription/bridge` | `app/subscription/bridge/page.tsx` | `BridgeView` | `subscriptionsApi` (now) |
| `legal` | `app/legal/page.tsx` | index only | `content/legal` (static) |
| `legal/[slug]` | `app/legal/[slug]/page.tsx` | `LegalArticle` | `content/legal` (static) |
| `faq` | `app/faq/page.tsx` | `FaqAccordion` | `content/faq.ts` (static) |
| `about` | `app/about/page.tsx` | inline sections | local consts (static) |

Every file is well under the 400-line `.tsx` cap.

## Method

Four parallel research passes (marketplace commerce; the wellness/premium/
performance dashboards; the vouchers/subscription-bridge money-adjacent pair;
the four static-prose routes), each reading every route file, every imported
component, and the backing `lib/*Api.ts` client in full — then every
high-severity finding below was independently re-verified by reading the
source myself before it became a code change, per the standing discipline
this project's batches follow.

## Contracts that must survive wiring

### `marketplace`, `marketplace/[slug]` — a real second commerce surface

Two genuinely independent purchase paths exist: `MarketplaceItemView`'s own
"Place order" button (real Razorpay money path via `payForMarketplace()` →
the shared `RazorpayAdapter`, exactly the right amount of reuse), and
"Add to Cart" pushing a `kind:"marketplace"` line into the same `CartState`
dish lines use. Only the first one actually worked — see Defects. Both
purchase paths, and the browse grid, are fully public; auth is gated
correctly at the point of purchase (401 → inline `PhoneAuth`, never a
redirect). Money formatting throughout goes through the shared `formatPaise`.

### `wellness`, `performance` — the cleanest routes in this batch

Both are pure RSC wrappers around the already-shared `ProtocolView` (also
serving `/clinical`, out of scope here). `Promise.all([fetchMenu(), getRds()])`
with honest fallbacks on either failure (static catalog / empty roster, never
fabricated content), plan pricing from the deterministic `PLAN_CATALOG` spine
(no network call, no fabrication — the code comment literally says "No
fabricated price"). No auth gating, correctly: `PROTOCOL_CONFIG.wellness` /
`.performance` are both `clinical: false`, and both pages document the public,
signed-out scope explicitly. Restyle only.

### `premium` — real money path, one stale copy defect (fixed)

`PremiumMembership`'s `getPremium`/`payForPremium`/`cancelPremium`/
`resumePremium` are a clean, honest money-path implementation: real
server-priced Razorpay checkout, real error surfacing, no fabrication on
failure. The one defect (below) was in the *static marketing shell*
(`app/premium/page.tsx`), not the money-path component.

### `vouchers` — a clean model of the money-integrity contract

`VoucherRedeem` is redeem-only (never a charge), typed error branches (401 →
island, 404 → "not found," 409 → "already redeemed"), every amount sourced
from the server response through `formatPaise`. Nothing to fix.

### `subscription/bridge` — fabricated credit claim (fixed)

`BridgeView` never called the server at all — it unconditionally claimed
"Your ₹399 Trial Credit is Reserved" to every visitor, signed in or not,
owner or not, live trial or already-converted. See Defects.

### `legal`, `legal/[slug]`, `faq`, `about` — the shared prose template, grounded

Per `BATCH-4-5-SCOPE.md` Decision 3, these four share one template rather than
four briefs. Grounding confirms the decision but refines it: `/legal` (index)
and `/legal/[slug]` (via `LegalArticle.tsx`) genuinely share DNA — masthead +
`sections[]` loop, `max-w-3xl`. `/faq` shares the masthead idiom by
hand-copy (with drift: `max-w-2xl`, an extra eyebrow line) but its body is
structurally different in kind — `FaqAccordion`'s single-open-at-a-time
interaction model can't be flattened into `sections[]` without losing it, so
the template needs a distinct accordion body variant, not a forced reshape.
`/about` is confirmed the outlier: no back-link/byline, no `sections[]`
source at all, a full step up in heading scale, marketing-composition
sections (hero/mission/process-steps/trust-badge/team-grid/CTA) rather than
prose. The template should let `/about` opt into shared type-scale/tokens
only, with its own layout — not be forced into the masthead+body shell.
`terms` (20 sections) and `privacy` (16) genuinely warrant a TOC slot;
`refunds`/`shipping`/`disclaimer` (8–9) and `grievance` (6) are marginal;
`/faq`'s 11 flat Q&A rows and `/legal`'s 6-row index don't need one.

## Defects fixed before design wiring

1. **`/subscription/bridge` fabricated a trial-credit confirmation for every
   visitor, verified or not.** `BridgeView.tsx` never called the server —
   it unconditionally rendered "Your ₹399 Trial Credit is Reserved" and a
   claim CTA regardless of whether the visitor was signed in, owned the
   referenced subscription, or had a live/eligible trial at all. The real,
   purpose-built endpoint (`GET /subscriptions/:id/trial-recap`) already
   existed server-side and was completely unused — `requireAuth` +
   owner-scoped + trial-state-gated (400 outside the three live trial
   states). **Fixed**: added `trialRecap()` to `lib/subscriptionsApi.ts`;
   `BridgeView` now genuinely fetches and gates on it — loading, 401 → inline
   `PhoneAuth`, 404 → an honest "we couldn't find that trial" state, 400 → an
   honest "this credit isn't available anymore" state, and only the verified
   case renders the claim card. The three hardcoded "₹399" literals were also
   replaced with `formatPaise(TRIAL_CREDITBACK_PAISE)` — the same
   spine-computed constant `/trial`'s own copy already uses — so the figure
   is sourced, not hand-typed, on top of now being gated on real verification.
2. **`text-white` on raw `bg-gold`** in `BridgeView.tsx:48`, the page's only
   CTA — a 100%-reach contrast failure, not an edge case. **Fixed** to
   `text-[var(--gold-ink)]`, confirmed via `grep` to be the only such
   instance across all four money-adjacent route files (`VoucherRedeem.tsx`
   already had the correct pairing).
3. **`MarketplaceGrid.tsx` called `useCart()` inside a `.map()` callback** —
   a Rules-of-Hooks violation, not a style nit: the number of hook calls for
   the component instance changes whenever the filtered item count changes
   (e.g. switching category chips), which trips React's same-order-every-render
   invariant and can crash the grid. **Fixed**: hoisted `useCart()` to the
   component's top level.
4. **The marketplace "Add to Cart" flow silently drops the item at
   checkout — a real money-integrity bug, not a design gap.**
   `components/checkout/AlacarteCheckout.tsx` builds the order sent to
   `POST /orders` from dish-kind cart lines only, but `CartDrawer` and
   `AlacarteDetails` both displayed the **full** cart subtotal including any
   `kind:"marketplace"` lines — so a customer who added a pantry item via
   "Quick Add" or the item page's "Add to Cart" saw it listed with its price
   counted into "Est. total," entered address/consent, and would have been
   billed a **different, lower** amount by the server than the number shown
   throughout the flow, with the marketplace item never actually ordered or
   received. The only path that actually purchases a marketplace item is the
   item page's own "Place order" button, which bypasses the cart entirely.
   **Fixed**: `AlacarteCheckout` now scopes the summary, sticky total, and
   order payload to dish lines only (via a new `dishCart`), shows a plain-text
   notice when marketplace lines are present in the cart but excluded from
   this order (linking to `/marketplace` to buy them separately), and gets a
   dedicated empty-state ("Your cart only has pantry items") for the
   marketplace-only case instead of falling through into a checkout form with
   nothing payable.
5. **No out-of-stock affordance** on `MarketplaceItemView` — `stockQty === 0`
   still showed active "Add to Cart"/"Place order" buttons and "0 in stock"
   in the same neutral tone as any other count, relying entirely on a generic
   server 422 as the only backstop. **Fixed**: both actions are replaced with
   an honest "Currently out of stock" state when `stockQty === 0`, and the
   stock count renders in `--danger` at zero instead of neutral ink-faint.
6. **`/premium`'s static marketing copy asserted a stale, unsourced price** —
   *"A 30-minute video session... worth ₹1,499"* — not derived from any API
   or constant, and matching a figure the codebase's own banned-string
   scanner (`lib/copy.test.ts`) already flags elsewhere as a legacy literal
   (`/1,?499/`, labelled "Legacy trial 1,499 price literal"; the real live
   trial price is ₹399). It also bypassed the page's own gated copy source
   (`content/copy/premium.ts`'s `ownerPerksLeaf`, explicitly held `null`
   pending "entitlement API verification"). **Fixed**: removed the
   unverifiable "worth ₹1,499" clause; the benefit is now described without
   a price claim, since the real per-consult value is a gated, unverified
   number this batch has no basis to invent.
7. **`PremiumMembership`'s initial load never distinguished 401 from any
   other failure** — only the mutating actions (`join`/`cancel`/`resume`)
   routed a 401 into the inline `PhoneAuth` island; a signed-out visitor's
   first page load instead surfaced the raw error/message text. **Fixed**:
   the initial `load()` now checks for a 401 the same way `run()` does.
8. **`/about`'s "Meet the team" links didn't link to the team.** Each
   `DIETITIANS` entry carries a real `slug` matching the live, API-backed
   `/rd/[slug]` route (the same three seeded RDs used in
   `components/care/CareRdRoster.tsx` and the `rdApi`/`rdBookingApi` tests),
   but every card's link hardcoded `href="/rd"` regardless of which
   dietitian it was for. **Fixed**: each card now links to
   `/rd/${d.slug}`, with the button text naming that specific dietitian.

## Known issues, deliberately not fixed (out of scope or product decisions)

- **`CartUpsellRail.tsx` hardcodes four fictional marketplace products**
  (invented names, slugs, and prices — none sourced from `marketplaceApi`),
  rendered as "Recommended Add-ons" inside the shared `CartDrawer`. This is
  real fabricated commerce data, but the file is shared cart chrome used
  across the whole app, not one of this batch's 11 routes or their direct
  components — fixing it means either wiring a real "trending items" fetch
  or removing the rail, a decision affecting every route that opens the cart
  drawer. Flagging prominently for a dedicated fix rather than pulling
  shared-chrome scope into a route-design batch.
- **`lib/marketplaceApi.ts`'s `checkItemAvailability()` and
  `getLiquidationDeals()`/`LiquidationDealPayload` have zero callers.**
  Fully implemented, never wired into either marketplace route. Worth a
  decision (build the liquidation-deals rail the naming implies, or delete
  the dead surface) rather than silently carrying it forward — not this
  batch's decision to make.
- **`lib/marketplaceApi.test.ts` never calls `getItem()`** — the function the
  entire item-detail page depends on. A contract drift on
  `GET /marketplace/items/:slug` would go uncaught. Test-coverage gap, not a
  production defect; not added here to keep this batch's diff scoped to
  defects and design, matching precedent (Batches 6–8 also left adjacent
  coverage gaps for a dedicated pass).
- **`/wellness` and `/performance` compute but discard `fetchMenu()`'s
  `source: "api"|"fallback"` signal** — a cold catalog API silently serves
  the static fallback with zero visual indication to the customer. Real
  data either way (never fabricated), so not a fabrication defect; flagged
  as a gap a future pass could close with a subtle "showing recent menu"
  affordance.
- **`subscription/bridge`'s hold-expiration window and deep-linked CTA are
  not implemented.** The real `trial-recap` response includes
  `holdExpiration` (a kitchen-capacity-hold deadline) and the legacy app
  surfaced a live countdown plus an "expired" state; the storefront version
  (even after this batch's fix) only verifies eligibility, it doesn't render
  a countdown or branch on an expired hold. Likewise the CTA still routes to
  the generic `/plans` rather than a specific recommended plan/cadence (the
  legacy version deep-linked one). Both are real product features, not
  defects in what's shipped — the eligibility gate this batch added is a
  correctness fix; a countdown UI and a "recommended plan" decision are net
  new functionality appropriately left to a dedicated pass or this batch's
  design brief, not a pre-design defect fix.
- **`content/legal/company.ts` still has five bracketed placeholder fields**
  (`cin`, `registeredOffice`, `grievanceOfficer`, `jurisdictionCity`,
  `jurisdictionState`). These are intentionally, visibly flagged by
  `LegalArticle`'s `withPlaceholders()` — a deliberate "TODO, visibly marked"
  pattern, not a bug to silently paper over with invented company details.
- **`content/faq.ts` answer #9 contradicts the canonical refund policy**
  (`content/legal/refunds.ts`) — the FAQ describes a "30-minute cancellation
  window / Support tab" that the actual refund policy never mentions. Already
  self-flagged in `content/faq.ts`'s own header comment as unreconciled. This
  is a legal/policy content decision, not a code defect this batch can
  responsibly resolve by picking one version — flagged for an owner decision
  before either copy block gets re-cemented by a Stitch design pass.
- **`ACCENT`/ID-card-style duplication and other small cosmetic repeats**
  noted during grounding (e.g. `TeamCard`'s pattern echoed here) are not
  present in this batch's own files; nothing additional found.

## Shared vocabulary available

Unlike Batch 8 (which had to invent an editorial vocabulary from near
nothing), this batch inherits heavily:

- **`wellness`/`performance`**: the landing-kit hero (Batch 3), `BenefitGrid`
  (Batch 3), `PlanCard` (shared by `/metabolic`, `/care`, `/protocol` per its
  own doc comment), `RdCard` (Batch 7) — all reused verbatim via the shared
  `ProtocolView`. Only `ProtocolDishRail`'s protocol-specific badge face is
  genuinely new territory for a brief to style.
- **`premium`**: `components/account/SubscriptionCard.tsx` (Batch 5) is a
  direct precedent for the active-membership status-badge + action-row shape
  `PremiumMembership` currently reimplements independently — a brief should
  point at it rather than treat `/premium` as novel. The static marketing
  shell around it hand-duplicates `BenefitGrid`-style card markup instead of
  importing the real component — worth flagging to a brief author.
- **`vouchers`, `subscription/bridge`**: `BATCH-4-BRIEFS.md` (routes 21–26)
  explicitly defines its dark-scope/glass-footer/money-CTA-discipline
  vocabulary as binding on *any* money-adjacent screen, not just checkout —
  neither route currently uses the dark `data-stitch` wrapper or the glass
  sticky footer. `/vouchers` already independently converged on tabular
  numerals, correct gold pairing, and island auth without citing the batch;
  `/subscription/bridge` (pre-fix) followed none of it. Both are strong
  candidates to formally adopt that vocabulary now.
- **`marketplace`**: closer to Batch 8's `RecipeCard` (image-top, content
  below, stats under a hairline divider) than Batch 1's `DishCard`, but
  simpler than either — no existing rating/fit/byline signal. The item PDP
  structurally mirrors the dish PDP's rhythm (hero → header → sectioned body
  → CTA cluster) without needing the clinical-specific subcomponents.
- **`legal`/`legal[slug]`/`faq`/`about`**: `components/legal/LegalArticle.tsx`
  is the one genuine prior art (masthead → `sections[]` loop,
  `withPlaceholders()` gold-highlighting) — see the shared-template section
  above for exactly how far it extends.
