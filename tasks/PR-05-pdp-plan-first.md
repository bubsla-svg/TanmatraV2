# PR-05 · Plan-first PDP

**Blast radius: medium.** Conversion-critical surface, allergen-safety logic inside. The allergen path is maximum rigor.

## Objective

Replace the à-la-carte PDP with the plan-first, macro-gated PDP. This is the primary lever on menu-to-cart conversion (28.1% vs ~46% peer benchmark).

## Context

Canonical spec: `docs/prototypes/pdp-plan-first.html` — all 9 frames wired and reachable. Condensed in-app version: `docs/prototypes/storefront.html` → `/dish/:slug`. Pixel reference (once PR-06 lands): generate from Stitch canonicals `166` (structure), `8` (hero), `16` (gauges), `27`/`115` (allergen).

The live PDP currently shows macros up front and CTAs "Customise / Add to Order." Target: macros gated behind Goal Fit, CTA bar "Add to Plan" (saffron primary) / "Add once ₹—" (ghost secondary).

## Steps

1. **Gate the macros.** Locked state shows a blurred ghost ribbon plus a "See how this fits your goal" entry. Unlocked state shows the real ribbon with per-macro status chips (within range / near boundary), each with icon + text.
2. **Goal Fit flow.** Goal + allergen capture; persist `goalFitProfile {goal, allergens[]}` server-side per account with local cache. `unlocked` is **derived** (`profile != null`) — never a separate stored flag.
3. **One allergen selector.** Implement `allergenClash(dish, profile, mods)` as the single source feeding: header chip, ingredient flag, CTA message, and the Add block. Four surfaces, one function. Any divergence is a safety bug.
4. **Allergen consent gate.** An Add with an active clash opens the acknowledgment sheet — full declaration with flagged items in error tone, safe action ("Choose another dish") as **primary**, acknowledgment logged for kitchen visibility. Never silently allow, never silently block.
5. **Ring gauges.** 2px circular macro gauges in the unlocked panel, arc color following the status tone.
6. **In-place variant swap.** Variant changes are state updates, not navigation. Current implementation costs a 1.2–1.6s reload; target under 200ms with no layout shift.
7. **Reviewer block.** Credentialed RD reviewer, expandable to credentials and consult affordance.
8. **All 9 frames:** default-gated, goal-fit-entry, result-unlocked, modifier-sheet, allergen-flagged, added-to-plan-success, out-of-stock, loading-skeleton, reviewer-block-detail.

## Acceptance criteria

- [ ] Macros are not reachable in any state before Goal Fit completes — including hero chips, meta tags, and SSR payload.
- [ ] `allergenClash` is called by all four surfaces; no surface computes its own.
- [ ] With a flagged profile, Add opens the consent sheet; the safe action is primary.
- [ ] Variant swap completes in-place under 200ms, CLS 0.
- [ ] Skeleton geometry matches final geometry (same doctrine as PR-04).
- [ ] Out-of-stock state disables Add and offers Notify Me.
- [ ] Telemetry: `gate_unlock`, `add_to_plan`, `allergen_ack`.

## Verify

```bash
npm run test          # allergenClash unit tests incl. mods interaction
npm run test:e2e      # gating, consent sheet, variant swap timing, CLS
```

Explicit test: a tree-nut profile on Almond Chicken Salad must render the clash on all four surfaces and block a naive Add.

## Out of scope

Coach endpoint (PR-10), plan rotation membership (PR-07/08).
