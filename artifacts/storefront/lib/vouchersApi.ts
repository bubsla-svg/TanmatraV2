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
