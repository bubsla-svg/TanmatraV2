import * as SecureStore from 'expo-secure-store';

/**
 * Device pairing-token store.
 *
 * Previously these were stubs that always returned null, so the session was
 * lost on every reload — the app forgot the paired device the moment it was
 * backgrounded or restarted. We now persist the token in the platform secure
 * enclave (iOS Keychain / Android Keystore) via expo-secure-store, with a
 * synchronous in-memory cache so the auth-token getter in `_layout.tsx` has a
 * zero-await fast path after the first load.
 */

const TOKEN_KEY = 'tanmatra.pairing_token';

// SecureStore keys must match [A-Za-z0-9._-].
const KEY_PATTERN = /^[\w.-]+$/;

let cachedToken: string | null = null;
let hydrated = false;

/**
 * Synchronous accessor for the cached token. Returns null until `loadToken`
 * has run at least once (or after a save). Used as the fast path by the
 * api-client auth-token getter.
 */
export function getTokenSync(): string | null {
  return cachedToken;
}

/**
 * Read the persisted token into the in-memory cache and return it. Safe to
 * call repeatedly; after the first hydration it resolves from cache. On web
 * (or if the secure store is unavailable) it degrades to null rather than
 * throwing, so app boot never fails on a storage error.
 */
export async function loadToken(): Promise<string | null> {
  if (hydrated) return cachedToken;
  try {
    if (KEY_PATTERN.test(TOKEN_KEY)) {
      cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    }
  } catch {
    cachedToken = null;
  } finally {
    hydrated = true;
  }
  return cachedToken;
}

/**
 * Persist a pairing token and update the in-memory cache. Passing an empty
 * string clears the token instead of writing an unusable value.
 */
export async function saveToken(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) {
    await clearToken();
    return;
  }
  cachedToken = trimmed;
  hydrated = true;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, trimmed);
  } catch {
    // Keep the in-memory token for this session even if secure persistence
    // fails; the user simply re-pairs on next cold start.
  }
}

/**
 * Remove the persisted token and clear the cache (sign-out).
 *
 * The in-memory cache is nulled ONLY after the secure store confirms deletion.
 * If we cleared the cache first and the native delete then failed, the token
 * would still sit in the Keychain/Keystore and silently resurrect the session
 * on the next cold start (loadToken re-reads it) — a sign-out that doesn't sign
 * out. So a failed delete is retried once and then surfaced to the caller
 * instead of being swallowed, and the cache is left intact so app state stays
 * consistent with what is actually persisted.
 */
export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      throw new Error(
        'Could not clear the saved session from secure storage. Please try signing out again.',
      );
    }
  }
  cachedToken = null;
  hydrated = true;
}
