"use client";
// account/health-information — the DPDPA-native clinical surface: explicit
// health-data consent (audit-recorded), an edit form for the clinical profile,
// and the §12 right-to-erasure. Session-gated. Stitch brief route-09 supplies
// both screens: the consent gate (with the form locked behind it) and the
// unlocked clinical profile.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, CheckCircle2, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { getAuthUser, type AuthUser } from "@/lib/api";
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
  const queryClient = useQueryClient();
  const [eraseBusy, setEraseBusy] = useState(false);
  const [eraseError, setEraseError] = useState<string | null>(null);

  // Soft probe: getAuthUser is a 200-with-null read, never a 401 — a network
  // failure here is indistinguishable from "signed out" upstream, so this
  // preserves that fallback rather than inventing a new auth-error state.
  const authQuery = useQuery({
    queryKey: ["account", "auth-user"],
    queryFn: async () => {
      try {
        return (await getAuthUser()).user;
      } catch {
        return null;
      }
    },
  });
  const user: AuthUser | null = authQuery.data ?? null;

  const prefsQuery = useQuery({
    queryKey: ["account", "preferences"],
    queryFn: () => getPreferences().then((r) => r.preferences),
    enabled: !!user,
  });

  // Finding #2: a failed READ must never collapse into "not consented" — that
  // re-shows the DPDP gate to someone who already granted it. This branch is
  // kept separate from the ungranted-consent UI below.
  const consentQuery = useQuery({
    queryKey: ["account", "health-consent"],
    queryFn: () => getConsent().then((r) => r.consent),
    enabled: !!user,
  });

  // Finding #2b: useMutation surfaces isError/error for free, so a failed
  // grant no longer disappears silently.
  const grantMutation = useMutation({
    mutationFn: () => grantHealthConsent(),
    onSuccess: ({ consent }) => {
      queryClient.setQueryData<ConsentRow | null>(["account", "health-consent"], consent);
    },
  });

  function updatePrefsCache(p: UserPreferences) {
    queryClient.setQueryData(["account", "preferences"], p);
  }

  async function erase() {
    if (!window.confirm("Are you sure you want to delete your account? This action is permanent, and under the DPDP Act 2023 all your personal and health data will be completely erased from our servers.")) return;
    setEraseBusy(true);
    setEraseError(null);
    try {
      await deleteAccount();
      window.location.href = "/";
    } catch (e) {
      setEraseError(e instanceof ApiError ? e.message : "Couldn't delete your account. Please try again.");
      setEraseBusy(false);
    }
  }

  if (authQuery.isPending) return <p className="text-sm text-ink-muted">Loading…</p>;

  // Island, not a redirect: PHI surfaces offer sign-in in place (UIF §2).
  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          Sign in to view and manage your health information.
        </p>
        <PhoneAuth startExpanded onVerified={(u) => queryClient.setQueryData(["account", "auth-user"], u)} />
      </div>
    );
  }

  if (consentQuery.isPending || prefsQuery.isPending) {
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  if (consentQuery.isError) {
    if (consentQuery.error instanceof ApiError && consentQuery.error.status === 401) {
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-muted">Your session expired. Sign in again to view your health information.</p>
          <PhoneAuth
            startExpanded
            onVerified={(u) => {
              queryClient.setQueryData(["account", "auth-user"], u);
              void consentQuery.refetch();
            }}
          />
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold text-[var(--danger)]">
          {consentQuery.error instanceof ApiError ? consentQuery.error.message : "Couldn't load your consent status."}
        </p>
        <button
          type="button"
          onClick={() => void consentQuery.refetch()}
          className="mt-4 rounded-full border border-line px-5 py-2 text-xs font-semibold text-gold-text transition-colors hover:border-line-strong"
        >
          Try again
        </button>
      </div>
    );
  }

  const consent = consentQuery.data ?? null;
  const granted = hasHealthConsent(consent);
  const prefs = prefsQuery.data ?? null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-relaxed text-ink-muted">
        This clinical data is used exclusively for metabolic optimisation and nutritional
        bio-individualisation. Under DPDP Act 2023, you can remove any of it at any time.
      </p>
      <p className="text-2xs leading-relaxed text-ink-faint">
        Tanmatra personalises food recommendations and is not a medical service. This is not medical advice — consult a clinician for diagnosis or treatment.
      </p>

      {!granted ? (
        <>
          <div className="relative overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--gold)_35%,transparent)] bg-[color-mix(in_srgb,var(--gold)_7%,transparent)] p-6">
            <span className="tabular absolute top-4 right-4 rounded bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] px-2 py-1 text-3xs uppercase tracking-widest text-gold-text">
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
              onClick={() => grantMutation.mutate()}
              disabled={grantMutation.isPending}
              aria-busy={grantMutation.isPending}
              aria-live="polite"
              shape="pill" size="fluid" className="w-full py-4 text-xs font-bold uppercase tracking-wider disabled:opacity-60"
            >
              {grantMutation.isPending ? "Recording…" : "I agree — save my health details"}
              {!grantMutation.isPending && <ArrowRight aria-hidden className="h-4 w-4" />}
            </Button>
            {grantMutation.isError && (
              <p role="alert" className="mt-3 text-xs font-medium text-[var(--danger)]">
                {grantMutation.error instanceof ApiError ? grantMutation.error.message : "Couldn't record your consent. Please try again."}
              </p>
            )}
          </div>

          {/* Locked preview: the real fields, disabled, so the scope of what is
              being consented to is visible before agreeing. */}
          {prefs && (
            <div aria-hidden className="pointer-events-none select-none opacity-40">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-ink">Clinical metrics</h3>
                <Lock className="h-4 w-4 text-ink-faint" />
              </div>
              <ClinicalForm prefs={prefs} disabled onSaved={updatePrefsCache} />
            </div>
          )}
        </>
      ) : prefs ? (
        <ClinicalForm prefs={prefs} disabled={false} onSaved={updatePrefsCache} />
      ) : (
        <p className="text-sm text-ink-muted">Couldn&rsquo;t load your health profile.</p>
      )}

      <div className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] p-5">
        <p className="text-sm font-semibold text-ink">Right to Erasure (Section 12)</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Under the DPDP Act 2023, you have the right to request erasure of your entire account and all associated personal, health, and dietary history.
        </p>
        <button type="button" onClick={erase} disabled={eraseBusy} className="mt-3 rounded-xl border border-[var(--danger)] px-5 py-2.5 text-sm font-semibold text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] disabled:opacity-60">
          Permanently delete account &amp; data
        </button>
        {eraseError && <p role="alert" className="mt-2 text-xs font-medium text-[var(--danger)]">{eraseError}</p>}
      </div>
    </div>
  );
}
