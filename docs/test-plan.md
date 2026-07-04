# Tanmatra E2E Test Plan

Execution-ready master test matrix for the customer storefront + ops flows.

## Column legend

- **Layer**: Unit / API Integration / E2E UI / Ops Simulation
- **Assertion Source**: UI / API / DB / Logs — prefer **API/DB for math-critical** checks; UI only for behaviour.
- **Priority**: P0 (critical) · P1 (important) · P2 (nice-to-have)
- **Blocker**: must pass on `main`/release before deploy.

## Matrix

| ID | Domain | Layer | Persona | Preconditions | Steps (short) | Expected Result | Assertion Source | Pri | Blocker | Automation |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Storefront UX | E2E UI | Busy lunch user | Seeded menu + quick filters | Filter high-protein chicken → add → checkout | Journey completes; no blocking modal | UI + cart API | P1 | No | Yes |
| 2 | Storefront UX | E2E UI | Non-tech patient | A11y copy variant on | Browse protocols + macro tables | Understandable; no jargon dead-ends | UI snapshot + content API | P1 | No | Partial |
| 3 | B2B Onboarding | E2E UI + API | RD partner | "For Dietitians" form live | Open → submit credentials | License/compliance fields captured | API payload + DB row | P0 | Yes | Yes |
| 4 | B2B Sales | E2E UI | Corporate HR lead | Corporate page seeded | Browse plans → submit pilot form | Lead form visible + submittable | UI + lead API | P1 | No | Yes |
| 5 | B2B Sales | E2E UI | Gym affiliate | Performance filters/links | Filter protocol → open cohort links | Affiliate journey routes correctly | UI route + tracking API | P2 | No | Partial |
| 6 | Clinical Safety | Unit + API | Diabetes patient | GI metadata seeded | Apply diabetes filter; inspect meals | Meals outside safe GI/carb bands excluded | meal metadata API + rule engine | P0 | Yes | Yes |
| 7 | Clinical Filters | E2E UI | Ayurvedic user | Dosha tags seeded | Apply Pitta/Vata filters | Correct filtered list; no crash | UI + query API | P1 | No | Yes |
| 8 | Clinical Filters | Unit + API + UI | Jain user | Ingredient tags complete | Apply Jain filter | Onion/garlic/root fully excluded | ingredients API + UI cards | P0 | Yes | Yes |
| 9 | Household Cart | E2E UI | Caregiver | Kids + senior SKUs available | Add both in one cart | Grouped/labelled; no pricing conflict | UI + cart model API | P1 | No | Yes |
| 10 | Pricing UX | Unit + E2E UI | Shopper | Threshold = ₹500 (50000 paise) | Add items toward threshold | "Add ₹X more" updates each mutation | pricing engine + UI text | P0 | Yes | Yes |
| 11 | Auth Guard | E2E UI | Guest | Incognito, no token | Open /preferences, /account | Immediate auth block; no ghost account | UI + auth API status | P0 | Yes | Yes |
| 12 | Filter Logic | Unit + E2E UI | User | Contradictory filters allowed | Non-veg+Jain / Vegan+Carnivore | Clean zero-state + clear-filters; no crash | UI + filter API | P1 | No | Yes |
| 13 | Persistence | E2E UI + API | Returning user | Storage enabled | Quiz + personalize → close → reopen ≤5m | Preferences + cart restored per policy | storage + profile/cart API | P1 | No | Yes |
| 14 | Boundary Math | Unit + API + UI | QA | Deterministic price fixtures | Cart subtotal exactly ₹500 | Delivery fee = ₹0 exactly at boundary | pricing API + order breakdown | P0 | Yes | Yes |
| 15 | Upsell Reversal | Unit + E2E UI | QA | Upsell SKU active | Add base + upsell → remove upsell | Subtotal/tax/ship/total revert exactly | cart totals diff (API) | P0 | Yes | Yes |
| 16 | Inventory Sync | API + Ops Sim | Kitchen ops | KDS integration active | Set prawns stock=0 | SKU disabled; in-flight cart blocked w/ message | inventory + checkout API | P0 | Yes | Yes |
| 17 | Logistics SLA | Ops Sim + API | Ops manager | Dispatch simulator on | Simulate prep >20 min | Rider reassignment + delay notification | dispatch logs + notif events | P0 | Yes | Partial |
| 18 | Compliance | API + Logs | Founder/Legal | Audit logging on | Generate logs, attempt edit | Immutable logs; tamper denied + logged | audit DB + append-only proof | P0 | Yes | Partial |
| 19 | Delivery Zone | E2E UI + API | New user | Geo rules configured | Enter out-of-zone pincode | Checkout blocked; expansion-interest form | geo check API + lead capture | P0 | Yes | Yes |
| 20 | Payment Resilience | API + Ops | QA/Gateway | Test gateway/webhook keys | Pay then close before redirect | Webhook → order Paid; KDS dispatched; no loss | webhook logs + order DB + KDS | P0 | Yes | Yes |
| 21 | Subscription Sched | API + E2E UI | Subscriber | Active plan seeded | Skip next Tue (≥24h) | Kitchen prep decremented; plan +1 day | subscription API + forecast DB | P0 | Yes | Partial |
| 22 | Refund Engine | Unit + API | Support agent | 21-day plan, 10 consumed | Cancel program | Refund = consumed@retail; remainder refunded | refund API + ledger DB | P0 | Yes | Yes |

## Global test controls

1. **Deterministic fixture pack** — fixed SKUs/prices/tax/shipping thresholds for CI. Seed via the same scripts used in prod (`pnpm --filter scripts run seed-menu-items`) plus a CI-only price-locked overlay.
2. **Money precision** — assert in **integer paise**; never compare floats. Helpers in `e2e/fixtures.ts` (`rupees()`, `expectPaise()`).
3. **Evidence-first** — UI for behaviour, **API/DB for correctness** (totals, refunds, geo, inventory).
4. **Release gate** — every **P0 + Blocker** row must pass on `main`/release branches (wire into the `Deploy` workflow as a pre-deploy job, or a required PR check).

## Grounding notes (repo reality — read before automating)

These are facts pulled from the codebase so tests assert against real behaviour, not the matrix's prose:

- **Money is paise.** `artifacts/tanmatra/src/lib/cartContext.tsx`: `FREE_DELIVERY_THRESHOLD = 50000` (₹500), `DELIVERY_FEE = 5000` (₹50), `GST_BPS = 500` (5%). Delivery fee is `0` when `subtotal === 0 || subtotal >= 50000`, else `5000`. Tax `= round(subtotal * 500 / 10000)`. **Scenarios 10/14/15 must use these.**
- **Cart persistence** is Zustand → `localStorage["tanmatra:cart:v1"]`, shape `{ state: { items: CartItem[], bundleSlugs: string[] }, version: 0 }`. `CartItem` = `{ lineId, dishId, slug, name, image, basePrice, unitPrice, quantity, kitchen, isVeg, rdVerified, macros{protein,carbs,fat,fiber,calories}, customizations }`. Seed helper: `e2e/fixtures.ts#seedCart`.
- **Routes** (real): `/menu`, `/dish/:slug`, `/cart`, `/checkout`, `/preferences`, `/account`, `/account/addresses`, `/subscribe`, `/subscriptions`, `/track/:orderId`, `/plans` (RD), `/rd`. Auth-gated (scenario 11): `/preferences`, `/account`.
- **Order finalize**: `POST /orders/finalize` (`loyaltyApi.finalizeOrder`). Server recomputes gross from catalog prices and throws `unknown dish id` for items not in `menu_items` — assert order math from the **response**, not client state.
- **Menu catalog API**: `GET /api/menu/public` returns `{ dishes: [{ id, slug, price, isVeg, allergens, glycaemicIndex, macros, ... }] }` — the source for clinical-filter assertions (6/8) and cart item ids.
- **Delivery zone (scenario 19)**: `checkPincode()` in `src/lib/serviceablePincodes.ts`. **The live serviceable zone is Noida NCR** (`110xxx` / `201xxx`, e.g. `201301`), **not Bengaluru**. Use `201301` as serviceable and e.g. `560001` (Bengaluru) / `400001` (Mumbai) as out-of-zone. ⚠️ The matrix's "non-Bengaluru" wording is inverted vs. the code; pickup locations are labelled Bengaluru while pincode serviceability is Noida — worth a product decision, tracked as a test note.
- **`data-testid` coverage is thin** (only ~12, mostly `WeeklyPlanner.tsx`). Tests below prefer **role/text selectors that exist today** (e.g. "Delivery Address", "Get it your way", "Place Order") and flag where a `data-testid` should be added. Adding stable testids for menu cards, cart line totals, and the "add ₹X more" nudge is a prerequisite to fully automating 1/9/10/12.

## Playwright conventions

- Prefer `getByRole` / `getByText` for existing UI; add `data-testid` for money-bearing nodes (cart line total, order total, free-delivery nudge) and assert those.
- **Validate all totals via the `/orders/finalize` (or cart) API response**, keep UI text checks secondary.
- One deterministic seed per spec file; reset `localStorage` between tests.
- Tag P0 blockers with `@p0` so CI can run `--grep @p0` as the release gate.
