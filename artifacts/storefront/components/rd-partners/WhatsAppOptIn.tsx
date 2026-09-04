"use client";
// WhatsApp opt-in sub-flow for the RD partner wizard (Stitch brief 16):
// send-otp -> verify-otp -> the parent submits. The opt-in is only honoured if
// THIS session's stable `sessionId` verified the number, so the sessionId is a
// prop — never minted here.
//
// The step is deliberately skippable. A transport failure (502) is not the
// applicant's problem: they are told the opt-in is unavailable and the wizard
// continues without it. Only the phone digits and the verified flag are lifted
// to the parent draft; the code and transient errors stay local.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { sendRdWhatsappOtp, verifyRdWhatsappOtp } from "@/lib/rdPartnerApi";
import { RD_WHATSAPP_COPY as C } from "@/content/landing/rdPartners";
import { Field, TextField } from "./WizardControls";

type Phase = "idle" | "sent" | "verified" | "unavailable";

export function WhatsAppOptIn({
  sessionId,
  countryCode,
  phone,
  verified,
  onPhoneChange,
  onCountryCodeChange,
  onVerified,
}: {
  sessionId: string;
  countryCode: string;
  phone: string;
  verified: boolean;
  onPhoneChange: (v: string) => void;
  onCountryCodeChange: (v: string) => void;
  onVerified: (v: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>(verified ? "verified" : "idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setNote(null);
    try {
      await sendRdWhatsappOtp({ countryCode: countryCode.trim(), phone: phone.trim() });
      setPhase("sent");
    } catch (e) {
      if (e instanceof ApiError && e.status === 502) {
        // Transport down — do not trap the applicant in a step they can skip.
        setPhase("unavailable");
        setNote("WhatsApp verification is unavailable right now. You can finish without it.");
      } else if (e instanceof ApiError && e.status === 429) {
        setNote("Too many codes requested for this number. Please try again later, or skip this step.");
      } else {
        setNote("Couldn't send the code. Please check the number, or skip this step.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setNote(null);
    try {
      await verifyRdWhatsappOtp({
        countryCode: countryCode.trim(),
        phone: phone.trim(),
        code: code.trim(),
        sessionId,
      });
      setPhase("verified");
      onVerified(true);
    } catch {
      setNote("That code didn't match. Request a new one, or skip this step.");
    } finally {
      setBusy(false);
    }
  }

  /** Changing the number retracts any proof — the old one no longer applies. */
  function changePhone(v: string) {
    onPhoneChange(v);
    if (verified) onVerified(false);
    if (phase !== "idle") setPhase("idle");
    setCode("");
  }

  if (phase === "verified") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-bg p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage-text">
          ✓
        </span>
        <div className="flex flex-col">
          <span className="font-data text-sm text-ink">
            {countryCode} {phone}
          </span>
          <span className="text-2xs font-semibold uppercase tracking-widest text-sage-text">Verified</span>
        </div>
        <button
          type="button"
          onClick={() => changePhone(phone)}
          className="ml-auto text-xs text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          Change
        </button>
      </div>
    );
  }

  const canSend = phone.trim().length >= 6 && countryCode.trim().length >= 1;

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-line bg-bg p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-display font-semibold text-primary">{C.heading}</h3>
        <p className="text-sm leading-relaxed text-ink-muted">{C.blurb}</p>
      </div>

      <div className="flex gap-2">
        <div className="w-24">
          <Field label="Code" htmlFor="rd-cc">
            <TextField id="rd-cc" type="tel" value={countryCode} onChange={onCountryCodeChange} placeholder="+91" />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="WhatsApp number" htmlFor="rd-phone">
            <TextField id="rd-phone" type="tel" value={phone} onChange={changePhone} placeholder="98765 43210" />
          </Field>
        </div>
      </div>

      {phase === "sent" && (
        <Field label="6-digit code" htmlFor="rd-otp">
          <TextField id="rd-otp" value={code} onChange={setCode} placeholder="123456" inputMode="numeric" />
        </Field>
      )}

      {note && (
        <p role="status" className="text-2xs leading-relaxed text-ink-muted">
          {note}
        </p>
      )}

      {phase !== "unavailable" && (
        <Button
          type="button"
          disabled={busy || (phase === "idle" ? !canSend : code.trim().length === 0)}
          aria-busy={busy}
          aria-live="polite"
          onClick={() => void (phase === "sent" ? verify() : send())}
          shape="pill"
          size="fluid"
          className="self-start px-6 py-3 text-2xs font-semibold uppercase tracking-widest disabled:opacity-40"
        >
          {busy ? "Working…" : phase === "sent" ? "Verify code" : "Send code"}
        </Button>
      )}

      <p className="text-xs text-ink-faint">
        {C.skip} — this step is optional and does not affect your application.
      </p>
    </div>
  );
}
