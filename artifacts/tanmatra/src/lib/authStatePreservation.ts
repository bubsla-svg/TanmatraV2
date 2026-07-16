/**
 * Auth State Preservation & Silent Token Refresh System
 * 
 * Step 1: Silent Token Refresh (Background interval trigger every 45 mins).
 * Step 2: Graceful Refresh Failure & State Preservation (Saves path, cart, and form drafts prior to re-auth).
 */

const PRESERVED_AUTH_STATE_KEY = "tanmatra_preserved_user_state";

export interface PreservedUserState {
  path: string;
  cartItems?: Array<{ dishId: number; qty: number }>;
  formData?: Record<string, unknown>;
  savedAt: number;
}

/**
 * Step 2: Preserves active user state before redirecting to login.
 */
export function saveAuthStateBeforeRedirect(
  path: string,
  cartItems?: Array<{ dishId: number; qty: number }>,
  formData?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;

  const state: PreservedUserState = {
    path,
    cartItems,
    formData,
    savedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(PRESERVED_AUTH_STATE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to store preserved auth state", err);
  }
}

/**
 * Step 2: Restores preserved state after successful re-authentication.
 */
export function restoreSavedAuthState(): PreservedUserState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(PRESERVED_AUTH_STATE_KEY);
    if (!raw) return null;

    sessionStorage.removeItem(PRESERVED_AUTH_STATE_KEY);
    const parsed = JSON.parse(raw) as PreservedUserState;

    // Reject stale states older than 2 hours
    if (Date.now() - parsed.savedAt > 2 * 60 * 60 * 1000) {
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn("Failed to restore preserved auth state", err);
    return null;
  }
}

/**
 * Step 1: Silent Token Refresh scheduler.
 * Runs in the background every 45 minutes to refresh access tokens invisibly
 * before the 60-minute expiration ceiling is reached.
 */
export function scheduleSilentTokenRefresh(
  onRefreshSuccess?: (user: unknown) => void,
  onRefreshFail?: (preserveState: boolean) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes

  const triggerRefresh = async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        onRefreshSuccess?.(data.user);
      } else {
        const errData = await res.json().catch(() => ({}));
        onRefreshFail?.(errData.preserveState === true);
      }
    } catch (err) {
      console.warn("Silent token refresh network attempt deferred", err);
    }
  };

  const timer = setInterval(triggerRefresh, REFRESH_INTERVAL_MS);

  return () => clearInterval(timer);
}
