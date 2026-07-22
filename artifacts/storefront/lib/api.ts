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

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3000";

export type DietTrack = "veg" | "egg" | "nonveg";
export type AddOnId = "rd_bump" | "evening_add";
export type PlanCadence = "weekly" | "fortnightly" | "monthly";

/** A non-2xx from the api-server. The server returns bare `{error, code?}` — no
 *  envelope — so we surface the status and code for the caller to branch on
 *  (e.g. 422 `plan_not_launchable` → route to waitlist). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type FetchImpl = typeof fetch;

/** POST JSON to `/api<path>`, cookie-authed, bare-JSON in and out. `fetchImpl`
 *  is injectable so the money path is testable without a network. */
export async function apiPost<T>(
  path: string,
  body: unknown,
  fetchImpl: FetchImpl = fetch,
): Promise<T> {
  const res = await fetchImpl(`${API_BASE}/api${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const e = json as { error?: string; code?: string };
    throw new ApiError(res.status, e.code ?? "error", e.error ?? res.statusText);
  }
  return json as T;
}

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
export interface CreateSubscriptionInput {
  planId: string;
  track: DietTrack;
  addOns?: AddOnId[];
  cadence: PlanCadence;
  mealsPerDelivery: number;
  deliveryWindow: string;
  startDate: string;
  /** The member payload the create route requires (min 1) — supplied by the
   *  live integration once identity is collected. */
  members: unknown[];
  [extra: string]: unknown;
}

export interface CreateSubscriptionResponse {
  subscription: { id: number; externalOrderId?: string; [k: string]: unknown };
  deliveries: unknown[];
  bridgeCreditPaise: number;
}

export function createSubscription(
  body: CreateSubscriptionInput,
  fetchImpl?: FetchImpl,
): Promise<CreateSubscriptionResponse> {
  return apiPost("/subscriptions", body, fetchImpl);
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
