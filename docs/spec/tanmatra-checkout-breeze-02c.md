# Checkout: The Breeze Spec — Amendment 02c

**Date:** 2026-07-21 · **Governs:** money-path steps from plan review to confirmation, rebuild Phase 2 · **Layers onto:** IMPECCABLE §8.4/§10/§13/§15, Amendment 02 §5, Trial 02b · **Principle:** cognitive load at checkout is almost always decisions that belonged earlier in the flow, piling up at the end. The fix is architectural.

> Transcribed into the repo from the Google Doc source (`1FSgeb1J9TUQoCpzhYSaq-ZT6773ZRzxyslEsOF6uenI`) on 2026-07-22.

## 1. The load diagnosis

Checkout feels heavy when a screen asks the user to simultaneously: decide (add-ons? coupon? slot?), type (address forms), read (itemized summaries, T&Cs), choose (eight equal payment methods), and worry (will I be charged now? is this refundable? what if it fails?). Every one of those has a structural cure: **decide earlier, type never, read one line, choose a default, state the future.**

## 2. Decisions evicted from checkout

By the time "checkout" begins, these are already settled and never re-asked:

| Decision | Where it now lives |
|---|---|
| Plan, duration, meals/day, preference | Plan builder (before checkout) |
| Serviceability | PIN gate at entry (§2.1) — checkout cannot dead-end on geography |
| RD guidance bump | Plan review screen (02 §5) — the *only* upsell, before payment begins |
| Delivery slot | Not a decision. Stated: "Delivered 12:30–1:30." Fixed lunch window is information |
| Start date | Defaulted to next weekday, editable inline — a tap, not a form |
| Coupon | **The field does not exist.** Trial credit and any plan credit auto-apply as one sage line: "₹399 credit applied." A coupon box manufactures the anxiety of overpaying and sends users to Google hunting codes — it is Zomato's cognitive load, not ours |
| COD | Not offered, anywhere. Subscriptions can't COD, and the trial's upfront payment is its abuse filter. UPI penetration in the NCR corporate segment makes this a non-cost |

## 3. The three screens (element inventories are exhaustive — if it's not listed, it's not on the screen)

### S1 — Identity (skipped entirely for signed-in users)

Phone field (numeric inputmode, autofocus) → OTP (autocomplete="one-time-code", WebOTP auto-fill, auto-advances on 6th digit — zero taps when autofill fires). Elements: step dots (1/3) · one-line plan summary "Desk Fuel · 22 lunches · **₹4,378**" (collapsed, chevron expands) · phone field · helper "We'll text a code — no passwords, ever" · primary CTA. **One decision: whose lunch is this. Typed fields: 1.**

### S2 — Address (skipped for returning users with a saved address — it renders pre-selected on S3)

Saved addresses as tappable cards (Office / Home labels) OR new address: PIN pre-filled from the serviceability gate → auto-resolves city/state · Places autocomplete line · optional landmark/floor. Elements: step dots (2/3) · sticky total · address cards or 2 fields · CTA "Deliver here". **One decision: where. Typed fields: ≤2 (0 returning).**

### S3 — Pay

Elements, complete list: step dots (3/3) · plan one-liner + total (server-quoted, GST-inclusive — the number that gets charged, §10.2, no surprises by construction) · credit line if any (sage) · **one dominant button: "Pay ₹3,979 with UPI"** (fires OS-level UPI intent — GPay/PhonePe/Paytm chooser is the phone's, zero typing) · collapsed "More ways to pay" (cards, meal card per Amendment 02, netbanking — expanded only on tap) · one future-state line: "Next billing 21 Aug · pause or cancel anytime" · trust row (UPI mark · FSSAI lic. · "RD-reviewed kitchen"). **Word budget above the button: ≤ 40. Elements above fold: 5. One decision: pay.**

### Confirmation

Money status first, always (§13): "₹3,979 paid. First lunch Tuesday, 12:30–1:30." Then the single post-purchase offer (Evening Add, 02 §5), skippable, never blocking. Manage-plan link. Nothing else.

## 4. The load budget (falsifiable, CI-checkable where possible)

| Metric | New user | Returning |
|---|---|---|
| Screens, plan review → paid | ≤ 4 | ≤ 2 |
| Decisions per screen | **1** | 1 |
| Typed fields, total | ≤ 4 (phone, OTP\*, address, landmark\*) | **0 — tap-only checkout** |
| Taps to UPI intent | ≤ 9 | **≤ 3** (= reorder north star) |
| Time to paid (expert walkthrough) | ≤ 90s | ≤ 15s |
| Words above primary CTA, any step | ≤ 40 | ≤ 40 |
| Layout shift during checkout | CLS = 0 — a moving total is cognitive load *and* a §15 defect | 0 |

\* auto-fillable → effectively 0 when WebOTP and Places fire.

Playwright asserts screens, taps, and field counts per build; word budget is a per-PR checklist line (IMPECCABLE §17).

## 5. Certainty devices (anxiety is load)

Every screen answers "what happens next" in one line: S1–S2 carry "You won't be charged yet"; S3 carries the exact amount, next billing date, and exit rights; failure states lead with money status ("Payment didn't go through — you have not been charged") + one retry + one alternate-method suggestion (§13). Buttons hold their width while loading (§8.3); the total is sticky and identical on every screen — a number that changes mid-flow is a trust incident, and the server quote (§10.1) makes it impossible.

## 6. What this deletes from the current build

The audit-era checkout sins this spec makes unrepresentable: silent click absorption with no address (S2 cannot be skipped into), multi-decision single-page checkout, client-computed totals, coupon field, slot pickers, itemized-summary walls, and any T&C paragraph — replaced by the one future-state line plus a linked policy page.
