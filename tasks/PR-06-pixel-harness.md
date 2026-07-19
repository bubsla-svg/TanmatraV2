# PR-06 · Pixel-fidelity harness (S5)

**Blast radius: low.** CI-only. No production code changes.

## Objective

Make "pixel-perfect" a passing test instead of an opinion. Three checks per screen against a manufactured reference.

## Context

Full rationale in `docs/pixel-pipeline.md`. The key move: the diff target is **not** the raw Stitch export (that would ship the forbidden Nocturnal palette) but a mechanically re-tokened reference produced by `tools/stitch_retoken.py`. Geometry survives the transform; only the skin changes. Proof: `docs/references/checkout-93-tnm2-reference.html` and its render comparison.

## Steps

1. **Reference generation.** Add an npm script wrapping the transformer:
   `npm run stitch:reference -- IN.html OUT.html`
   Output lands in `docs/references/`. References are committed (they're the target) but never imported by app code — add a CI check enforcing that.
2. **Harness.** Playwright job, per screen × two viewports (390, 780):
   - **Pixelmatch** implemented route vs reference. Threshold ≤1.5% differing pixels, antialiasing tolerance on.
   - **Geometry budget.** Compare the DOM-rect tree — every box within ±2px. This catches structural drift that pixel noise hides.
   - **Token lint on computed styles.** Zero Nocturnal hexes (CLAUDE.md §2 list), zero non-`.tnm2` fonts in the rendered output.
   All three must pass for a screen to be considered matched.
3. **Deterministic rendering.** Fixed seed data, fonts preloaded, animations disabled, `prefers-reduced-motion` forced, network stubbed. A flaky pixel test is worse than none.
4. **Spec extractor** (`tools/stitch_spec.py`). Parse an export's Tailwind classes into a layout contract: section order, spacing values on the 8px grid, radii, type scale, breakpoint behavior. Emit JSON per screen. Run it over the canonicals marked SHIP/REF in `docs/stitch-screen-census.csv`.
5. **Divergence ledger.** `docs/pixel-divergence.md` — every intentional delta gets a line (screen, what, why, approver). CI fails a screen whose diff exceeds threshold **without** a matching ledger entry.
6. **First subject: checkout.** Wire the reference that already exists, get it green or get an honest number, and record the baseline.

## Acceptance criteria

- [ ] `npm run stitch:reference` regenerates any reference deterministically.
- [ ] Harness runs in CI beside the price-authority suite.
- [ ] Introducing a 4px padding change locally turns the geometry check red (prove it).
- [ ] Introducing `#fbbf24` locally turns the token lint red (prove it).
- [ ] Ledger schema is in place with at least the known pre-approved divergence classes (pipeline §5) recorded.
- [ ] Zero flaky runs across 5 consecutive CI executions.

## Verify

```bash
npm run test:pixel
npm run test:pixel -- --update-baselines   # explicit, never automatic
```

## Notes

Baselines never update implicitly. A changed baseline is a reviewed decision with a ledger line.
