# PR-04 · Menu CLS fix (W4)

**Blast radius: low.** Isolated to the menu grid's mount sequence.

## Objective

Menu page CLS below 0.1, measured on the throttled harness. Current: 0.44–0.48.

## Context

The cause is card-grid mount-after-paint: the shell paints, then cards hydrate into an unreserved area and shove everything down. The fix is the skeleton doctrine — **skeleton geometry must equal final geometry**, so hydration swaps content into boxes that already exist.

Working reference: `docs/prototypes/storefront.html` → `/menu`. The skeleton renders fixed-height card boxes in the same paint as the shell; cards hydrate into identical boxes; the featured card and every row reserve their aspect ratios. Port that pattern, not just its appearance.

## Steps

1. **Measure first.** Record current CLS at 375×812 throttled. Put the number in the PR.
2. **Reserve the grid.** Grid container plus fixed-height card skeletons render in the **same paint** as the shell — not in an effect, not after a fetch.
3. **Match geometry exactly.** Skeleton card height, gap, padding, and radius equal the real card's. Any mismatch is the bug re-entering.
4. **Reserve image boxes.** Every dish image gets an explicit aspect ratio (1:1 for row thumbs, 16:10 for the featured card). Images load into reserved space.
5. **Filter changes must not reflow the page.** Applying a filter swaps cards inside the existing grid; the header, filter row, and CTA stay put.
6. **Empty-filter state** occupies a reserved block, not a collapse.
7. Check `/dish/:slug` and `/` for the same pattern while you're here — if the same mount-after-paint exists, note it for a follow-up rather than expanding this PR.

## Acceptance criteria

- [ ] Menu CLS < 0.1 at 375×812, throttled, cold cache.
- [ ] Skeleton and hydrated card bounding boxes match within ±2px (assert it).
- [ ] Applying and clearing a filter produces no layout shift above the grid.
- [ ] No image loads without reserved space.
- [ ] `prefers-reduced-motion` disables the shimmer.

## Verify

```bash
npm run test:e2e   # CLS budget assertion on /menu
```

Use the throttling profile from the Core Web Vitals audit harness so numbers are comparable to the baseline.

## Out of scope

Menu visual redesign, filter logic, the featured-card treatment (that arrives with PR-06's reference work). Geometry and mount sequence only.
