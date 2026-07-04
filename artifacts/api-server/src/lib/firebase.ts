import { initializeApp, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { logger } from "./logger";

let app: App | null = null;

export function getFirebaseAdmin(): App {
  if (app) return app;

  try {
    app = initializeApp();
    logger.info("Firebase Admin initialized successfully.");
  } catch (err) {
    logger.error({ err }, "Failed to initialize Firebase Admin. Ensure Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS are set.");
    throw err;
  }
  return app;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<string> {
  const adminApp = getFirebaseAdmin();
  const auth = getAuth(adminApp);
  const decodedToken = await auth.verifyIdToken(idToken);
  if (!decodedToken.phone_number) {
    throw new Error("Token does not contain a phone number.");
  }
  return decodedToken.phone_number;
}
