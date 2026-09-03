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
          className="inline-flex min-h-11 items-center text-xs font-medium text-primary underline underline-offset-4 hover:text-ink"
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
        <p className="text-xs font-semibold text-sage-text">
          Thank you! We&rsquo;ll notify you when delivery reaches {pincode}.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-11 items-center text-xs font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          Check another pincode
        </button>
        <div>
          <MarketplaceFallbackCta />
        </div>
      </div>
    );
  }

  // T-04: this is the ONLY conversion left for an out-of-zone visitor, and it
  // used to be the smallest form on the site (39px unlabelled phone, an
  // 88×16 "Change pincode" link). Now the phone field matches the identity
  // gate (50px, labelled, 16px text so iOS never zooms, numeric keypad), the
  // primary is a full-width gold button directly under it, and the secondary
  // is a 44px outlined button — gold stays the one action colour here.
  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div>
        <label htmlFor={`notify-phone-${pincode}`} className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.16em] text-ink-muted">
          Mobile number
        </label>
        <input
          id={`notify-phone-${pincode}`}
          type="tel"
          name="tel"
          inputMode="numeric"
          autoComplete="tel"
          enterKeyHint="send"
          maxLength={10}
          pattern="[0-9]*"
          placeholder="10-digit mobile"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          disabled={busy}
          className="w-full min-h-[50px] rounded-2xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none placeholder:text-ink-faint focus-visible:border-primary disabled:opacity-50"
        />
      </div>
      {err && <p role="alert" className="mt-1 block text-xs font-medium text-[var(--danger)]">{err}</p>}
      <Button
        type="submit"
        disabled={busy || phone.trim().length < 10}
        aria-busy={busy}
        aria-live="polite"
        shape="pill"
        size="fluid"
        className="block w-full min-h-12 px-4 py-3 text-center text-sm font-semibold disabled:opacity-40"
      >
        {/* Real ellipsis — entities do not resolve inside JS strings (see
            ServiceabilityBar's Check button). */}
        {busy ? "Saving…" : "Notify me"}
      </Button>
      <button
        type="button"
        onClick={onReset}
        className="flex min-h-12 w-full items-center justify-center rounded-full border border-line-strong px-4 text-sm font-medium text-ink transition-colors hover:bg-secondary active:scale-[0.98]"
      >
        Change pincode
      </button>
      <p className="text-xs leading-relaxed text-ink-muted">
        We currently deliver across Noida (sectors 1–168). We&rsquo;ll use this number only to tell you when Tanmatra delivers in {pincode}.
      </p>
      <MarketplaceFallbackCta />
    </form>
  );
}
