# Application Ownership

> P0 §24 deliverable. Baseline SHA `3aea38dc` (`main`, 2026-08-06).
> Companion machine-readable file: [`p0-baseline.json`](./p0-baseline.json).

This document answers one question: **for any given surface, which application
owns it, and which one is allowed to change it?** Every ambiguity below is a
place where two applications could both claim a change, which is how the
Phase 13 regression happened in the first place.

## 1. The applications

| Package | Kind | Owns | Status |
|---|---|---|---|
| `artifacts/storefront` | Next.js 16 App Router | **Every customer-facing surface.** All 58 page routes. | Active — all new customer work lands here |
| `artifacts/api-server` | Express 5 | Every business decision: pricing, quotes, orders, payments, dispatch, clinical gating, AI agents. 64 routers under `src/routes/`. | Active |
| `artifacts/tanmatra` | React 19 + Vite SPA | Internal Admin ERP + RD console only. Customer routes removed 2026-07-26. | Legacy — retained for the `/images/*` proxy and internal consoles |
| `artifacts/tanmatra-mobile` | Expo RN | Mobile app | Active, out of P0 scope |
| `artifacts/clinical-governance-engine` | Zero-dep TS library | Contraindication engine, packing-station interlock, AE webhooks, WORM audit log | Active |
| `artifacts/agents`, `artifacts/mockup-sandbox` | Vite tools | Internal browsing/preview | Non-production |

## 2. Domain ownership — who decides what

The single load-bearing rule: **the server owns every amount.** The browser
never authors a price, a total, a discount or a credit. It receives a
server-issued quote and a `keyId`; no Razorpay key is bundled into the client.

| Decision | Owner | Storefront's role |
|---|---|---|
| Catalogue contents, availability | api-server (`routes/catalog.ts`, `menu.ts`) | Render |
| Plan pricing, cadence discount, add-on maths | `lib/subscription-rules` (shared, pure) + api-server | Render; `lib/plans.ts` is a *view* over the spine |
| Quote issuance, TTL, supersession | api-server (`routes/checkout.ts`) | Consume `quoteId`, never recompute |
| Payment creation + verification | api-server + Razorpay | Thread ids through `moneyPath.alacarte.ts` |
| Clinical contraindication | `clinical-governance-engine` + api-server | Render rationale, never decide |
| Session identity | api-server session cookie | Try-the-call, render `<PhoneAuth/>` on 401 |
| Design tokens | `lib/tokens` + `lib/themes` | Bridge in `app/globals.css`; never inline a hex |

## 3. Shared libraries and their single owners

| Library | Sole authority for | Consumed by |
|---|---|---|
| `lib/api-spec/openapi.yaml` | The HTTP contract | api-server, `lib/api-client-react`, `lib/api-zod` |
| `lib/subscription-rules` | Plan catalogue, price table, cadence discount, 24 h skip/swap cutoff | api-server **and** storefront — this is what stops API/UI drift |
| `lib/preferences-match` | Dietary/allergen matching | Both |
| `lib/menu-catalog` | Dish/menu types | Both |
| `lib/db` | Postgres schema (Drizzle) | api-server only |
| `lib/tokens`, `lib/themes` | Colour, type, radius, motion | storefront |

### The contract-flow exception (must stay explicit)

`artifacts/tanmatra`, `tanmatra-mobile` and `agents` consume generated React
Query hooks from `@workspace/api-client-react`. **The storefront deliberately
does not.** It calls the API through hand-written typed clients in
`artifacts/storefront/lib/*Api.ts` over `lib/apiClient.ts`.

Consequence, and it is an ownership hazard: **editing `openapi.yaml` does not
propagate to the storefront.** A contract change must be mirrored into the
relevant `lib/*Api.ts` by hand, and that client's wire test is the only thing
that catches the drift. Ownership of "keeping the storefront in sync with the
contract" belongs to whoever changes the contract — nothing automates it.

## 4. Domain ambiguities on this SHA

These are the places where ownership is genuinely unclear today. Each is a
latent source of the same class of regression P0 exists to prevent.

1. **Two `SafeImage` implementations.** `components/ui/SafeImage.tsx` and
   `components/primitives/SafeImage.tsx` both ship. P0 §11 requires one.
   Neither directory is declared the owner of image fallback behaviour.
2. **Layout ownership is not held by the router.** Shell selection lives in an
   inline script in `app/layout.tsx` that reads `location.pathname`. Adding a
   route does not assign it a shell; a developer must remember to edit
   `lib/focusRoutes.ts`. See [`layout-contracts.md`](./layout-contracts.md).
3. **Analytics sanitisation has no owner in production.** The allowlist exists
   only inside `lib/domainInvariants.test.ts`. See
   [`privacy-analytics-contract.md`](./privacy-analytics-contract.md).
4. **`/api/build` advertises `canonicalRoutes: 42` and `totalScreens: 74`**
   while the tree has 58 page routes. The endpoint is the deploy-truth
   contract, so nobody owns correcting its self-description.
5. **The legacy SPA still sits in the storefront's serving path** as
   `IMAGE_UPSTREAM` for `/images/*`. A change to the legacy app's `public/`
   changes what customers see on the storefront, across an ownership boundary.

## 5. Change-authority rules

- New customer surface → `artifacts/storefront` only. Never the legacy SPA.
- New business rule that both API and UI must agree on → a pure package under
  `lib/` (the `subscription-rules` pattern), never duplicated in both.
- New colour or spacing value → `lib/tokens` / `lib/themes`, bridged in
  `app/globals.css`. `lint:tokens` fails the build on a raw hex in
  `components/` or `app/`.
- Contract change → `openapi.yaml` **and** the matching storefront
  `lib/*Api.ts` in the same change, or the storefront silently diverges.
- Money-path change → API and UI in lockstep; `lib/pricingInvariants.test.ts`
  guards the boundary with a shrink-only debt register.
