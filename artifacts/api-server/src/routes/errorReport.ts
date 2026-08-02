import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { requireOps } from "../lib/adminGate";

const router: IRouter = Router();

export interface ErrorReportRecord {
  id: string;
  errorName: string;
  errorMessage: string;
  stackTrace?: string;
  url: string;
  timestamp: string;
  sessionReplayTrace: any[];
  isRageClickAlert: boolean;
}

export const storedErrorReports: ErrorReportRecord[] = [];

/**
 * POST /api/v1/error-reports
 * Ingests client errors attached side-by-side with full session replay event traces.
 */
router.post(
  ["/v1/error-reports", "/error-reports"],
  (req: Request, res: Response) => {
    const { errorName, errorMessage, stackTrace, url, timestamp, sessionReplayTrace } = req.body ?? {};

    const trace = Array.isArray(sessionReplayTrace) ? sessionReplayTrace : [];
    const isRageClickAlert = trace.some((e: any) => e?.type === "rage_click");

    const record: ErrorReportRecord = {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      errorName: errorName ?? "UnknownClientError",
      errorMessage: errorMessage ?? "No error message provided",
      stackTrace,
      url: url ?? "unknown",
      timestamp: timestamp ?? new Date().toISOString(),
      sessionReplayTrace: trace,
      isRageClickAlert,
    };

    storedErrorReports.push(record);

    if (isRageClickAlert) {
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
      attachedEventsCount: trace.length,
      isRageClickAlert,
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
    totalReports: storedErrorReports.length,
    reports: storedErrorReports,
  });
});

export default router;
