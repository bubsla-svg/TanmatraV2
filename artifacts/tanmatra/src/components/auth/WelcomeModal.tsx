import { useState } from "react";
import { toast } from "sonner";
import { Sparkle } from "@phosphor-icons/react";

import { API_BASE } from "@/lib/apiBase";

interface WelcomeModalProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * Post-OTP first-sign-in capture. Asks for first name (required) + optional
 * email. Skippable so we never block a returning customer's order intent;
 * the same modal can be retriggered later from the Account page.
 *
 * Persists via PATCH /auth/profile-info — the server returns the updated
 * AuthUser but we don't propagate it here because the only place reading it
 * client-side is the Account page, which refetches /auth/user on its own.
 */
export function WelcomeModal({
  open,
  onComplete,
  onSkip,
}: WelcomeModalProps) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmedName = firstName.trim();
    if (!trimmedName) {
      toast.error("Please tell us your first name");
      return;
    }
    setSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      const res = await fetch(`${API_BASE}/auth/profile-info`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: trimmedName,
          ...(trimmedEmail ? { email: trimmedEmail } : {}),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(
          res.status === 409
            ? "That email is already used by another account"
            : data.error ?? "Could not save your details",
        );
        return;
      }
      toast.success(`Welcome, ${trimmedName}!`);
      onComplete();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="tnm2 bg-black/60"
      // Block dismiss-by-overlay-click while we're posting; otherwise allow
      // it (treated as "skip").
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={() => {
        if (!submitting) onSkip();
      }}
    >
      <div
        className="card"
        style={{ maxWidth: 384, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--safd)", border: "1px solid var(--saf)" }}
          >
            <Sparkle className="w-5 h-5" style={{ color: "var(--safb)" }} weight="bold" />
          </div>
          <div className="tt" style={{ color: "var(--tx)" }}>
            What should we call you?
          </div>
          <p className="fine">
            Helps your rider greet you correctly and personalises your menu.
            Email is optional — only used for receipts.
          </p>
        </div>
        <div className="space-y-3 pt-2 mt12">
          <div className="space-y-1.5">
            <label htmlFor="welcome-fn" className="lab">
              First name
            </label>
            <input
              id="welcome-fn"
              className="inp"
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Priya"
              maxLength={64}
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="welcome-email" className="lab">
              Email <span style={{ color: "var(--fnt)" }}>(optional)</span>
            </label>
            <input
              id="welcome-email"
              className="inp"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="priya@example.com"
              maxLength={254}
              autoComplete="email"
              inputMode="email"
            />
          </div>
        </div>
        <div className="fx gap8 mt16" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className={`btn btn-g ${submitting ? "dis" : ""}`}
            onClick={onSkip}
            disabled={submitting}
          >
            Skip for now
          </button>
          <button
            type="button"
            className={`btn btn-p ${submitting || !firstName.trim() ? "dis" : ""}`}
            onClick={submit}
            disabled={submitting || !firstName.trim()}
          >
            {submitting ? "Saving…" : "Save & continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
