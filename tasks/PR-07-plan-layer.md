# PR-07 · Subscription plan layer (W2)

**Blast radius: MAXIMUM.** Recurring money plus mandates. Restate the plan and wait for approval before editing. Depends on PR-01.

## Objective

Build the subscription commerce layer the pillar rests on: plan entity, server-quoted pricing, Razorpay mandates, and the builder commit that creates them.

## Context

Petpooja has no recurring primitive — this layer is new. Per-meal prices in the prototypes are `[quote]` class placeholders: **server-quoted, never client literals**. Interaction spec: `docs/prototypes/storefront.html` → `/subscribe` (4-step builder) and the trial-bridge sheet in the dev strip.

Amendment A2 governs conversion: **nothing converts silently.** Explicit tap, explicit disclosure, and a same-VPA offer that is *labeled as a default*, never silently reused.

## Steps

1. **Entity.** `plan {id, userId, cadence, mealsPerDay, pref, goal, perMealQuote, slots[], pauses[], swaps[], status}`. Builder state stays throwaway until commit.
2. **Quoting.** Per-meal price comes from a server endpoint given (cadence × mealsPerDay × pref). Commitment discounts computed server-side. The client renders `[quote]` values and never derives them.
3. **Mandate.** Razorpay mandate for weekly and 6-week cadences. Trial is single-charge, **no auto-renewal**. Mandate creation is explicit, disclosed on-screen before the tap, and receipted.
4. **Endpoints:** create, pause, resume, skip (credit rolls forward), swap (validated against plan macro caps — a swap that breaches caps is rejected server-side, not just hidden in UI).
5. **Trial bridge (A2).** Recap → offer → explicit dual CTA. Same-VPA offered as a labeled default with a visible "change method" path. Telemetry: `trial_bridge_viewed`, `trial_bridge_cta`, `trial_bridge_outcome`.
6. **Builder commit.** The final CTA states the amount, the cadence, and the renewal behavior in the button or directly adjacent. Seeds the first week's rotation from the user's goal profile.
7. **Cancellation.** Self-serve, honoring the trial's no-lock-in promise. If a cancellation path can't be built in this PR, it must at minimum be discoverable and manual — never a dead end.

## Acceptance criteria

- [ ] No per-meal or plan-total price originates client-side.
- [ ] Trial creates no mandate and cannot auto-renew (test it).
- [ ] Mandate creation requires an explicit tap after a visible disclosure.
- [ ] Pause/skip/swap all enforce server-side; a crafted request that breaches macro caps is rejected.
- [ ] Skipped meal credits roll forward and are reflected in the plan's remaining balance.
- [ ] All three trial-bridge telemetry events fire.
- [ ] Razorpay failure modes handled: mandate rejected, mandate pending, webhook late/duplicate.

## Verify

```bash
npm run test        # quoting, cap validation, credit arithmetic
npm run test:e2e    # commit flow, trial→plan bridge, pause/skip/swap
```

## Notes

Open decisions D2–D5 from Checklist v1.2 must be closed before this PR's task cut. If any are still open when you start, **stop and say so**.
