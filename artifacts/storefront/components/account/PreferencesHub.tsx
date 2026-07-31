"use client";
// Client: session-gated food-preferences editor. GET /preferences returns 200
// { preferences: null } even when signed out, so the gate keys off getAuthUser
// (like AccountHub) — not the prefs read; only PATCH 401s on a lapsed session.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthUser } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { getPreferences, savePreferences, type PreferencesPatch, type UserPreferences } from "@/lib/preferencesApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { PreferencesForm } from "./PreferencesForm";

export function PreferencesHub() {
  const queryClient = useQueryClient();

  const authQuery = useQuery({
    queryKey: ["account", "auth-user"],
    queryFn: () => getAuthUser().then((r) => r.user),
  });
  const signedIn = authQuery.isSuccess && authQuery.data !== null;

  const prefsQuery = useQuery({
    queryKey: ["account", "preferences"],
    queryFn: () => getPreferences().then((r) => r.preferences),
    enabled: signedIn,
  });

  const saveMutation = useMutation({
    mutationFn: (patch: PreferencesPatch) => savePreferences(patch),
    onSuccess: ({ preferences }) => {
      queryClient.setQueryData<UserPreferences | null>(["account", "preferences"], preferences);
    },
    onError: (e) => {
      // A lapsed session drops straight to the sign-in island (hard rule),
      // never a generic form error.
      if (e instanceof ApiError && e.status === 401) {
        queryClient.setQueryData(["account", "auth-user"], null);
      }
    },
  });

  if (authQuery.isPending) {
    return <p className="text-sm text-ink-muted">Loading your preferences…</p>;
  }

  // Finding #14-pattern: 401 → PhoneAuth; any other failure gets its own
  // error+retry state instead of collapsing into "signed out".
  if (authQuery.isError) {
    if (authQuery.error instanceof ApiError && authQuery.error.status === 401) {
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-muted">Sign in to set your food preferences.</p>
          <PhoneAuth onVerified={() => void authQuery.refetch()} />
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold text-[var(--danger)]">
          {authQuery.error instanceof ApiError ? authQuery.error.message : "Couldn't load your preferences."}
        </p>
        <button
          type="button"
          onClick={() => void authQuery.refetch()}
          className="mt-4 rounded-full border border-line px-5 py-2 text-xs font-semibold text-gold-text transition-colors hover:border-line-strong"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to set your food preferences.</p>
        <PhoneAuth onVerified={() => void authQuery.refetch()} />
      </div>
    );
  }

  if (prefsQuery.isPending) {
    return <p className="text-sm text-ink-muted">Loading your preferences…</p>;
  }

  // A lapsed session between the auth check and the prefs read.
  if (prefsQuery.isError && prefsQuery.error instanceof ApiError && prefsQuery.error.status === 401) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to set your food preferences.</p>
        <PhoneAuth
          onVerified={() => {
            void authQuery.refetch();
            void prefsQuery.refetch();
          }}
        />
      </div>
    );
  }

  // A non-auth read failure shouldn't strand the page — fall through to the
  // form with defaults; the save path surfaces its own errors.
  const prefsLoadError = prefsQuery.isError
    ? prefsQuery.error instanceof ApiError
      ? prefsQuery.error.message
      : "Couldn't load your saved preferences."
    : null;
  const saveError = saveMutation.isError
    ? saveMutation.error instanceof ApiError
      ? saveMutation.error.message
      : "Couldn't save your preferences."
    : null;

  return (
    <PreferencesForm
      key={prefsQuery.data?.updatedAt ?? "new"}
      initial={prefsQuery.data ?? null}
      busy={saveMutation.isPending}
      error={prefsLoadError ?? saveError}
      saved={saveMutation.isSuccess}
      onSubmit={(patch) => saveMutation.mutate(patch)}
    />
  );
}
