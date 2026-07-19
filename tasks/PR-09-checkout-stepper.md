# PR-09 · Checkout stepper refactor

**Blast radius: MAXIMUM.** The money path, inside the heaviest file in the repo. Restate the plan and wait for approval. Depends on PR-01 and PR-03.

## Objective

Impose the Review → Delivery → Payment stepper on checkout without destabilizing what already works.

## Context

`Checkout.tsx` is ~2,599 LOC and holds load-bearing Razorpay plumbing. **Refactor inside it.** A rewrite trades a known-imperfect flow for an unknown one on the surface that takes money — that trade is not available.

Historical P0s on this surface: silent click absorption on checkout with no address (an enabled button that did nothing), and a GST rate discrepancy. Both are fixed; neither may return.

Interaction spec: `docs/prototypes/storefront.html` → `/checkout` (13 of 15 frames wired, including the guest OTP flow and the disabled-with-reason states). Pixel canonicals: `93`, `168`, `4`, and the address set `189`/`125`/`161`.

## Steps

1. **Map before touching.** Document the current component's state, effects, and Razorpay call sites in the PR body. Identify what is safe to move and what must stay put.
2. **State machine.** Formalize `step ∈ {review, delivery, payment}` × `phase ∈ {phone, otp, address, pay, processing, failed}`. Port the prototype's transitions verbatim — they're the spec.
3. **Review step.** Line items with quantity controls, itemized bill (item total, GST 5%, delivery), server-verified subtotal from PR-01.
4. **Delivery step.** Guest-first phone entry → 6-box OTP (WebOTP autofill in production) → address selection → now/schedule toggle with slot chips. Capacity-aware slots where the data supports it (Stitch `17`).
5. **Disabled states carry reasons.** No address selected → Continue disabled **with a visible line** stating why. No slot picked when scheduling → same. Never an enabled control that absorbs the click.
6. **Payment step.** UPI intent-first with app affordances, cards/netbanking secondary, tip chips, voucher field. The 68px sticky Pay bar with **one quiet trust line directly above it** — FSSAI number, ISO 22000, RD-formulated. Server figure drives the Pay amount (PR-01).
7. **Failure states.** Payment failed: money-is-safe reassurance, auto-reversal window, retry and change-method paths. Processing: explicit "don't close this screen" with the order reference.
8. **Cold-load.** Confirm the prerender fix from PR-02 holds for this route after refactor.

## Acceptance criteria

- [ ] Every existing checkout completion path still completes on staging — regression tested before and after.
- [ ] No enabled control absorbs a click anywhere in the flow.
- [ ] Every disabled control shows a reason.
- [ ] GST renders 5% for prepared food, sourced from the tax table.
- [ ] Pay amount equals the server quote; mismatch blocks (PR-01 behavior intact).
- [ ] OTP: paste, autofill, resend, and wrong-code paths all handled.
- [ ] Trust strip appears exactly once, directly above Pay.
- [ ] Keyboard-navigable end to end with visible focus.

## Verify

```bash
npm run test
npm run test:e2e   # full money path + every disabled-reason assertion
```

Run the mutation tests from PR-01 again after the refactor. They must still be green.

## Out of scope

`/account/addresses` (designs complete, separate brief). Voucher wallet. Any visual change to cart.
