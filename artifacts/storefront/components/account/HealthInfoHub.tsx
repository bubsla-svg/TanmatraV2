"use client";
// account/health-information — the DPDPA-native clinical surface: explicit
// health-data consent (audit-recorded), an edit form for the clinical profile,
// and the §12 right-to-erasure. Session-gated. Stitch brief route-09 supplies
// both screens: the consent gate (with the form locked behind it) and the
// unlocked clinical profile.
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, CheckCircle2, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/api";
import { getPreferences, deleteAccount, type UserPreferences } from "@/lib/preferencesApi";
import {
  getConsent,
  grantHealthConsent,
  hasHealthConsent,
  DPDP_HEALTH_CONSENT_VERSION,
  type ConsentRow,
} from "@/lib/healthConsent";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { ClinicalForm } from "./ClinicalForm";

/** What the grant actually authorises — shown as the brief's check list so the
 *  scope is legible before the user agrees, not buried in a paragraph. */
const CONSENT_SCOPE = [
  "Processing for nutritional bio-individualization only.",
  "Encrypted at rest, visible only to you and your RD.",
  "Never shared with advertisers, never sold.",
  "Direct control over your clinical data history.",
] as const;

export function HealthInfoHub() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [consent, setConsent] = useState<ConsentRow | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "anon">("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { user } = await getAuthUser().catch(() => ({ user: null }));
    if (!user) { setPhase("anon"); return; }
    const [p, c] = await Promise.all([
      getPreferences().then((r) => r.preferences).catch(() => null),
      getConsent().then((r) => r.consent).catch(() => null),
    ]);
    setPrefs(p); setConsent(c); setPhase("ready");
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function grant() {
    setBusy(true);
    try { setConsent((await grantHealthConsent()).consent); } catch { /* surfaced on retry */ } finally { setBusy(false); }
  }

  async function erase() {
    if (!window.confirm("Are you sure you want to delete your account? This action is permanent, and under the DPDP Act 2023 all your personal and health data will be completely erased from our servers.")) return;
    setBusy(true);
    try { await deleteAccount(); window.location.href = "/"; } catch { setBusy(false); }
  }

  if (phase === "loading") return <p className="text-sm text-ink-muted">Loading…</p>;

  // Island, not a redirect: PHI surfaces offer sign-in in place (UIF §2).
  if (phase === "anon") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          Sign in to view and manage your health information.
        </p>
        <PhoneAuth onVerified={() => void load()} />
      </div>
    );
  }

  const granted = hasHealthConsent(consent);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-relaxed text-ink-muted">
        This clinical data is used exclusively for metabolic optimisation and nutritional
        bio-individualisation. Under DPDP Act 2023, you can remove any of it at any time.
      </p>
      <p className="text-[11px] leading-relaxed text-ink-faint">
        Tanmatra personalises food recommendations and is not a medical service. This is not medical advice — consult a clinician for diagnosis or treatment.
      </p>

      {!granted ? (
        <>
          <div className="relative overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--gold)_35%,transparent)] bg-[color-mix(in_srgb,var(--gold)_7%,transparent)] p-6">
            <span className="tabular absolute top-4 right-4 rounded bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] px-2 py-1 text-[10px] uppercase tracking-widest text-gold-text">
              {DPDP_HEALTH_CONSENT_VERSION}
            </span>
            <div className="mb-4 flex items-center gap-2 pr-28">
              <ShieldCheck aria-hidden className="h-5 w-5 shrink-0 text-gold-text" />
              <h2 className="text-lg font-medium text-ink">Data processing consent</h2>
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">
              To provide personalised metabolic insights we process sensitive health data
              (medical conditions, HbA1c, PCOS history, height and weight) under the Digital
              Personal Data Protection Act.
            </p>
            <ul className="mt-6 mb-8 flex flex-col gap-3">
              {CONSENT_SCOPE.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-sage-text" />
                  <span className="text-xs leading-relaxed text-ink-muted">{line}</span>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              onClick={grant}
              disabled={busy}
              shape="pill" size="fluid" className="w-full py-4 text-xs font-bold uppercase tracking-wider disabled:opacity-60"
            >
              {busy ? "Recording…" : "I agree — save my health details"}
              {!busy && <ArrowRight aria-hidden className="h-4 w-4" />}
            </Button>
          </div>

          {/* Locked preview: the real fields, disabled, so the scope of what is
              being consented to is visible before agreeing. */}
          {prefs && (
            <div aria-hidden className="pointer-events-none select-none opacity-40">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-ink">Clinical metrics</h3>
                <Lock className="h-4 w-4 text-ink-faint" />
              </div>
              <ClinicalForm prefs={prefs} disabled onSaved={setPrefs} />
            </div>
          )}
        </>
      ) : prefs ? (
        <ClinicalForm prefs={prefs} disabled={false} onSaved={setPrefs} />
      ) : (
        <p className="text-sm text-ink-muted">Couldn&rsquo;t load your health profile.</p>
      )}

      <div className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] p-5">
        <p className="text-sm font-semibold text-ink">Right to Erasure (Section 12)</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Under the DPDP Act 2023, you have the right to request erasure of your entire account and all associated personal, health, and dietary history.
        </p>
        <button type="button" onClick={erase} disabled={busy} className="mt-3 rounded-xl border border-[var(--danger)] px-5 py-2.5 text-sm font-semibold text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] disabled:opacity-60">
          Permanently delete account &amp; data
        </button>
      </div>
    </div>
  );
}
