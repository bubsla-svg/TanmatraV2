import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import overrideRouter from "./routes/manualOverride";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";
import { adminSessionShim } from "./lib/adminSessionShim";
import {
  publicMenuRateLimit,
  orderRateLimit,
  aiRateLimit,
  aiStaffRateLimit,
  rationaleRateLimit,
  paymentRouteRateLimit,
  addressRateLimit,
} from "./middlewares/rateLimitMiddleware";
import { idempotencyMiddleware } from "./middlewares/idempotency";

const app: Express = express();

// Two trusted hops, not one: the browser reaches this service via
// GCLB (the storefront's public-facing edge) THEN the storefront's own
// `/api/:path*` rewrite, which issues a second, separate request into this
// service's own Cloud Run ingress — a distinct hop with its own
// X-Forwarded-For entry, not a transparent pass-through. With `trust proxy: 1`,
// Express only skips ONE hop from the right and reads the SECOND-CLOSEST
// entry as `req.ip` — for a 2-hop chain that resolves to the storefront's own
// (shared, low-cardinality) address, not the end user's. Every real visitor
// collapsed onto that handful of shared addresses, so the per-IP rate
// limiter effectively rate-limited "the storefront" as one bucket instead of
// each visitor individually — a burst from a few customers could 429 every
// other customer sharing that address. `2` walks back both trusted hops to
// the address the customer's own browser actually connected from.
app.set("trust proxy", 2);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// gzip/brotli-compress API responses. Cheap win for the larger JSON payloads
// (menu catalog, order lists). The SPA's static bundles are compressed by the
// SPA server (artifacts/tanmatra/server/static-server.mjs), not here.
app.use(compression());

// The API server only emits JSON, never HTML, so a browser shouldn't ever
// execute a response from us. CSP at the API layer is mostly belt-and-braces.
// Note: the *browsing* document (the SPA's index.html + bundles) is served and
// header-hardened by artifacts/tanmatra/server/static-server.mjs — it does NOT
// ship a <meta http-equiv> CSP, so that server is where the document-context
// CSP/HSTS live. Helmet here still sets HSTS, X-Frame-Options=DENY,
// X-Content-Type-Options, Referrer-Policy, etc. on our JSON responses.
app.use(
  helmet({
    contentSecurityPolicy: {
      // Tight policy suitable for a JSON API: refuse all sub-resource
      // loading from the response. If a future route ever returns HTML
      // (it should not), nothing can be loaded into it.
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Helmet 8 no longer sets Permissions-Policy; add it explicitly to deny powerful
// features the API has no use for.
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  next();
});

const isProduction = process.env["NODE_ENV"] === "production";

const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsAllowList = new Set<string>(allowedOrigins);

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin / curl / server-to-server requests have no Origin
      // header — allow them so health checks and SSR fetches still work.
      if (!origin) return cb(null, true);
      if (corsAllowList.has(origin)) return cb(null, true);
      // Fail-open ONLY in development when the operator hasn't configured
      // an allowlist. In production an empty allowlist is treated as a
      // misconfiguration and we refuse the request rather than wildcard.
      if (!isProduction && corsAllowList.size === 0) return cb(null, true);
      cb(new Error("Origin not allowed"));
    },
    credentials: true,
  }),
);

app.use(cookieParser());

// --- Body parsers -----------------------------------------------------------
//
// Express's body parsers short-circuit once any of them has consumed the
// request body, so the *first* parser whose route matches wins. To keep
// the global default tight (100kb) while still allowing larger payloads
// for image-upload / agent endpoints, we mount the higher-limit parsers
// FIRST against their specific path prefixes, then a 100kb catch-all.
//
// Razorpay webhook requires the raw Buffer body for HMAC verification,
// so we mount express.raw() for that path BEFORE the JSON parsers so
// the JSON parser never consumes it.

import {
  concurrencyGuardMiddleware,
  serverlessTimeoutGuard,
} from "./middlewares/concurrencyGuard";

// Step 3: Enforce 4.5MB Serverless / Platform Request Payload Ceiling
const jsonLarge = express.json({ limit: "4.5mb" });
const jsonAgent = express.json({ limit: "2mb" });
const jsonDefault = express.json({ limit: "100kb" });
const urlEncodedDefault = express.urlencoded({ extended: true, limit: "100kb" });

// Step 1: Bulkhead Concurrency Control Middleware
app.use(concurrencyGuardMiddleware(250));

// Razorpay server-to-server webhook — raw body needed for HMAC.
app.use("/api/payments/razorpay/webhook", express.raw({ type: "application/json" }));

// Web Vitals beacons arrive as text/plain from navigator.sendBeacon.
app.use("/api/vitals", express.text({ type: "text/plain", limit: "4kb" }));

// Image / asset upload endpoints — capped at 4.5MB platform payload ceiling
app.use("/api/menu/uploads", jsonLarge);
app.use("/api/menu-assets", jsonLarge);

// Step 2: AI agent endpoints — guarded by 8s serverless execution timeout watchdog
app.use("/api/cms-agent", serverlessTimeoutGuard(8000), jsonAgent);
app.use("/api/coach-agent", serverlessTimeoutGuard(8000), jsonAgent);
app.use("/api/ops-agent", serverlessTimeoutGuard(8000), jsonAgent);
app.use("/api/support-agent", serverlessTimeoutGuard(8000), jsonAgent);

import {
  sanitizeInputMiddleware,
  routeBurstGuard,
} from "./middlewares/requestValidationGuard";

app.use(jsonDefault);
app.use(urlEncodedDefault);

// Step 2 & Step 3: Global XSS Sanitization Scrubber + Middleware Rate Awareness Guard
app.use("/api", sanitizeInputMiddleware);
// The per-IP/per-endpoint burst guard (30 req/s) blocks automated scrapers and
// probes in production. It is disabled under NODE_ENV=test so the bulkhead
// load-test — which deliberately fires >30 req/s from a single IP against
// /api/delivery/dispatch/* to exercise connection-pool isolation — can reach
// the pool it is meant to test instead of being 429'd at the edge. The guard
// itself is unit-tested directly in requestValidationGuard.test.ts.
if (process.env.NODE_ENV !== "test") {
  app.use("/api", routeBurstGuard(30));
}

// --- Per-category rate limiting -------------------------------------------
// Mounted before authMiddleware so unauthenticated scraping is also limited.
// Each limiter is keyed on client IP so authenticated + anonymous requests
// share the same counter per IP.

app.use("/api/menu", publicMenuRateLimit);
app.use("/api/dish", publicMenuRateLimit);
app.use("/api/orders", orderRateLimit);
app.use("/api/checkout", orderRateLimit);
// Staff (cms/ops) and customer (coach/support) agents get separate buckets —
// office/VPN egress IPs would otherwise exhaust the shared customer quota.
// See aiStaffRateLimit's comment (OA-MED-1.9).
app.use("/api/cms-agent", aiStaffRateLimit);
app.use("/api/ops-agent", aiStaffRateLimit);
app.use("/api/coach-agent", aiRateLimit);
app.use("/api/support-agent", aiRateLimit);
app.use("/api/dish-rationales", rationaleRateLimit);
app.use("/api/payments", paymentRouteRateLimit);
app.use("/api/addresses", addressRateLimit);

// Surface body-parser failures as a clean 413 / 400 instead of a 500.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err && typeof err === "object" && "type" in err) {
    const t = (err as { type?: string }).type;
    if (t === "entity.too.large") {
      res.status(413).json({ error: "payload too large" });
      return;
    }
    if (t === "entity.parse.failed") {
      res.status(400).json({ error: "invalid json" });
      return;
    }
  }
  next(err);
});

app.use(authMiddleware);

// Mirror the new signed-cookie admin session into the legacy
// `req.session.isAdmin` flag so endpoints written before the cookie-
// based admin login (aiRuns, community, challenges, b2bPlanner, …)
// honor admins who logged in through POST /admin/login. See
// lib/adminSessionShim.ts for the full rationale.
app.use(adminSessionShim);

// Task #7 bulkhead: mount the clinical override router BEFORE the
// monolithic /api router so the override request never traverses
// sibling middleware on the aggregate router. Auth + adminSessionShim
// already ran above; the handler still enforces the ops scope.
app.use(overrideRouter);

app.post("/api/orders", idempotencyMiddleware);
app.post("/api/payments/upi/intent", idempotencyMiddleware);
app.post("/api/referral/redeem", idempotencyMiddleware);
app.post("/api/credit-ledger/redeem", idempotencyMiddleware);

app.use("/api", router);

// Catch-all error handler. Must be the LAST middleware so any route
// that calls `next(err)` (or throws inside an async handler that
// Express 5 forwards) lands here. We log the full error server-side
// but only surface a generic shape to the client — never the stack.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status =
    err && typeof err === "object" && "status" in err && typeof (err as { status?: unknown }).status === "number"
      ? ((err as { status: number }).status as number)
      : 500;
  req.log?.error({ err, status }, "unhandled error");
  if (res.headersSent) return;
  res.status(status).json({ error: status >= 500 ? "internal error" : "bad request" });
});

export default app;
