# Pixel Divergence Ledger

Every intentional delta between an implemented route and its pixel reference gets a line here. CI fails a screen whose diff exceeds threshold **without** a matching entry. An undocumented delta is a defect; a documented one is a decision.

Schema: `date | screen ref | route | what diverges | why | class | approver`

## Pre-approved divergence classes

| Class | Meaning | Needs a line? |
|---|---|---|
| `data` | Real content widths differ from mock placeholders (₹ amounts, live dish names, RD names) | No — inherent |
| `law` | A CLAUDE.md §2 law overrides the mock (macro gating, trust strip placement, disabled-with-reason) | **Yes** |
| `states` | Standard Four states the mock doesn't show; skeleton geometry matched to final | No — required |
| `a11y` | Focus rings, ≥44px targets, contrast corrections the mock undershoots | No — required |
| `icon` | Inline SVG substituted for Material Symbols at identical metrics | No — inherent |
| `product` | A deliberate product decision that departs from the design | **Yes** |

Classes marked **Yes** require a ledger line before the screen can ship.

## Entries

| Date | Screen ref | Route | What diverges | Why | Class | Approver |
|---|---|---|---|---|---|---|
| 2026-07-19 | 8 (PDP hero) | `/dish/:slug` | Hero glass chips carry RD badge + allergen only; mock shows kcal/macros | Macro gating law — macros unreachable before Goal Fit | `law` | Chandan |
| 2026-07-19 | 93 (checkout) | `/checkout` | Trust strip is one line directly above Pay; mock renders it as a block | Trust strip law | `law` | Chandan |
| 2026-07-19 | 49, 40, 58 | various | Currency ₹ with Indian formatting; mocks show `$` | Market | `product` | Chandan |
| 2026-07-19 | 58 | order history | Brand reads TANMATRA; mock shipped as NUTRIENG | Stitch brand drift | `product` | Chandan |
| 2026-07-19 | 70, 116, 173, 126 | various | Claim language rewritten | No-cure-claims law | `law` | Chandan |
| 2026-07-19 | 93 (checkout) | `/checkout` | PR-06 pixel-fidelity harness does not diff `/checkout` against the Stitch reference (`checkout-93-tnm2-reference.html`) — raw Tailwind/Material markup (`text-on-background`, etc.) has no reliable 1:1 DOM-structure mapping to the live `.tnm2` component tree, so a rect-for-rect or screenshot diff against it would compare two unrelated layout systems, not catch real regressions. `e2e/specs/pixel_fidelity.spec.ts` instead does self-regression protection: committed baselines (screenshot PNGs + landmark geometry JSON) taken from the live route's own current rendered state, enforced ±1.5% pixel ratio / ±2px geometry on every future run. True pixel-parity against the Stitch mock remains unverified by CI; a full parity pass would require either hand-authoring the reference in `.tnm2` markup or a semantic (non-DOM) visual diff tool. The harness's forbidden-palette token lint also surfaced pre-existing Nocturnal-palette hex (`#e2e2e2`, `#c6c6c7`, `#fbbf24`) still resolving on `/checkout` computed styles — logged here as known debt (baselined in `checkout-forbidden-color-baseline.json` so only *new* forbidden-color regressions fail CI) since fixing it is production-code work out of scope for this CI-tooling PR. | `product` | Chandan |

Add new rows at the bottom. Never delete a row — supersede it with a new entry referencing the old date.
