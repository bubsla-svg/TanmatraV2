/**
 * Vouchers + wallet client (route-parity Wave G). Redeeming a voucher CREDITS
 * the user's wallet (credit_ledger) — it is not a charge; the credit is applied
 * automatically at a future checkout (same ledger as referral / loyalty). All
 * calls are cookie-authed via the same-origin `/api` proxy (apiClient).
 *
 * Backend (all on main, in routes/corporate.ts + loyalty.ts):
 *   GET  /credit-ledger      → { balancePaise }        (wallet total)
 *   GET  /vouchers/mine      → { purchased, redeemed } (this user's vouchers)
 *   POST /vouchers/preview   → { code, amountPaise, status, redeemed }
 *   POST /vouchers/redeem    → { voucher, creditedPaise }  (401/404/409 typed)
 */

/**
 * OWNER DECISION (2026-08-16): vouchers stay on the wallet surface. Checkout
 * stays plain — no voucher field, no apply-and-re-quote step.
 *
 * Plan item 1.4 asked for "voucher validates server-side on apply with instant
 * total update" at checkout. Two things made that the wrong build here:
 *
 *   - `redeemVoucher` CREDITS THE WALLET; it does not discount an order.
 *     `POST /orders/quote` takes no voucher code, so an "instant total update"
 *     would have to mean redeem → credit → re-quote.
 *   - Redemption is irreversible. A customer who applies a voucher and then
 *     abandons checkout has burned it on an order that never existed.
 *
 * The credit path already works without a checkout field: PlanCheckout reads
 * the credit-ledger balance and subscriptions.ts redeems it automatically at
 * create time, so a voucher redeemed in the wallet still reaches the next
 * order's total. Re-opening this needs a server-side order-level discount
 * concept, not a form field.
 */

import { apiGet, apiPost, type FetchImpl } from "./apiClient";

export interface VoucherLite {
  id: number;
  code: string;
  amountPaise: number;
  status: string;
  redeemedAt: string | null;
  createdAt: string;
}

export interface VoucherPreview {
  code: string;
  amountPaise: number;
  status: string;
  redeemed: boolean;
}

export interface RedeemResult {
  voucher: VoucherLite;
  creditedPaise: number;
}

/** Wallet credit balance in paise (server-owned ledger). */
export async function getWalletBalancePaise(fetchImpl?: FetchImpl): Promise<number> {
  const data = await apiGet<{ balancePaise?: number }>("/credit-ledger", fetchImpl);
  return data.balancePaise ?? 0;
}

/** Look up a code before redeeming (validate + show its value). */
export function previewVoucher(code: string, fetchImpl?: FetchImpl): Promise<VoucherPreview> {
  return apiPost<VoucherPreview>("/vouchers/preview", { code: code.trim().toUpperCase() }, fetchImpl);
}

/** Redeem a code → credits the wallet. Throws ApiError (401 / 404 / 409). */
export function redeemVoucher(code: string, fetchImpl?: FetchImpl): Promise<RedeemResult> {
  return apiPost<RedeemResult>("/vouchers/redeem", { code: code.trim().toUpperCase() }, fetchImpl);
}

/** This user's vouchers — purchased (gifted out) + redeemed (into the wallet). */
export function getMyVouchers(fetchImpl?: FetchImpl): Promise<{ purchased: VoucherLite[]; redeemed: VoucherLite[] }> {
  return apiGet<{ purchased: VoucherLite[]; redeemed: VoucherLite[] }>("/vouchers/mine", fetchImpl);
}
