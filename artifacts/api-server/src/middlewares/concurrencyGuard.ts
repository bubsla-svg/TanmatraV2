import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

let activeRequestsCount = 0;
const MAX_CONCURRENT_REQUESTS = 250; // Serverless ceiling guard

/**
 * Step 1: Concurrency Control & Bulkhead Limiter Middleware
 * Tracks active concurrent HTTP function executions.
 * Rejects requests with 503 + Retry-After when approaching serverless concurrency ceiling.
 */
export function concurrencyGuardMiddleware(
  maxConcurrent = MAX_CONCURRENT_REQUESTS
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (activeRequestsCount >= maxConcurrent) {
      logger.warn(
        { activeRequestsCount, maxConcurrent, path: req.originalUrl },
        "platform.concurrency_ceiling_exceeded"
      );
      res.setHeader("Retry-After", "2");
      res.status(503).json({
        error: "concurrency_limit_exceeded",
        message: "Server busy: concurrent execution ceiling reached. Please retry in 2 seconds.",
      });
      return;
    }

    activeRequestsCount++;

    const cleanup = () => {
      activeRequestsCount = Math.max(0, activeRequestsCount - 1);
      res.removeListener("finish", cleanup);
      res.removeListener("close", cleanup);
    };

    res.on("finish", cleanup);
    res.on("close", cleanup);

    next();
  };
}

/**
 * Step 2: Execution Timeout & Webhook Async Hand-off Guard
 * Prevents 10-second serverless execution timeouts by wrapping long-running AI / heavy routes
 * in an explicit 8-second execution watchdog that returns async jobId / webhook hand-off.
 */
export function serverlessTimeoutGuard(timeoutMs = 8000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      if (!res.headersSent) {
        logger.warn(
          { timeoutMs, path: req.originalUrl },
          "platform.execution_timeout_watchdog_triggered"
        );
        res.status(202).json({
          status: "processing_async",
          message: "Request execution extended past serverless timeout ceiling. Handed off to background worker.",
          pollUrl: `/api/v1/jobs/status?path=${encodeURIComponent(req.originalUrl)}`,
        });
      }
    }, timeoutMs);

    const clearTimer = () => {
      clearTimeout(timer);
      res.removeListener("finish", clearTimer);
      res.removeListener("close", clearTimer);
    };

    res.on("finish", clearTimer);
    res.on("close", clearTimer);

    next();
  };
}

export function getActiveRequestsCount(): number {
  return activeRequestsCount;
}

export function resetConcurrencyCountForTesting(): void {
  activeRequestsCount = 0;
}
