"use client";
// account/health-information — the DPDPA-native clinical surface: explicit
// health-data consent (audit-recorded), an edit form for the clinical profile,
// and the §12 right-to-erasure. Session-gated. The wellness food/water tracker
// is the planned v2 (separate, larger PHI surface).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getAuthUser } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { getPreferences, deleteAccount, type UserPreferences } from "@/lib/preferencesApi";
import { getConsent, grantHealthConsent, hasHealthConsent, type ConsentRow } from "@/lib/healthConsent";
import { ClinicalForm } from "./ClinicalForm";

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
  if (phase === "anon") return (
    <p className="text-sm text-ink-muted">
      <Link href="/login?next=/account/health-information" className="font-medium text-gold-text hover:underline">Sign in</Link> to view and manage your health information.
    </p>
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-muted">
        Your clinical profile is used to personalise dish ranking. Under DPDP Act 2023, you can remove any of this information at any time.
      </p>
      <p className="text-[11px] leading-relaxed text-ink-faint">
        Tanmatra personalises food recommendations and is not a medical service. This is not medical advice — consult a clinician for diagnosis or treatment.
      </p>

      {!hasHealthConsent(consent) ? (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--gold)_35%,transparent)] bg-[color-mix(in_srgb,var(--gold)_7%,transparent)] p-5">
          <p className="text-sm font-semibold text-ink">Consent to process your health details</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            I agree that Tanmatra may process my health details (medical conditions, HbA1c, PCOS history, height and weight) to personalise my
            meal ranking, under the DPDP Act 2023. This sensitive data is stored encrypted, is visible only to you and your RD, is never shared
            with advertisers, and can be removed by you at any time.
          </p>
          <button type="button" onClick={grant} disabled={busy} className="mt-3 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-[var(--gold-ink)] disabled:opacity-60">
            {busy ? "Recording…" : "I agree — save my health details"}
          </button>
        </div>
      ) : prefs ? (
        <ClinicalForm prefs={prefs} disabled={false} onSaved={setPrefs} />
      ) : (
        <p className="text-sm text-ink-muted">Couldn&rsquo;t load your health profile.</p>
      )}

      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] p-5">
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
