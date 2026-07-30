"use client";
// Client: Firebase phone-auth is browser-only (reCAPTCHA + SMS confirmation).
import { useEffect, useRef, useState } from "react";
import { firebaseConfigured, friendlyFirebaseError } from "@/lib/firebase";
import { sendPhoneOtp, toE164, type PhoneVerification } from "@/lib/phoneAuth";
import { verifyOtp, ApiError, type AuthUser } from "@/lib/api";

type Stage = "collapsed" | "phone" | "code";

const inputCls =
  "w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus:border-line-strong";

/**
 * Optional sign-in (SF-03). Firebase sends the SMS, its idToken is exchanged for
 * a `sid` session at verify-otp, and the verified user is handed up so checkout
 * can attribute the order and prefill the phone. Renders NOTHING when the build
 * shipped no Firebase config — the guest money path never hard-depends on it.
 */
export function PhoneAuth({ onVerified }: { onVerified: (user: AuthUser) => void }) {
  const [stage, setStage] = useState<Stage>("collapsed");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verification = useRef<PhoneVerification | null>(null);
  const recaptcha = useRef<HTMLDivElement | null>(null);

  // Tear down the reCAPTCHA widget on unmount so it doesn't leak across mounts.
  useEffect(() => () => verification.current?.clear(), []);

  if (!firebaseConfigured()) return null;

  const phoneValid = phone.replace(/\D/g, "").length >= 10;
  const codeValid = code.replace(/\D/g, "").length >= 6;

  async function send() {
    const el = recaptcha.current;
    if (!el) return;
    // Clear any prior widget first — a re-send into the same element otherwise
    // throws "reCAPTCHA has already been rendered in this element".
    verification.current?.clear();
    verification.current = null;
    setError(null);
    setBusy(true);
    try {
      verification.current = await sendPhoneOtp(toE164("91", phone), el);
      setStage("code");
    } catch (e) {
      setError(friendlyFirebaseError(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!verification.current) return;
    setError(null);
    setBusy(true);
    try {
      const idToken = await verification.current.confirm(code);
      const res = await verifyOtp({ idToken });
      onVerified(res.user);
      setStage("collapsed");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : friendlyFirebaseError(e));
    } finally {
      setBusy(false);
    }
  }

  if (stage === "collapsed") {
    return (
      <button
        type="button"
        onClick={() => setStage("phone")}
        className="-m-2 self-start p-2 text-sm font-medium text-gold-text underline-offset-4 hover:underline"
      >
        Have an account? Sign in for faster checkout
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-6">
      {stage === "phone" ? (
        <>
          <label htmlFor="pa-phone" className="text-sm font-medium text-ink">Mobile number</label>
          <input
            id="pa-phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone}
            onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" className={inputCls}
          />
          <button
            type="button" disabled={!phoneValid || busy} onClick={send}
            className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send code"}
          </button>
        </>
      ) : (
        <>
          <label htmlFor="pa-code" className="text-sm font-medium text-ink">Enter the 6-digit code</label>
          <input
            id="pa-code" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value)} placeholder="123456" className={inputCls}
          />
          <div className="flex items-center gap-3">
            <button
              type="button" disabled={!codeValid || busy} onClick={verify}
              className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-[var(--gold-ink)] transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
            <button type="button" onClick={() => setStage("phone")} className="-m-2 p-2 text-xs font-medium text-ink-muted hover:underline">
              Resend
            </button>
          </div>
        </>
      )}
      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      <div ref={recaptcha} />
    </div>
  );
}
