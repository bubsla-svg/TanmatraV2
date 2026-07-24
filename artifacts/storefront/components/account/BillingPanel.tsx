"use client";
// Client: read-only credit-ledger statement. Session-gated (401 → inline
// PhoneAuth). Every row is the server's own ledger entry — no client arithmetic.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { getCreditLedger, creditLabel, type CreditLedger } from "@/lib/billingApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function BillingPanel() {
  const [ledger, setLedger] = useState<CreditLedger | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setLedger(await getCreditLedger());
      setNeedsAuth(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else setError(e instanceof ApiError ? e.message : "Couldn't load your billing.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (needsAuth) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to see your billing &amp; credits.</p>
        <PhoneAuth onVerified={() => void load()} />
      </div>
    );
  }
  if (ledger === null) return <p className="text-sm text-ink-muted">{error ?? "Loading your billing…"}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Wallet balance</p>
        <p className="tabular mt-1 text-3xl font-bold text-gold-text">{formatPaise(ledger.balancePaise)}</p>
        <p className="mt-1 text-xs text-ink-muted">
          Applied automatically at checkout. Redeem a voucher on the{" "}
          <Link href="/vouchers" className="font-medium text-gold-text hover:underline">wallet page</Link>.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ink">Credit activity</h2>
        {ledger.entries.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No credit activity yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {ledger.entries.map((e) => {
              const credit = e.deltaPaise >= 0;
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{creditLabel(e)}</p>
                    <p className="tabular text-xs text-ink-faint">{day(e.createdAt)}</p>
                  </div>
                  <span className={`tabular shrink-0 text-sm font-semibold ${credit ? "text-sage-text" : "text-ink-muted"}`}>
                    {credit ? "+" : "−"}{formatPaise(Math.abs(e.deltaPaise))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-ink-faint">
        Looking for order receipts or plan billing? See your{" "}
        <Link href="/account/orders" className="font-medium text-gold-text hover:underline">orders</Link> and{" "}
        <Link href="/account/subscriptions" className="font-medium text-gold-text hover:underline">plans</Link>.
      </p>
    </div>
  );
}
