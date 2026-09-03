# Task Index — sequenced PR queue

One brief = one session = one PR. Do not run them in parallel across the same files.
Sequence follows Wiring Guide §5: money integrity and dead-route cleanup before any redesign traffic.

| PR | Brief | Workstream | Sprint | Depends on | Blast radius |
|---|---|---|---|---|---|
| 01 | `PR-01-price-authority.md` | W1 | 1 | — | **Max** (money) |
| 02 | `PR-02-route-hygiene.md` | W6 | 1 | — | Medium |
| 03 | `PR-03-tokens-and-a11y.md` | W5 | 2 | 02 | Medium |
| 04 | `PR-04-menu-cls.md` | W4 | 2 | 03 | Low |
| 05 | `PR-05-pdp-plan-first.md` | — | 2 | 03, 04 | Medium |
| 06 | `PR-06-pixel-harness.md` | S5 | 2 | 03 | Low (CI only) |
| 07 | `PR-07-plan-layer.md` | W2 | 3 | 01 | **Max** (money) |
| 08 | `PR-08-plans-screen.md` | — | 3 | 07 | Medium |
| 09 | `PR-09-checkout-stepper.md` | — | 4 | 01, 03 | **Max** (money) |
| 10 | `PR-10-coach-anon.md` | W3 | 4 | — | Medium (safety) |
| 11 | `PR-11-mobile-first-restyle.md` | UX | 5 | 03, 06 | Medium per PR (series; presentation only, see `docs/MOBILE-FIRST-CX-BRIEF.md`) |

**Critical path:** 01 → 07 → 09. Everything else can slip without blocking revenue integrity.

**Not in this queue** (parked or reference-complete, per register §2): `/account/addresses` (designs complete, Wave-2, brief when scheduled), order history (needs brand/currency fix first), wellness suite, RD partner funnel, corporate/B2B, kitchen ERP, admin consoles.

## Session opener (paste into Claude Code)

```
Read CLAUDE.md, then tasks/PR-01-price-authority.md.
Before editing: verify the repo topology claims in CLAUDE.md §3 against the actual tree
and report any drift. Then restate the plan as a checklist and wait for my go.
```

Keep the "restate and wait" step for every brief on the money path. For low-blast-radius briefs you can let it run straight through.
