import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

export interface CspViolationPayload {
  "csp-report"?: {
    "document-uri"?: string;
    referrer?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "original-policy"?: string;
    disposition?: "enforce" | "report";
    "blocked-uri"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "source-file"?: string;
    "status-code"?: number;
    "script-sample"?: string;
  };
}

export const cspViolationLogs: CspViolationPayload["csp-report"][] = [];

/**
 * POST /api/v1/csp-report
 * Ingests CSP violation reports sent by browsers in report-only or enforcement mode.
 * Consistently returns HTTP 204 No Content so browser beaconing never disrupts user traffic.
 */
router.post(
  ["/v1/csp-report", "/csp-report"],
  (req: Request, res: Response) => {
    let raw = req.body;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        /* malformed json body — silent graceful degrade */
      }
    }

    const report = (raw as CspViolationPayload)?.["csp-report"] ?? raw;

    if (report && typeof report === "object") {
      const blockedUri = report["blocked-uri"] ?? "unknown";
      const directive = report["effective-directive"] ?? report["violated-directive"] ?? "unknown";

      cspViolationLogs.push(report);

      logger.warn(
        {
          blockedUri,
          directive,
          documentUri: report["document-uri"],
          disposition: report.disposition ?? "report",
        },
        "csp_violation_reported"
      );
    }

    res.status(204).end();
  }
);

/**
 * GET /api/v1/csp-report/audit
 * Audit endpoint to inspect recorded CSP violations during report-only phase.
 */
router.get("/v1/csp-report/audit", (_req: Request, res: Response) => {
  res.json({
    totalViolations: cspViolationLogs.length,
    violations: cspViolationLogs,
  });
});

export default router;
