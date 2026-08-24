# API rate limits

<!-- GENERATED FILE — DO NOT EDIT BY HAND.
     Source: artifacts/api-server/src/middlewares/rateLimitMiddleware.ts
             artifacts/api-server/src/app.ts
     Regenerate: pnpm run docs:rate-limits
     Verified in CI: pnpm run docs:rate-limits:check -->

Every number here is read out of the source at generation time. Do not edit
this file — change the limiter and regenerate, or the two will disagree and CI
will say so.

## How a bucket is keyed

Limiters are keyed on **client IP** by default. Authenticated and anonymous
callers therefore **share one counter per IP** — there is no separate, looser
or tighter tier for signed-in users. A few limiters override this to key per
user or per session where that matters; `orders:claim` is keyed per session
specifically so an attacker cannot buy more attempts by changing networks.

Two edge guards sit in front of all of this and are not per-scope:
`routeBurstGuard(30)` (30 req/s per IP per endpoint, disabled under
`NODE_ENV=test`) and `concurrencyGuardMiddleware(250)`.

## When the limiter itself cannot run

The store is Postgres. If the check throws — unreachable, statement timeout,
pool exhausted — each limiter resolves according to its **fail** column:

- **open** — admit the request. Correct for public reads: serving the menu
  through a database blip is worth more than the scraping it lets through.
- **closed** — answer `429` with `Retry-After`. Correct for money and
  mutating routes. Not because money is important, but because of a specific
  failure shape: a total outage is not the interesting case (the handler needs
  the same database, so the request was going to fail anyway), whereas partial
  degradation lets handlers keep partly working while the limiter throws —
  removing the brake exactly as a flood causes the degradation.

## Limits

| Scope | Mounted on | Max | Window | Fail | Export |
|---|---|---:|---|---|---|
| `public:menu` | `/api/menu`, `/api/dish` | 120 | 1 min | open | `publicMenuRateLimit` |
| `orders` | `/api/orders`, `/api/checkout`, `/api/subscriptions` | 30 | 1 min | **closed** | `orderRateLimit` |
| `ai:agent:customer` | `/api/coach-agent`, `/api/support-agent` | 20 | 1 min | open | `aiRateLimit` |
| `ai:agent:staff` | `/api/cms-agent`, `/api/ops-agent` | 20 | 1 min | open | `aiStaffRateLimit` |
| `ai:rationale` | `/api/dish-rationales` | 40 | 1 min | open | `rationaleRateLimit` |
| `plan:draft:create` | _route-level only_ | 10 _(default)_ | 1 min | open | `planDraftCreateRateLimit` |
| `plan:draft:mutate` | _route-level only_ | 120 _(default)_ | 1 min | open | `planDraftMutateRateLimit` |
| `plan:draft:generate` | _route-level only_ | 10 _(default)_ | 1 min | open | `planGenerationRateLimit` |
| `plan:draft:shuffle` | _route-level only_ | 20 _(default)_ | 1 min | open | `planShuffleRateLimit` |
| `plan:draft:read` | _route-level only_ | 120 _(default)_ | 1 min | open | `planDraftReadRateLimit` |
| `payments` | `/api/payments` | 10 | 1 min | **closed** | `paymentRateLimit` |
| `orders:claim` | _route-level only_ | 10 | 1 min | **closed** | `orderClaimRateLimit` |
| `client:error-report` | _route-level only_ | 30 | 1 min | open | `errorReportRateLimit` |
| `admin:moderation` | _route-level only_ | 60 | 1 min | open | `adminModerationRateLimit` |
| `user:addresses` | `/api/addresses` | 30 | 1 min | open | `addressRateLimit` |
| `corporate:inquiry` | _route-level only_ | 5 | 1 day | open | `corporateInquiryRateLimit` |

A refused request is rejected **before** the handler runs, so a 429 can never
have partially mutated anything.

`/api/payments/razorpay/webhook` is exempt from the payments limiter
entirely: it is authenticated by HMAC signature and arrives from Razorpay's own
small source-IP pool, so without the exemption every customer's payment
confirmation would share one browser-sized bucket.
