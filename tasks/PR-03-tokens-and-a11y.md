# PR-03 · Token bind, lint gates, focus rings (W5)

**Blast radius: medium.** Touches every storefront surface via tokens. Visual regression risk; pair with screenshots in the PR.

## Objective

Finalize `.tnm2` token values, turn on the gates that keep them, and fix the two silent failures the design audit found.

## Context

Two known silent failures: **undefined `--color-alert-*` tokens** on safety-relevant components (a nutrition app rendering an allergen warning in an undefined color is a safety defect, not a cosmetic one), and **missing `:focus-visible` rings** on storefront primitives. Both prototypes ship correct versions — diff against them.

## Steps

1. **Finalize the palette.** Confirmed: action saffron `#E89A3E`, alert `#DC8773`. Placeholders needing real values from `theme.css`: `--tnm-surface-ink`, `--tnm-surface-ink-2`, `--tnm-surface-ink-3`, `--tnm-sage`, `--tnm-caution`. If `theme.css` doesn't define them, **ask** — do not invent values.
2. **Fix alert tokens.** Define `--color-alert-*`, or migrate `ConflictsPanel` (and anything else using them) to `--tnm-alert`. Verify every caution/alert surface renders with **icon + text**, never color alone.
3. **Focus rings.** `:focus-visible` on all storefront primitives — buttons, links, inputs, chips, cards-as-buttons. 2px saffron, 2px offset. Keyboard-traverse the money path and confirm every stop is visible.
4. **Turn on the gates:**
   - stylelint: reject raw hex/rgb/hsl in components
   - grep gate: reject the named-hex list from CLAUDE.md §2 law 2 (both the superseded homepage palette and the Stitch Nocturnal palette)
   - grep gate: reject `₹[0-9]` literals in components
5. **Fix what the gates surface.** Expect a batch of violations. Fix them; do not add ignore comments without a written reason in the PR.
6. **Verify mono numerals.** Every numeral on storefront routes goes through the `tnm-data` utility with `tabular-nums`.

## Acceptance criteria

- [ ] Zero placeholder token values remain in shipped CSS.
- [ ] `--color-alert-*` resolves everywhere it's referenced, or its consumers are migrated.
- [ ] Every interactive storefront element has a visible focus ring; keyboard traversal of `/menu → /dish → /cart → /checkout` never loses focus.
- [ ] All three gates run in CI and fail on a deliberately introduced violation (prove it in the PR).
- [ ] Contrast: text on ink surfaces ≥ 4.5:1; verify sage/caution/alert against their backgrounds.

## Verify

```bash
npm run lint
npm run test:e2e   # a11y assertions
```

Add one deliberate violation locally, confirm CI red, revert. Include that evidence in the PR.

## Out of scope

Layout changes. This is color, focus, and enforcement only.
