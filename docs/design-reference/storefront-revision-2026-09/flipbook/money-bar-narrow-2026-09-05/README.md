# Checkout pay bar on narrow iPhones + Account sheet (2026-09-05)

Owner report: the money path renders wrong on mobile, Apple viewports especially; the bottom-nav
"Account" tab has a bug.

## Pay bar (`components/checkout/AlacartePayBar.tsx`)

The CTA carried `min-w-64` (256px) at every width. On a 375px iPhone (SE 2/3, 12/13 mini, X/XS/11 Pro)
the "Payable now" column was squeezed to 75px and the label wrapped to three lines; at 320px the
column was 20px and **the payable amount itself was clipped behind the button**. Now the amount
column is `shrink-0` with a nowrap label and the CTA takes the remaining width (`flex-1`, `px-4`);
from `sm` up it keeps its fixed 16rem so a changing label never resizes it under a thumb.

| before | after |
|---|---|
| `before/pay-bar-320.png` — amount clipped to 20px, label on three lines | `after/pay-bar-320.png` — label one line, amount whole, CTA 189px |
| `before/pay-bar-375.png` — label wrapped, column 75px | `after/pay-bar-375.png` — label one line, CTA 244px |
| `before/pay-bar-390.png` — one line, tight | `after/pay-bar-390.png` |

Measured on production before / the prod build after, 320–430px: label 15px tall at every width,
amount never clipped, CTA ≥44px, no overlap, no horizontal overflow.

## Account sheet (`components/MobileBottomNav.tsx`)

The Company & Legal links were 32px tall (under the 44px gate) and the sheet had no explicit Close
(drag handle, scrim tap or back gesture only — CartDrawer gained one under T-01, this sheet had not).
Links now `min-h-11`; a 44px Close sits beside the title.

| before | after |
|---|---|
| `before/account-sheet-375.png` | `after/account-sheet-375.png` |
