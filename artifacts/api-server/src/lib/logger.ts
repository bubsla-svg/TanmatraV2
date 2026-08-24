import pino from "pino";
import { censorPii } from "./piiMask";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Customer contact fields, masked wherever they appear in a log record.
 *
 * This is a BACKSTOP, not the fix: every call site is expected to mask its own
 * value (see `piiMask.ts`). It exists because the call sites drifted once
 * already — `sms.ts` masked at info level and passed the raw number at error
 * level by documented policy, while `whatsapp.ts` logged it raw at both — and
 * nothing failed when they did. A new logger.info({ e164 }) added next month
 * lands masked whether or not its author remembers.
 *
 * Both depths are listed because these fields appear top-level in a merge
 * object (`logger.info({ e164 }, "...")`) and one level down in a nested
 * payload; pino matches redaction paths literally, so `*.e164` alone would
 * miss the common case.
 */
const PII_PATHS = [
  "e164",
  "*.e164",
  "phone",
  "*.phone",
  "phoneE164",
  "*.phoneE164",
  "email",
  "*.email",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      ...PII_PATHS,
    ],
    // Masking rather than "[Redacted]" keeps a correlatable trace, and keeps
    // the already-masked call sites readable instead of blanking them.
    censor: censorPii,
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
