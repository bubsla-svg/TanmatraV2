"use client"; // Justification: interactive state, form input, and graceful 404 API degradation.
import { useState } from "react";
import { submitServiceabilityInterest } from "@/lib/serviceabilityApi";
import { ApiError } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { MarketplaceFallbackCta } from "./MarketplaceFallbackCta";

/**
 * The marketplace CTA is deliberately rendered in ALL THREE out-of-zone
 * branches below (form, submitted, and the 404-degraded `hidden` state). The
 * degraded branch is the one most likely to be missed: when the notify
 * endpoint is unmounted mid-deploy the form vanishes entirely, and before this
 * it left the visitor with a single "check a different pincode" link and no
 * way forward at all. See `MarketplaceFallbackCta.tsx` for why it is shared.
 */

export interface NotifyMeFormProps {
  pincode: string;
  onReset: () => void;
}

/**
 * Notify-me capture component (OB-3 / II.3).
 * Rendered within unserviceable serviceability states. Gracefully degrades (hides) on 404.
 */
export function NotifyMeForm({ pincode, onReset }: NotifyMeFormProps) {
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-medium underline text-gold-text hover:text-ink"
        >
          Check a different pincode &rarr;
        </button>
        <div className="mt-2">
          <MarketplaceFallbackCta />
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim().length < 10) {
      setErr("Please enter a valid Indian mobile number");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await submitServiceabilityInterest(pincode, phone);
      setSubmitted(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // Graceful degradation when OB-3 route is not mounted or during split deployments
        setHidden(true);
        return;
      }
      setErr(e instanceof ApiError ? e.message : "Failed to register interest.");
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold text-[var(--success)]">
          Thank you! We&rsquo;ll notify you when delivery reaches {pincode}.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] underline text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          Check another pincode
        </button>
        <div>
          <MarketplaceFallbackCta />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="10-digit mobile"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={busy}
          className="w-48 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] outline-none focus:border-[var(--line-strong)] disabled:opacity-50"
        />
        <Button
          type="submit"
          disabled={busy || phone.trim().length < 10}
          size="fluid"
          className="rounded-lg px-4 py-2 text-xs font-semibold shadow-sm disabled:opacity-40"
        >
          {/* Real ellipsis — entities do not resolve inside JS strings (see
              ServiceabilityBar's Check button). */}
          {busy ? "Saving…" : "Notify me"}
        </Button>
        <button
          type="button"
          onClick={onReset}
          className="ml-auto text-xs underline text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          Change pincode
        </button>
      </div>
      {err && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{err}</p>}
      <p className="text-[11px] leading-snug text-[var(--ink-muted)]">
        We&rsquo;ll use this number only to tell you when Tanmatra delivers in {pincode}.
      </p>
      <MarketplaceFallbackCta />
    </form>
  );
}
