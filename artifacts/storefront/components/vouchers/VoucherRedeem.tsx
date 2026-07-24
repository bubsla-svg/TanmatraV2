"use client";
// Client island: wallet + voucher redemption (Wave G). Redeeming CREDITS the
// wallet ledger (not a charge) and the balance refreshes from the server. Auth-
// gated: an unauthenticated load 401s → inline PhoneAuth, then reload.
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { getWalletBalancePaise, getMyVouchers, redeemVoucher, type VoucherLite } from "@/lib/vouchersApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";

export function VoucherRedeem() {
  const [balance, setBalance] = useState<number | null>(null);
  const [redeemed, setRedeemed] = useState<VoucherLite[]>([]);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [bal, mine] = await Promise.all([getWalletBalancePaise(), getMyVouchers()]);
      setBalance(bal);
      setRedeemed(mine.redeemed);
      setNeedsAuth(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else setError(e instanceof ApiError ? e.message : "Couldn't load your wallet.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function doRedeem() {
    if (!code.trim() || busy) return;
    setBusy(true); setMsg(null); setError(null);
    try {
      const r = await redeemVoucher(code);
      setMsg(`${formatPaise(r.creditedPaise)} added to your wallet.`);
      setCode("");
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
      else if (e instanceof ApiError && e.status === 404) setError("We couldn't find that code — check it and try again.");
      else if (e instanceof ApiError && e.status === 409) setError("That voucher has already been redeemed.");
      else setError(e instanceof ApiError ? e.message : "Couldn't redeem that just now — please try again.");
    } finally { setBusy(false); }
  }

  if (needsAuth) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm font-semibold text-ink">Sign in to see your wallet & redeem vouchers</p>
        <div className="mt-4"><PhoneAuth onVerified={() => void load()} /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Wallet balance</p>
        <p className="tabular mt-1 text-3xl font-bold text-gold-text">{balance === null ? "…" : formatPaise(balance)}</p>
        <p className="mt-1 text-xs text-ink-muted">Credit applies automatically at your next checkout.</p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <label htmlFor="voucher-code" className="text-sm font-semibold text-ink">Redeem a voucher</label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="voucher-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") void doRedeem(); }}
            placeholder="Enter your code" autoCapitalize="characters" autoComplete="off"
            className="tabular w-full rounded-xl border border-line bg-surface px-4 py-3 text-base tracking-wide text-ink outline-none focus:border-line-strong"
          />
          <button
            type="button" onClick={() => void doRedeem()} disabled={busy || !code.trim()}
            className="shrink-0 rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-40"
          >
            {busy ? "Redeeming…" : "Redeem"}
          </button>
        </div>
        {msg && <p className="mt-3 text-xs font-medium text-sage-text">{msg}</p>}
        {error && <p role="alert" className="mt-3 text-xs font-medium text-[var(--danger)]">{error}</p>}
      </div>

      {redeemed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-ink">Redeemed vouchers</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {redeemed.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                <span className="tabular font-medium text-ink">{v.code}</span>
                <span className="tabular text-ink-muted">
                  {formatPaise(v.amountPaise)}
                  {v.redeemedAt ? ` · ${new Date(v.redeemedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
