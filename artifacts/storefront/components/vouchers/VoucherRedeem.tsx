"use client";
// Client island: wallet + voucher redemption (Wave G). Redeeming CREDITS the
// wallet ledger (not a charge) and the balance refreshes from the server. Auth-
// gated: an unauthenticated load 401s → inline PhoneAuth, then reload.
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { getWalletBalancePaise, getMyVouchers, redeemVoucher, type VoucherLite } from "@/lib/vouchersApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col gap-6 pb-2">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Wallet balance</p>
        <p className="tabular mt-1 text-3xl font-bold text-gold-text">{balance === null ? "…" : formatPaise(balance)}</p>
        <p className="mt-1 text-xs text-ink-muted">Credit applies automatically at your next checkout.</p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <label htmlFor="voucher-code" className="text-sm font-semibold text-ink">Redeem a voucher</label>
        <input
          id="voucher-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") void doRedeem(); }}
          placeholder="Enter your code" autoCapitalize="characters" autoComplete="off"
          className="tabular mt-3 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base tracking-wide text-ink outline-none focus:border-line-strong"
        />
        {msg && (
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <CheckCircle2 size={16} className="shrink-0 text-sage-text" aria-hidden="true" />
            <p className="text-xs font-medium text-sage-text">{msg}</p>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-xs font-medium text-[var(--danger)]">{error}</p>}
      </div>

      {redeemed.length > 0 && (
        <div>
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Redeemed vouchers</h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {redeemed.map((v) => (
              <li key={v.id} className="flex items-center justify-between p-4 transition-colors hover:bg-surface-raised">
                <div className="flex flex-col gap-1">
                  <span className="tabular text-sm font-medium tracking-wide text-ink">{v.code}</span>
                  <span className="text-xs text-ink-faint">
                    {v.redeemedAt
                      ? `Redeemed · ${new Date(v.redeemedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                      : "Redeemed"}
                  </span>
                </div>
                <span className="tabular text-sm font-semibold text-ink">{formatPaise(v.amountPaise)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Glass sticky footer (checkout/trial vocabulary, BATCH-4-BRIEFS.md) —
          the ONE redeem CTA on this screen. Stays a plain verb, no amount
          printed on it: the code's value isn't known until the server
          validates it (money-CTA rule, BATCH-9-BRIEFS.md Brief 57). */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:bottom-0">
        <div className="mx-auto max-w-md px-4 py-3">
          <Button
            type="button" onClick={() => void doRedeem()} disabled={busy || !code.trim()}
            shape="pill"
            size="fluid"
            className="w-full px-8 py-4 text-center text-base font-semibold disabled:opacity-40"
          >
            {busy ? "Redeeming…" : "Redeem"}
          </Button>
        </div>
      </div>
    </div>
  );
}
