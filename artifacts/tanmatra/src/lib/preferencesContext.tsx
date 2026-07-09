import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  preferencesApi,
  type PreferencesPatch,
  type UserPreferences,
} from "./preferencesApi";

interface PreferencesContextValue {
  preferences: UserPreferences | null;
  loading: boolean;
  unauthorized: boolean;
  needsQuiz: boolean;
  refresh: () => Promise<void>;
  update: (patch: PreferencesPatch) => Promise<UserPreferences | null>;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const out = await preferencesApi.get();
      // Guest → account migration: a visitor who completed the quiz before
      // signing in has their profile only in localStorage. Without this
      // push, logging in silently reset personalization to the account's
      // (empty) server profile — the "quiz twice" bug. Server data wins
      // where it already exists; the guest profile only fills the gaps.
      let serverPrefs = out.preferences;
      try {
        const raw = localStorage.getItem("tanmatra:guest-preferences");
        if (raw) {
          const guest = JSON.parse(raw) as Record<string, unknown>;
          const serverHasProfile = Boolean(serverPrefs?.quizCompletedAt);
          if (!serverHasProfile && guest && Object.keys(guest).length > 0) {
            const patch: Record<string, unknown> = {};
            for (const k of [
              "goal",
              "dietaryStyle",
              "allergens",
              "dislikedIngredients",
              "cuisines",
              "spiceLevel",
              "calorieTarget",
              "proteinTargetGrams",
              "medicalConditions",
            ]) {
              if (guest[k] !== undefined && guest[k] !== null) patch[k] = guest[k];
            }
            if (guest["quizCompletedAt"]) patch["markQuizComplete"] = true;
            if (Object.keys(patch).length > 0) {
              const migrated = await preferencesApi.update(patch as PreferencesPatch);
              serverPrefs = migrated.preferences;
            }
          }
          // Either migrated or the account already had a profile — the
          // guest copy has served its purpose.
          localStorage.removeItem("tanmatra:guest-preferences");
        }
      } catch {
        // Migration is best-effort; never block sign-in on it.
      }
      setPreferences(serverPrefs);
      setUnauthorized(false);
    } catch (e) {
      if (String(e).includes("401")) {
        setUnauthorized(true);
        try {
          const raw = localStorage.getItem("tanmatra:guest-preferences");
          if (raw) {
            setPreferences(JSON.parse(raw));
          } else {
            setPreferences(null);
          }
        } catch {
          setPreferences(null);
        }
      } else {
        setPreferences(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = useCallback(async (patch: PreferencesPatch) => {
    try {
      const out = await preferencesApi.update(patch);
      setPreferences(out.preferences);
      setUnauthorized(false);
      return out.preferences;
    } catch (e) {
      if (String(e).includes("401")) {
        setUnauthorized(true);
        try {
          const raw = localStorage.getItem("tanmatra:guest-preferences") ?? "{}";
          const current = JSON.parse(raw);
          const nextPrefs = {
            ...current,
            ...patch,
            updatedAt: new Date().toISOString(),
            quizCompletedAt: patch.markQuizComplete ? new Date().toISOString() : (current.quizCompletedAt || null),
          };
          localStorage.setItem("tanmatra:guest-preferences", JSON.stringify(nextPrefs));
          setPreferences(nextPrefs as UserPreferences);
          return nextPrefs as UserPreferences;
        } catch {
          return null;
        }
      }
      return null;
    }
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      loading,
      unauthorized,
      needsQuiz:
        !loading && (preferences?.quizCompletedAt ?? null) === null,
      refresh,
      update,
    }),
    [preferences, loading, unauthorized, refresh, update],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx)
    throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
