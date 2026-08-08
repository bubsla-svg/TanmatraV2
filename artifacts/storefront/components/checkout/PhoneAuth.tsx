"use client";
// Client: Firebase phone-auth is browser-only (reCAPTCHA + SMS confirmation).
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { firebaseConfigured, friendlyFirebaseError } from "@/lib/firebase";
import { sendPhoneOtp, toE164, type PhoneVerification } from "@/lib/phoneAuth";
import { getAuthUser, verifyOtp, ApiError, type AuthUser } from "@/lib/api";
import {
  canResend,
  isCodeValid,
  isPhoneValid,
  resendSecondsLeft,
  OTP_MESSAGES,
  type OtpStage,
} from "@/lib/otpFlow";

const inputCls =
  "w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base text-ink outline-none focus:border-line-strong";

/**
 * Optional sign-in (SF-03). Firebase sends the SMS, its idToken is exchanged for
 * a `sid` session at verify-otp, and the verified user is handed up so checkout
 * can attribute the order and prefill the phone. Renders NOTHING when the build
 * shipped no Firebase config — the guest money path never hard-depends on it.
 *
 * NO AUTH WALL FOR AN AUTHENTICATED USER. This component probes the session on
 * mount and renders nothing once one exists, reporting the user upward instead.
 * It used to render "Have an account? Sign in for faster checkout"
 * unconditionally — so a signed-in customer arriving at /checkout was invited
 * to sign in again, a top-of-funnel wall in the middle of the money path. The
 * probe is the same `getAuthUser()` every other auth-gated island already uses,
 * so the answer comes from the session cookie, not from client state that can
 * disagree with it.
 *
 * NO SILENT DEAD-ENDS. Every early return in `send`/`verify` now sets a visible
 * message (lib/otpFlow.ts owns the copy). Two of them used to be bare
 * `return`s — a tapped "Send code"/"Verify" that produced no SMS, no error and
 * no state change. The rules themselves (validity, resend cooldown) live in
 * lib/otpFlow.ts so they are unit-tested without a browser.
 */
export function PhoneAuth({
  onVerified,
  startExpanded = false,
  initialStage,
  onStageChange,
}: {
  onVerified: (user: AuthUser) => void;
  /**
   * Open straight at the phone input. Pass this from any surface that already
   * announces "Sign in to …" in its own copy (/login, the plan identity gate,
   * the post-401 islands): the collapsed "Have an account? Sign in for faster
   * checkout" teaser is checkout copy, and on those surfaces it was a second,
   * contradictory prompt plus one dead-feeling extra tap. Checkout keeps the
   * default: there, sign-in is genuinely optional and the teaser is correct.
   */
  startExpanded?: boolean;
  /** Overrides the startExpanded-derived initial stage. /login uses this to
   *  open directly at the step named in its URL (P0 §7 — see lib/loginRoute.ts). */
  initialStage?: OtpStage;
  /** Fired on every stage change after mount (not for the initial render) so
   *  a host page can keep its own address bar a truthful record of state. */
  onStageChange?: (stage: OtpStage) => void;
}) {
  const [stage, setStage] = useState<OtpStage>(
    initialStage ?? (startExpanded ? "phone" : "collapsed"),
  );
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** null until a session probe has answered; `false` = confirmed signed out. */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const verification = useRef<PhoneVerification | null>(null);
  const recaptcha = useRef<HTMLDivElement | null>(null);

  // `onVerified` through a ref: the session probe below must not re-run just
  // because a parent re-rendered and handed down a fresh closure.
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  // Same ref pattern for `onStageChange`, plus a mounted flag so the host's
  // very first render (the URL step it asked for) doesn't get echoed straight
  // back — only real, user-driven transitions update the address bar.
  const onStageChangeRef = useRef(onStageChange);
  onStageChangeRef.current = onStageChange;
  const mountedStage = useRef(false);
  useEffect(() => {
    if (!mountedStage.current) {
      mountedStage.current = true;
      return;
    }
    // "collapsed" is only reached from here via a just-succeeded verify()
    // (line below), which already starts its own router.replace(next) through
    // onVerified — syncing here too would race two replace() calls in the
    // same tick over which URL wins. Every other caller ignores this stage.
    if (stage === "collapsed") return;
    onStageChangeRef.current?.(stage);
  }, [stage]);

  // Session probe. A 401 (or any failure) means "signed out" — the sign-in
  // affordance is the correct fallback, never a blocked screen.
  useEffect(() => {
    let live = true;
    getAuthUser()
      .then(({ user }) => {
        if (!live) return;
        setSignedIn(Boolean(user));
        if (user) onVerifiedRef.current(user);
      })
      .catch(() => {
        if (live) setSignedIn(false);
      });
    return () => {
      live = false;
    };
  }, []);

  // Tear down the reCAPTCHA widget on unmount so it doesn't leak across mounts.
  useEffect(() => () => verification.current?.clear(), []);

  // Drive the resend countdown. Only ticks while a cooldown is actually
  // running, so an idle form schedules no timers at all.
  const secondsLeft = resendSecondsLeft(lastSentAt, now);
  useEffect(() => {
    if (lastSentAt === null || secondsLeft === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lastSentAt, secondsLeft]);

  /** Send (or re-send) the SMS. Always ends in a rendered state: a new stage,
   *  or a message saying why not. */
  const send = useCallback(async () => {
    if (!isPhoneValid(phone)) {
      setError(OTP_MESSAGES.invalidPhone);
      return;
    }
    const el = recaptcha.current;
    if (!el) {
      // Previously a bare `return` — the button looked dead.
      setError(OTP_MESSAGES.captchaUnavailable);
      return;
    }
    // Clear any prior widget first — a re-send into the same element otherwise
    // throws "reCAPTCHA has already been rendered in this element".
    verification.current?.clear();
    verification.current = null;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      verification.current = await sendPhoneOtp(toE164("91", phone), el);
      const sentAt = Date.now();
      setLastSentAt(sentAt);
      setNow(sentAt);
      setCode("");
      setStage("code");
      setNotice(`Code sent to +91 ${phone.trim()}.`);
    } catch (e) {
      setError(friendlyFirebaseError(e));
    } finally {
      setBusy(false);
    }
  }, [phone]);

  async function verify() {
    if (!isCodeValid(code)) {
      setError(OTP_MESSAGES.invalidCode);
      return;
    }
    if (!verification.current) {
      // Previously a bare `return` — "Verify" did nothing at all whenever the
      // confirmation handle had been cleared (re-mount, or a failed re-send).
      setError(OTP_MESSAGES.sessionExpired);
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const idToken = await verification.current.confirm(code);
      const res = await verifyOtp({ idToken });
      onVerifiedRef.current(res.user);
      setStage("collapsed");
      setSignedIn(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : friendlyFirebaseError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!firebaseConfigured()) return null;
  // Already authenticated (or still probing): never show a sign-in wall.
  if (signedIn !== false) return null;

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

  const resendReady = canResend(lastSentAt, now);

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-6">
      {stage === "phone" ? (
        <>
          <label htmlFor="pa-phone" className="text-sm font-medium text-ink">Mobile number</label>
          <input
            id="pa-phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone}
            onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" className={inputCls}
          />
          <Button
            type="button" disabled={busy} onClick={() => void send()}
            shape="pill" size="fluid" className="px-6 py-3 font-semibold disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send code"}
          </Button>
        </>
      ) : (
        <>
          <label htmlFor="pa-code" className="text-sm font-medium text-ink">Enter the 6-digit code</label>
          <input
            id="pa-code" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value)} placeholder="123456" className={inputCls}
          />
          <div className="flex items-center gap-3">
            <Button
              type="button" disabled={busy} onClick={() => void verify()}
              shape="pill" size="fluid" className="px-6 py-3 font-semibold disabled:opacity-40"
            >
              {busy ? "Verifying…" : "Verify"}
            </Button>
            {/* A real resend: it re-requests the SMS rather than walking the
                stage back to the phone input (which never sent anything). The
                cooldown is shown, not merely enforced — a disabled control
                with no visible reason is the signpost-less dead end Law 10
                exists to prevent. */}
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !resendReady}
              className="-m-2 p-2 text-xs font-medium text-ink-muted hover:underline disabled:no-underline disabled:opacity-60"
            >
              {resendReady ? "Resend code" : `Resend in ${secondsLeft}s`}
            </button>
            <button
              type="button"
              onClick={() => { setStage("phone"); setError(null); setNotice(null); }}
              className="-m-2 p-2 text-xs font-medium text-ink-muted hover:underline"
            >
              Change number
            </button>
          </div>
        </>
      )}
      {notice && <p role="status" className="text-xs text-ink-muted">{notice}</p>}
      {error && <p role="alert" className="text-xs font-medium text-[var(--danger)]">{error}</p>}
      <div ref={recaptcha} />
    </div>
  );
}
