# Plan Configuration — Amendment 02e (collated)

**Date:** 2026-07-22 · **Collates:** Amd 02 §2/§5 (plans, add-ons), 02a §4 (menus, pools), 02b (trial), 02d §3–§4 (defaults, router) · **Status:** normative for implementation; rationale stays in the source amendments. **Rule:** this file is authoritative for plan *configuration values*. Dish prices remain authoritative in tanmatra-catalog-repricing.csv. Never hardcode a dish price here or there — plans reference SKU ids; the server prices them (IMP §10.1).

> Transcribed into the repo from the Google Doc source (`1yERdFQvxGtVrBD3K5SWvLXLVspE0q7TsRXFldc3UXxo`) on 2026-07-22.

## 1. Schema

```ts
type PlanId = 'desk_fuel' | 'steady' | 'glp1_companion' | 'protein_build' | 'teams' | 'trial_3day';

interface PlanConfig {
  id: PlanId;
  routerAnswer: string | null;        // 02d §2 — null = not router-reachable
  pricePerMealPaise: number | null;   // null = flat-priced plan
  flatPricePaise: number | null;
  mealsPerCycle: number;
  cycle: 'weekly' | 'monthly' | 'one_off';
  slots: ('lunch' | 'dinner' | 'snack')[];
  dietTracks: ('veg' | 'egg' | 'nonveg')[];   // only tracks that can actually be served
  poolQuery: PoolQuery;               // how the kitchen fills the week
  requiresRdSignoff: boolean;         // blocks publish until true (rdReviewState)
  customizable: boolean;              // swap/skip enabled
  trialEligible: boolean;
  addOnsAllowed: AddOnId[];
  status: 'live' | 'blocked_pending_skus' | 'sales_led';
  blockers: string[];
}
```

## 2. Plan table

| field | desk_fuel | steady | glp1_companion | protein_build | teams | trial_3day |
|---|---|---|---|---|---|---|
| routerAnswer | "Get me through the workday" | "Keep my sugar steady" | "I'm on a GLP-1" | "Build muscle" | null | null (secondary CTA) |
| pricePerMeal | ₹199 | ₹229 | — | ₹249 | ₹189 (25+ seats) | — |
| flatPrice | — | — | ₹5,999 intro / ₹6,999 | — | — | ₹399 |
| mealsPerCycle | 22 | 22 (or 44) | 60 meals + 30 snacks | 22 (or 44) | per seat-count | 3 |
| cycle | monthly | monthly | monthly | monthly | monthly | one_off |
| slots | lunch | lunch (+dinner opt) | 2 meals + snack | lunch (+PM meal) | lunch | lunch |
| dietTracks | veg, egg, nonveg | **nonveg only today** | **egg, nonveg only** | veg, nonveg | veg, nonveg | veg, nonveg |
| poolQuery | §3.1 | §3.2 | §3.3 | §3.4 | = desk_fuel | §3.5 fixed |
| requiresRdSignoff | false | **true** | **true** | false | false | false |
| customizable | true | true | true | true | false (batch) | **false** |
| trialEligible | true | true | **false** | true | false | — |
| addOnsAllowed | rd_bump, evening_add | rd_bump, evening_add | rd_bump (bundled) | evening_add | none | none |
| status | live | blocked_pending_skus | blocked_pending_skus | live | sales_led | live (Phase 2) |
| blockers | — | veg GI-low pool = 0; needs millets pasta import + millet khichdi SKU | needs tofu/soy bowl for veg; RD sign-off; sattu shake SKU | — | Pluxee onboarding | — |

**Read this row first:** two of five plans cannot launch complete today. dietTracks is deliberately narrowed to what the kitchen can actually serve — never widen it in code to make a UI look symmetrical. A plan offering a veg track it can't fill is a §2.6 violation that surfaces as a refund.

## 3. Pool queries (how a week gets filled)

- **3.1 desk_fuel** — category ∈ {bowls, wraps, pasta, mains, salads} ∧ 300 ≤ kcal ≤ 650 ∧ available ∧ track matches. Rotation: no dish repeats within 10 weekdays. Seed week in 02a §4.
- **3.2 steady** — 3.1 **∧** **gi = 'low'** **∧** **rdReviewState = 'signed'**. Current signed veg count: 0 → track disabled.
- **3.3 glp1_companion** — protein ≥ 25 ∧ kcal ≤ 450 for meals; snack slot needs protein ≥ 18 (no current SKU qualifies → sattu shake required).
- **3.4 protein_build** — protein ≥ 28, ranked desc; hero SKU Roast Chicken Russian (P36).
- **3.5 trial_3day** — **fixed trio, no query, no swaps** (02b §3): veg = BBQ Paneer Fiesta Bowl → Paneer Tikka Burrito Wrap → Alfredo Veg; nonveg = BBQ Grilled Chicken Bowl → Chipotle Chicken Wrap → Alfredo Chicken.

## 4. Add-ons

| id | price | attach point | rules |
|---|---|---|---|
| rd_bump | +₹499/mo | plan review (02 §5) | one offer, silent decline persists, capacity-capped by RD hours — never sell unschedulable sessions |
| evening_add | +₹599/week | post-purchase (02a §4) | one-tap, charges to subscription, never blocks confirmation |

## 5. Builder defaults (02d §4)

duration: monthly · mealsPerDay: 1 · preference: router answer ?? 'veg' · startDate: next weekday · rd_bump: unselected. All pre-selected, all visible, all one tap to change. Weekly entry tier ₹1,199–₹1,499 offered as the alternate duration, never as the default.

## 6. Trial credit logic (02b — implement exactly)

```
credit = 39900 paise, valid 7 days from trial end
applies to: any plan start by the same identity
weekly:  119900 - 39900 = 80000 charged   // trial + weekly = exactly ₹1,199
monthly: 437800 - 39900 = 397900 charged
```

Eligibility: one per phone number **ever** (server-side, OTP identity); no prior paid plan; address fingerprint as soft flag only. **No auto-conversion** — trial ends, continuing is an explicit tap.

## 7. Launch gates

steady and glp1_companion render **only** when their pools return a non-empty signed set for the requested track; otherwise the router answer routes to a waitlist capture, never to a broken builder (02d §8 zero-dead-end). Publish checklist per plan: pools non-empty ✓ · RD sign-off where required ✓ · every SKU has verified allergens (IMP §11.2) ✓ · price resolves server-side ✓.
