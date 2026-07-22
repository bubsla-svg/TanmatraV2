import { useState } from "react";
import { cn } from "@/lib/utils";
import { StepDots } from "@/components/primitives";

interface CheckoutIdentityProps {
  /** Collapsed one-line plan summary shown above the field. */
  planSummary: string;
  /** Called with the entered phone (numeric E.164-ish). */
  onSubmitPhone: (phone: string) => void;
  className?: string;
}

/**
 * `<CheckoutIdentity>` — 02c §3 S1. Skipped entirely for signed-in users.
 * Element inventory: step dots, the collapsed plan summary, the phone field,
 * one helper line, one CTA. One decision: whose lunch is this. One typed field.
 * (OTP is a follow-up screen; WebOTP autofill makes it zero-tap.)
 */
export function CheckoutIdentity({ planSummary, onSubmitPhone, className }: CheckoutIdentityProps) {
  const [phone, setPhone] = useState("");
  const valid = phone.replace(/\D/g, "").length >= 10;

  return (
    <section className={cn("flex flex-col gap-4 p-4", className)} aria-label="Your details">
      <StepDots current={1} total={3} />

      <p className="text-sm" style={{ color: "var(--color-ink-500)", margin: 0 }}>{planSummary}</p>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm">Mobile number</span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          autoFocus
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-xl px-4 py-3"
          style={{
            backgroundColor: "var(--color-ink-800)",
            border: "1px solid var(--color-ink-600)",
            color: "var(--color-stone-0)",
          }}
        />
      </label>

      <p className="text-xs" style={{ color: "var(--color-ink-500)", margin: 0 }}>
        We'll text a code — no passwords, ever.
      </p>

      <button
        type="button"
        disabled={!valid}
        onClick={() => onSubmitPhone(phone)}
        className="rounded-xl px-4 py-3 text-center font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
        style={{ backgroundColor: "var(--color-saffron-500)", color: "var(--color-saffron-on)" }}
      >
        Continue
      </button>
    </section>
  );
}
