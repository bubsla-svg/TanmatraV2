import { logger } from "./logger";

/**
 * Validate environment at boot. Fail-fast (exit 1) on anything the app cannot
 * run without; warn loudly on misconfigurations that silently degrade a
 * feature (payments off, CORS closed, POS integration half-wired) so ops sees
 * it in the very first log line instead of debugging a "why is X not working"
 * ticket later. Called before the HTTP server binds.
 */
export function validateEnv(): void {
  const isProd = process.env["NODE_ENV"] === "production";
  const missingRequired: string[] = [];
  const warnings: string[] = [];

  // Hard requirement — no DB, no app.
  if (!process.env["DATABASE_URL"]) missingRequired.push("DATABASE_URL");

  // Hard requirement in production — the KMS master key that encrypts
  // DPDPA-sensitive subscription-member clinical fields (medicalConditions /
  // allergens / dislikedIngredients) at rest. Without it, member create/read
  // throws at request time; we fail fast at boot instead so a misconfigured
  // deploy is caught at the health check rather than as per-request 500s, and
  // clinical data can never silently fall back to plaintext. Any one of the
  // aliases accepted by lib/db's resolveMasterKey satisfies this.
  if (
    isProd &&
    !(
      process.env["CLINICAL_KMS_MASTER_KEY"] ||
      process.env["MASTER_KEY"] ||
      process.env["DPDPA_MASTER_KEY_HEX"] ||
      process.env["CLINICAL_MASTER_KEY_HEX"]
    )
  ) {
    missingRequired.push("CLINICAL_KMS_MASTER_KEY");
  }

  if (isProd) {
    if ((process.env["ADMIN_SESSION_SECRET"] || "").length < 32) {
      warnings.push("ADMIN_SESSION_SECRET is missing or < 32 chars — admin login is insecure/disabled");
    }
    if (!process.env["ALLOWED_ORIGINS"]) {
      warnings.push("ALLOWED_ORIGINS is unset — CORS will reject all browser origins");
    }
    if (!process.env["RAZORPAY_KEY_ID"] || !process.env["RAZORPAY_KEY_SECRET"]) {
      warnings.push("RAZORPAY_KEY_ID/SECRET unset — online payments are disabled");
    }
    if (!process.env["RAZORPAY_WEBHOOK_SECRET"]) {
      warnings.push("RAZORPAY_WEBHOOK_SECRET unset — Razorpay webhooks cannot be verified");
    }
    if (!process.env["GOOGLE_VERTEX_PROJECT"]) {
      warnings.push("GOOGLE_VERTEX_PROJECT unset — AI agents (coach/support/ops/reorder/CMS) run on Vertex AI and will return errors");
    }
    if (!process.env["GOOGLE_API_KEY"]) {
      warnings.push("GOOGLE_API_KEY unset — dish imagery (Gemini image API) and server-side geocoding return errors");
    }
    // Maps geocoding rides on GOOGLE_API_KEY unless GOOGLE_MAPS_API_KEY is
    // set. A Gemini-only rotation of GOOGLE_API_KEY without the Maps var
    // breaks /geo/* and dispatch geocoding (observed live 2026-07-20).
    if (process.env["GOOGLE_API_KEY"] && !process.env["GOOGLE_MAPS_API_KEY"]) {
      warnings.push(
        "GOOGLE_MAPS_API_KEY unset — Maps geocoding (/geo/reverse, /geo/search, dispatch distances) shares GOOGLE_API_KEY; ensure that key has the Geocoding API enabled, or set a dedicated Maps key",
      );
    }

    // Twilio powers OPTIONAL server-sent SMS only: delivery-delay alerts,
    // WhatsApp updates, and a fallback SMS-OTP path. The primary customer OTP
    // is Firebase phone-auth (client-side signInWithPhoneNumber + backend
    // verifyIdToken), which needs no Twilio — so a Firebase-OTP deployment can
    // leave Twilio fully unset without breaking login. Warn only on a *partial*
    // config (a footgun: the SMS features stay inert until the trio completes).
    const twilioKeys = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"];
    const twilioSet = twilioKeys.filter((k) => process.env[k]);
    if (twilioSet.length > 0 && twilioSet.length < twilioKeys.length) {
      warnings.push(
        `Twilio partially configured (${twilioSet.length}/${twilioKeys.length}) — optional SMS features (delivery alerts, WhatsApp, SMS-OTP fallback) stay off until all of ${twilioKeys.join(", ")} are set. Primary OTP is Firebase and needs no Twilio.`,
      );
    }

    if (!process.env["PRIVATE_OBJECT_DIR"]) {
      warnings.push("PRIVATE_OBJECT_DIR unset — menu-asset / dish-image uploads to object storage are disabled");
    }
  }

  // Petpooja: warn if partially configured (a common footgun — the integration
  // stays inert until ALL required vars are present).
  const ppKeys = [
    "PETPOOJA_APP_KEY",
    "PETPOOJA_APP_SECRET",
    "PETPOOJA_ACCESS_TOKEN",
    "PETPOOJA_RESTAURANT_ID",
  ];
  const ppSet = ppKeys.filter((k) => process.env[k]);
  const petpoojaConfigured = ppSet.length === ppKeys.length;
  if (ppSet.length > 0 && !petpoojaConfigured) {
    warnings.push(
      `Petpooja is partially configured (${ppSet.length}/${ppKeys.length}) — integration stays OFF until all of ${ppKeys.join(", ")} are set`,
    );
  }

  // Wearables (Terra/Vital aggregator): warn if partially configured. The
  // integration stays inert until the minimum set (provider + api key + signing
  // secret) is present.
  const wearableProvider = (process.env["WEARABLE_PROVIDER"] || "").trim();
  const wearableApiKey =
    process.env["TERRA_API_KEY"] || process.env["WEARABLE_API_KEY"];
  const wearableSigningSecret =
    process.env["TERRA_SIGNING_SECRET"] || process.env["WEARABLE_SIGNING_SECRET"];
  const wearableParts = [
    ["WEARABLE_PROVIDER", wearableProvider],
    ["TERRA_API_KEY/WEARABLE_API_KEY", wearableApiKey],
    ["TERRA_SIGNING_SECRET/WEARABLE_SIGNING_SECRET", wearableSigningSecret],
  ] as const;
  const wearableSet = wearableParts.filter(([, v]) => v);
  const wearableConfigured = wearableSet.length === wearableParts.length;
  if (wearableSet.length > 0 && !wearableConfigured) {
    warnings.push(
      `Wearables (Terra/Vital) is partially configured (${wearableSet.length}/${wearableParts.length}) — integration stays OFF until all of ${wearableParts
        .map(([k]) => k)
        .join(", ")} are set`,
    );
  }

  for (const w of warnings) logger.warn({ env: true }, w);

  if (missingRequired.length > 0) {
    logger.fatal({ missing: missingRequired }, "Required environment variables missing. Exiting.");
    process.exit(1);
  }

  logger.info(
    {
      petpooja: petpoojaConfigured ? "configured" : "off",
      wearables: wearableConfigured ? "configured" : "off",
      warnings: warnings.length,
    },
    "environment validated",
  );
}
