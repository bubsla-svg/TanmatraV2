# Route Contract

> P0 §24 deliverable. Baseline SHA `3aea38dc` (`main`, 2026-08-06).
> Machine-readable companion: [`routes.json`](./routes.json).

**Contract status: FAIL.** Three defects below are blocking; the route table
itself is otherwise complete and internally consistent.

## 1. How this was produced

`routes.json` is generated, not asserted:

```bash
find artifacts/storefront/app -name page.tsx
```

The filesystem *is* the route table — the storefront has no `routes.ts`.
Every row's shell and canvas was computed by running the route through the
same matchers the app runs (`lib/focusRoutes.ts#isFocusRoute`,
`lib/internalSurfaces.ts#isInternalSurface`, `lib/stitchRoutes.ts#isStitchRoute`),
with dynamic segments substituted by a literal sample path.

## 2. Totals

| Metric | Count |
|---|---:|
| Page routes | **58** |
| Static | 44 |
| Dynamic (`[param]`) | 14 |
| Route handlers (`route.ts`) | 2 (`/api/build`, `/api/build-info`) |
| Redirect rules (`next.config.ts`) | 16 |
| Rewrite rules | 2 (`/api/*`, `/images/*` — build-time only) |
| Route groups | **0** |

By family:

| Family | Routes |
|---|---:|
| commerce | 16 |
| b2b | 11 |
| clinical | 10 |
| content | 10 |
| account | 9 |
| identity | 1 |
| system | 1 |

## 3. Blocking defects

### 3.1 `/account/wearables` has no redirect — MISSING

P0 canonicalises health-device management on `/account/connections`, with a
308 from the legacy `/account/wearables`. `app/account/connections/page.tsx`
exists. **The redirect does not.** `next.config.ts` `redirects()` returns 16
rules and none of them sources `/account/wearables`; the path 404s.

Every other legacy consolidation in the same table was done correctly
(`/orders`, `/rewards`, `/preferences`, `/subscriptions`, `/track`,
`/account/plan`, `/profile`, `/subscribe`, `/subscription-plans`, `/cart`,
`/plans/:path+`, `/appointments`, `/checkout-appointment`, and the three
`/legal/*` paths). This one was skipped.

Fix: add `{ source: "/account/wearables", destination: "/account/connections", permanent: true }`.
Redirects are baked into `routes-manifest.json` at `next build`, so this is a
redeploy, not a restart.

### 3.2 Auth step contract is `?next=`, not `?step=` — DIVERGENT

P0 specifies `/login?step=phone|otp|account-conflict` as the canonical,
linkable auth state. The shipped contract is different:

```ts
// app/login/page.tsx:15-18
searchParams: Promise<{ next?: string }>;
const { next } = await searchParams;
const safeNext = next && /^\/(?!\/)/.test(next) ? next : "/account";
```

`next` is a *return destination*, not a step. There is no `step` parameter at
all, so no auth state is addressable by URL and the `account-conflict` state
has no route representation.

The `safeNext` guard itself is correct — `/^\/(?!\/)/` rejects both absolute
external URLs and protocol-relative `//evil.com`. It is, however, **untested**:
neither `lib/phoneAuth.test.ts` nor `lib/otpFlow.test.ts` asserts it, so an
open-redirect regression would ship silently. That is tracked as invariant 13
in [`domain-invariants.json`](./domain-invariants.json).

### 3.3 `/api/build` misreports the route count

The deploy-truth endpoint advertises `canonicalRoutes: 42` and
`totalScreens: 74`. The tree has 58 page routes. Since this endpoint is what
every deploy assertion compares against, a stale self-description undermines
the one contract that is supposed to be beyond doubt.

## 4. Non-blocking observations

- **`/qa` and `/styleguide` are publicly routable.** `/styleguide` is the
  sanctioned design-system surface (moved here from the legacy SPA). `/qa` has
  no declared owner in any contract document and is reachable in production.
- **`/corporate` and `/corporate-wellness` are separate top-level routes** with
  overlapping intent, plus `/team`, `/partners/{gyms,fitness-clubs,dietitians}`
  and `/rd-partners` — 11 B2B acquisition routes with no shared shell. See
  [`layout-contracts.md`](./layout-contracts.md) §4.
- **`/marketplace` is global but `/marketplace/[slug]` is focus.** This is
  deliberate and encoded in `isFocusRoute`'s one special case, not an accident.
- **`/subscription/bridge` is listed in `STITCH_EXACT_ROUTES`** but has no
  `page.tsx`. It is a dark-canvas declaration for a route that does not exist.

## 5. What holds

- All 58 routes resolve to a real `page.tsx`; there are no orphan declarations
  other than `/subscription/bridge` noted above.
- The 16-rule redirect table is the *single* redirect surface — no scattered
  per-route redirects. Waves add here.
- Dynamic segments are consistently named and typed;
  `noUncheckedIndexedAccess` is on and `e2e/specs/**` is typechecked.
- No route is served from the quarantine tree
  ([`legacy-quarantine.md`](./legacy-quarantine.md)).
