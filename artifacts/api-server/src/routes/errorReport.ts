import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { requireOps } from "../lib/adminGate";
import { MAX_RETAINED_REPORTS, normalizeReport, retain } from "../lib/errorReportIntake";
import { errorReportRateLimit } from "../middlewares/rateLimitMiddleware";

const router: IRouter = Router();

export interface ErrorReportRecord {
  id: string;
  errorName: string;
  errorMessage: string;
  stackTrace?: string;
  url: string;
  timestamp: string;
  sessionReplayTrace: unknown[];
  isRageClickAlert: boolean;
  /** True when a field was cut to fit — so a truncated stack is never read as
   *  the whole story by whoever is debugging from it. */
  truncated: boolean;
}

/**
 * A BOUNDED debugging window, not the sink.
 *
 * The durable record is the `logger.error` line below, which on Cloud Run
 * lands in Cloud Logging. This array only backs the ops audit view. It used to
 * grow without limit on an endpoint that cannot require a session, so a loop
 * posting large stacks grew the heap until the process was OOM-killed — and
 * this process also serves checkout.
 */
export const storedErrorReports: ErrorReportRecord[] = [];

/**
 * POST /api/v1/error-reports
 *
 * Ingests client errors alongside their session-replay traces. Deliberately
 * unauthenticated (a beacon fires from a page that has just crashed), which is
 * exactly why every field is clamped and the retained set is a fixed window —
 * see lib/errorReportIntake.ts.
 */
router.post(
  ["/v1/error-reports", "/error-reports"],
  errorReportRateLimit,
  (req: Request, res: Response) => {
    const normalized = normalizeReport(req.body ?? {});

    const record: ErrorReportRecord = {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...normalized,
    };

    retain(storedErrorReports, record, MAX_RETAINED_REPORTS);

    if (record.isRageClickAlert) {
      logger.warn(
        { record, alert: "RAGE_CLICK_UX_FAILURE_DETECTED" },
        "session_replay.rage_click_flagged"
      );
    } else {
      logger.error(
        { record, alert: "SESSION_REPLAY_LINKED_ERROR" },
        "session_replay.error_linked"
      );
    }

    res.status(201).json({
      ok: true,
      reportId: record.id,
      attachedEventsCount: record.sessionReplayTrace.length,
      isRageClickAlert: record.isRageClickAlert,
    });
  }
);

/**
 * GET /api/v1/error-reports/audit
 * Audit inspection endpoint for debugging linked session replays and rage clicks.
 * Ops-gated: reports carry full page URLs, JS stack traces, and session-replay
 * interaction traces from ALL users — never public. (Ingestion above stays
 * open: error beacons cannot authenticate.)
 */
router.get("/v1/error-reports/audit", async (req: Request, res: Response) => {
  if (!(await requireOps(req, res))) return;
  res.json({
    // `retained` is not `totalReports`: the window holds the most recent
    // MAX_RETAINED_REPORTS and nothing more, so calling it a total would read
    // as "we have had 200 errors" when it means "here are the last 200".
    retained: storedErrorReports.length,
    windowSize: MAX_RETAINED_REPORTS,
    reports: storedErrorReports,
  });
});

export default router;
