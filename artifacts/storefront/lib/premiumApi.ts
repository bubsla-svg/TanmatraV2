import { apiGet, apiPost, type FetchImpl } from "./apiClient";

/**
 * Premium-membership client (route-parity — gated). The purchase is a real
 * money-path: the SERVER opens the Razorpay order at its own price, the browser
 * pays, the server verifies the signature and activates. The client never
 * authors an amount. Cancel/resume are free (period already paid).
 */

export type PremiumStatus = "active" | "cancelled" | "expired" | "pending_payment";

export interface PremiumMembership {
  status: PremiumStatus;
  monthlyPricePaise: number;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  rdConsultsUsedThisPeriod: number;
  rdConsultsPerPeriod: number;
}

export interface PremiumMe {
  membership: PremiumMembership | null;
  isPremium: boolean;
  pricePaise: number;
}

export interface PremiumCheckoutOrder {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

interface PaidPayload {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

export function getPremium(fetchImpl?: FetchImpl): Promise<PremiumMe> {
  return apiGet("/premium/me", fetchImpl);
}

export function checkoutPremium(fetchImpl?: FetchImpl): Promise<PremiumCheckoutOrder> {
  return apiPost("/premium/checkout", {}, fetchImpl);
}

export function verifyPremium(
  paid: PaidPayload,
  fetchImpl?: FetchImpl,
): Promise<{ membership: PremiumMembership; isPremium: boolean }> {
  return apiPost("/premium/verify", paid, fetchImpl);
}

export function cancelPremium(fetchImpl?: FetchImpl): Promise<{ membership: PremiumMembership }> {
  return apiPost("/premium/cancel", {}, fetchImpl);
}

/** Resume auto-renewal for a cancelled-but-in-period membership (no charge). */
export function resumePremium(
  fetchImpl?: FetchImpl,
): Promise<{ membership: PremiumMembership; resumed?: boolean }> {
  return apiPost("/premium/subscribe", {}, fetchImpl);
}

// The one-call `payForPremium(razorpay)` wrapper that used to live here is
// gone. It ran server order → modal → verify with a SINGLE naked verify
// attempt and no way to recover a captured-but-unverified payment, and its
// only caller opened the modal on /premium itself. Premium now settles on the
// shared checkout: lib/purchaseSteps.ts#premiumSteps composes the same three
// calls with the bounded verify retry and the authoritative /premium/me read
// that recovery needs, and components/checkout/PurchaseRunner.tsx drives them.
