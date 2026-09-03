# Printed-code acquisition — scan to paid

A QR on a delivery box, a gym standee or a flyer, and the shortest path from
that scan to a paid trial. This is the record of how the pieces fit, what each
one refuses to do, and how to read the scoreboard.

## The journey

| Step | Where | What it does |
|------|-------|--------------|
| 0. The code | `app/q/[src]/route.ts` | Resolves the printed code, logs the scan, 302s to the landing with `?src=` |
| 1. Proof, then one field | `app/(focus)/start/page.tsx` | Three dishes with photos and macros, the all-in price, the delivery window — then a PIN code |
| 2. One decision | `components/start/QrStart.tsx` | Veg / non-veg, then a single CTA into checkout |
| 3. The ask | `components/checkout/plan/PlanCheckout.tsx` | Phone → OTP → address (PIN prefilled) → allergens |
| 4. Pay | same | Server-priced total, Razorpay sheet over the summary |
| 5. Done | `app/(focus)/order/confirmed/[orderId]/page.tsx` | Status, then the customer's own `/r/<code>` link |

Steps 3–5 are the EXISTING plan/trial checkout, unchanged. The QR flow hands
off to `/checkout?plan=trial_3day&track=…`; it does not fork the money path.

## Why the printed URL is uppercase

Print `HTTPS://TANMATRA.FOOD/Q/BOX`, not the lowercase form.

QR has an **alphanumeric mode** whose character set is digits, uppercase A–Z and
a few symbols. Lowercase letters force byte mode, which packs fewer characters
per module and produces a denser symbol. The uppercase URL therefore encodes to
a **lower-density code that scans smaller and from farther away** — the
difference between a poster that works across a gym and one you have to walk up
to.

URL paths are case-**sensitive** per RFC 3986, so `/Q/BOX` matches no route on
its own. Two things fix that, and both are deliberate:

- `middleware.ts` **rewrites** (not redirects) `/Q/BOX` → `/q/box` via
  `canonicalScanPath`. A rewrite keeps the scan at exactly one hop.
- `normalizeQrCode` folds the code itself, in the storefront
  (`lib/qrPlacement.ts`) and again in the api-server (`routes/qr.ts`).

Always print `tanmatra.food` as text under the code: it is a trust cue, and the
fallback when a scan fails.

## Placements

Codes are rows, not constants. `/q/box` and `/q/gym12` can be repointed at a new
landing without reprinting anything already stuck to a wall.

```bash
pnpm --filter @workspace/scripts run qr-placements                                     # list, with scan counts
pnpm --filter @workspace/scripts run qr-placements -- --add box --label "Box sticker"
pnpm --filter @workspace/scripts run qr-placements -- --add gym12 --label "FitLife Sec-12" --to "/start?src=gym12"
pnpm --filter @workspace/scripts run qr-placements -- --retire gym12
```

Re-adding an existing code repoints it and un-retires it. Codes are **retired,
never deleted** — a retired row keeps its scan history, which is the only way to
tell "that poster stopped working" from "that poster was never counted".

## Getting the artwork

```bash
pnpm --filter @workspace/scripts run qr-placements -- --qr box --distance 4
# → qr/box.svg   (vector — the same file is a 3 cm sticker and a 40 cm standee)
# → qr/box.png   (1024 px, for decks and WhatsApp)
```

Flags: `--distance <m>` (prints the minimum width for that scan range),
`--ecc L|M|Q|H` (default M), `--out <dir>` (default `qr/`), `--origin <url>`
for a staging host.

No database needed — a missing placement row is a warning, not a refusal.
Making artwork is a design-desk task, and requiring production credentials to
draw a square is how a lowercase or typo'd URL ends up on 5,000 printed boxes
via some random online generator instead.

Three things decide whether a print run works:

- **Width.** A symbol scans from roughly **10× its own width**. 4 m across a
  gym → print it at least **40 cm** wide. The tool computes this; it rounds up,
  because a code slightly too large still scans and one slightly too small
  fails invisibly until the posters are on the wall.
- **The quiet zone.** The 4-module white margin is required by the QR spec, not
  decoration. Butting the code against dark artwork to save space is the single
  most common way a print run is wasted. The generated SVG already includes it —
  do not let a designer crop it off.
- **The text underneath.** Print `tanmatra.food` as readable text below every
  code. Trust cue, and the fallback when the scan fails.

Verified end to end: the generated PNG decodes (jsQR) to
`HTTPS://TANMATRA.FOOD/Q/BOX`, which as a request path returns
`302 → /start?src=box` with `tnm_src` set.

**No code ever 404s.** Unknown, retired, mistyped, or resolved while the
api-server was unreachable — all of them land on `/start`, which sells the same
offer. Marketing links are covered by Law 10 too.

**Destinations are validated at the redirect**, not at the write:
`isSafeDestination` accepts same-origin absolute paths only, so a row reading
`//evil.example` (a protocol-relative URL wearing a path) cannot turn an
operator's typo into an open redirect.

## Referrals

`tanmatra.food/r/<code>` → `/start?src=referral&ref=<CODE>`. No api-server call
on the redirect: a referral code has nothing to resolve, and the share link is
the one URL people forward over WhatsApp, so it stays the fastest hop here.

The landing then reads `GET /api/referral/offer/:code` and states the offer with
the **server's** figure (`getLoyaltyConstantsSnapshot()` — the same number the
redemption row is written with). It returns the referrer's first name and
nothing else, rate-limited to 20/min so it cannot become a name-harvesting
oracle over the 8-hex code space.

`src=referral` is stamped so word of mouth appears on the same scoreboard as
paid print.

> **The referral card names when the credit lands, and does not discount the
> trial.** The loyalty engine releases the referee's credit inside
> `finalizeOrder`, on their first qualifying order — so a struck-through price
> on this landing would describe a discount that does not exist at this
> checkout. Making it an upfront discount is a pricing decision, not a UI one:
> grant the referee credit at `POST /referral/redeem` time instead, and the
> existing quote → `creditAppliedPaise` → `payableTotalPaise` machinery shows
> and charges the lower number with no new pricing code. See
> `artifacts/api-server/src/routes/loyalty.ts`.

## The scoreboard

One funnel per `src`. The denominator lives in `qr_scans` (written server-side,
because a visitor who bounces off the landing runs no client code); every later
step is a `funnel_events` row carrying the same `src` in `props`, stamped
centrally by `emitFunnel`. `session_id` joins the two.

```sql
-- scans → pincode → phone → paid, per placement, last 30 days
with scans as (
  select code as src, count(*) as scans
  from qr_scans
  where created_at > now() - interval '30 days'
  group by 1
),
steps as (
  select
    props->>'src'                                              as src,
    count(*) filter (where name = 'qr_pincode_serviceable')     as pincode_ok,
    count(*) filter (where name = 'identity_verified')          as phone,
    count(*) filter (where name = 'checkout_complete')          as paid
  from funnel_events
  where created_at > now() - interval '30 days'
    and props->>'src' is not null
  group by 1
)
select
  coalesce(scans.src, steps.src) as src,
  scans.scans, steps.pincode_ok, steps.phone, steps.paid,
  round(100.0 * steps.paid / nullif(scans.scans, 0), 2) as scans_to_paid_pct
from scans full outer join steps on steps.src = scans.src
order by scans_to_paid_pct desc nulls last;
```

Read it as a ratio, not a count. A poster with many scans and no `pincode_ok`
is in an unserved sector; a poster with many `pincode_ok` and no `phone` has a
creative or an offer problem. Those two failures look identical in a scan count
and have opposite fixes — which is why `qr_pincode_unserviceable` is counted
separately rather than folded into "drop-off".

Kill the losers, reprint the winners: the codes are rows, so the winner's URL
does not change when you reprint it.

## What is deliberately NOT here

- **No app-install prompt and no interstitial.** The single most expensive thing
  a cold landing can do is ask a scanner to install something.
- **No menu on the decision screen.** The trio is fixed (02e §3.5). Handing a
  cold scanner 95 dishes to browse is where they leave.
- **No delivery-window picker.** The plan create path books one window
  (`PLAN_DELIVERY_WINDOW`). Offering a choice it cannot honour would be a false
  promise, so the window is stated, not selected.
- **No back button on `/start`.** It is an ENTRY route: `router.back()` targets
  the `/q` redirect that sent the visitor here, which 302s straight forward
  again. Law 3 is satisfied by a forward exit instead ("Browse the full menu"),
  and `lib/focusRouteBack.test.ts` enforces exactly that for entry routes.
