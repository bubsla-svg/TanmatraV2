/**
 * Money-path client — the storefront's typed calls to the api-server, matching
 * the verified contracts (slice 5). Every route is mounted under `/api`; auth is
 * the `sid` session cookie, so browser calls use `credentials:"include"`. The
 * server owns every amount (the Razorpay order always charges the server-stored
 * `order.chargePaise`, never a client number) — this client sends intent, never
 * a price.
 *
 * Requires the api-server deployed with this origin in `ALLOWED_ORIGINS`,
 * `SESSION_SAMESITE=none`, and `FLAG_PLAN_V2=1` for the plan-v2 branches. Base
 * URL is the CLIENT-inlined `NEXT_PUBLIC_API_BASE` (server components read the
 * server-only `API_BASE_URL` in lib/catalog.ts). See docs/LIVE-CUTOVER.md.
 */

// Transport core lives in ./apiClient (keeps this file under the cap); re-export
// so `@/lib/api` stays the single import surface for callers.
export { API_BASE, ApiError, apiPost, apiGet, apiPatch, apiDelete } from "./apiClient";
import { apiPost, apiGet, apiPatch, apiDelete, type FetchImpl } from "./apiClient";

export type DietTrack = "veg" | "egg" | "nonveg";
export type AddOnId = "rd_bump" | "evening_add";
export type PlanCadence = "weekly" | "fortnightly" | "monthly" | "quarterly";

// ── Quote (no auth, no secret — the one seam that runs without a gateway) ─────
export interface PlanQuoteResponse {
  planId?: string;
  track?: DietTrack;
  mealsPerDelivery: number;
  pricePerMealPaise: number | null;
  pricePerDeliveryPaise: number;
  addOns?: { id: AddOnId; pricePaise: number; cadence: string; attachPoint: string }[];
  addOnTotalPaise?: number;
  gstPaise: number;
  totalPaise: number;
  /** Credit preview — present only on a signed-in (cookie-authed) quote. The
   *  bridge (trial) + ledger credit the create route will redeem against this
   *  first bill, and the resulting net charge, both server-computed in the
   *  create route's exact order. Absent for anonymous quotes. */
  bridgeCreditPaise?: number;
  creditAppliedPaise?: number;
  payableTotalPaise?: number;
}

export function quotePlan(
  input: { planId: string; track: DietTrack; addOns?: AddOnId[]; cadence?: PlanCadence },
  fetchImpl?: FetchImpl,
): Promise<PlanQuoteResponse> {
  return apiPost(
    "/subscriptions/quote",
    { cadence: input.cadence ?? "monthly", planId: input.planId, track: input.track, addOns: input.addOns ?? [] },
    fetchImpl,
  );
}

// ── OTP (send = Twilio; verify = a Firebase idToken from the client SDK) ──────
export interface SendOtpResponse {
  ok: true;
  devCode?: string;
}

export function sendOtp(
  input: { countryCode: string; phone: string },
  fetchImpl?: FetchImpl,
): Promise<SendOtpResponse> {
  return apiPost("/auth/phone/send-otp", input, fetchImpl);
}

export interface AuthUser {
  id: string;
  phoneE164: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export interface VerifyOtpResponse {
  ok: true;
  user: AuthUser;
}

export function verifyOtp(
  input: { idToken: string; attribution?: Record<string, unknown> },
  fetchImpl?: FetchImpl,
): Promise<VerifyOtpResponse> {
  return apiPost("/auth/phone/verify-otp", input, fetchImpl);
}

// ── Create (session required) ────────────────────────────────────────────────
export type MemberDiet = "any" | "veg" | "nonveg";
export type SpiceLevel = "mild" | "medium" | "hot";

/** One eater's profile for a plan subscription (server: memberInputSchema).
 *  `allergens`/`medicalConditions` feed the server-side clinical safety gate —
 *  DPDP-sensitive; collected only under explicit consent at checkout. */
export interface MemberInput {
  name: string;
  diet?: MemberDiet;
  allergens?: string[];
  medicalConditions?: string[];
  dislikedIngredients?: string[];
  lifestyle?: string;
  spiceLevel?: SpiceLevel;
  dailyCalorieTarget?: number;
  dailyProteinTargetGrams?: number;
}

export interface CreateSubscriptionInput {
  planId: string;
  track: DietTrack;
  addOns?: AddOnId[];
  cadence: PlanCadence;
  mealsPerDelivery: number;
  deliveryWindow: string;
  startDate: string;
  /** At least one eater's profile (the create route requires min 1). */
  members: MemberInput[];
  [extra: string]: unknown;
}

export interface CreateSubscriptionResponse {
  subscription: { id: number; externalOrderId?: string; [k: string]: unknown };
  deliveries: unknown[];
  bridgeCreditPaise: number;
  /** General credit-ledger balance (referral/trial-creditback/loyalty — see
   *  getCreditBalance) the server redeemed against THIS bill, net of any
   *  bridgeCreditPaise already applied. */
  creditAppliedPaise?: number;
}

export function createSubscription(
  body: CreateSubscriptionInput,
  fetchImpl?: FetchImpl,
): Promise<CreateSubscriptionResponse> {
  return apiPost("/subscriptions", body, fetchImpl);
}

// ── À-la-carte order (guest checkout — no session required) ──────────────────
// Grounded contract (checkout.ts POST /orders): DPDP consent object REQUIRED
// (400 consent_required), serviceable pincode enforced (422), allergen safety
// gate, idempotency via externalOrderId, and the whole route is dark until
// the api-server env sets ALC_CHECKOUT_ENABLED (403 alc_checkout_disabled).
export interface AlacarteOrderInput {
  /** Client-generated idempotency key; also the id used to poll status. */
  externalOrderId: string;
  items: {
    dishId: number;
    qty: number;
    /** Customisation SELECTIONS, never a price — the server resolves the
     *  price against its own copy of the dish's customisation groups
     *  (dishCustomizations.ts). Omit entirely for a plain, uncustomised line. */
    customizations?: { groupName: string; optionNames: string[] }[];
  }[];
  phone: string;
  address: { label?: string; line1: string; line2?: string; city: string; pincode: string };
  consent: { accepted: true; policyVersion: string };
  guestPrefs?: Record<string, unknown>;
  allergenAck?: boolean;
  [extra: string]: unknown;
}

export interface AlacarteOrderResponse {
  orderId: string;
  serverOrderId: number | string;
  status: string;
  etaMinutes: number;
  /** The SERVER's total — the only number any later step may display. */
  totalPaise: number;
}

export function createAlacarteOrder(
  body: AlacarteOrderInput,
  fetchImpl?: FetchImpl,
): Promise<AlacarteOrderResponse> {
  return apiPost("/orders", body, fetchImpl);
}

// ── Pay (Razorpay order → browser modal → verify) ────────────────────────────
export interface RazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export function createRazorpayOrder(
  input: { orderId: string; subscriptionId?: number },
  fetchImpl?: FetchImpl,
): Promise<RazorpayOrderResponse> {
  return apiPost("/payments/razorpay/order", input, fetchImpl);
}

export interface VerifyPaymentInput {
  orderId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

export interface VerifyPaymentResponse {
  ok: true;
  orderId: string;
  status: string;
  autopayDisclaimer?: string;
}

export function verifyPayment(
  input: VerifyPaymentInput,
  fetchImpl?: FetchImpl,
): Promise<VerifyPaymentResponse> {
  return apiPost("/payments/razorpay/verify", input, fetchImpl);
}

// ── Addresses (SF-04 — session required; 401 without the sid cookie) ──────────
// Grounded contract (userAddresses.ts): GET/POST/PATCH/DELETE /addresses, all
// behind requireAuthUser. The first saved address auto-defaults; an unserviceable
// pincode is refused with 422 `unserviceable_pincode`.
export type AddressType = "home" | "work" | "other";

export interface Address {
  id: string;
  label: string;
  type: AddressType;
  line1: string;
  line2: string;
  city: string;
  pincode: string;
  phone: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddressInput {
  label: string;
  type?: AddressType;
  line1: string;
  line2?: string | null;
  city: string;
  pincode: string;
  phone: string;
  isDefault?: boolean;
}

export function getAddresses(fetchImpl?: FetchImpl): Promise<{ addresses: Address[] }> {
  return apiGet("/addresses", fetchImpl);
}

export function createAddress(
  body: AddressInput,
  fetchImpl?: FetchImpl,
): Promise<{ address: Address }> {
  return apiPost("/addresses", body, fetchImpl);
}

export function updateAddress(
  id: string,
  patch: Partial<AddressInput>,
  fetchImpl?: FetchImpl,
): Promise<{ address: Address }> {
  return apiPatch(`/addresses/${encodeURIComponent(id)}`, patch, fetchImpl);
}

export function deleteAddress(id: string, fetchImpl?: FetchImpl): Promise<{ ok: true }> {
  return apiDelete(`/addresses/${encodeURIComponent(id)}`, fetchImpl);
}

// ── Session (account surfaces) ───────────────────────────────────────────────
/** The session's user, or null — GET /auth/user answers 200 either way. */
export function getAuthUser(fetchImpl?: FetchImpl): Promise<{ user: AuthUser | null }> {
  return apiGet("/auth/user", fetchImpl);
}

/** End the `sid` session (POST /logout — auth.ts clears it server-side). */
export function logoutSession(fetchImpl?: FetchImpl): Promise<{ success: boolean }> {
  return apiPost("/logout", {}, fetchImpl);
}

// ── Credit ledger (session required) ─────────────────────────────────────────
// The FIFO balance behind "redeemable against any plan start" (02e §6):
// referral awards, the 3-Day Taste Test's ₹399 paid-time creditback, loyalty/
// winback grants. subscriptions.ts applies it automatically at plan create —
// this is the pre-purchase read so the checkout total can show the net amount
// before the user ever pays.
export function getCreditBalance(
  fetchImpl?: FetchImpl,
): Promise<{ balancePaise: number }> {
  return apiGet("/credit-ledger", fetchImpl);
}
