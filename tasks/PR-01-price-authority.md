# PR-01 · Server price authority (W1)

**Blast radius: MAXIMUM.** This is the money path. Read before you write. Restate the plan and wait for approval before editing.

## Objective

No client-computed amount ever reaches an order or Razorpay. The server recomputes every total from its own catalog and tax rules; the client displays and, on mismatch, blocks.

## Context

Today Razorpay order creation uses client-supplied amounts with no verified server-side revalidation. A tampered cart, a stale price after a Petpooja sync, or a rounding drift all reach payment unchallenged. This blocks everything else money-shaped — PR-07 and PR-09 depend on it.

Working reference for the blocked state: `docs/prototypes/storefront.html` → dev strip → **price-tamper demo**. Tamper a line, go to Payment, observe: Pay disabled, alert notice states both figures, "Refresh cart" re-syncs. Match that behavior.

## Scope

**In:** quote/create endpoints, server tax + delivery + voucher computation, client mismatch handling, regression tests.
**Out:** checkout UI restructure (that's PR-09), subscription/mandate pricing (PR-07), voucher *design* changes.

## Steps

1. **Audit first.** Trace every path that reaches Razorpay order creation. Document each entry point in the PR body before changing anything.
2. **`POST /orders/quote`** — accepts line items as `{sku, qty, mods[]}` **only**. No prices accepted from the client, ever. Server computes:
   - item prices from the server catalog (Petpooja-synced source of truth)
   - GST from the tax table — 5% prepared food; do not hardcode, and do not reintroduce the 18% bug
   - delivery rules and any voucher, validated server-side (existence, eligibility, expiry, single-use)
   - returns a signed/short-TTL quote token plus the itemized breakdown
3. **`POST /orders/create`** — accepts a quote token, revalidates it server-side (not trusting its contents), and creates the Razorpay order with the **server** amount. Reject expired or mutated quotes.
4. **Client** — cart line prices are display-only. Before Pay, fetch a quote; if the server figure differs from the displayed total, block Pay with the alert pattern (icon + text, both figures shown, explicit re-sync action). Never silently overwrite the displayed price and proceed.
5. **Telemetry** — emit `pay_blocked_price_mismatch` with both figures and the SKU set.

## Acceptance criteria

- [ ] No code path constructs a Razorpay amount from a client-supplied number. Grep proves it.
- [ ] Mutating a cart line price client-side results in a blocked Pay, not a cheap order.
- [ ] Quote tokens expire; a replayed or edited token is rejected.
- [ ] GST is 5% for prepared food, read from the tax table, covered by a test.
- [ ] Voucher validation is server-side; a fabricated code fails.
- [ ] Blocked state renders icon + text and an explicit re-sync action; Pay is disabled **with a visible reason**.
- [ ] Existing checkout flows still complete end-to-end on staging.

## Verify

```bash
npm run test           # unit: quote math, tax table, voucher validation
npm run test:e2e       # mutation tests against staging
```

Wire the mutation tests from the existing audit harness into CI as the standing regression gate. If that harness isn't present, build the three cases here: tampered line price, replayed quote token, expired quote.

## Notes

If any part of the current flow can't be made server-authoritative without a schema change, **stop and report** rather than working around it.
