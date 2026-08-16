# Frontend audit report

Routes audited: **9** · findings: **37**

| severity | count |
|---|---:|
| high | 5 |
| medium | 32 |

| probe | count |
|---|---:|
| `tap-target` | 34 |
| `cta-stacking` | 2 |
| `trailing-void` | 1 |

## `/`

- **[high] `tap-target`** — 81x16 — below the WCAG 2.2 AA 24px minimum: "View menu"
  - `a.font-bold.text-xs.text-primary`
- **[high] `tap-target`** — 328x20 — below the WCAG 2.2 AA 24px minimum: "Or see monthly plans"
  - `a.text-center.text-sm.font-semibold`
- **[medium] `tap-target`** — 74x28 — below the 44px comfort floor: "Tanmatra"
  - `a.inline-block.max-w-[7.5rem].overflow-hidden`
- **[medium] `tap-target`** — 36x28 — below the 44px comfort floor: "Search⌘K"
  - `button.flex.items-center.gap-2`
- **[medium] `tap-target`** — 380x24 — below the 44px comfort floor: "Can I change my plan or pause delive"
  - `button.flex.w-full.items-center`
- **[medium] `tap-target`** — 380x24 — below the 44px comfort floor: "Where do you deliver?+"
  - `button.flex.w-full.items-center`
- **[medium] `tap-target`** — 380x24 — below the 44px comfort floor: "How do the expert consultations work"
  - `button.flex.w-full.items-center`

<details><summary>7 console error(s)</summary>

- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`

</details>

<details><summary>12 failed request(s)</summary>

- `GET http://127.0.0.1:3210/menu?_rsc=5CB68i4pnAekjehf`
- `GET http://127.0.0.1:3210/menu?dish=aglio-olio-veg&_rsc=5CB68i4pnAekjehf`
- `GET http://127.0.0.1:3210/menu?dish=activated-charcoal-smoothie&_rsc=5CB68i4pnAekjehf`
- `GET http://127.0.0.1:3210/?_rsc=tXyZJ52UQVBCVsD3`
- `GET http://127.0.0.1:3210/menu?_rsc=ODuXsXs2XV8QunVV`
- `GET http://127.0.0.1:3210/menu?dish=aglio-olio-veg&_rsc=tXyZJ52UQVBCVsD3`
- `GET http://127.0.0.1:3210/menu?dish=activated-charcoal-smoothie&_rsc=tXyZJ52UQVBCVsD3`
- `GET http://127.0.0.1:3210/plan/desk_fuel?_rsc=5CB68i4pnAekjehf`
- `GET http://127.0.0.1:3210/plan/steady?_rsc=5CB68i4pnAekjehf`
- `GET http://127.0.0.1:3210/plan/desk_fuel?_rsc=tXyZJ52UQVBCVsD3`

</details>

## `/account`

- **[medium] `tap-target`** — 74x28 — below the 44px comfort floor: "Tanmatra"
  - `a.inline-block.max-w-[7.5rem].overflow-hidden`
- **[medium] `tap-target`** — 36x28 — below the 44px comfort floor: "Search⌘K"
  - `button.flex.items-center.gap-2`
- **[medium] `tap-target`** — 93x34 — below the 44px comfort floor: "Try again"
  - `button.mt-4.rounded-lg.border`

<details><summary>3 console error(s)</summary>

- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`

</details>

<details><summary>4 failed request(s)</summary>

- `GET http://127.0.0.1:3210/?_rsc=2h7RqkUd4R7tj9A_`
- `GET http://127.0.0.1:3210/menu?_rsc=2h7RqkUd4R7tj9A_`
- `GET http://127.0.0.1:3210/?_rsc=q9qeW4TLPSng93_h`
- `GET http://127.0.0.1:3210/menu?_rsc=Zw6JW8w70LpEEl5c`

</details>

## `/cart`

- **[medium] `trailing-void`** — 568px of empty space below the last painted element (a.inline-flex.shrink-0.items-center) — 0.7x viewport height
- **[medium] `tap-target`** — 116x36 — below the 44px comfort floor: "Back to cart"
  - `button.-ml-2.inline-flex.min-h-9`

<details><summary>2 console error(s)</summary>

- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`

</details>

<details><summary>2 failed request(s)</summary>

- `GET http://127.0.0.1:3210/menu?_rsc=a9Lu7oUMcKkSuDdI`
- `GET http://127.0.0.1:3210/menu?_rsc=sEIbRxFhDV_sJvqI`

</details>

## `/dish/cheese-omelette`

- **[high] `tap-target`** — 380x17 — below the WCAG 2.2 AA 24px minimum: "Nutrition"
  - `button.x9f619.x78zum5.x6s0dn4`
- **[high] `tap-target`** — 380x17 — below the WCAG 2.2 AA 24px minimum: "Ingredients"
  - `button.x9f619.x78zum5.x6s0dn4`

<details><summary>1 console error(s)</summary>

- `Failed to load resource: the server responded with a status of 404 (Not Found)`

</details>

<details><summary>1 failed request(s)</summary>

- `GET http://127.0.0.1:3210/menu?_rsc=Sfsi3ja7c0hTyg8K`

</details>

## `/faq`

- **[medium] `tap-target`** — 74x28 — below the 44px comfort floor: "Tanmatra"
  - `a.inline-block.max-w-[7.5rem].overflow-hidden`
- **[medium] `tap-target`** — 36x28 — below the 44px comfort floor: "Search⌘K"
  - `button.flex.items-center.gap-2`
- **[medium] `tap-target`** — 136x42 — below the 44px comfort floor: "Talk to an RD"
  - `a.shrink-0.rounded-full.border`

<details><summary>1 console error(s)</summary>

- `Failed to load resource: the server responded with a status of 404 (Not Found)`

</details>

<details><summary>4 failed request(s)</summary>

- `GET http://127.0.0.1:3210/?_rsc=QgfnF85fYcrwyI4V`
- `GET http://127.0.0.1:3210/menu?_rsc=QgfnF85fYcrwyI4V`
- `GET http://127.0.0.1:3210/?_rsc=wKPz8cjhDlzQ_BQw`
- `GET http://127.0.0.1:3210/menu?_rsc=idRFCYNHTuOXPa-u`

</details>

## `/menu`

- **[medium] `tap-target`** — 74x28 — below the 44px comfort floor: "Tanmatra"
  - `a.inline-block.max-w-[7.5rem].overflow-hidden`
- **[medium] `tap-target`** — 36x28 — below the 44px comfort floor: "Search⌘K"
  - `button.flex.items-center.gap-2`
- **[medium] `tap-target`** — 61x36 — below the 44px comfort floor: "✓All"
  - `button.inline-flex.min-h-9.items-center`
- **[medium] `tap-target`** — 55x36 — below the 44px comfort floor: "Veg"
  - `button.inline-flex.min-h-9.items-center`
- **[medium] `tap-target`** — 82x36 — below the 44px comfort floor: "Non-veg"
  - `button.inline-flex.min-h-9.items-center`
- **[medium] `cta-stacking`** — 4 primary CTAs visible at once: Add | Add | Add | Add

<details><summary>129 console error(s)</summary>

- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`

</details>

<details><summary>84 failed request(s)</summary>

- `GET http://127.0.0.1:3210/?_rsc=4bN2-IAdJYTqgAL8`
- `GET http://127.0.0.1:3210/menu?dish=aglio-olio-veg&_rsc=9sJMT9sa4syRWArk`
- `GET http://127.0.0.1:3210/menu?dish=aglio-olio-prawns&_rsc=9sJMT9sa4syRWArk`
- `GET http://127.0.0.1:3210/menu?dish=aglio-olio-chicken&_rsc=9sJMT9sa4syRWArk`
- `GET http://127.0.0.1:3210/menu?dish=activated-charcoal-smoothie&_rsc=9sJMT9sa4syRWArk`
- `GET http://127.0.0.1:3210/menu?dish=aglio-olio-veg&_rsc=4bN2-IAdJYTqgAL8`
- `GET http://127.0.0.1:3210/menu?dish=aglio-olio-prawns&_rsc=4bN2-IAdJYTqgAL8`
- `GET http://127.0.0.1:3210/menu?dish=aglio-olio-chicken&_rsc=4bN2-IAdJYTqgAL8`
- `GET http://127.0.0.1:3210/menu?dish=activated-charcoal-smoothie&_rsc=4bN2-IAdJYTqgAL8`
- `GET http://127.0.0.1:3210/menu?dish=alfredo-pasta-prawns&_rsc=9sJMT9sa4syRWArk`

</details>

## `/menu?dish=cheese-omelette`

- **[high] `tap-target`** — 93x20 — below the WCAG 2.2 AA 24px minimum: "Open full page"
  - `a.text-sm.font-medium.text-ink-muted`
- **[medium] `tap-target`** — 74x28 — below the 44px comfort floor: "Tanmatra"
  - `a.inline-block.max-w-[7.5rem].overflow-hidden`
- **[medium] `tap-target`** — 36x28 — below the 44px comfort floor: "Search⌘K"
  - `button.flex.items-center.gap-2`
- **[medium] `tap-target`** — 61x36 — below the 44px comfort floor: "✓All"
  - `button.inline-flex.min-h-9.items-center`
- **[medium] `tap-target`** — 55x36 — below the 44px comfort floor: "Veg"
  - `button.inline-flex.min-h-9.items-center`
- **[medium] `tap-target`** — 82x36 — below the 44px comfort floor: "Non-veg"
  - `button.inline-flex.min-h-9.items-center`
- **[medium] `cta-stacking`** — 6 primary CTAs visible at once: Add | Add | Add | Add | Open full page | Add

<details><summary>121 console error(s)</summary>

- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`
- `Failed to load resource: the server responded with a status of 404 (Not Found)`

</details>

<details><summary>174 failed request(s)</summary>

- `GET http://127.0.0.1:3210/menu?dish=aglio-olio-veg&_rsc=9sJMT9sa4syRWArk`
- `GET http://127.0.0.1:3210/menu?dish=activated-charcoal-smoothie&_rsc=9sJMT9sa4syRWArk`
- `GET http://127.0.0.1:3210/?_rsc=9sJMT9sa4syRWArk`
- `GET http://127.0.0.1:3210/menu?dish=aglio-olio-chicken&_rsc=4bN2-IAdJYTqgAL8`
- `GET http://127.0.0.1:3210/menu?dish=aglio-olio-veg&_rsc=4bN2-IAdJYTqgAL8`
- `GET http://127.0.0.1:3210/menu?dish=aglio-olio-prawns&_rsc=4bN2-IAdJYTqgAL8`
- `GET http://127.0.0.1:3210/?_rsc=4bN2-IAdJYTqgAL8`
- `GET http://127.0.0.1:3210/menu?_rsc=4bN2-IAdJYTqgAL8`
- `GET http://127.0.0.1:3210/menu?dish=alfredo-pasta-prawns&_rsc=9sJMT9sa4syRWArk`
- `GET http://127.0.0.1:3210/menu?dish=alfredo-pasta-veg&_rsc=9sJMT9sa4syRWArk`

</details>

## `/plans`

- **[medium] `tap-target`** — 74x28 — below the 44px comfort floor: "Tanmatra"
  - `a.inline-block.max-w-[7.5rem].overflow-hidden`
- **[medium] `tap-target`** — 36x28 — below the 44px comfort floor: "Search⌘K"
  - `button.flex.items-center.gap-2`
- **[medium] `tap-target`** — 120x36 — below the 44px comfort floor: "Just browsing →"
  - `a.-m-2.mt-2.self-center`
- **[medium] `tap-target`** — 112x36 — below the 44px comfort floor: "Talk to sales →"
  - `a.-m-2.mt-1.p-2`

<details><summary>1 console error(s)</summary>

- `Failed to load resource: the server responded with a status of 404 (Not Found)`

</details>

<details><summary>13 failed request(s)</summary>

- `GET http://127.0.0.1:3210/plan/desk_fuel?_rsc=ILPuZ0uu4ga-M9mi`
- `GET http://127.0.0.1:3210/plan/protein_build?_rsc=ILPuZ0uu4ga-M9mi`
- `GET http://127.0.0.1:3210/plan/glp1_companion?_rsc=ILPuZ0uu4ga-M9mi`
- `GET http://127.0.0.1:3210/menu?_rsc=ILPuZ0uu4ga-M9mi`
- `GET http://127.0.0.1:3210/?_rsc=ILPuZ0uu4ga-M9mi`
- `GET http://127.0.0.1:3210/plan/desk_fuel?_rsc=ljCYIAyZqeTTm3Xu`
- `GET http://127.0.0.1:3210/plan/glp1_companion?_rsc=ljCYIAyZqeTTm3Xu`
- `GET http://127.0.0.1:3210/plan/steady?_rsc=ljCYIAyZqeTTm3Xu`
- `GET http://127.0.0.1:3210/?_rsc=ljCYIAyZqeTTm3Xu`
- `GET http://127.0.0.1:3210/plan/steady?waitlist=1&_rsc=ILPuZ0uu4ga-M9mi`

</details>

## `/styleguide`

- **[medium] `tap-target`** — 74x28 — below the 44px comfort floor: "Tanmatra"
  - `a.inline-block.max-w-[7.5rem].overflow-hidden`
- **[medium] `tap-target`** — 36x28 — below the 44px comfort floor: "Search⌘K"
  - `button.flex.items-center.gap-2`
- **[medium] `tap-target`** — 145x38 — below the 44px comfort floor: "Compact Action"
  - `button.inline-flex.items-center.gap-2`

<details><summary>1 console error(s)</summary>

- `Failed to load resource: the server responded with a status of 404 (Not Found)`

</details>

<details><summary>4 failed request(s)</summary>

- `GET http://127.0.0.1:3210/?_rsc=EWwZxu7CWT_b_Hft`
- `GET http://127.0.0.1:3210/menu?_rsc=EWwZxu7CWT_b_Hft`
- `GET http://127.0.0.1:3210/?_rsc=fyNs6KI5MSSqjMYQ`
- `GET http://127.0.0.1:3210/menu?_rsc=cQFh0vLwP7Or4_E2`

</details>

