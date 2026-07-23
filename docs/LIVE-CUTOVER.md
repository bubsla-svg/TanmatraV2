# Storefront money-path — live cutover runbook

**Scope:** what it takes to turn the new storefront's checkout from the buildable
skeleton (stubs) into a live money path against the existing api-server. Written
from the **verified** api-server contracts (all routes are mounted under `/api`).

Nothing here is charged by the client. The api-server owns every amount — the
Razorpay order always charges the server-stored `order.chargePaise`, never a
number sent from the browser. The storefront sends **intent**, never a price.

---

## 1. What is wired now (in `claude/phase2-money-path`)

- **`lib/api.ts`** — typed client for the verified endpoints: `quotePlan`,
  `sendOtp`, `verifyOtp`, `createSubscription`, `createRazorpayOrder`,
  `verifyPayment`. Cookie auth (`credentials:"include"`), bare-JSON, typed
  `ApiError{status, code}`.
- **`lib/moneyPath.ts`** — `runCheckout()` orchestration in the verified order,
  injectable (unit-tested with fakes: sequence + user-dismiss).
- **`lib/flags.ts`** — `LIVE_CHECKOUT_ENABLED` (`NEXT_PUBLIC_LIVE_CHECKOUT=1`),
  OFF by default.
- **`CheckoutIdentity`** — when the flag is on, "Send code" calls the real
  `POST /api/auth/phone/send-otp` and **fails loud** on error instead of
  advancing as if a code went out.

Everything else (create, pay, evening attach) stays a stub until the items in §4
and §5 are in place — they cannot run in a bare build and are not faked as if
they can.

## 2. The money-path call order (verified)

1. **Identity → session.** Firebase phone-auth (client SDK) sends+collects the
   OTP and yields an `idToken` → `POST /api/auth/phone/verify-otp {idToken}` →
   sets the `sid` session cookie. (`POST /api/auth/phone/send-otp` is the
   Twilio path; verify expects a **Firebase idToken**, not the SMS digits.)
2. **Create.** `POST /api/subscriptions` (session required) with
   `{planId, track, addOns, cadence, mealsPerDelivery, deliveryWindow,
   startDate, members[...], address...}` → `{subscription, deliveries,
   bridgeCreditPaise}`. The first-cycle order is `externalOrderId = sub-<id>`.
   Active plan-v2 branch requires `FLAG_PLAN_V2=1`.
3. **Order.** `POST /api/payments/razorpay/order {orderId:"sub-<id>",
   subscriptionId}` → `{razorpayOrderId, amount, currency, keyId}`. Amount is
   server-stored; a client `amountPaise` is only a tamper-check.
4. **Modal.** Open Razorpay checkout.js with `keyId` + `razorpayOrderId` →
   `{razorpayPaymentId, razorpayOrderId, razorpaySignature}`.
5. **Verify.** `POST /api/payments/razorpay/verify {orderId, razorpayPaymentId,
   razorpayOrderId, razorpaySignature}` → `{ok, orderId, status:"preparing",
   autopayDisclaimer?}`. The autopay mandate is registered inside verify.

Server-authoritative price display (optional, secret-free): `POST
/api/subscriptions/quote` (no auth) returns the same `totalPaise` the server
bills. Fall back to the local spine (`computePlanQuote`) when the API is
unreachable — the spine is a faithful mirror, so parity holds.

## 3. Environment

**api-server deploy:**

| Var | Why |
|---|---|
| `ALLOWED_ORIGINS` | must include the storefront origin (CORS allowlist; empty = refuse in prod) |
| `SESSION_SAMESITE=none` | else the `sid` cookie is dropped on cross-origin fetches |
| `FLAG_PLAN_V2=1` | enables the plan-v2 branches in `/subscriptions` + `/subscriptions/quote` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | order-create + signature verify (503 if unset) |
| `RAZORPAY_WEBHOOK_SECRET` | server-to-server webhook (not a browser call) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Firebase Admin — verifies the OTP idToken |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | OTP send (non-prod without them = mock code `123456`) |

**storefront:** `NEXT_PUBLIC_API_BASE` (api-server origin, client-inlined),
`NEXT_PUBLIC_LIVE_CHECKOUT=1` to arm the live seams.

Browser fetches use `credentials:"include"` (already set in `lib/api.ts`).

## 4. Remaining client integration (not fabricated here)

- **Firebase phone-auth SDK** in the storefront to obtain the `idToken` for
  `verifyOtp` — the OTP verify cannot work without it.
- **Razorpay checkout.js** implementing the `RazorpayAdapter` in
  `lib/moneyPath.ts`.
- **Identity + address + members collection** so `createSubscription` gets a
  real payload (the current 3-screen skeleton collects phone + a single address
  line; the create route needs `members[...]`, structured address, `startDate`).
- Then call `runCheckout({subscription, razorpay})` from `CheckoutFlow.pay()`
  behind `LIVE_CHECKOUT_ENABLED`.

## 5. Server-side gaps found (must be closed for the attach money path)

These are api-server changes — flagged, not made here (the money path is
lockstep-governed; see the working agreement):

1. **`evening_add` has no post-purchase attach endpoint.** `POST
   /api/addons/attach` is the *legacy à-la-carte* system (numeric `addonId` +
   `orderId`, juice/shake seed items) — it does not attach the plan-v2
   `evening_add`. The confirmation-screen Evening Add (02d stage 8) has no
   server seam to call. A `POST /api/subscriptions/:id/add-ons` (or equivalent)
   is needed.
2. **`POST /api/subscriptions` accepts `addOns` but never bills/persists them.**
   Only `/subscriptions/quote` runs `resolveAddOns`; the create branch ignores
   the field. So an RD bump accepted at plan review would **not** be charged on
   the created subscription. Create must resolve + persist + bill the
   `plan_review` add-ons (rd_bump) to match the quote.

Until (2) is fixed, the bump is display-and-quote-only; until (1) exists, the
Evening Add confirmation offer cannot attach server-side.

---

## 6. À-la-carte money path — LIVE (SF-03 + SF-05)

The **guest** money path (browse → cart → checkout → pay → confirmed → track) is
now wired end-to-end and armed on the deployed storefront. It does **not** reuse
the plan-v2 machinery (§2/§4): it is `POST /api/orders` guest checkout, which the
api-server designs for `userId: null` orders — no session required.

**Call order (verified against `checkout.ts` + `payments.ts`):**

1. `POST /api/orders` — `{externalOrderId, items:[{dishId,qty}], phone, address,
   consent:{accepted:true, policyVersion}}`. The server prices it (DPDP consent →
   400 `consent_required`, serviceable pincode → 422, allergen gate). Returns
   `{orderId, status:"placed", etaMinutes, totalPaise}`. **No client price.**
2. `POST /api/payments/razorpay/order {orderId}` → `{razorpayOrderId, amount,
   currency, keyId}`. Guest orders stay open for payment without auth; the amount
   is the server-stored total. `keyId` comes back here — **no Razorpay key ships
   in the bundle.**
3. Razorpay checkout.js modal (`lib/razorpayAdapter.ts`) → `{razorpayPaymentId,
   razorpayOrderId, razorpaySignature}`. A **dismissed** modal throws
   `RazorpayDismissed` so verify is never called.
4. `POST /api/payments/razorpay/verify {...}` → `status:"preparing"` →
   `/order/confirmed/[orderId]` → `/track/[orderId]`.

**Wired client pieces:** `lib/firebase.ts`, `lib/phoneAuth.ts`,
`components/checkout/PhoneAuth.tsx` (SF-03 optional sign-in), `lib/razorpayAdapter.ts`,
`components/checkout/{AlacarteCheckout,AlacarteDetails}.tsx`, and the
`/checkout?mode=alacarte` branch. `runAlacarteCheckout()` (`lib/moneyPath.ts`)
sequences the calls.

**SF-03 optional sign-in.** Firebase phone-auth (`signInWithPhoneNumber` →
`confirm` → `getIdToken` → `POST /api/auth/phone/verify-otp {idToken}` → `sid`
session) is offered at the top of the à-la-carte details step. It **self-hides**
when `firebaseConfigured()` is false, so the guest money path never hard-depends
on it. When a user signs in, the order is attributed to them and the phone is
prefilled.

**Deploy config (already applied):**

- storefront job (`deploy.yml`): `NEXT_PUBLIC_LIVE_CHECKOUT=1` +
  `NEXT_PUBLIC_FIREBASE_*` (6, from the same `secrets.FIREBASE_*` the tanmatra
  build uses) as Docker build args; mirrored `ARG`s in the Dockerfile.
- api-server: `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` already set;
  `ALC_CHECKOUT_ENABLED` defaults true; Firebase Admin verifies via ADC. **No
  api-server change is required for this path.**

**One console-side step (outside CI):** Firebase Console → Authentication →
Settings → Authorized domains must list the storefront origin for phone sign-in
to succeed. If it is missing, `signInWithPhoneNumber` fails with
`auth/unauthorized-domain`; PhoneAuth surfaces the friendly error and the guest
path is unaffected.

**Plan path unchanged.** The subscription money path (§2/§4) remains for a later
wave. `CheckoutFlow.pay()` now **fails loud** under the live flag ("finishing its
wiring", points at the menu) instead of fabricating a receipt — no mocked success
ships behind the flag.
