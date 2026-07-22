import * as SecureStore from "expo-secure-store";

/**
 * Persisted "has the user finished onboarding?" flag. Mirrors lib/auth.ts:
 * SecureStore-backed with an in-memory cache, degrading to a safe default if
 * storage is unavailable rather than throwing on boot.
 */

const ONBOARDING_KEY = "tanmatra.onboarding_complete";

let cached: boolean | null = null;

export function isOnboardingCompleteSync(): boolean {
  return cached === true;
}

export async function loadOnboardingComplete(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    cached = (await SecureStore.getItemAsync(ONBOARDING_KEY)) === "1";
  } catch {
    cached = false;
  }
  return cached;
}

export async function setOnboardingComplete(done: boolean): Promise<void> {
  cached = done;
  try {
    if (done) await SecureStore.setItemAsync(ONBOARDING_KEY, "1");
    else await SecureStore.deleteItemAsync(ONBOARDING_KEY);
  } catch {
    // Keep the in-memory value for this session even if persistence fails.
  }
}
