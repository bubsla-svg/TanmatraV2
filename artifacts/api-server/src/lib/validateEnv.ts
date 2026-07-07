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

  for (const w of warnings) logger.warn({ env: true }, w);

  if (missingRequired.length > 0) {
    logger.fatal({ missing: missingRequired }, "Required environment variables missing. Exiting.");
    process.exit(1);
  }

  logger.info(
    { petpooja: petpoojaConfigured ? "configured" : "off", warnings: warnings.length },
    "environment validated",
  );
}
