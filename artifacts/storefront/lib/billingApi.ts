/**
 * Billing client (route-parity Wave G) — READ-ONLY. The billing surface is a
 * statement of the user's wallet credit ledger: every credit (voucher, referral,
 * loyalty reward) and debit (applied at checkout), plus the current balance.
 * No charge path here; orders (payments) live at /account/orders and recurring
 * billing at /account/subscriptions.
 *
 * Backend (on main): GET /credit-ledger → { entries, balancePaise } (auth).
 */
import { apiGet, type FetchImpl } from "./apiClient";

export interface CreditEntry {
  id: number;
  deltaPaise: number;
  reason: string;
  refType: string | null;
  refId: string | null;
  note: string | null;
  createdAt: string;
}

export interface CreditLedger {
  entries: CreditEntry[];
  balancePaise: number;
}

/** The user's credit-ledger statement (most recent first) + current balance. */
export async function getCreditLedger(fetchImpl?: FetchImpl): Promise<CreditLedger> {
  const data = await apiGet<{ entries?: CreditEntry[]; balancePaise?: number }>("/credit-ledger", fetchImpl);
  return { entries: data.entries ?? [], balancePaise: data.balancePaise ?? 0 };
}

/** Human label for a ledger row — the server note if present, else the reason. */
export function creditLabel(e: CreditEntry): string {
  if (e.note) return e.note;
  return e.reason.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
