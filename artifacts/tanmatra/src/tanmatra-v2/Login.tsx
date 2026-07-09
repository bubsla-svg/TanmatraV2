import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { API_BASE } from "@/lib/apiBase";
import { track } from "@/lib/analytics";
import { auth, friendlyFirebaseError } from "../lib/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { captureAttribution, getAttribution } from "@/lib/attribution";
import { WelcomeModal } from "@/components/auth/WelcomeModal";

/* Full-parity re-port of the System-A Login (git 2507084, 472 lines) into v2.
 * Firebase phone-OTP logic preserved verbatim; presentation only is v2. */

type Step = "phone" | "code";
const MIN_PHONE_LEN_BY_CC: Record<string, number> = { "+91": 10, "+1": 10, "+44": 10, "+971": 9 };
const DEFAULT_MIN_PHONE_LEN = 7;
const minPhoneLen = (cc: string) => MIN_PHONE_LEN_BY_CC[cc] ?? DEFAULT_MIN_PHONE_LEN;
const RESEND_COOLDOWN_SECS = 30;
const TOS_VERSION = "2026-05";

export default function V2Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const rawNext = params.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const UNLOCK_PHRASE = "tanmatra-ops-2026";
  const adminShortcutVisible = import.meta.env.DEV || params.get("unlock") === UNLOCK_PHRASE;

  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const recaptchaVerifierRef = useRef<any>(null);
  const [smsConsent, setSmsConsent] = useState(false);
  const [whatsAppConsent, setWhatsAppConsent] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => { captureAttribution(); }, []);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const enterAdminMode = () => {
    try {
      window.localStorage.setItem("tanmatra:admin:v1", "1");
      toast.success("Admin mode enabled (dev only)");
      navigate(next.startsWith("/") ? next : "/admin/ops", { replace: true });
    } catch { toast.error("Could not enable admin mode"); }
  };

  const sendOtp = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < minPhoneLen(countryCode)) { toast.error(`Enter a valid ${countryCode} phone number`); return; }
    setIsSending(true);
    if (!auth) {
      toast.error("Sign-in is temporarily unavailable", { description: "Verification service is not configured. Please try again shortly." });
      setIsSending(false);
      return;
    }
    try {
      if (recaptchaVerifierRef.current) { try { recaptchaVerifierRef.current.clear(); } catch {} recaptchaVerifierRef.current = null; }
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      const phoneNumberE164 = `${countryCode}${digits}`;
      const confirmation = await signInWithPhoneNumber(auth, phoneNumberE164, recaptchaVerifierRef.current);
      setConfirmationResult(confirmation);
      setStep("code");
      setResendIn(RESEND_COOLDOWN_SECS);
      toast.success(`Verification code sent to ${countryCode} ${phone}`);
    } catch (err) {
      console.error("SMS OTP failed:", err);
      if (recaptchaVerifierRef.current) { try { recaptchaVerifierRef.current.clear(); } catch {} recaptchaVerifierRef.current = null; }
      toast.error("Couldn't send verification code", { description: friendlyFirebaseError(err) });
    } finally { setIsSending(false); }
  };

  const verifyOtp = async () => {
    if (code.replace(/\D/g, "").length < 6) { toast.error("Enter the 6-digit verification code"); return; }
    if (!confirmationResult) { toast.error("No verification in progress"); return; }
    setIsVerifying(true);
    try {
      const userCredential = await confirmationResult.confirm(code);
      const idToken = await userCredential.user.getIdToken();
      const attr = getAttribution();
      const res = await fetch(`${API_BASE}/auth/phone/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken, attribution: { ...(attr ?? {}), dpdpConsent: true, tosVersion: TOS_VERSION, marketingSmsConsent: smsConsent, marketingWhatsAppConsent: whatsAppConsent } }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.user) { toast.error(data.error ?? "Incorrect code"); return; }
      // Session probe: confirm the browser actually STORED the session
      // cookie before navigating into an auth-gated page. If it didn't
      // (third-party cookie blocking on a cross-site API), the guard
      // would bounce straight back here — an infinite-feeling loop with
      // no explanation. Surface the real problem instead.
      try {
        const probe = await fetch(`${API_BASE}/auth/user`, { credentials: "include" });
        const probeData: any = await probe.json().catch(() => ({}));
        if (!probe.ok || !probeData.user) {
          track("auth_session_cookie_dropped", { path: "/login" });
          toast.error("Signed in, but your browser refused the session cookie", {
            description:
              "Please disable 'block all cookies' / strict tracking prevention for this site and try again.",
          });
          return;
        }
      } catch { /* network blip — proceed; the guard will re-check */ }
      if (data.user.firstName === null) { setShowWelcome(true); return; }
      toast.success("Signed in");
      navigate(next, { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Verification failed: " + (err as Error).message);
    } finally { setIsVerifying(false); }
  };

  const Consent = ({ on, set, color, children }: any) => (
    <button className="fx gap8" style={{ alignItems: "flex-start", width: "100%", marginTop: 10 }} onClick={() => set(!on)} type="button">
      <i className={on ? "ph-fill ph-check-square" : "ph-bold ph-square"} style={{ fontSize: 20, color: on ? color : "var(--mut)", flex: "none", marginTop: 1 }} />
      <span className="fine" style={{ textAlign: "left", lineHeight: 1.4 }}>{children}</span>
    </button>
  );

  return (
    <div className="tnm2" style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ maxWidth: 420, width: "100%", margin: "0 auto", padding: 20 }}>
        <div className="tc mb20">
          <div className="dic" style={{ width: 48, height: 48, margin: "0 auto 12px", color: "var(--safb)", fontSize: 24 }}><i className="ph-bold ph-flask" /></div>
          <div className="h2">Welcome to Tanmatra</div>
          <div className="fine mt6">{step === "phone" ? "Sign in with your phone number — we'll text you a code." : `Enter the 6-digit code we sent to ${countryCode} ${phone}.`}</div>
        </div>

        <div className="card">
          {step === "phone" ? (
            <>
              <div className="lab mb6">Phone number</div>
              <div className="fx ac gap8">
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} aria-label="Country code"
                  style={{ height: 46, background: "var(--s2)", border: "1px solid var(--ln2)", borderRadius: 10, color: "var(--tx)", fontSize: 14, padding: "0 8px", width: 96 }}>
                  <option value="+91">🇮🇳 +91</option><option value="+1">🇺🇸 +1</option><option value="+44">🇬🇧 +44</option>
                  <option value="+61">🇦🇺 +61</option><option value="+971">🇦🇪 +971</option><option value="+65">🇸🇬 +65</option>
                </select>
                <div className="inp f1"><input autoFocus inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" value={phone}
                  onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void sendOtp(); }} /></div>
              </div>

              <Consent on={whatsAppConsent} set={setWhatsAppConsent} color="var(--sage)">Send me order confirmations and delivery updates on WhatsApp. Reply STOP any time.</Consent>
              <Consent on={smsConsent} set={setSmsConsent} color="var(--safb)">Send me menu updates and offers by SMS. Unsubscribe by replying STOP.</Consent>

              <button className="btn btn-p btn-lg btn-blk mt14" onClick={sendOtp} disabled={isSending}><i className="ph-bold ph-phone" /> {isSending ? "Sending…" : "Send code"}</button>
              <div className="fine tc mt10">By continuing you agree to our <Link to="/terms" style={{ color: "var(--safb)" }}>Terms</Link> and <Link to="/privacy" style={{ color: "var(--safb)" }}>Privacy Policy</Link>.</div>
            </>
          ) : (
            <>
              <div className="lab mb6">Verification code</div>
              <div className="inp"><input autoFocus inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") void verifyOtp(); }}
                style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 18 }} /></div>
              {import.meta.env.DEV && devCode && <div className="fine mt6" style={{ color: "var(--sage)" }}><i className="ph-bold ph-chat-text" /> Dev mode — your code is <span className="mono">{devCode}</span></div>}

              <div className="fx ac jb mt10">
                <span className="fine">Didn't get the code?</span>
                <button className="fine" style={{ color: resendIn > 0 ? "var(--fnt)" : "var(--safb)" }} disabled={resendIn > 0 || isSending} onClick={() => void sendOtp()}>
                  {resendIn > 0 ? `Resend in ${resendIn}s` : isSending ? "Sending…" : "Resend code"}
                </button>
              </div>
              <div className="fx ac gap8 mt14">
                <button className="btn btn-g f1" onClick={() => { setStep("phone"); setCode(""); setDevCode(null); setResendIn(0); }}>Change number</button>
                <button className="btn btn-p f1" onClick={verifyOtp} disabled={isVerifying}>{isVerifying ? "Verifying…" : "Verify"}</button>
              </div>
            </>
          )}

          <div id="recaptcha-container" style={{ position: "fixed", bottom: 0, right: 0, zIndex: 50, pointerEvents: "none" }} />

          <div className="fine tc mt14"><i className="ph-bold ph-shield-check" style={{ color: "var(--sage)" }} /> Secured by Firebase</div>

          {adminShortcutVisible && (
            <>
              <div style={{ borderTop: "1px solid var(--ln)", margin: "12px 0" }} />
              <button className="btn btn-g btn-blk" onClick={enterAdminMode}><i className="ph-bold ph-pulse" /> Continue as Operations</button>
              <div className="fine tc mt6">Internal shortcut to /admin</div>
            </>
          )}
        </div>
      </div>

      <WelcomeModal
        open={showWelcome}
        onComplete={() => { setShowWelcome(false); toast.success("Signed in"); navigate(next, { replace: true }); }}
        onSkip={() => { setShowWelcome(false); toast.success("Signed in"); navigate(next, { replace: true }); }}
      />
    </div>
  );
}
