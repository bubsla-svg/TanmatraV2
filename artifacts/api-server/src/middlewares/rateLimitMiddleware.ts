import type { Request, Response, NextFunction } from "express";
import { rateLimit } from "../lib/rateLimit";

function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

/**
 * Express middleware factory that applies the Postgres-backed rate limiter.
 *
 * @param scope   Logical action name embedded in the key (e.g. "public:menu")
 * @param max     Maximum allowed requests within the window
 * @param windowMs  Window duration in milliseconds
 */
export function rateLimitMiddleware(scope: string, max: number, windowMs: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = `${scope}:ip:${clientIp(req)}`;
      const allowed = await rateLimit(key, windowMs, max);
      if (!allowed) {
        res.status(429).json({ error: "rate_limited" });
        return;
      }
    } catch (err) {
      // If the rate-limit check itself fails (DB down, etc.), log and allow
      // through — a broken rate limiter should not take down the API.
      req.log?.warn({ err, scope }, "rate limit check failed, allowing request");
    }
    next();
  };
}

// Pre-built limiters for the key endpoint categories.
// 1 min = 60_000 ms

/** Public catalog browsing — generous for real users, still blocks scrapers. */
export const publicMenuRateLimit = rateLimitMiddleware("public:menu", 120, 60_000);

/** Order creation and status — stricter to prevent order-spam. */
export const orderRateLimit = rateLimitMiddleware("orders", 30, 60_000);

/**
 * AI / agent endpoints — GPU-backed, expensive.
 *
 * OA-MED-1.9 (TODO_optimization-auditor.md): staff routes (cms, ops) and
 * customer routes (coach, support) shared ONE `ai:agent` bucket, keyed on
 * client IP. Staff traffic arrives from a small set of office/VPN egress IPs,
 * so a few operators running agent sessions could exhaust the 20/min budget
 * for every customer sharing that apparent IP — and, symmetrically, a
 * customer-side burst could lock staff out of the ops console mid-incident.
 * Separate scope strings give each side its own bucket, so neither can starve
 * the other.
 *
 * Same 20/min limit on both: the split is about isolation, not about changing
 * anyone's budget. Tune the numbers independently now that they're separable.
 */
export const aiRateLimit = rateLimitMiddleware("ai:agent:customer", 20, 60_000);

/** Staff-facing agent endpoints (cms, ops) — own bucket, see above. */
export const aiStaffRateLimit = rateLimitMiddleware("ai:agent:staff", 20, 60_000);

/** Dish rationale AI — called on menu scroll, batched but still limited. */
export const rationaleRateLimit = rateLimitMiddleware("ai:rationale", 40, 60_000);

/** Payment initiation — very tight to block synthetic order fraud. */
export const paymentRateLimit = rateLimitMiddleware("payments", 10, 60_000);

/**
 * Mounted on /api/payments in app.ts. Applies paymentRateLimit to every
 * payment route EXCEPT the Razorpay server-to-server webhook, which is
 * authenticated by HMAC signature (see routes/payments.ts) and arrives from
 * Razorpay's own small source-IP pool — without this exemption every
 * customer's payment confirmation would share one 10-req/min IP bucket
 * meant for throttling browser clients.
 */
export async function paymentRouteRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.path === "/razorpay/webhook") {
    next();
    return;
  }
  await paymentRateLimit(req, res, next);
}

/** Admin moderation actions — prevents enumeration via compromised token. */
export const adminModerationRateLimit = rateLimitMiddleware("admin:moderation", 60, 60_000);

/** User address mutations — prevents address enumeration/abuse. */
export const addressRateLimit = rateLimitMiddleware("user:addresses", 30, 60_000);

/** Public corporate lead form — matches the rd-partners application limit. */
export const corporateInquiryRateLimit = rateLimitMiddleware("corporate:inquiry", 5, 24 * 60 * 60_000);
