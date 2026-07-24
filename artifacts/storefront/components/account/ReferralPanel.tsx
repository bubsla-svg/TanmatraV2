"use client";
// Client: referral code display + share copy + redeem-a-friend's-code form.
// Data comes from the parent (GET /referral/me); this component owns only
// the redeem-form's own local request state.
import { useState } from "react";
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
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
      <div>
        <p className="text-sm font-semibold text-ink">
          Give {formatPaise(data.awards.refereePaise)}, get {formatPaise(data.awards.referrerPaise)}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Share your code — your friend gets {formatPaise(data.awards.refereePaise)} credit on their first
          order, and you get {formatPaise(data.awards.referrerPaise)} once they place it.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-center text-lg font-semibold tracking-wider text-ink">
          {data.code}
        </span>
        <button
          type="button"
          onClick={() => void copyCode()}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-[var(--gold-ink)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="border-t border-line pt-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Got a friend&rsquo;s code?
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code"
              className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm uppercase"
            />
            <button
              type="button"
              disabled={busy || !code.trim()}
              onClick={() => void submit()}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-gold-text disabled:opacity-40"
            >
              {busy ? "Applying…" : "Apply"}
            </button>
          </div>
        </label>
        {redeemed && (
          <p className="mt-2 text-xs font-medium text-sage-text">
            Code applied — your credit lands after your first order.
          </p>
        )}
        {error && <p role="alert" className="mt-2 text-xs font-medium text-[var(--danger)]">{error}</p>}
      </div>

      {data.redemptions.length > 0 && (
        <div className="border-t border-line pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Friends you&rsquo;ve referred</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {data.redemptions.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-xs text-ink-muted">
                <span>Joined {fmtDate(r.createdAt)}</span>
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
