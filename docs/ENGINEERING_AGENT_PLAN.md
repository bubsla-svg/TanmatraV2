# Tanmatra — Engineering Agent Execution Directives

**Generated:** 2026-07-25 · **Pinned to `origin/main` = `766888da`**
**Scope:** everything that remains to be built on the money paths, plus the sync and push discipline that surrounds it.

Read this top to bottom before touching a file. Section 1 tells you how to establish ground truth against the remote. Section 2 is the ordered work. Section 3 is how to land it. Skipping Section 1 is the single most common way this plan goes wrong — `origin/main` has moved three times since the sprint plan was written, and two items the plan lists as "to build" are already shipped.

---

## 1. Sync directives — establish ground truth before you write anything

### 1.1 The rule

**Never trust a local working copy, a plan document, or this file's line numbers as evidence of what is broken.** Every defect claim in Section 2 was verified with `git show origin/main:<path>`, not by reading the checkout. Re-verify the same way before you fix anything. Four separate plan items in this repo's history turned out to be already-fixed on `main` and were nearly re-implemented.

### 1.2 Credentials

The GitHub PAT lives at `/root/.wf-pat` and is reached only through the file-backed credential helper already configured in this repo:

```
!f() { echo "username=x-access-token"; echo "password=$(cat /root/.wf-pat)"; }; f
```

Never echo it, never inline it in a URL, never commit it. Filter every network git command's output:

```bash
git fetch origin 2>&1 | grep -v -iE "ghp_|github_pat_|x-access"
```

### 1.3 Sync sequence

```bash
cd /home/claude/wf
git status --short                                  # MUST be empty before you start
git fetch origin 2>&1 | grep -v -iE "ghp_|github_pat_|x-access"
git rev-parse --short origin/main                   # expect 766888da or newer
git log --oneline -8 origin/main
```

If `git status --short` is not empty, resolve that first. Do not start new work on a dirty tree — this plan assumes a clean base, and a stray edit will end up in someone else's commit.

### 1.4 Re-derive the merge queue

`behind / ahead` relative to `origin/main`. Run this before you pick up any existing branch — the numbers below are a snapshot, not a contract:

```bash
for b in $(git branch -r --no-merged origin/main | sed 's|origin/||'); do
  printf "%-52s %s\n" "$b" "$(git rev-list --left-right --count origin/main...origin/$b | tr '\t' '/')"
done
```

Snapshot at `766888da`:

| Branch | behind / ahead | Note |
|---|---|---|
| `claude/addons-attach-no-money-write` | 0 / 3 | **Ready to merge as-is.** Fixes S6. |
| `claude/refund-console-cap` | 6 / 1 | Base (`agent-refund-cap-authority`) is merged; just merge `main` in. |
| `claude/refund-lifecycle-webhook` | 6 / 2 | Same — base merged, needs `main` merged in. MP-6. |
| `claude/voucher-purchase-requires-payment` | 8 / 1 | **Highest-value open branch.** Fixes S1/MP-1. |
| `claude/petpooja-saveorder-idempotent` | 17 / 1 | Bottom of the 6-deep PetPooja stack. |
| `claude/petpooja-status-monotonic` | 17 / 2 | Stack #2 |
| `claude/petpooja-saveorder-test-mock` | 17 / 3 | Stack #3 |
| `claude/orders-status-check-constraint` | 17 / 4 | Stack #4 |
| `claude/petpooja-inbound-total-invariant` | 17 / 5 | Stack #5 |
| `claude/analytics-order-channel-visible` | 17 / 6 | Stack top |
| `claude/storefront-tests-ci-reach` | 20 / 1 | MP-14 |
| `claude/tanmatra-tests-reach` | 20 / 2 | MP-14 |
| `claude/petpooja-push-charge-fidelity` | 20 / 1 | |
| `claude/domain-cutover-doc` | 20 / 1 | D1 |
| `claude/petpooja-webhooks-fail-closed` | 20 / 1 | S2 |
| `claude/ops-routes-require-auth` | 20 / 1 | |
| `claude/menu-engineering-zero-cost-guard` | 20 / 1 | |
| `claude/wbr-food-cost-lookup` | 20 / 1 | |
| `claude/claude-md-storefront` | 20 / 2 | Docs |
| `claude/storefront-test-script` | 20 / 3 | |

**The PetPooja stack is ordered and must stay ordered.** Each branch forks from the one above it. Rebase and review in this sequence, never in isolation:

```
petpooja-saveorder-idempotent
  → petpooja-status-monotonic
    → petpooja-saveorder-test-mock
      → orders-status-check-constraint
        → petpooja-inbound-total-invariant
          → analytics-order-channel-visible
```

Merging any of these out of order will produce conflicts that look like logic errors.

### 1.5 What landed after the sprint plan was written

The sprint plan (`claude/money-path-sprint-plan.md`) was verified against `346dae36`. Three PRs have merged since. **Correct the plan against this, not the other way round:**

| Commit | PR | Effect |
|---|---|---|
| `766888da` | #387 `claude/agent-refund-cap-authority` | MP-5 refund cap shipped. Unblocks the two refund branches above. |
| `a5b30b13` | #390 `claude/marketplace-checkout-collects-payment` | **MP-3 is SHIPPED.** Do not re-implement. See the note below on *where* the payment code actually lives. |
| `ac670a10` | #388 `claude/marketplace-tests-ci-reach` | Part of MP-14. `verify.yml` now names the two marketplace test files. |

**Where PR #390's marketplace payment code actually lives.** The merge stat reads `marketplaceApi.ts +20 / MarketplaceItem.tsx +143`, which invites the wrong conclusion. Verified against `origin/main`: the `+20` in `marketplaceApi.ts` is **entirely the `externalOrderId` field and its two doc comments** (lines 89-115) — there is **no `pay`, no `verify`, and no `razorpayClient` import in that file at all**. The whole payment orchestration is inline in the component:

```
MarketplaceItem.tsx:10   import { payWithRazorpay, razorpayConfigured } from "@/lib/razorpayClient";
MarketplaceItem.tsx:134  const outcome = razorpayConfigured() ? await payWithRazorpay({…}) : "unavailable";
MarketplaceItem.tsx:137    receipt: order.externalOrderId,
MarketplaceItem.tsx:142  if (outcome === "paid") { … }
```

Two consequences. First, do not go looking for a `marketplaceApi.pay(...)` helper to copy — it does not exist. Second, this **diverges from the storefront idiom**, where `artifacts/storefront/lib/rdBookingApi.ts` puts `payForAppointment` in the API module and leaves the component thin. E13 covers extracting it; until then, when you mirror this pattern for premium (E2) or RD consults (E3), follow the storefront's module-level-helper idiom, not this component-inline one.

Two further plan corrections, both verified against `origin/main` this pass:

- **MP-2 (Premium) is frontend-only.** `premium.ts` already has `/premium/checkout` at line 140 and `/premium/verify` at line 231, and `/premium/subscribe` at line 100 now returns `409 {code:"payment_required"}`. The backend is done. Only `Premium.tsx` leaks.
- **MP-4 (RD consults) is two-thirds done.** `rdAdvisory.ts` has a correct `/checkout` (539) and `/verify` (634), and `artifacts/storefront/lib/rdBookingApi.ts` already implements the full pay flow. Only the legacy `artifacts/tanmatra` app leaks.

### 1.6 Environment sanity

Before running any test, confirm the workspace installs cleanly. A stale `node_modules` produces `ERR_MODULE_NOT_FOUND: @workspace/subscription-rules`, which is an environment artifact and **not** a code defect:

```bash
pnpm install --prefer-offline
```

---

## 2. Execution list

Ordered by money at risk, then by blast radius. Each item states its branch, its anchor on `origin/main`, what to change, what to test, **which line of `verify.yml` the test must be named on**, and how to verify.

Two standing constraints apply to every item:

- **Money authority is server-side.** The client never authors an amount. It reads the amount from the server's checkout response and displays it.
- **One concern per branch.** If a fix requires touching a shared helper used by other callers, that helper change is its own branch.

---

### E1 — Vouchers mint spendable credit for free `[CRITICAL]`

**Branch:** `claude/voucher-purchase-requires-payment` (exists, 8 behind / 1 ahead)
**Anchor:** `artifacts/api-server/src/routes/corporate.ts:793` (`POST /vouchers`), redemption at `:868`, raw ledger write at `:901`
**Plan ID:** S1 / MP-1

`POST /corporate/vouchers` creates a voucher with no payment step. `POST /corporate/vouchers/redeem` then writes directly into `credit_ledger` via raw SQL at line 901. Anyone with a session can mint arbitrary spendable balance. This is the largest open hole and the fix already exists on a branch.

**Do:** merge `origin/main` into the branch, resolve, re-run the suite, hand off. Do not rewrite the fix — review it, then land it.

```bash
git checkout claude/voucher-purchase-requires-payment
git merge origin/main
```

**Tests:** `./src/routes/vouchers.test.ts` — already named in `verify.yml:168`. Confirm it still passes after the merge.

**Owner action this creates:** vouchers already minted for free in production need triage. Flag it; do not attempt a data fix from here.

---

### E2 — Premium membership activates without payment `[CRITICAL, frontend-only]`

**Branch:** `claude/premium-frontend-collects-payment` (new, fork from `origin/main`)
**Anchor:** `artifacts/tanmatra/src/tanmatra-v2/Premium.tsx:39-40, :163, :167`
**Plan ID:** MP-2

`Premium.tsx` calls `premiumApi.subscribe` (line 40) directly on button click (line 163). The backend now refuses that with `409 {code:"payment_required"}`, so today the button is simply broken — but the frontend has no path to `/premium/checkout` at all.

**Change 1 — `artifacts/tanmatra/src/lib/marketplaceApi.ts`,** add to the `premiumApi` object (currently lines 144-164):

```ts
checkout: () =>
  request<{ razorpayOrderId: string; amount: number; currency: string; keyId: string }>(
    `/premium/checkout`,
    { method: "POST" },
  ),
verify: (payment: {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}) =>
  request<{ membership: PremiumMembership; isPremium: true }>(`/premium/verify`, {
    method: "POST",
    body: JSON.stringify(payment),
  }),
```

**Change 2 — `Premium.tsx`,** replace the `subscribe` mutation body with: call `premiumApi.checkout()`, pass the returned `razorpayOrderId` and `amount` to `openRazorpayCheckout` from `./razorpayClient`, then call `premiumApi.verify(payment)` on the `"paid"` outcome. Handle `"cancelled"` and `"unavailable"` without claiming success. The amount displayed must come from the checkout response, never from a client constant.

**Use `openRazorpayCheckout` (razorpayClient.ts:61), not `payWithRazorpay` (:120).** `payWithRazorpay` is hardwired to `/payments/razorpay/order` + `/payments/razorpay/verify`, which key on an `orders` row. Premium memberships are not `orders` rows.

**Tests:** extend `./src/routes/premium.paymentOrder.test.ts` (already at `verify.yml:169`) if backend behaviour changes — it should not. Add a web-side unit test for the new `premiumApi` helpers and name it in the **`Money-math unit tests (web)`** step at `verify.yml:81-91`.

**Verify:** `pnpm run typecheck` && `pnpm --filter @workspace/tanmatra run lint:gates`.

---

### E3 — RD consults charge nothing `[CRITICAL, frontend-only]`

**Branch:** `claude/rd-consult-collects-payment` (exists locally, forked from `a5b30b13` — rebase onto `766888da`)
**Anchors:** `artifacts/tanmatra/src/tanmatra-v2/CheckoutAppointment.tsx:69, :72, :82, :86`; `artifacts/tanmatra/src/lib/rdAdvisoryApi.ts` (no pay helper exists); `artifacts/tanmatra/src/tanmatra-v2/Appointments.tsx:82-87, :451`
**Plan ID:** MP-4

`CheckoutAppointment.tsx:72` is `await new Promise((r) => setTimeout(r, 1200));` under a comment that says "Mock payment processing UI delay". The UI then claims "Confirm & pay" (131), "Total to pay" (167), "Payment settled server-side via signed webhook" (170 — this is false), and "Secured payment · SSL encrypted" (201). No money moves. The backend `/rd/appointments/:id/checkout` (`rdAdvisory.ts:539`) and `/verify` (`:634`) are both correct and already used by `artifacts/storefront/lib/rdBookingApi.ts`.

**The design is settled. Implement exactly this:**

**Change 1 — `rdAdvisoryApi.ts`,** add `checkout`, `verify`, and a `payForAppointment` orchestrator. `payForAppointment` takes `{appointmentId, description, contact?}` and reads the amount from the server's checkout response, so the client is structurally incapable of authoring a price.

**Change 2 — four outcomes, not three.** The shared `RazorpayOutcome` is `"paid" | "cancelled" | "unavailable"`. The appointment flow needs a fourth: **`"unconfirmed"`**.

Why: `payWithRazorpay` resolves `"paid"` when verify throws (razorpayClient.ts:188-192), justified by "the Razorpay webhook + manual reconciliation cover this." **That justification does not transfer.** `grep -n "rdAppointments\|rd_appointments" src/routes/payments.ts` returns zero matches — nothing in the webhook body (payments.ts:635-780) touches `rd_appointments`. A captured-but-unverified appointment payment would sit at `paymentStatus='pending'` forever. It must not be reported as paid, and it must not be naively retried — a retry mints a second Razorpay order and double-charges.

Return `"unconfirmed"` when the checkout succeeded and the modal returned a payment but the `verify` call threw a transport error (a `TypeError`, distinguishable from the `Error(\`${status}: ...\`)` that `request<T>` throws on a non-2xx at `rdAdvisoryApi.ts:68`). Surface it to the user as "we're confirming your payment" with no retry button.

**Change 3 — hold the created appointment in state.** `pay()` currently books then navigates. It must book, hold the returned appointment id, then pay for *that* appointment, so a retry pays for the existing row rather than creating a second one. Hold the idempotency key in a `useRef` so retries of one submit reuse it.

**Change 4 — gate the join link.** `Appointments.tsx:82-87` (`statusPill`) branches only on `status`; `paymentStatus` is read nowhere in the file. The "Join call" link at ~`:451` has no payment gate. Gate on `appt.paymentStatus !== "pending"`.

**Failure-state styling:** use `var(--color-nn-error)` — the idiom already in `CheckoutAppointment.tsx`'s failure block (175-199). Do **not** use `.tnm2 .note`; it is sage-toned/positive and reads as success.

**Icon idiom:** `CheckoutAppointment.tsx` and `Appointments.tsx` use the icon font (`<i className="ph-bold ph-…" />`). Stay with each file's own idiom — do not import the Phosphor React component here.

**Explicitly out of scope for this branch:** changing `openRazorpayCheckout` to use the server-returned `keyId` instead of the `VITE_RAZORPAY_KEY_ID` build var. That touches every caller. Separate branch.

**Tests:** `./src/routes/rdAdvisory.appointmentOrder.test.ts` is already at `verify.yml:167`. Add a web unit test for the four-outcome discriminator and name it at `verify.yml:81-91`.

---

### E4 — Refund lifecycle webhook `[HIGH]`

**Branch:** `claude/refund-lifecycle-webhook` (exists, 6 behind / 2 ahead)
**Plan ID:** MP-6

Base is now merged. Merge `origin/main` in, re-run, hand off. Pair it with `claude/refund-console-cap` (6/1) — same base, same merge.

---

### E5 — PetPooja webhooks accept unauthenticated callers `[CRITICAL]`

**Branch:** `claude/petpooja-webhooks-fail-closed` (exists, 20 behind / 1 ahead) — verify it covers all sites below before landing
**Anchors:**
- `artifacts/api-server/src/routes/petpooja.ts` — `petpoojaAuthOk(req, req.log, "lenient")` at lines **16, 141, 398, 441, 506**
- `artifacts/api-server/src/lib/petpoojaClient.ts:106-109` — returns `true` when `!r.configured`
- `artifacts/api-server/src/lib/petpoojaClient.ts:111-114` — returns `true` in `"lenient"` mode when no credentials were presented
- `artifacts/api-server/src/routes/petpooja.ts:74, :95, :222, :302, :486` — **no auth call at all**

**Plan ID:** S2 + S10

Two distinct fail-open paths. `petpoojaClient.ts:106-109` allows every request when `PETPOOJA_APP_SECRET` is unset (fails open on misconfiguration). `:111-114` allows any request that simply omits credentials, in `"lenient"` mode. Five route handlers use `"lenient"`; five others call nothing at all. `lib/petpooja.ts:653-667` maps inbound `"1"` → `"preparing"` (which by house convention **means paid**) and `"6"` → `"delivered"` — so an unauthenticated caller can mark orders paid and delivered.

**Fix shape:** flip both defaults to fail-closed, add the missing calls at the five bare handlers, and keep an explicit opt-in env flag for the transition window if the vendor genuinely cannot send the header yet. `./src/lib/petpooja.test.ts` is at `verify.yml:210` — extend it, do not create a parallel file.

**Blocking owner action:** the live PetPooja `app_key` / `app_secret` / `access_token` were emailed in plaintext to six-plus recipients and **must be rotated**. They live only in `/root/.wf-pp-probe.json`, outside the repo. Never print, log, echo, or commit any of them. Never call a `*_save_api` write endpoint against the live outlet — APIs 1, 2, 3, 4, 6, 7 mutate real stock.

---

### E6 — Ops-only delivery endpoints gated by session alone `[HIGH]`

**Branch:** `claude/delivery-ops-gate` (new, fork from `origin/main`)
**Anchors, all in `artifacts/api-server/src/routes/delivery.ts`:**

| Route | Line | Current gate |
|---|---|---|
| `POST /delivery/events` | 47 | `req.isAuthenticated()` (48) |
| `POST /delivery/rider-position` | 74 | `req.isAuthenticated()` (75) |
| `POST /delivery/schedule-advance` | 95 | `req.isAuthenticated()` (96) |
| `POST /delivery/auto-assign` | 140 | `req.isAuthenticated()` (141) |
| `POST /delivery/eta/record-actual` | 248 | `req.isAuthenticated()` (249) |

**Plan ID:** S4 / S5 / S9

`resolveOps(req)` is defined at line **269** and is the gate every route from 281 onward uses (281, 319, 356, 377, 390, 411, 440). The five routes above are ops actions — advancing schedules, auto-assigning riders, writing delivery events — reachable by any signed-in customer. The fix is mechanical: replace `req.isAuthenticated()` with `resolveOps(req)` and move the five handlers below the function definition (or hoist it).

Also review `GET /delivery/:orderId/timeline` (26), `POST /delivery/eta/estimate` (216), `GET /delivery/eta/:orderId` (229) — no gate appears in the grep. Confirm whether that is intentional before changing them.

**Tests:** new file `./src/routes/delivery.opsGate.test.ts`, added to the **`Money-path integration tests`** run at `verify.yml:154-171`.

---

### E7 — Add-ons attach inflates `total_paise` without charging `[HIGH]`

**Branch:** `claude/addons-attach-no-money-write` — **0 behind / 3 ahead, ready to merge now**
**Anchor:** `artifacts/api-server/src/routes/addons.ts:228-232`
**Plan ID:** S6

```ts
await db
  .update(ordersTable)
  .set({ totalPaise: order.totalPaise + totalAddedPaise })
  .where(eq(ordersTable.id, orderId));
```

Attaching an add-on raises the order total "for transparency" and collects nothing. The branch is clean against `main`. **Land it first, before anything that touches `addons.ts`.**

Owner action it creates: production orders whose `total_paise` was inflated need triage, and the owner must decide re-charge vs. unbilled amendment.

---

### E8 — Corporate subsidy double-bills `[HIGH]`

**Branch:** `claude/corporate-subsidy-single-charge` (new)
**Anchors:** `artifacts/tanmatra/src/tanmatra-v2/Checkout.tsx:1264-1266`, `:1358`, `:1623-1629`
**Plan ID:** S3

Checkout opens the Razorpay modal on the **net** (post-subsidy) figure while passing the **full-amount** `order_id`, then bills the company for the subsidy on top at `:1623-1629`. Either the customer is charged the wrong amount or the total is collected twice. Resolve the amount server-side: one authoritative charge, one company invoice line, reconciled.

---

### E9 — Corporate accepts a client-supplied amount `[HIGH]`

**Branch:** `claude/corporate-server-authoritative-amount` (new)
**Anchor:** `artifacts/api-server/src/routes/corporate.ts:455-529`
**Plan ID:** S7

Accepts `paise` from the request body and an unvalidated `orderRef`. Derive the amount server-side from the referenced order; validate `orderRef` ownership.

---

### E10 — Loyalty grants a meal credit on an unpaid order `[MEDIUM]`

**Branch:** `claude/loyalty-credit-requires-paid` (new)
**Anchor:** `artifacts/api-server/src/routes/loyalty.ts:374-401`
**Plan ID:** S8

The referral creditback fires on order creation. Under house convention `status: "placed"` means **unpaid**. Gate on `PAID_STATES` (`preparing`, `ready`, `out_for_delivery`, `delivered`). `./src/routes/loyalty.referral.test.ts` is at `verify.yml:164` — extend it.

---

### E11 — Premium's bundled RD consult is never spent `[MEDIUM]`

**Branch:** `claude/premium-consult-entitlement` (new)
**Anchors:** `artifacts/api-server/src/routes/premium.ts:308` (`/premium/use-rd-consult`, zero callers); `Premium.tsx:147-149` (navigates without consuming)

Members pay for consults they cannot spend. Wire the entitlement into the RD booking path so a premium member's included consult is consumed instead of charged. **Do this after E3** — it depends on the RD payment path existing.

---

### E12 — RD secondary defects `[MEDIUM]`

**Branch:** `claude/rd-payment-predicates` (new)
**Anchors:** `rdAdvisory.ts:880` (`PATCH /rd/console/appointments/:id/notes` sets `joinUrl` with no `paymentStatus` predicate); `rdAdvisory.ts:699` (`cancel` has no refund path for a `paid` row)

An RD can hand out a join link for an unpaid appointment, and cancelling a paid appointment refunds nothing.

---

### E13 — Marketplace secondary defects `[MEDIUM]`

**Branch:** `claude/marketplace-stock-reservation` (new)

Stock is decremented before payment, there is no reservation TTL, and there is no cancel endpoint. An abandoned checkout permanently removes inventory. MP-3 shipped the payment collection; this is the follow-on.

A second, separable concern (own branch, `claude/marketplace-pay-helper-extract`): PR #390 left the payment orchestration inline in `MarketplaceItem.tsx:134-161` instead of in `marketplaceApi.ts`, diverging from the storefront idiom (`artifacts/storefront/lib/rdBookingApi.ts` exposes `payForAppointment` at module level). Extract a `marketplaceApi.pay(...)` helper so the component stops importing `razorpayClient` directly. This is a refactor with no money-behaviour change — pin it with the existing marketplace tests before and after, and do not fold it into the stock-reservation branch.

---

### E14 — Subscription recurring-charge defects `[P1]`

Three separate branches, three separate concerns — do not combine:

| Branch | Anchor | Defect |
|---|---|---|
| `claude/sub-mandate-no-double-charge` | `chargeMandate.ts:594-617` | Recurring double-charge |
| `claude/sub-changeplan-no-double-bill` | `subscriptions.ts:2440-2459` | Change-plan reauth double-bill |
| `claude/sub-resume-rearms-nextcharge` | `subscriptions.ts:1509-1516` | Resume re-arms `nextChargeAt` |

---

### E15 — Reconciliation and CI reach `[P1]`

- **MP-12** — nothing reconciles RD or Premium captures. `payments.ts` webhook (635-780) has no `rd_appointments` handling and no premium handling. Add both, or add a reconciliation job. **This is what makes E3's `"unconfirmed"` outcome eventually self-healing** — until it exists, `"unconfirmed"` is terminal.
- **MP-13** — `razorpayClient.ts:188-192` `catch { return "paid" }`. Revisit once MP-12 lands.
- **MP-14** — CI reach. **91 test files exist in `artifacts/api-server`; only ~29 are named in any workflow.** `verify.yml` enumerates files individually — anything not named runs nowhere. Land `claude/storefront-tests-ci-reach` and `claude/tanmatra-tests-reach`, then audit the remainder.

---

### E16 — Owner-only actions (agent cannot do these)

Do not attempt these; surface them:

1. **Rotate the three PetPooja credentials.** Most urgent — `app_secret` is a write key.
2. **Register the Razorpay Dashboard webhook** — events `payment.captured`, `payment.failed`, `payment_link.paid`, `refund.created`, `refund.processed`, `refund.failed` — and add the generated `RAZORPAY_WEBHOOK_SECRET` to GitHub Secrets. Setting live `RAZORPAY_*` values is a Settings→Secrets action, never a repo edit.
3. **Apply migrations 0012, 0013, 0014, 0015.**
4. **Decide D1** — which app serves `tanmatra.food`. Blocks the legacy-`tanmatra` retirement question.
5. **Decide the GST position across streams** — a CA question, explicitly out of sprint scope. Today: meals 5% + delivery 18%, subscriptions 5%, `orders.charge_paise` documented as 18%, RD/marketplace/add-ons 0%.
6. **Merge the open branches** — this session cannot open PRs (`gh` is not installed; the GitHub REST API returns 403).
7. **Production data triage** — free-minted vouchers; `orderKind='marketplace' AND status='placed'` (placed, never paid); RD appointments at `paymentStatus='pending'` that were delivered anyway; orders with inflated `total_paise` from add-ons; `SELECT count(*) FROM orders WHERE user_id IS NULL`.
8. **Decide whether office lunch** (`corporate.ts:643-746`) should have a charge path at all.

---

## 3. Push and commit directives

### 3.1 Branch discipline

- **One concern per branch.** If the fix needs a shared helper changed, that is a second branch. This is enforced by review, and violating it is the main reason branches sit unmerged.
- **Fork from the correct base.** Standalone work forks from `origin/main`. Work inside the PetPooja stack forks from the branch below it, never from `main`.
- **Branch naming:** `claude/<subject>-<verb-phrase>`, lowercase, hyphens. Existing names in §1.4 are the reference.

### 3.2 Verify before push — all four gates, in this order

**Gate 1 — typecheck (authoritative, root only):**

```bash
pnpm run typecheck    # expect "Scope: 8 of 19 workspace projects"
```

**Never run `npx tsc` inside a single artifact package to diagnose a failure.** Lib packages use TypeScript project references, so a package-local `tsc` reads *stale built* lib output and will report failures that do not exist (or miss ones that do). Only the root command is truth.

**Gate 2 — lint gates (web changes):**

```bash
pnpm --filter @workspace/tanmatra run lint:gates   # = lint:colors && lint:prices
pnpm --filter @workspace/tanmatra run lint:geography
```

`lint:colors` → `scripts/lint-colors.ts`; `lint:prices` → `scripts/lint-prices.ts`. No new base colors without approval — the Clinical Dark palette is locked (`#D4AF37`, `#6BA3C8`, `#7D9E7E`).

**Gate 3 — DB-backed tests.** From `artifacts/api-server`, with the CI-equivalent environment:

```bash
export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5432/tanmatra_test"
export GOOGLE_API_KEY=test
export NODE_ENV=test
export CLINICAL_KMS_MASTER_KEY="0000000000000000000000000000000000000000000000000000000000000000"

node --test --test-force-exit --import tsx ./src/routes/<your>.test.ts
```

`--test-force-exit` is **required**: these suites hold real Postgres connections whose open handles keep the event loop alive forever. Without it the run hangs and CI kills it at the timeout — which reads as a hang, not a failure. Do not run the full `pnpm run test` from here; it exceeds the 10-minute Bash timeout.

**Gate 4 — the test actually runs in CI.** `verify.yml` **enumerates every test file by name.** A new test file that is not added to the workflow runs nowhere, forever, and looks green. Add it to the right step:

| Kind of test | Step | Lines |
|---|---|---|
| DB-free api-server / plan spine | `Money-path unit tests` | `verify.yml:69-77` |
| DB-free web money math | `Money-math unit tests (web)` | `verify.yml:81-91` |
| DB-backed money path | `Money-path integration tests` | `verify.yml:152-171` |
| Kitchen board | `Kitchen-board route contract (KDS)` | `verify.yml:182-184` |
| Order-channel split | `Order-channel split integrity` | `verify.yml:205-210` |

**Optional but recommended — mutation-test your own test.** Back up the file, reintroduce the defect with a `python3` heredoc, re-run the suite, confirm the expected tests turn red, restore from the backup, confirm no residue. A test that does not fail against the original defect is not a test.

> Tooling note: `sed` breaks on replacement text containing `|`. Use a `python3` heredoc with `str.replace` / `str.index` plus an occurrence-count assertion so a silent no-op edit is impossible.

### 3.3 Commit message

Conventional-commit subject, then a body that states **what is not fixed** as plainly as what is. Reviewers rely on this — an over-claiming commit message is how a partial fix gets treated as complete.

```
fix(premium): collect payment before activating membership

Premium.tsx called premiumApi.subscribe directly, which the backend now
refuses with 409 payment_required — so the button was broken and, before
that 409 landed, activated a paid membership for free. Adds premiumApi
.checkout/.verify and routes the button through openRazorpayCheckout.
The displayed amount comes from the server's checkout response.

NOT fixed: nothing reconciles a captured-but-unverified premium payment.
payments.ts:635-780 has no premium handling, so a verify that fails on a
transport error leaves the membership inactive with money captured. That
is MP-12 and it is not in this branch.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01K36KG1RKxxXvMBkefs5HXP
```

Both trailers are required on every commit.

### 3.4 Push

```bash
git push --force-with-lease origin <branch> 2>&1 | grep -v -iE "ghp_|github_pat_|x-access"
```

- **`--force-with-lease`, never `--force`.** A plain force-push has previously come within one command of overwriting an owner merge commit. The lease is what stops it.
- **Always `git fetch origin` before concluding a pushed branch is broken.** A "broken" branch is usually just a stale local ref.
- **Filter every push and fetch.** No exceptions.

### 3.5 Absolute prohibitions

1. **Never commit a secret value.** Not a Razorpay key, not a PetPooja credential, not a DB URL. `.env.example` gets names only. Live values are an owner Settings→Secrets action.
2. **Never print, log, echo, or commit a PetPooja credential.** Every probe scrubs them via the `REDACT` list. They must never enter the repo, a commit, a log, or prose.
3. **Never call a PetPooja `*_save_api` write endpoint against the live outlet.** APIs 1, 2, 3, 4, 6, 7 mutate real stock.
4. **Never fetch the client-rendered PetPooja docs** (`inventory.petpooja.com/inventory_api#overview`) or the Apiary docs (`onlineorderingapisv210.docs.apiary.io`) with curl, Playwright, or any other fetcher.
5. **Never open a PR from this session.** `gh` is not installed and the GitHub REST API returns 403. Push the branch and hand it to the owner with the branch name, the concern, and what is not fixed.

### 3.6 Handoff format

When a branch is ready, report exactly this and stop:

```
Branch:      claude/<name>
Base:        origin/main @ <sha>   (or: forked from claude/<parent>)
Fixes:       <plan ID> — <one line>
Not fixed:   <what a reviewer might wrongly assume is covered>
Gates:       typecheck ✓  lint:gates ✓  <test file> ✓ (named at verify.yml:<line>)
Owner action: <anything the owner must do for this to take effect in prod>
```

---

## Appendix — invariants you must not relearn the hard way

**The two money columns** (`lib/db/src/schema/orders.ts:133-142`):
`totalPaise` = meal subtotal after discounts/credit. No GST, no delivery fee. The schema comment says *"do not use this to charge."*
`chargePaise` = *"THE authoritative amount to charge, in paise: post-discount meal total + 18% GST + delivery fee."* Nullable, so legacy/guest/marketplace rows stay valid. The payment path falls back: `const authoritativePaise = order.chargePaise ?? order.totalPaise;` (payments.ts:263, and again at 487, 764, 788, 845, 865).

**`orders` has no payment-status column.** Only `razorpayOrderId` (128) and `razorpayPaymentId` (132).

**The paid/unpaid convention:** `status: "placed"` means **created-but-unpaid**. `"preparing"` means **paid**.
`const PAID_STATES = new Set(["preparing","ready","out_for_delivery","delivered"]);`
The transition is a guarded `UPDATE ... WHERE id = ? AND status = 'placed'`, returning 409 on zero rows.

**RD consults do not write an `orders` row.** They live entirely on `rd_appointments` with their own vocabulary — `"free" | "pending" | "paid" | "refunded"`. This is deliberate (`rdAdvisory.ts:533-537`), and it is exactly why nothing reconciles them.

**The house Razorpay pattern:** `pending_payment` row → `POST https://api.razorpay.com/v1/orders` with `{amount, currency:"INR", receipt, payment_capture: 1}` → store `razorpayOrderId` → return `{razorpayOrderId, amount, currency, keyId}` → verify by HMAC-SHA256 of `` `${razorpayOrderId}|${razorpayPaymentId}` `` compared with `timingSafeEqual` → **atomic guarded UPDATE** → 409 on zero rows. 503 when credentials are absent, 502 on a gateway error.

**TypeScript narrowing traps:** `req.isAuthenticated()` narrowing does **not** survive into a `db.transaction` arrow-function body — capture `const userId = req.user.id;` first. A derived boolean (`const paymentPending = unpaidOrder !== null`) does **not** narrow `unpaidOrder` — JSX must test `unpaidOrder` directly.

**`artifacts/api-server/src/lib/fulfillment.ts` does not exist.** The `FOR UPDATE` idiom is at `artifacts/api-server/src/routes/fulfillment.ts:428-441`.
