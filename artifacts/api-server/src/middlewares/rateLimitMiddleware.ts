import type { Request, Response, NextFunction } from "express";
import { rateLimit } from "../lib/rateLimit";

function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

export interface RateLimitOptions {
  /** Derives the bucket key suffix. Defaults to the client IP. Use this to
   *  bucket per authenticated caller so shared egress IPs (corporate NAT,
   *  carrier gateways) do not put unrelated customers in one bucket. */
  key?: (req: Request) => string;
  /** Machine-readable code returned in the 429 body, so a client can tell
   *  WHICH budget it exhausted and react appropriately. Defaults to the
   *  generic `rate_limited`. */
  code?: string;
}

/**
 * Express middleware factory that applies the Postgres-backed rate limiter.
 *
 * A refused request is rejected BEFORE the handler runs, so a 429 can never
 * have partially mutated anything — no draft write, no generation claim, no
 * partial lineup.
 *
 * @param scope   Logical action name embedded in the key (e.g. "public:menu")
 * @param max     Maximum allowed requests within the window
 * @param windowMs  Window duration in milliseconds
 * @param opts    Optional key derivation and typed error code
 */
export function rateLimitMiddleware(
  scope: string,
  /** A fixed ceiling, or a getter resolved per request. The getter form lets a
   *  limit stay configurable at runtime instead of freezing whatever the
   *  environment happened to hold at import time. */
  max: number | (() => number),
  windowMs: number,
  opts: RateLimitOptions = {},
) {
  const deriveKey = opts.key ?? ((req: Request) => `ip:${clientIp(req)}`);
  const code = opts.code ?? "rate_limited";
  const resolveMax = typeof max === "function" ? max : () => max;
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = `${scope}:${deriveKey(req)}`;
      const allowed = await rateLimit(key, windowMs, resolveMax());
      if (!allowed) {
        // Retry-After is in seconds, per RFC 9110. The window length is the
        // honest upper bound on how long the caller must wait.
        res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
        res.status(429).json({
          error: "rate_limited",
          code,
          retryAfterSeconds: Math.ceil(windowMs / 1000),
        });
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

/**
 * Bucket key for the plan-draft family: the authenticated customer when there
 * is one, else the guest draft cookie (an opaque server-issued 32-byte token —
 * the same credential that authorizes access to the draft), else the IP.
 *
 * Draft-specific operations additionally fold in the draft id from the path, so
 * a customer working on two plans in two tabs does not throttle themselves by
 * sharing one bucket across both.
 */
export function planDraftRateLimitKey(req: Request): string {
  const authed = req.isAuthenticated?.() ? req.user?.id : undefined;
  const identity = authed
    ? `user:${authed}`
    : typeof req.cookies?.["plan_draft_id"] === "string"
      ? `guest:${req.cookies["plan_draft_id"]}`
      : `ip:${clientIp(req)}`;
  const draftId = req.params?.["id"];
  return typeof draftId === "string" && draftId.length > 0
    ? `${identity}:draft:${draftId}`
    : identity;
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

// ── Pre-purchase plan drafts (A2.2H) ─────────────────────────────────────────
//
// A single flat bucket over every /plan-drafts route was wrong in both
// directions: too tight for cheap, click-heavy editing (a customer walking a
// lineup slot by slot issues far more requests than someone placing an order),
// and far too loose for the two genuinely expensive endpoints. `generate` and
// `shuffle` each fetch the merged catalog and rewrite the draft's entire
// lineup; `POST /plan-drafts` needs no auth at all and writes a row per call.
// Those deserve their own budgets, not a share of the editing budget.
//
// Keying: per CALLER identity, not per IP alone. `planDraftRateLimitKey`
// prefers the authenticated user, then the guest draft cookie (an opaque
// 32-byte server-issued token — the same credential that authorizes the draft),
// and only falls back to IP for an unidentified caller. IP alone would put
// every customer behind one corporate NAT or mobile carrier gateway into a
// shared bucket.
//
// Limits are env-overridable rather than baked in, so an operator can retune
// them from observed traffic without a deploy.

function envLimit(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Defaults, in requests per minute. Each is env-overridable at RUNTIME (the
 *  getters below re-read on every request), so an operator can retune from
 *  observed traffic without a deploy. */
export const PLAN_DRAFT_LIMIT_DEFAULTS = {
  /** Row-creating and unauthenticated. Tightest of the family. */
  create: 10,
  /** Preference PATCHes and per-slot lineup edits. Deliberately generous —
   *  this is ordinary typing and tapping. */
  mutate: 120,
  /** Catalog fetch + full lineup build. */
  generate: 10,
  /** Same cost as generate; separated so a shuffle-spamming UI bug cannot
   *  exhaust the budget a customer needs to generate at all. */
  shuffle: 20,
  /** Read-only candidate/option lookups. */
  read: 120,
} as const;

export const PLAN_DRAFT_LIMITS = {
  create: () => envLimit("PLAN_DRAFT_CREATE_PER_MIN", PLAN_DRAFT_LIMIT_DEFAULTS.create),
  mutate: () => envLimit("PLAN_DRAFT_MUTATE_PER_MIN", PLAN_DRAFT_LIMIT_DEFAULTS.mutate),
  generate: () => envLimit("PLAN_GENERATION_PER_MIN", PLAN_DRAFT_LIMIT_DEFAULTS.generate),
  shuffle: () => envLimit("PLAN_SHUFFLE_PER_MIN", PLAN_DRAFT_LIMIT_DEFAULTS.shuffle),
  read: () => envLimit("PLAN_DRAFT_READ_PER_MIN", PLAN_DRAFT_LIMIT_DEFAULTS.read),
} as const;

export const planDraftCreateRateLimit = rateLimitMiddleware(
  "plan:draft:create",
  PLAN_DRAFT_LIMITS.create,
  60_000,
  { key: planDraftRateLimitKey, code: "PLAN_DRAFT_CREATION_RATE_LIMITED" },
);

export const planDraftMutateRateLimit = rateLimitMiddleware(
  "plan:draft:mutate",
  PLAN_DRAFT_LIMITS.mutate,
  60_000,
  { key: planDraftRateLimitKey, code: "PLAN_DRAFT_MUTATION_RATE_LIMITED" },
);

export const planGenerationRateLimit = rateLimitMiddleware(
  "plan:draft:generate",
  PLAN_DRAFT_LIMITS.generate,
  60_000,
  { key: planDraftRateLimitKey, code: "PLAN_GENERATION_RATE_LIMITED" },
);

export const planShuffleRateLimit = rateLimitMiddleware(
  "plan:draft:shuffle",
  PLAN_DRAFT_LIMITS.shuffle,
  60_000,
  { key: planDraftRateLimitKey, code: "PLAN_SHUFFLE_RATE_LIMITED" },
);

export const planDraftReadRateLimit = rateLimitMiddleware(
  "plan:draft:read",
  PLAN_DRAFT_LIMITS.read,
  60_000,
  { key: planDraftRateLimitKey, code: "PLAN_DRAFT_READ_RATE_LIMITED" },
);

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

/**
 * Guest-order claim (POST /orders/:externalOrderId/claim).
 *
 * Its own bucket, and a tight one, because this is the one customer endpoint
 * where an order id taken from a URL can move ownership of a paid order. The
 * phone match is what authorises the transfer; this is the second wall — it
 * makes walking a list of ids expensive even for a signed-in caller, and it is
 * keyed per SESSION rather than per IP so an attacker cannot buy more attempts
 * by changing networks. Signed-out callers are rejected before any query runs,
 * so the IP fallback only ever covers those.
 */
export const orderClaimRateLimit = rateLimitMiddleware("orders:claim", 10, 60_000, {
  key: (req: Request) => (req.isAuthenticated?.() ? `user:${req.user.id}` : `ip:${clientIp(req)}`),
  code: "ORDER_CLAIM_RATE_LIMITED",
});

/**
 * Client error beacons (POST /api/v1/error-reports).
 *
 * Unauthenticated by necessity — a beacon fires from a page that has just
 * crashed, often with no session — so the IP bucket is the only handle there
 * is. Generous enough that a genuinely broken deploy still reports (a customer
 * hitting one bad route repeatedly is the case this exists to capture), tight
 * enough that a loop cannot turn one client into an unbounded log bill.
 */
export const errorReportRateLimit = rateLimitMiddleware("client:error-report", 30, 60_000, {
  code: "ERROR_REPORT_RATE_LIMITED",
});

/** Admin moderation actions — prevents enumeration via compromised token. */
export const adminModerationRateLimit = rateLimitMiddleware("admin:moderation", 60, 60_000);

/** User address mutations — prevents address enumeration/abuse. */
export const addressRateLimit = rateLimitMiddleware("user:addresses", 30, 60_000);

/** Public corporate lead form — matches the rd-partners application limit. */
export const corporateInquiryRateLimit = rateLimitMiddleware("corporate:inquiry", 5, 24 * 60 * 60_000);
