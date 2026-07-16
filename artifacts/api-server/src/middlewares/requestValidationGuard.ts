import type { Request, Response, NextFunction } from "express";
import { z, type ZodSchema } from "zod/v4";
import { logger } from "../lib/logger";

/**
 * Step 1: Input Validation Guard Middleware
 * Validates request body, query, and params against explicit Zod schemas.
 * Rejects wrong types/missing fields with 400 Bad Request and strips unexpected fields.
 */
export function validateRequest(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body && req.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query && req.query) {
        schemas.query.parse(req.query);
      }
      if (schemas.params && req.params) {
        schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: "validation_failed",
          message: "Input validation error: schema mismatch or missing fields",
          issues: err.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        });
        return;
      }
      res.status(400).json({ error: "malformed_request" });
    }
  };
}

/**
 * Step 2: XSS Sanitization & HTML Scrubber Middleware
 * Recursively strips dangerous script tags (<script>, <iframe>, javascript:, onerror=)
 * from all string inputs in req.body, req.query, and req.params.
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/javascript\s*:/gi, "no_javascript:")
      .replace(/on\w+\s*=/gi, "no_evt=");
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      cleaned[k] = sanitizeValue(v);
    }
    return cleaned;
  }
  return value;
}

export function sanitizeInputMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query && typeof req.query === "object") {
    for (const k of Object.keys(req.query)) {
      (req.query as Record<string, unknown>)[k] = sanitizeValue((req.query as Record<string, unknown>)[k]);
    }
  }
  if (req.params && typeof req.params === "object") {
    for (const k of Object.keys(req.params)) {
      (req.params as Record<string, unknown>)[k] = sanitizeValue((req.params as Record<string, unknown>)[k]);
    }
  }
  next();
}

/**
 * Step 3: Rate Awareness & Probe Detection Middleware
 * Enforces per-IP per-endpoint burst detection (max 25 requests/sec).
 * Blocks scrapers and automated probes before business logic or DB calls are invoked.
 */
const requestRateMap = new Map<string, { count: number; windowStart: number }>();

export function routeBurstGuard(maxPerSecond = 25) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const key = `${ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();

    const record = requestRateMap.get(key) ?? { count: 0, windowStart: now };

    if (now - record.windowStart > 1000) {
      // Reset window every 1 second
      record.count = 1;
      record.windowStart = now;
    } else {
      record.count++;
    }

    requestRateMap.set(key, record);

    if (record.count > maxPerSecond) {
      logger.warn({ ip, endpoint: req.originalUrl, count: record.count }, "rate_awareness_burst_blocked");
      res.status(429).json({
        error: "burst_rate_limit_exceeded",
        message: "Too many requests per second. Automated probing detected.",
      });
      return;
    }

    next();
  };
}

export function clearRateAwarenessForTesting(): void {
  requestRateMap.clear();
}
