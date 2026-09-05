# Audit fixes — 2026-09-05

Three layout-only fixes from the e2e frontend audit (393/320px). `after/` vs `before/`, same frame each.

| Frame | Before | After |
|---|---|---|
| `drawer-upsell-667` | cart drawer at 393×667 with a forced 3-item upsell rail: the order list is starved to 67px of 158px, first line clipped | one scroll region for orders + rail: every order line visible on open, rail scrolls after them, footer pinned |
| `b2b-header-393` | `(b2b)` shell header at 393: wordmark breaks across lines, "Explore meals" pill wraps, 20px links; overflows to 354px at 320 | header wraps to a second row below `sm`; wordmark + pill on one line; 44px hit-areas; no overflow at 320 on all six routes |
| `wellness-tabs-393` | six wellness-hub tabs at 38px | 44px |

The drawer frames use a mocked marketplace catalog to force the rail (the sandbox's dead API otherwise hides the bug entirely — which is why the first audit pass, captured with an empty cart, missed it).
