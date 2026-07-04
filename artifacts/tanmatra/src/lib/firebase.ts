import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase only if the apiKey is present (in dev it might not be)
let auth: any = null;
if (firebaseConfig.apiKey) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

export { auth };

/**
 * Map Firebase phone-auth errors to copy a customer can act on.
 * Falls back to the raw message so real failures are never silently masked.
 */
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
