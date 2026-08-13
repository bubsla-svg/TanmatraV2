import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StepDots } from "./StepDots";
import { CERTAINTY } from "@/lib/checkout";

/**
 * Screen 1 — Identity (02c §3). One decision: whose lunch. One typed field: the
 * phone. The plan flow captures the number and advances; verified sign-in for
 * the LIVE money path is Firebase phone-auth in the à-la-carte checkout's
 * PhoneAuth step (SF-03), not here. No password, ever. Client behaviour is
 * inherited from CheckoutFlow — no directive needed.
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
  const valid = phone.replace(/\D/g, "").length >= 10;

  return (
    <div className="flex flex-col gap-5">
      <StepDots current={step} total={total} />
      <h1 className="text-lg font-semibold text-ink">Your details</h1>
      <p className="text-sm text-ink-muted">{planSummary}</p>
      <div className="rounded-3xl border border-line bg-surface p-6">
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
          className="w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus-visible:border-line-strong"
        />
        <p className="mt-1.5 text-xs text-ink-faint">We use this to reach you about your order — no passwords, ever.</p>
      </div>
      <p className="text-xs font-medium text-sage-text">{CERTAINTY.identity}</p>
      <Button
        type="button"
        disabled={!valid}
        onClick={() => onSubmitPhone(phone)}
        shape="pill" size="fluid" className="px-6 py-3 font-semibold disabled:opacity-40"
      >
        Continue
      </Button>
    </div>
  );
}
