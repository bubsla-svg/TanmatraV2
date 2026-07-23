import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Client Firebase init for phone-auth (SF-03). Config comes from the public
 * NEXT_PUBLIC_FIREBASE_* build args (same values the legacy VITE_FIREBASE_*
 * build uses — Firebase web config is public by design; the security boundary
 * is the server, which verifies the resulting idToken). Reads env at call time,
 * never module scope, so importing this file is SSR-safe.
 */
function readConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function firebaseConfigured(): boolean {
  const config = readConfig();
  return Boolean(config.apiKey && config.projectId && config.appId);
}

let cachedAuth: Auth | null = null;

/** The client Auth instance. Throws if the build shipped no Firebase config —
 *  callers gate on firebaseConfigured() / LIVE_CHECKOUT_ENABLED first. */
export function getFirebaseAuth(): Auth {
  if (!firebaseConfigured()) throw new Error("firebase_not_configured");
  if (cachedAuth) return cachedAuth;
  const app: FirebaseApp = getApps()[0] ?? initializeApp(readConfig());
  cachedAuth = getAuth(app);
  return cachedAuth;
}

/** Map Firebase phone-auth errors to copy a customer can act on; falls back to
 *  the raw message so real failures are never silently masked. */
export function friendlyFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/configuration-not-found":
    case "auth/operation-not-allowed":
      return "Phone sign-in isn't enabled on the verification service yet. Please contact support.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorised for sign-in yet. Please contact support.";
    case "auth/invalid-phone-number":
      return "That phone number doesn't look valid. Please check and try again.";
    case "auth/too-many-requests":
      return "Too many attempts from this device. Please wait a few minutes and try again.";
    case "auth/quota-exceeded":
      return "SMS limit reached for now. Please try again in a little while.";
    case "auth/captcha-check-failed":
    case "auth/missing-recaptcha-token":
      return "Security check failed. Please refresh the page and try again.";
    case "auth/network-request-failed":
      return "Network issue while contacting the verification service. Check your connection and retry.";
    case "auth/invalid-verification-code":
      return "That code is incorrect. Please re-check the SMS and try again.";
    case "auth/code-expired":
      return "That code has expired. Tap Resend to get a new one.";
    default: {
      const message = (err as Error)?.message;
      return message
        ? message.replace(/^Firebase:\s*/i, "").replace(/\s*\(auth\/[\w-]+\)\.?$/, "")
        : "Something went wrong. Please try again.";
    }
  }
}
