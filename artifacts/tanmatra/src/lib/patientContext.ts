import { useMemo } from "react";
import { usePreferences } from "./preferencesContext";
import { useClinicalMode, type DietOrderId } from "./clinicalDiet";

/**
 * Active clinical ordering context for the signed-in user.
 *
 * Tanmatra has no separate patient roster — this context is the authenticated
 * user's own dietary signals: allergens from the user-preferences API plus the
 * active diet order from the clinical-mode store. It is a *read* surface; the
 * clinician console (Clinical.tsx) is the only writer for the diet order.
 *
 * Consumers (ConflictsPanel, Cart/Checkout/Menu allergen + diet evaluation)
 * read through this single accessor.
 */
export interface ActivePatientContext {
  allergens: string[];
  dietOrderId: DietOrderId;
  /** True iff a real preferences row has been hydrated for the user. */
  hydrated: boolean;
}

export function useActivePatient(): ActivePatientContext {
  const { preferences, loading } = usePreferences();
  const { dietOrderId } = useClinicalMode();

  return useMemo<ActivePatientContext>(
    () => ({
      allergens: preferences?.allergens ?? [],
      dietOrderId,
      hydrated: !loading && preferences !== null,
    }),
    [preferences, loading, dietOrderId],
  );
}
