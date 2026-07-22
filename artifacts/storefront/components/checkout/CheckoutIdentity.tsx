import { useState } from "react";
import { StepDots } from "./StepDots";
import { CERTAINTY } from "@/lib/checkout";
import { LIVE_CHECKOUT_ENABLED } from "@/lib/flags";
import { sendOtp, ApiError } from "@/lib/api";

/**
 * Screen 1 — Identity (02c §3). One decision: whose lunch. One typed field: the
 * phone. When live checkout is on, "Send code" calls the api-server's OTP send
 * (the code is then collected + verified via the Firebase phone-auth seam — see
 * docs/LIVE-CUTOVER.md); OFF, it advances as a skeleton stub. No password, ever.
 * Client behaviour is inherited from CheckoutFlow — no directive needed.
 */
export function CheckoutIdentity({
  planSummary,
  step,
  total,
  onSubmitPhone,
}: {
  planSummary: string;
  step: number;
  total: number;
  onSubmitPhone: (phone: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = phone.replace(/\D/g, "").length >= 10;

  async function submit() {
    setError(null);
    if (!LIVE_CHECKOUT_ENABLED) {
      onSubmitPhone(phone);
      return;
    }
    setSending(true);
    try {
      await sendOtp({ countryCode: "91", phone: phone.replace(/\D/g, "") });
      onSubmitPhone(phone);
    } catch (e) {
      // Fail loud — never advance as if a code went out when it didn't.
      setError(e instanceof ApiError ? e.message : "Couldn't send the code. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <StepDots current={step} total={total} />
      <p className="text-sm text-ink-muted">{planSummary}</p>
      <div>
        <label htmlFor="co-phone" className="mb-1.5 block text-sm font-medium text-ink">
          Your mobile number
        </label>
        <input
          id="co-phone"
          type="tel"
          inputMode="numeric"
          autoFocus
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="98765 43210"
          className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus:border-line-strong"
        />
        <p className="mt-1.5 text-xs text-ink-faint">We&rsquo;ll text a code — no passwords, ever.</p>
      </div>
      {error && <p className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      <p className="text-xs font-medium text-sage">{CERTAINTY.identity}</p>
      <button
        type="button"
        disabled={!valid || sending}
        onClick={submit}
        className="rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        {sending ? "Sending…" : "Send code"}
      </button>
    </div>
  );
}
