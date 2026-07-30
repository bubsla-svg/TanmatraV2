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
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 text-center">
        <p className="text-sm text-ink-muted">Sign in to see your billing &amp; credits.</p>
        <PhoneAuth onVerified={() => void load()} />
      </div>
    );
  }
  if (ledger === null) return <p className="text-sm text-ink-muted">{error ?? "Loading your billing…"}</p>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-2 rounded-3xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Wallet balance</p>
        <p className="tabular text-5xl font-bold leading-none text-gold-text">{formatPaise(ledger.balancePaise)}</p>
        <p className="mt-2 max-w-xs text-xs text-ink-muted">
          Applied automatically at checkout. Redeem a voucher on the{" "}
          <Link href="/vouchers" className="font-medium text-gold-text hover:underline">wallet page</Link>.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Credit activity</h2>
        {ledger.entries.length === 0 ? (
          <p className="text-sm text-ink-muted">No credit activity yet.</p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
            {ledger.entries.map((e, i) => {
              const credit = e.deltaPaise >= 0;
              return (
                <li
                  key={e.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-raised ${i > 0 ? "border-t border-line" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{creditLabel(e)}</p>
                    <p className="tabular mt-0.5 text-xs text-ink-faint">{day(e.createdAt)}</p>
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

      <p className="text-center text-xs text-ink-faint">
        Looking for order receipts or plan billing? See your{" "}
        <Link href="/account/orders" className="font-medium text-gold-text hover:underline">orders</Link> and{" "}
        <Link href="/account/subscriptions" className="font-medium text-gold-text hover:underline">plans</Link>.
      </p>
    </div>
  );
}
