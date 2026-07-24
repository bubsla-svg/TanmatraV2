"use client";
// Client: session-gated food-preferences editor. GET /preferences returns 200
// { preferences: null } even when signed out, so the gate keys off getAuthUser
// (like AccountHub) — not the prefs read; only PATCH 401s on a lapsed session.
import { useCallback, useEffect, useState } from "react";
import { getAuthUser, type AuthUser } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import { getPreferences, savePreferences, type PreferencesPatch, type UserPreferences } from "@/lib/preferencesApi";
import { PhoneAuth } from "@/components/checkout/PhoneAuth";
import { PreferencesForm } from "./PreferencesForm";

export function PreferencesHub() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    let u: AuthUser | null;
    try {
      ({ user: u } = await getAuthUser());
    } catch {
      setUser(null);
      return;
    }
    setUser(u);
    if (!u) return;
    try {
      const { preferences } = await getPreferences();
      setPrefs(preferences);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        return;
      }
      // A non-auth read failure shouldn't strand the page — fall through to
      // the form with defaults; the save path surfaces its own errors.
      setError(e instanceof ApiError ? e.message : "Couldn't load your saved preferences.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: PreferencesPatch) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const { preferences } = await savePreferences(patch);
      setPrefs(preferences);
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        return;
      }
      setError(e instanceof ApiError ? e.message : "Couldn't save your preferences.");
    } finally {
      setBusy(false);
    }
  }

  if (user === undefined) {
    return <p className="text-sm text-ink-muted">Loading your preferences…</p>;
  }
  if (user === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">Sign in to set your food preferences.</p>
        <PhoneAuth onVerified={() => void load()} />
      </div>
    );
  }
  if (!loaded) {
    return <p className="text-sm text-ink-muted">Loading your preferences…</p>;
  }

  return (
    <PreferencesForm
      key={prefs?.updatedAt ?? "new"}
      initial={prefs}
      busy={busy}
      error={error}
      saved={saved}
      onSubmit={save}
    />
  );
}
