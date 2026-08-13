import { useState } from "react";
import { Card } from "@astryxdesign/core/Card";
import { Field } from "@astryxdesign/core/Field";
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
      {/* Stage-5 Astryx adoption (chrome only): Card + Field shell around the
          SAME native tel input — TextInput can't carry type=tel/inputMode/
          autoComplete, and #co-phone + the label text are e2e contracts. The
          helper line rides Field's description slot (aria-describedby wired by
          Field). Handler, valid gate and copy untouched. */}
      <Card padding={6} className="rounded-3xl">
        <Field
          label="Your mobile number"
          inputID="co-phone"
          description="We use this to reach you about your order — no passwords, ever."
        >
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
        </Field>
      </Card>
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
