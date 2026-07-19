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

Add new rows at the bottom. Never delete a row — supersede it with a new entry referencing the old date.
