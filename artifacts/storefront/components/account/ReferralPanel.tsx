"use client";
// Client: referral code display + share copy + redeem-a-friend's-code form.
// Data comes from the parent (GET /referral/me); this component owns only
// the redeem-form's own local request state.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { formatPaise } from "@/lib/format";
import { redeemReferralCode, type ReferralMe } from "@/lib/referralApi";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function ReferralPanel({ data }: { data: ReferralMe }) {
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied/unavailable — the code is still visible
      // on screen to copy by hand, so this is a silent no-op.
    }
  }

  async function submit() {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await redeemReferralCode(code.trim());
      setRedeemed(true);
      setCode("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't redeem that code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
      <div>
        <p className="font-display text-lg font-semibold leading-tight text-primary">
          Give {formatPaise(data.awards.refereePaise)}, get {formatPaise(data.awards.referrerPaise)}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Share your code — your friend gets {formatPaise(data.awards.refereePaise)} credit on their first
          order, and you get {formatPaise(data.awards.referrerPaise)} once they place it.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-3">
        <span className="font-data text-xl font-bold tracking-[0.2em] text-primary">{data.code}</span>
        <Button
          type="button"
          onClick={() => void copyCode()}
          shape="pill" size="fluid" className="shrink-0 px-5 py-2 text-sm font-semibold"
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <div className="border-t border-line pt-5">
        <label className="flex flex-col gap-2 text-sm font-medium text-ink">
          Got a friend&rsquo;s code?
          <div className="flex gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code"
              className="min-h-[50px] min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 py-3 text-base uppercase text-ink outline-none placeholder:text-ink-faint focus-visible:border-primary"
            />
            <button
              type="button"
              disabled={busy || !code.trim()}
              aria-busy={busy}
              aria-live="polite"
              onClick={() => void submit()}
              className="min-h-11 shrink-0 rounded-full border border-line-strong bg-surface px-4 text-sm font-bold text-ink disabled:opacity-40"
            >
              {busy ? "Applying…" : "Apply"}
            </button>
          </div>
        </label>
        {redeemed && (
          <p className="mt-3 text-xs font-medium text-sage-text">
            Code applied — your credit lands after your first order.
          </p>
        )}
        {error && <p role="alert" className="mt-3 text-xs font-medium text-danger">{error}</p>}
      </div>

      {data.redemptions.length > 0 && (
        <div className="border-t border-line pt-5">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">Friends you&rsquo;ve referred</p>
          <ul className="mt-1 divide-y divide-line">
            {data.redemptions.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                <span className="font-data text-ink">Joined {fmtDate(r.createdAt)}</span>
                <span className={r.awardedAt ? "font-medium text-sage-text" : "text-ink-faint"}>
                  {r.awardedAt ? `You earned ${formatPaise(r.referrerAwardPaise)}` : "Pending first order"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
