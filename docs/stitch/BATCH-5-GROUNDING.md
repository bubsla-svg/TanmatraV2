# Batch 5 Grounding — Account Depth (G1)

> Reconciliation input for Route Briefs 27–33. Establishes, per route, the real
> backend contract and the logic that must survive wiring — written **before**
> any Stitch generation, following the pattern `BATCH-3-GROUNDING.md` and
> `BATCH-4-GROUNDING.md` set.
>
> Batch 2 designed six `/account` routes (hub, health-information, wellness,
> preferences, orders, favorites) and stopped. These seven are the rest of the
> same hub: `addresses`, `subscriptions`, `symptoms`, `appointments`, `billing`,
> `loyalty`, `history`. Per `BATCH-4-5-SCOPE.md`: *"the most visible
> inconsistency in the product today — a customer moving from `/account/orders`
> to `/account/billing` crosses a design boundary mid-hub."* This batch's own
> grounding pass found that boundary is worse than cosmetic in two places: it's
> not just unstyled, it's unreachable, and in one case it's dishonest.

## Route → real path map

| Route | Page | Main component(s) | Route weight |
|---|---|---|---|
| `account/addresses` | `app/account/addresses/page.tsx` (26) | `AddressManager` (139) → `AddressList` (56), `AddressForm` (86) | 201 |
| `account/subscriptions` | `app/account/subscriptions/page.tsx` (24) | `SubscriptionManager` (132) → `SubscriptionCard` (128) → `ChangePlanPanel` (146), `DeliveryList` (105), `HybridWorkToggle` (86) | 192 |
| `account/symptoms` | `app/account/symptoms/page.tsx` (27) | `SymptomTrackerView` (143) | 172 |
| `account/appointments` | `app/account/appointments/page.tsx` (25) | `AppointmentsList` (91) | 152 |
| `account/billing` | `app/account/billing/page.tsx` (24) | `BillingPanel` (83) | 143 |
| `account/loyalty` | `app/account/loyalty/page.tsx` (23) | `LoyaltyHub` (53) → `ReferralPanel` (117), `LoyaltyProgressPanel` (71) | 112 |
| `account/history` | `app/account/history/page.tsx` (27) | `MealHistoryDashboard` (81) | 110 |

Every component is well under the 400-line cap; no file-cap risk anywhere in
this batch.

## AccountNav: the hub's own tab strip has a gap

`components/account/AccountNav.tsx` is Batch 2's shared tab row — a server
component, `Tab` union of 8 values, one `<Link>` per value, invited to extend
("Extend here as account surfaces land"). Five of this batch's seven routes are
already in it and render it correctly: **addresses, subscriptions, appointments,
billing, loyalty** (`active="…"` matches the route).

**`symptoms` and `history` are not in the `Tab` union, are not linked from
`AccountNav`, and neither page renders `AccountNav` at all.** They are reachable
only from a different surface entirely — the top-level "Track" mega-menu
(`lib/nav.ts:80-81`, labelled "Meal history dashboard" and "Symptom logs") and
`sitemap.ts`. A customer on `/account/billing` has seven tabs in front of them
and no way to reach `/account/symptoms` or `/account/history` from there, and a
customer who arrives at either of those two pages has no way back into the rest
of the account hub — no nav, no breadcrumb, nothing.

`components/account/AccountHub.tsx`'s own tile grid (`SECTIONS`, the five cards
on `/account` itself) has the same shape of gap: it lists subscriptions, orders,
addresses, preferences, loyalty — **not appointments, billing, symptoms, or
history**. Two of those (appointments, billing) at least have a tab once you're
inside the hub; symptoms and history have neither an entry tile nor a tab.

**Decision, taken here (small, reversible, in-batch):** add `symptoms` and
`history` to `AccountNav`'s `Tab` union and render list, render `AccountNav` on
both pages, and add hub tiles for `appointments`, `billing`, `symptoms`, and
`history` to `AccountHub.tsx`'s `SECTIONS`. This is exactly what the batch was
scoped to fix, for exactly this batch's own routes — not a general audit of
every account route's reachability (`preferences` and `health-information`
already have tiles and are untouched).

## Contracts that must survive wiring

### `account/addresses` — fully wired, no defects

`lib/api.ts:245-266`: `getAddresses/createAddress/updateAddress/deleteAddress`
against `/api/addresses`. Session-gated; 401 → `needsAuth` → inline `PhoneAuth`
(`AddressManager.tsx:88-95`), the correct island pattern. Server owns
serviceability (422 `unserviceable_pincode`) and the single-default invariant.
Nothing to fix here — restyle only.

### `account/subscriptions` — real money path, one fake feature inside it

Pause/resume/cancel/reactivate, `changePlan`, and a full Razorpay
OTP-reauth-order→modal→verify sequence for autopay mandate changes
(`ChangePlanPanel.tsx:66-87`, `lib/razorpayAdapter.ts`) all hit real endpoints
via `lib/subscriptionsApi.ts`. Cancel is confirmed via `window.confirm` first.
401 → inline `PhoneAuth`, correct.

**`components/account/HybridWorkToggle.tsx` is entirely fake.** `handleToggle`
(`:26-38`) is a `setTimeout`, not a network call:

```
setTimeout(() => {
  setSelected(target);
  setIsUpdating(false);
  setNotice(`Route updated to ${locationName} for tomorrow's dispatch (Lock at 9:00 PM tonight).`);
  onLocationChange?.(locationName);
}, 300);
```

Nothing is routed. The success message is invented. `currentLocation` defaults
to the hardcoded literal `"Sector 150 Home"` (`:17`) — and `SubscriptionCard.tsx:78`
falls back to that same fabricated string when a subscription has no real
`addressLine`, presenting invented data as the customer's actual address. The
`onLocationChange` callback prop is never even passed by the parent, so the
toggle is a closed loop even on its own terms.

Checked for a real backend counterpart before deciding what to do with it:
**none exists.** No endpoint anywhere in `artifacts/api-server` supports
changing a subscription's delivery address or routing a specific day's
delivery to an alternate location; `subscriptionsApi.ts`'s `Subscription` type
carries `addressLabel`/`addressLine` as read-only display fields set at
creation. This is not a case like Batch 4's `/custom-build` (a real,
POS-integrated model sitting unused) — there is nothing to wire this to.

**Decision:** remove the fake toggle-and-fake-success. Replace with a plain,
honest display of the subscription's real current delivery address (no
fabricated fallback string — if `addressLine` is null, say so, don't invent
one). Do not claim a self-serve reroute capability the backend doesn't have.

### `account/symptoms` — real endpoint, broken auth handling, one fabrication

`lib/ecosystemApi.ts`: `getMySymptomLogs()` → `GET /symptom-logs`,
`recordSymptomLog()` → `POST /symptom-logs`. Real clinical data — the page's
own copy calls it a "clinical record" feeding registered dietitians. The happy
path (signed in, submit succeeds) genuinely posts and prepends the server's
returned entry.

**Two real defects:**

1. Load failures are silently swallowed (`SymptomTrackerView.tsx:15-17`,
   bare `.catch(() => {})`) — a signed-out visitor sees an empty list
   ("No physiological symptom observations recorded...") indistinguishable
   from "you have no data," when they may simply not be authenticated.
2. Every submit failure — 401 included — maps to the same string, *"Please
   sign in to save verified symptom telemetry to your permanent vault"*
   (`:37`), but **the file never imports `PhoneAuth`**. There is no sign-in
   control anywhere on the page. This is the exact island-pattern violation
   Batch 4's grounding flagged elsewhere: the copy promises a path that
   doesn't exist.

Also: `relatedDishSlug: dishSlug.trim() || "general-dietary-cycle"` (`:30`) —
when the optional related-dish field is left blank, the client invents a slug
that resolves to no real dish and submits it as clinical correlation data.

**Must survive wiring:** the real GET/POST calls, the server-returned-entry
prepend. **Must be fixed during wiring:** real `needsAuth` state + inline
`PhoneAuth` (mirror `AddressManager`/`AppointmentsList`), an honest
distinction between "no data" and "not signed in," and dropping the invented
`relatedDishSlug` fallback (omit the field rather than fabricate a value).

### `account/appointments` — fully wired, no defects

`lib/rdBookingApi.ts`'s `getMyAppointments()` → `GET /rd/appointments`. Real
money data (RD consult price, `pricePaise`, rendered via `formatPaise` with a
genuine `=== 0` "Free Intro" branch, never an invented fallback). 401 →
`needsAuth` → inline `PhoneAuth` (`AppointmentsList.tsx:41-48`), correct.
Nothing to fix — restyle only.

### `account/billing` — fully wired, read-only, no defects

`lib/billingApi.ts`'s `getCreditLedger()` → `GET /credit-ledger`, explicitly
read-only (order receipts live at `/account/orders`, recurring billing at
`/account/subscriptions`). 401 → `needsAuth` → inline `PhoneAuth`
(`BillingPanel.tsx:31-38`), correct. Nothing to fix — restyle only.

### `account/loyalty` — fully wired, no defects

`lib/referralApi.ts` (`getMyReferral`, `redeemReferralCode`) and
`lib/loyaltyApi.ts` (`getLoyaltyProgress`), joined client-side by
`subscriptionId`. Documented and true in the code: reward-value display reads
the subscription's own `pricePerDeliveryPaise` rather than a second invented
figure, so the UI can't drift from what the server would actually credit. 401
→ `needsAuth` → inline `PhoneAuth` at the `LoyaltyHub` level, correct. Nothing
to fix — restyle only.

### `account/history` — real endpoint, same broken auth pattern, fabricated clinical targets

`lib/ecosystemApi.ts`'s `getMyNutritionHistory()` → `GET /nutrition-history` →
`{ logs, targets: { calorieTarget, proteinTargetGrams, fiberTargetGrams, waterTargetMl } }`.
The per-log list is genuinely wired (`logs.map`, keyed by `log.id`).

**Two real defects, one of them the most severe finding in this batch:**

1. Same dead-end auth pattern as `symptoms`: every load failure — 401
   included — maps to *"Please sign in to inspect your verified macro
   adherence logs"* (`MealHistoryDashboard.tsx:16`), with no `PhoneAuth`
   import and no sign-in control anywhere on the page.
2. **The headline metric tiles fabricate clinical targets:**
   ```
   { label: "Calorie Adherence", target: `Target: ${targets.calorieTarget || 2000}/day` },
   { label: "Protein Volume", target: `Target: ${targets.proteinTargetGrams || 80}g/day` },
   { label: "Prebiotic Fiber", target: `Target: ${targets.fiberTargetGrams || 28}g/day` },
   ```
   `||` (not `??`) means a legitimate `0` — no RD-set target yet — silently
   becomes the hardcoded default. The page's own metadata frames these as
   "registered dietitian daily prescription ceilings." For any user without a
   set target, the dashboard shows an invented number captioned as their
   personal clinical prescription, with no visual distinction from a real one.
   `targets.waterTargetMl` is defined in the type and never rendered anywhere
   — a fourth tile that apparently never got built; not a bug, but worth
   knowing before designing the tile grid.

**Must survive wiring:** the real per-log list and its live totals. **Must be
fixed during wiring:** real `needsAuth` state + inline `PhoneAuth`, and the
target tiles must distinguish "your RD-set target" from "no target set yet" —
never silently substitute a number and caption it as prescribed. (A reasonable
shape: when a target is `0`/falsy, the tile shows "No target set — ask your
RD" instead of a number, or the fallback is visibly labelled as a general
guideline rather than "Target:".)

## Defects found, all pre-existing, ordered by severity

1. **`account/history` fabricates a clinical prescription** when none exists
   (`MealHistoryDashboard.tsx:45-47`) — the most severe finding, on the
   highest-clinical-sensitivity route in the batch alongside `symptoms`.
2. **`HybridWorkToggle` (subscriptions) is a fully fake feature** — no
   backend, invented success copy, fabricated default address, and no real
   endpoint exists to wire it to.
3. **`symptoms` and `history` both violate the island-auth pattern** — a
   "please sign in" message with no sign-in control, and no honest
   distinction between empty and unauthenticated.
4. **`symptoms` and `history` are structurally outside the account hub** —
   missing from `AccountNav` and `AccountHub`'s tile grid.
5. Cosmetic, fixed during the same pass every batch fixes them:
   - `text-white` on `bg-gold` (fails WCAG AA, same recurring defect):
     `SymptomTrackerView.tsx:110`, `MealHistoryDashboard.tsx:29` → both need
     `text-[var(--gold-ink)]`.
   - `bg-sage-100`/`text-sage-800` (dead classes, don't resolve):
     `SymptomTrackerView.tsx:127`, `AppointmentsList.tsx:74` → both need
     `bg-sage-soft text-sage-text`.
   - Entity-in-JS-string bug: `SymptomTrackerView.tsx:112` — `"+ Record Symptom Log &rarr;"`
     is a plain JS string, not JSX text, so `&rarr;` ships as literal text.
     Needs the literal glyph.
   - Index key on a `.map()` (`MealHistoryDashboard.tsx:48-49`): the mapped
     array is a fixed 3-item literal that never reorders, so this isn't live
     breakage — but it's an index key on a list and worth switching to
     `key={label}` while the file is open for other reasons.

## What must survive wiring (batch-wide)

- Every real API call enumerated above, verbatim — no client-side price/target
  math, no invented fallback presented as real data.
- The island-auth pattern already correct on 5 of 7 routes: 401 → `needsAuth`
  → inline `<PhoneAuth onVerified={...}/>`, never a redirect.
- `AppointmentsList`'s real `formatPaise(a.pricePaise)` with the honest
  `=== 0` → "Free Intro" branch (not a fallback — a real server value).
- `LoyaltyProgressPanel` reading reward value from the subscription's own
  price rather than a second number.
- All real list keys (`.id`-keyed throughout, bar the one harmless index-key
  noted above).

## Wiring checklist for Batch 5

- [ ] Add `symptoms` and `history` to `AccountNav`'s `Tab` union + link list
- [ ] Render `<AccountNav active="symptoms">` / `active="history"` on both pages
- [ ] Add `appointments`, `billing`, `symptoms`, `history` tiles to `AccountHub.tsx`'s `SECTIONS`
- [ ] Replace `HybridWorkToggle`'s fake setTimeout-success with an honest, non-interactive real-address display; drop the `"Sector 150 Home"` fabricated fallback
- [ ] `symptoms`: real `needsAuth` + inline `PhoneAuth`; distinguish "no data" from "not signed in" on load failure; drop the fabricated `relatedDishSlug` fallback
- [ ] `history`: real `needsAuth` + inline `PhoneAuth`; target tiles show "no target set" honestly instead of a captioned fabricated number
- [ ] Fix both `text-white`-on-`bg-gold` instances → `text-[var(--gold-ink)]`
- [ ] Fix both `bg-sage-100`/`text-sage-800` instances → `bg-sage-soft text-sage-text`
- [ ] Fix the one entity-in-string-literal bug (`SymptomTrackerView.tsx:112`)
- [ ] `MealHistoryDashboard.tsx`'s literal-array `.map()` keys on `label`, not index
