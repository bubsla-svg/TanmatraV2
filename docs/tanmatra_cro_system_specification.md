# Tanmatra CRO System Specification — Amendment Set 01

Document type: Normative delta. Append to the base "Tanmatra CRO System Specification" (§0–§20) before Claude Code handoff.
Precedence rule: Where an amendment conflicts with the base document, the amendment governs. All base-document invariants not touched here remain in force.
Date: 12 July 2026
Status: Ready for implementation

## Application map

| # | Title | Type | Touches |
|---|---|---|---|
| A1 | Rendering & money-path availability doctrine | New §0.4 | §19, §20 |
| A2 | Trial → subscription bridge | New §7.5 | §20 resequence |
| A3 | Design-token binding | Amends §0.3, §1.3, §2.6, §6, §7 | Global |
| A4 | Base-spec contradiction resolutions | Amends §1.4, §2.2, §2.3, §2.6, §3.2, §4 | Copy + data contracts |
| A5 | À-la-carte scope gate | Amends §1.4 | Cart state model |
| A6 | Experimentation deferral | Amends §13.1, §15.2 | Telemetry |
| A7 | Recurring-mandate compliance & billing surface | New §21; amends §3.2 Step 3, §16 | Payments, account |
| A8 | Discovery surface & re-rank contract | New §22 | Menu, telemetry, §18 |
| A9 | Operational communications layer | New §23 | Comms, consents §8.2 |
| A10 | Health-data lifecycle | New §24; amends §8.2 | Privacy, account |

---

## A1 — Rendering & Money-Path Availability Doctrine (new §0.4)

**Adds:** §0.4. **Amends:** §19 (acceptance criteria), §20 (Sprint 1–2 scope).

Problem bound: the base spec sets INP/LCP/CLS budgets (§0) but defines no rendering architecture. Transactional routes currently cold-load a JavaScript-required fallback. The budgets are unenforceable, and the highest-intent screens paint blank on mid-tier Android over mobile data. This doctrine is a Sprint 1 prerequisite for everything else in the base spec.

### 0.4.1 Money-path route manifest

A version-controlled manifest file lists every route that participates in the money path:

```
/
/menu
/dish/*
/plans
/subscribe            (including all query-parameter variants)
/checkout/*
/trial/*
/order/confirmed/*
/account/plan
/account/billing
```

The manifest is a build artifact. Adding a transactional route without adding it to the manifest fails CI.

### 0.4.2 Rendering requirements

- Every manifest route MUST serve server-rendered or build-time prerendered HTML whose first response contains, at minimum: the page `h1`, the primary CTA, and the price/plan context applicable to that screen.
- The JavaScript-required fallback page is prohibited on manifest routes. It may remain only on authenticated dashboard/admin routes.
- Primary CTAs are progressive: rendered as real `<a href>` elements that perform full-page navigation before hydration, enhanced to in-place transitions after hydration. A dead button pre-hydration is a defect.
- Hydration failure MUST degrade to readable content and working anchors — never a white screen, never inert controls.
- Skeleton states are defined for the Persistent Nutrition Cart, the Item Bottom Sheet, and the Subscription Selector. A skeleton may substitute for data, never for structure. No blank region larger than one component may paint.
- The cart's reserved bottom padding variable (§1.2) is present in server-rendered HTML so that cart appearance causes zero document-flow shift (reinforces §19).

### 0.4.3 Performance budgets (p75, mid-tier Android, 4G)

| Metric | Budget |
|---|---|
| TTFB | ≤ 800 ms |
| LCP | ≤ 2.5 s |
| INP | ≤ 200 ms |
| CLS | ≤ 0.1 |
| First response completeness | h1 + primary CTA present with JS disabled |

### 0.4.4 CI acceptance gates

- Headless fetch of each manifest route with JavaScript disabled asserts: HTTP 200; presence of `h1` text; presence of a primary-CTA anchor; absence of the fallback marker string.
- Lighthouse CI budget gate runs on `/subscribe` and `/checkout/payment` at minimum.
- Geography lint: the strings `Bengaluru`, `+91 80`, and superseded copyright years are prohibited anywhere in the consumer bundle; occurrence fails CI. (Codifies the brand-consistency defect as a permanent regression guard, not a one-time fix.)

### Acceptance criteria (append to §19)

- No manifest route returns the JS-required fallback under a no-JS fetch.
- `/subscribe?trial=1` and `/subscribe?plan=*` render plan context and a working CTA within the LCP budget on a throttled 4G profile.
- Hydration-disabled smoke test completes a navigation from `/menu` to `/subscribe` via anchors only.

---

## A2 — Trial → Subscription Bridge (new §7.5)

**Adds:** §7.5 at the same fidelity as §7. **Amends:** §20 — "Trial-to-subscription sequencing" moves from Sprint 9+ into Sprint 5–6.

Rationale bound: the trial is correctly specified as non-renewing (§3.1, §3.3), but the base document builds no conversion moment after it. This is the highest-leverage unbuilt touchpoint in the funnel and does not belong in an optimization backlog.

### 7.5.1 Trial state model

```
trial_purchased
  → trial_active            (delivery days 1–3)
  → trial_bridge_eligible   (earlier of: second delivery confirmed,
                             or 12:00 on trial day 2)
  → trial_ended_undecided   (days 4–10 after trial end)
  → terminal:
      trial_converted       (explicit subscription start)
      trial_declined        (explicit "not continuing" action)
      trial_lapsed          (day 10 with no decision)
```

Invariants:
- No state transition ever creates a charge. Conversion requires an explicit user action, preserving the §3.1 trial definition.
- `trial_bridge_eligible` and later states surface the bridge entry point (plan-tab badge, deep link).

### 7.5.2 Bridge screen — mobile layout

```
Your 3-day results

┌─────────────────────────────────────┐
│ Meals delivered            3 of 3  │
│ Avg protein per day          38 g  │
│ Days within calorie range   3 of 3 │
│ Swaps honored                   1  │
└─────────────────────────────────────┘

RECOMMENDED NEXT STEP
Blood-sugar-friendly lunches
5 meals/week · 6 weeks · ₹3,800/week

Your configuration is saved. Kitchen
capacity for a Monday start is held
until Sunday, 8:00 PM.

[Start my 6-week plan]
[Compare payment schedules]
[Decide later]
```

Rules:
- All numerals render in the data-numeral style (A3, Rule 3.2).
- The recap card uses only measured fulfilment data (deliveries, macros of delivered meals, honored swaps). Projected outcomes, weight claims, and transformation language are prohibited (§7.1 applies here in full).
- Primary CTA routes into §3.2 at Step 3 (billing period) with frequency and duration pre-filled from the recommendation; the user still passes the full price/renewal disclosure (Step 6) before payment. No step of §3.2 may be silently skipped.
- "Compare payment schedules" opens Step 3 directly (matches §4 copy table).
- "Decide later" saves state and confirms: *"Your plan and preferences are saved. We'll send one reminder before the Sunday cut-off."*

### 7.5.3 Capacity-hold rule

The "held until" line is governed by §6 in full: it must map to a real kitchen/route hold record with a server timestamp, a defined expiry, and a non-alarmist fallback. After expiry:

> Monday start has closed. Tuesday is the next available start date.

Never a resetting timer. The hold is re-validated server-side when the primary CTA is tapped; a stale hold returns `409` and refreshes the copy in place.

### 7.5.4 Verbatim copy

Heading: **Your 3-day results**
Sub-body under recap card: *"These are your delivered meals and their measured totals — not a health outcome."*

### 7.5.5 Reminder cadence (templates defined in §23)

| Send | Timing | Class | Content |
|---|---|---|---|
| T1 | Trial day 2, 19:00 | Utility | Recap teaser + bridge link |
| T2 | Trial day 3, 11:00 | Utility | Bridge link + Sunday cut-off time |
| T3 | Day 5 post-trial, 11:00, only if undecided | Utility | Single reminder; includes a working "Stop reminders" action |

No sends after `trial_lapsed` or `trial_declined`. Quiet hours per §23.2.

### 7.5.6 Payment continuity

If the trial was paid via UPI, the same VPA is offered as the default instrument for mandate creation (§21), clearly labeled and editable. Silent reuse of a payment instrument is prohibited.

### 7.5.7 Telemetry

- `trial_bridge_viewed` { entry_point, day_index }
- `trial_bridge_cta` { cta_id: start_plan | compare_billing | decide_later }
- `trial_outcome` { result, days_to_decision, reminders_sent }

Directional target: bridge_viewed → trial_converted ≥ 30% (opt-in trial benchmark band). Make one full cohort before optimizing.

### Acceptance criteria

- The bridge renders from cached state when offline; the hold is re-validated at CTA tap.
- Zero code paths exist that convert a trial without an explicit CTA tap plus the Step 6 disclosure.
- T3 never dispatches after a terminal trial state.

---

## A3 — Design-Token Binding

**Amends:** §0.3, §1.3, §2.6, §6, §7. **Applies globally.**

Problem bound: the base spec references "brand accent," "brand green," "amber," and "dark brand surface." Unbound color language is how the two-system drift occurred the first time. Every reference resolves to a canonical `.tnm2` token; no parallel scale may be introduced.

### Rule 3.1 — Binding table

| Base-spec phrase | Canonical token | Notes |
|---|---|---|
| "brand accent" / CTA color | `--tnm-action` | Saffron. The sole hue permitted on primary actions, sitewide. |
| "brand green" / within-range status | `--tnm-sage` | Wellness and veg signal + within-range macro status. |
| amber / near-boundary status | `--tnm-caution` | Always paired with icon + explicit text (§1.3). |
| red / conflict / alert | `--tnm-alert` | Blocking and safety states only. Never decorative. |
| "dark brand surface" | `--tnm-surface-ink`, `--tnm-surface-ink-2` | Cart, sheets, success card; `-2` for elevated layers. |
| primary text | `--tnm-text-primary` | Contrast ≥ 4.5:1 enforced at token definition. |
| secondary text | `--tnm-text-secondary` | Contrast ≥ 4.5:1 enforced at token definition. |

### Rule 3.2 — Data numerals

Every macro value, price, quantity, and countdown numeral renders in JetBrains Mono with `font-variant-numeric: tabular-nums` via a single utility class (`tnm-data`). Rationale: §1.5's 120 ms digit transitions and the cart secondary line require fixed-width digits to animate without width jitter; this is what makes the specified numeric cross-fades meet CLS 0 within the component.

### Rule 3.3 — Enforcement

- No color literal (hex/rgb/hsl) may appear in component code; a stylelint gate rejects literals outside the token file.
- The base spec's spacing/radius tokens (§0.3) map 1:1 into the `.tnm2` scale. Introducing a second scale fails review.
- Any component importing legacy System-A consumer styles fails CI. The `.tnm2` system is the single canonical consumer design system.

---

## A4 — Base-Spec Contradiction Resolutions

**Amends:** §1.4, §2.2, §2.3, §2.6, §3.2 (Steps 0, 3, 6), §4, §7. These are defects a literal-minded implementation agent will otherwise faithfully ship.

### 4.1 Macro denominator (amends §2.3, §2.6)

The layout string `71% of meal` is removed. It introduces a fourth, undefined denominator that violates the base spec's own hierarchy (user target → plan range → grams only).

- Percentages are permitted only when the denominator is the user's own per-meal target **and** the label names the denominator (e.g., "71% of your lunch protein target").
- Corrected layout row: `Protein  32g  ████████░░  Within range`
- Under hierarchy level 3 (grams only), the bar renders as a static grey track with zero fill — not an arbitrary fill percentage.

### 4.2 Canonical illustrative price set (amends §1.4, §3.2 Steps 0/3/6, §7)

The base document uses two irreconcilable price worlds (₹395/meal in cart states; ₹750/meal implied by "5 lunches ₹3,750"; a ₹3,950/week anchor at Step 0 vs. ₹3,800 payable at Step 6). One canonical illustrative set replaces all monetary strings in the base document:

| Item | Canonical value |
|---|---|
| Meal list price | ₹750 |
| Weekly subtotal (5 lunches) | ₹3,750 |
| Taxes | ₹200 |
| Weekly-plan saving | −₹150 |
| **Weekly payable** | **₹3,800** |
| Bi-weekly payable | ₹7,410 (₹190 multi-week saving) |
| Six-week single payment | ₹21,660 (₹1,140 full-plan saving) |
| 3-day trial (3 meals) | ₹2,250, one-time |

Normative rules:
- §3.2 Step 0 "Starting price" MUST display the current quote's payable for the recommended configuration (₹3,800/week in the canonical example). Displaying any anchor that differs from the payable is prohibited.
- Every monetary string in this spec and the base spec is an illustrative placeholder. Implementation binds all displayed prices to the pricing quote API (§8.3). Hardcoded currency literals in components fail a CI grep gate (`₹[0-9]`).

### 4.3 Bottom-sheet peek state (amends §2.2)

The 44vh peek state has no defined trigger anywhere in the base document — the flow always opens at 78vh. Peek is removed from v1. Sheet states: **default (78vh)** and **full**. Peek is reserved; reintroduction requires a defined trigger and its own telemetry.

### 4.4 Social-proof cold start (amends §4, row "Plan popularity")

"Most reselected lunch in this plan" requires reselection history that does not exist at launch. The claim ships only when server-computed backing data qualifies:

```
social_proof: {
  type: "most_reselected",
  n: <distinct reselecting subscribers>,
  window_days: 28
}
```

- Render conditions: `rank = 1` within the plan AND `n ≥ 30` AND window = trailing 28 days.
- Below threshold, fallback ladder: (1) "Dietitian's pick for this protocol" — only when an actual `rd_pick = true` flag exists on the dish; (2) no badge.
- Rendering a popularity claim from seeded, simulated, or aggregate-less data is prohibited. This is the §6 ethical-scarcity doctrine extended to social proof.

---

## A5 — À-la-Carte Scope Gate

**Amends:** §1.4 (cart state model). **Decision:** v1 own-site commerce is subscription + 3-day trial only, per the one-pillar thesis.

- Cart **States B and C** (à-la-carte counts, "Free delivery included" interstitial, delivery-threshold logic) ship behind `alc_checkout_enabled = false` and are excluded from the v1 QA surface. Flipping the flag restores them verbatim; no other code path may depend on the flag.
- The Persistent Nutrition Cart first appears when a plan or trial context exists (State D onward, plus the new State T below).
- Menu/sheet Add behavior in v1: the sheet CTA is **"Add to my plan"** in plan-builder context. The trial flow uses a curated default meal set with swaps (reusing the §3.2 Step 5 pattern), so the trial requires no free-form cart additions.

### New State T — Trial box in progress

Primary line: `3-day trial · 2 of 3 meals confirmed`
Secondary line: `₹2,250 one-time · No auto-renewal`
CTA: `Continue`

The secondary line's renewal statement is mandatory and may not be truncated at any supported viewport.

---

## A6 — Experimentation Deferral

**Amends:** §13.1 (envelope), §15.2 (`commitment_copy_variant`).

- v1 ships **no assignment service**. `experiment_assignments` remains in the envelope as `{}` — an empty object, never null, never removed — so a future platform slots in without an `event_version` bump.
- `commitment_copy_variant` is fixed to `\"v1\"`.
- New envelope field: `app_release` (semver). Copy and design iterations ship sequentially; dashboards read them as release cohorts.
- Any dashboard or report label claiming "A/B" results without an assignment service is prohibited; before/after reads must be labeled release comparisons.

Rationale: current order volume lacks statistical power for subscription-conversion splits. The schema is preserved; the infrastructure is deferred to Sprint 9+.

---

## A7 — Recurring-Mandate Compliance & Billing Surface (new §21)

**Adds:** §21. **Amends:** §3.2 Step 3 (disclosures), §16 (error taxonomy already contains `mandate_creation` / `mandate_failure`; this section supplies the missing flow).

Regulatory basis: RBI **Digital Payments — E-mandate Framework, 2026** (Circular RBI/DPSS/2026-27/396, April 2026), which consolidates the prior e-mandate circulars and applies across UPI, cards, and PPIs. Key obligations adopted below: one-time AFA at mandate registration; no per-cycle AFA for recurring debits up to ₹15,000 (the ₹1,00,000 enhanced tier covers only insurance, mutual funds, and credit-card bills — not this category); mandatory pre-debit notification at least 24 hours before every debit, with an opt-out facility; mandatory post-debit confirmation; mandate validity period disclosed at registration; customer-initiated modify/pause/revoke authenticated via AFA; zero customer charges for the e-mandate facility. Implementation task: re-verify the prevailing circular at launch.

### 21.1 Instrument mapping

| Billing choice (§3.2 Step 3) | Instrument |
|---|---|
| Weekly | UPI Autopay e-mandate (via payment aggregator; Razorpay per current stack) |
| Bi-weekly | UPI Autopay e-mandate |
| Six-week single payment | One-time UPI intent/collect or card |
| 3-day trial | One-time payment only. A trial may never create a mandate. |

### 21.2 Mandate parameters

- Frequency: fixed (weekly or bi-weekly).
- Amount: registered as a **maximum** equal to the configured payable ceiling including permissible swap deltas; disclosed as "up to ₹X per week."
- Start date: first billing date. End date: protocol end. With `auto_continue_after_protocol = false`, open-ended mandates are prohibited in v1. Validity period is displayed at registration (regulatory requirement).
- Weekly ₹3,800 sits under the ₹15,000 no-AFA cap; any future plan priced above the cap requires per-debit AFA UX before it may be sold.

### 21.3 Step 3 disclosure (verbatim, appended to the weekly and bi-weekly options)

> Weekly payments use UPI Autopay. You'll get a notification at least 24 hours before each charge, and you can pause or revoke the mandate anytime from Billing. Setting up Autopay is free.

### 21.4 Pre-debit and post-debit notifications

- Pre-debit: scheduled 24–26 h before each debit, default 10:00 IST. Channels: WhatsApp utility with SMS fallback (§23). Content: amount, date, plan name, cut-off deadline, manage/opt-out link. This operationalizes §3.3 "You will see each future charge and its date before you pay."
- **A debit MUST NOT execute if its pre-debit notification failed to dispatch.** The debit is blocked, retried after notification success, and an ops alert is raised.
- Post-debit: a confirmation is sent after every successful collection (amount, date, next charge date). Mandatory per the framework.

### 21.5 Mandate lifecycle

```
pending_authorization → active → {
  paused_cycle          (skip: suppress one debit + that week's fulfilment + notify)
  revoked_by_user
  revoked_by_issuer
  expired               (protocol end reached)
  failed
}
```

- Skip ≠ revoke. Cancel-plan and revoke-mandate are two distinct confirmations inside one flow; completing plan cancellation without mandate revocation (or vice versa) is a defect.
- Customer-initiated modify/pause/revoke passes AFA per the framework; the UX budget for this remains ≤ 3 taps inside the product before handoff to the UPI app.

### 21.6 Billing surface — /account/billing

Fulfills the §7.3 promises ("pause or cancel before each cut-off," "see your next charge"). Contents:

- Next charge: amount + date, in data numerals.
- Mandate status chip (`active`, `paused`, etc.).
- `[Skip next week]` with a live, system-true cut-off countdown (§6 rules apply).
- `[Pause plan]`, `[Cancel plan]` — self-serve, ≤ 3 taps, zero support-contact dependency.
- §18 guardrail "cancellation difficulty" gains metrics: `cancellation_completion_time`, and `support_contact_dependency = false` target ≥ 95% of cancellations.

### 21.7 Telemetry

`mandate_created` { max_amount_minor, end_date } · `mandate_authorization_failed` (maps to §16.3 `error_stage = mandate_creation`) · `predebit_sent` / `predebit_delivered` { debit_date } · `debit_executed` · `debit_blocked_notification_missing` · `postdebit_sent` · `mandate_revoked` { initiator } · `week_skipped` { via }

### Acceptance criteria

- No debit path exists without a matching dispatched pre-debit record; the block-and-retry path is tested.
- Revocation propagates to the debit scheduler within 60 seconds.
- The trial checkout provably cannot reach mandate creation.

---

## A8 — Discovery Surface & Re-Rank Contract (new §22)

**Adds:** §22. **Amends:** §18 (funnel table).

Problem bound: the measured own-funnel weakness is menu-to-cart (28.1% vs. a ~46% peer benchmark), and the base spec begins *after* the add moment. This is the minimum viable discovery spec — dish card, ranking contract, and the assessment→menu handshake — at the same normative fidelity as §2.

### 22.1 Dish card (menu grid, 2 columns at ≥ 360 px)

| Element | Spec |
|---|---|
| Image | 1:1, `radius-md`, ≤ 60 KB AVIF/WebP; real dish photography only — the §2.4 stock-photo prohibition applies here identically |
| Name | Max 2 lines, 15/20 px, weight 600 |
| Data line | `480 kcal · 32 g protein · ₹750` in data numerals (A3 Rule 3.2) |
| Badges | Maximum 2 (GI badge + one of RD/diet) — same ceiling as §2.4 |
| Fit chip | Only when `personalization_level = assessment_complete`: "Strong goal match" (`fit_band = high`) |
| Add | ≥ 44 × 44 px target; opens the §2 bottom sheet |
| Conflict items | Rendered, not hidden: flagged "Contains milk," Add disabled; sheet explains per §10.2 |

### 22.2 Rank contract

```
GET /menu/ranked?profile_id=&assessment_version=

items[]: {
  dish_id,
  rank,
  fit_band: high | moderate | neutral | conflict,
  rank_reason_codes[],
  nutrition_snapshot_id,
  social_proof?          // per A4.4
}
```

- Section order: (1) **"Matched to your goal"** — `fit_band = high`, max 8 items; (2) categories in RD-curated order.
- Unassessed users: RD-curated order only, no fit chips (the §2.8 invariant — never imply personalization the system doesn't have — applies to the menu), plus an assessment banner:

> Answer 5 questions (about 60 seconds) to rank this menu for you.

- Ranking is server-computed. The client never derives `fit_band` locally.

### 22.3 Re-rank triggers

Assessment completed or edited; allergen change (§10 sequence); goal change. The stale menu is marked and refreshed within 1 s using row-level shimmer only — no full-page skeleton on re-rank.

### 22.4 Telemetry and funnel

- `menu_viewed` { personalization_level }
- `dish_card_impression` — batched; fires at ≥ 50% visibility for 500 ms
- `dish_sheet_opened` { rank, fit_band, section }
- `add_committed` { source }

§18 gains a row:

| Funnel stage | Primary metric | Guardrail |
|---|---|---|
| Discovery | Menu→sheet rate; sheet→add rate | Conflict-item exposure rate; mis-rank complaints |

Read the composite menu→add rate segmented by `personalization_level` for one full cohort before setting targets; the 46% benchmark is an aggregator figure and transfers only directionally.

---

## A9 — Operational Communications Layer (new §23)

**Adds:** §23. **Amends:** §8.2 (consents object).

### 23.1 Channel matrix

| Purpose | Class | Primary | Fallback |
|---|---|---|---|
| Order, payment, delivery status; pre/post-debit; cut-off for an active plan | Utility | WhatsApp | SMS |
| Trial bridge T1–T3 (§7.5.5) | Utility (service-linked) | WhatsApp | Email |
| Win-back, promotions | Marketing | WhatsApp marketing template | Email |

/owl Consents (extends the §8.2 `consents` object):

```
"consents": {
  ...,
  "whatsapp_utility": true,      // disclosed at order; service messages
  "whatsapp_marketing": false,   // explicit opt-in only
  "sms_fallback": true
}
```

Marketing templates require `whatsapp_marketing = true`. Utility templates follow WhatsApp Business utility-category rules and carry no promotional content.

### 23.2 Quiet hours

21:30–08:00 IST for everything except payment-failure and delivery-day operational messages. Pre-debit notifications schedule at 10:00 IST by default (§21.4), which satisfies both the 24-hour rule and quiet hours.

### 23.3 Template registry

- Every template is versioned (`template_id`); every dispatch emits `comm_sent` / `comm_delivered` / `comm_failed` { template_id, channel, purpose_class }.
- Dedupe key: `(user_id, template_id, service_date)`. A duplicate dispatch is a defect, not a retry.

### 23.4 Stop paths

Every marketing template carries a working stop action; a stop is honored before the next dispatch cycle and emits a consent-change event. The trial T3 "Stop reminders" action (§7.5.5) is implemented through this mechanism.

### 23.5 Cut-off reminder discipline

The §6 Variation 1 reminder dispatches at T−3h **only if** the next service week has an unresolved required action (unreviewed plan change, blocked meal, pending payment issue). An account with nothing to resolve receives silence. Ritual noise erodes the utility channel.

---

## A10 — Health-Data Lifecycle (new §24)

**Adds:** §24. **Amends:** §8.2 (session payload rule).

Problem bound: §5.4 promises "You can remove it from your profile later." The base document never builds the mechanism, and DPDP-grade hygiene for sensitive health data is unspecified.

### 24.1 Per-field removal — /account/health-information

Lists every stored sensitive field (HbA1c, PCOS context, height/weight, conditions) with a per-field **Remove** action.

Removal semantics:
- Hard delete from the secure profile store (no soft-delete retention of the value).
- Recommendation state marked stale and recomputed (§10 pattern).
- Derived analytics flags flip on the next event (`hba1c_provided = false`); historical events are untouched — they never contained raw values (§13.2).

Confirmation copy (verbatim):

> HbA1c removed. Meal ranking will update and no longer use this value.

The §5.4 privacy note ("You can remove it from your profile later") deep-links to this screen. A promise in copy without a reachable mechanism is a defect.

### 24.2 Session payload rule (amends §8.2)

Checkout sessions carry **references, not values**: `profile_id` + `assessment_version` only. Sensitive health values never enter checkout-session payloads, logs, or replicas. Allergens and exclusions remain in-session — they are safety-critical operational data required for §10 validation — and this boundary is now codified: *allergens in session, clinical values by reference.*

### 24.3 Retention and consent versioning

- Sensitive fields persist only while the account is active; account deletion purges the profile store within 30 days.
- `health_data_processing` consent stores `{ granted, policy_version, timestamp }`. A material policy change gates the next assessment **edit** behind re-consent — it does not block ordering on an already-configured plan.

### 24.4 DPDP alignment

Access, correction, and erasure are self-serve where mechanisms above cover them; the privacy page names a grievance contact. Launch task: verify current DPDP Rules obligations (notice language, consent manager applicability) against this section.

---

## Amended §20 — Delivery Resequence (delta only)

| Sprint | Additions from this amendment set |
|---|---|
| 1–2 | §0.4 rendering doctrine + CI gates (A1); token-binding lint (A3); price-literal CI gate (A4.2); geography lint (A1) |
| 3–4 | §22 dish cards + rank contract (A8); §2.6 denominator corrections (A4.1) |
| 5–6 | §7.5 trial bridge (A2); §21 mandate creation + Step 3 disclosures (A7); §23 utility templates T1–T3 + pre-debit scheduler skeleton (A9) |
| 7–8 | Pre-debit enforcement — debit blocked without notification (A7); §21.6 billing surface; §24 health-data removal (A10) |
| 9+ | Experimentation platform (A6); §6 scarcity Variations 2–3; sheet peek state (A4.3, reserved); `alc_checkout_enabled` flag (A5); adherence dashboard |

**MVP cut line: v1 launch = end of Sprint 8.** Everything above the line ships; nothing in Sprint 9+ blocks launch. Any scope addition to Sprints 1–8 requires an explicit removal or a timeline extension — no silent absorption.

---

## Consolidated Acceptance Additions (append to §19)

- **Money path:** every manifest route passes the no-JS content assertion in CI; `/subscribe` variants meet LCP budget on throttled 4G.
- **Single system:** zero color literals outside the token file; zero legacy System-A imports; zero prohibited geography strings in the consumer bundle.
- **Pricing:** zero hardcoded `₹` literals in components; Step 0 displayed price equals the live quote payable.
- **Trial:** no code path converts a trial without an explicit CTA plus the Step 6 disclosure; capacity holds are server-re-validated at CTA tap.
- **Mandates:** no debit executes without a dispatched pre-debit notification; post-debit confirmations fire on every collection; revocation reaches the scheduler within 60 s; cancel is ≤ 3 taps with zero support dependency.
- **Social proof:** popularity badges render only with qualifying server-computed `n ≥ 30` in a 28-day window.
- **Comms:** dispatches dedupe on `(user, template, service_date)`; quiet hours enforced; every marketing template has a working stop path.
- **Health data:** per-field removal verifiably purges the profile store, recomputes recommendations, and flips derived flags; checkout sessions contain no raw sensitive values.

*End of Amendment Set 01.*
