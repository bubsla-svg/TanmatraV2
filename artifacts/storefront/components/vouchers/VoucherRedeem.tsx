"use client";
// Client island: wallet + voucher redemption (Wave G). Redeeming CREDITS the
// wallet ledger (not a charge) and the balance refreshes from the server. Auth-
// gated: an unauthenticated load 401s → inline PhoneAuth, then reload.
//
// Balance + history load through useQuery (["vouchers","balance"]) so a
// genuine load failure (non-401) gets its own error+retry state in THIS card,
// distinct from a redemption failure, which stays scoped to the redeem-form
// card below via the separate redeem `useMutation`.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { getWalletBalancePaise, getMyVouchers, redeemVoucher, type VoucherLite } from "@/lib/vouchersApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/CartProvider";

interface WalletData {
  balance: number;
  redeemed: VoucherLite[];
}

export function VoucherRedeem() {
  const { cart } = useCart();
  const queryClient = useQueryClient();
  const [needsAuth, setNeedsAuth] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const {
    data: wallet,
    isPending,
    isError: loadFailed,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: ["vouchers", "balance"],
    queryFn: async (): Promise<WalletData> => {
      const [balance, mine] = await Promise.all([getWalletBalancePaise(), getMyVouchers()]);
      return { balance, redeemed: mine.redeemed };
    },
    retry: (failureCount, e) => (e instanceof ApiError && e.status === 401 ? false : failureCount < 1),
  });

  const redeemMutation = useMutation({
    mutationFn: (c: string) => redeemVoucher(c),
    onSuccess: (r) => {
      setMsg(`${formatPaise(r.creditedPaise)} added to your wallet.`);
      setCode("");
      void queryClient.invalidateQueries({ queryKey: ["vouchers", "balance"] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 401) setNeedsAuth(true);
    },
  });

  const authRequired = needsAuth || (loadFailed && loadError instanceof ApiError && loadError.status === 401);

  function doRedeem() {
    if (!code.trim() || redeemMutation.isPending) return;
    setMsg(null);
    redeemMutation.mutate(code);
  }

  if (authRequired) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm font-semibold text-ink">Sign in to see your wallet & redeem vouchers</p>
        <div className="mt-4"><PhoneAuth startExpanded onVerified={() => { setNeedsAuth(false); void refetch(); }} /></div>
      </div>
    );
  }

  const redeemError = !redeemMutation.isError
    ? null
    : redeemMutation.error instanceof ApiError && redeemMutation.error.status === 404
      ? "We couldn't find that code — check it and try again."
      : redeemMutation.error instanceof ApiError && redeemMutation.error.status === 409
        ? "That voucher has already been redeemed."
        : redeemMutation.error instanceof ApiError
          ? redeemMutation.error.message
          : "Couldn't redeem that just now — please try again.";

  return (
    <div className="flex flex-col gap-6 pb-2">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Wallet balance</p>
        {loadFailed ? (
          <div className="mt-1.5 flex items-center gap-3">
            <p className="text-sm font-medium text-[var(--danger)]">Couldn&rsquo;t load your wallet.</p>
            <button type="button" onClick={() => void refetch()} className="text-xs font-semibold text-gold-text hover:underline">
              Try again
            </button>
          </div>
        ) : (
          <p className="tabular mt-1 text-3xl font-bold text-gold-text">{isPending ? "…" : formatPaise(wallet.balance)}</p>
        )}
        <p className="mt-1 text-xs text-ink-muted">Credit applies automatically at your next checkout.</p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <label htmlFor="voucher-code" className="text-sm font-semibold text-ink">Redeem a voucher</label>
        <input
          id="voucher-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") doRedeem(); }}
          placeholder="Enter your code" autoCapitalize="characters" autoComplete="off"
          className="tabular mt-3 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base tracking-wide text-ink outline-none focus-visible:border-line-strong"
        />
        {msg && (
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <CheckCircle2 size={16} className="shrink-0 text-sage-text" aria-hidden="true" />
            <p className="text-xs font-medium text-sage-text">{msg}</p>
          </div>
        )}
        {redeemError && <p role="alert" className="mt-3 text-xs font-medium text-[var(--danger)]">{redeemError}</p>}
      </div>

      {wallet && wallet.redeemed.length > 0 && (
        <div>
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Redeemed vouchers</h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {wallet.redeemed.map((v) => (
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
          validates it (money-CTA rule, BATCH-9-BRIEFS.md Brief 57).
          Renders only while the cart is EMPTY: MiniCartBar occupies the same
          `bottom-16 z-30` band and layout.tsx renders it AFTER <main>, so with
          equal z-index the later sibling wins and would paint over this button
          and swallow its clicks. Same guard DishBuyBar ships; once a line
          exists, MiniCartBar owns the bottom edge. The Enter key on the code
          field still submits, so the input keeps its own path to doRedeem. */}
      {cart.lines.length === 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-[var(--glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:bottom-0">
          <div className="mx-auto max-w-md px-4 py-3">
            <Button
              type="button" onClick={doRedeem} disabled={redeemMutation.isPending || !code.trim()}
              shape="pill"
              size="fluid"
              className="w-full px-8 py-4 text-center text-base font-semibold disabled:opacity-40"
            >
              {redeemMutation.isPending ? "Redeeming…" : "Redeem"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
