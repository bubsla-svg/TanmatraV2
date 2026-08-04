import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import {
  askDataQuestion,
  listRecentQueries,
  markQuerySaved,
  runEditedSql,
  chartSpecSchema,
} from "../lib/nlAnalytics";
import {
  generateWbr,
  getWbrReport,
  lastFullWeek,
  listWbrReports,
  calculateWeeklyMargins,
} from "../lib/wbr";
import { extractWeeklyVoc, listVocThemes } from "../lib/voc";
import { publishWbr } from "../lib/wbrPublisher";
import { SAFE_SCHEMA, UnsafeSqlError } from "../lib/safeSql";
import { requireRole } from "../lib/adminGate";
import { sendError as sendJsonError } from "../lib/sendError";
import { and, gte, inArray, sql } from "drizzle-orm";
import { db, funnelDailyTable } from "@workspace/db";
import {
  allFunnelEventNames,
  computeAllFunnels,
  type EventTotals,
} from "../lib/funnelDefs";

const router: IRouter = Router();

async function requireCatalog(req: Request, res: Response): Promise<boolean> {
  return (await requireRole(req, res, ["growth", "owner"])) !== null;
}

function userId(req: Request): string | null {
  return req.isAuthenticated() ? req.user.id ?? null : null;
}

function sendError(req: Request, res: Response, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof UnsafeSqlError) {
    // UnsafeSqlError messages are caller-friendly validation explanations.
    sendJsonError(req, res, err, { status: 400, expose: msg, event: "analytics.unsafe_sql" });
    return;
  }
  const lower = msg.toLowerCase();
  let code = 500;
  if (lower.includes("not found")) code = 404;
  else if (lower.includes("required") || lower.includes("invalid")) code = 400;
  else if (lower.includes("statement timeout")) code = 504;
  // Only echo the message for caller-fixable 4xx / known 504 cases. 500s
  // get a generic message so we don't leak driver / SQL details.
  const exposed = code === 500 ? undefined : msg;
  sendJsonError(req, res, err, { status: code, expose: exposed, event: "analytics.request_failed" });
}

// ---- Schema introspection (safe) --------------------------------------------

router.get("/analytics/schema", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  res.json({ tables: SAFE_SCHEMA });
});

// ---- NL → SQL ---------------------------------------------------------------

const askSchema = z.object({ question: z.string().min(2).max(2000) });

router.post("/analytics/ask", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  try {
    const out = await askDataQuestion(parsed.data.question, userId(req));
    res.json(out);
  } catch (err) {
    sendError(req, res, err);
  }
});

const sqlSchema = z.object({
  sql: z.string().min(6).max(10_000),
  question: z.string().max(2000).optional(),
  chartSpec: chartSpecSchema.optional(),
});

router.post("/analytics/sql", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  const parsed = sqlSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  try {
    const out = await runEditedSql(
      parsed.data.sql,
      parsed.data.question ?? null,
      parsed.data.chartSpec ?? null,
      userId(req),
    );
    res.json(out);
  } catch (err) {
    sendError(req, res, err);
  }
});

router.get("/analytics/queries", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  try {
    const rows = await listRecentQueries(50);
    res.json({ queries: rows });
  } catch (err) {
    sendError(req, res, err);
  }
});

router.post("/analytics/queries/:id/save", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  const id = Number(req.params["id"]);
  const saved = req.body?.saved !== false;
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    const row = await markQuerySaved(id, saved);
    if (!row) {
      res.status(404).json({ error: "query not found" });
      return;
    }
    res.json({ query: row });
  } catch (err) {
    sendError(req, res, err);
  }
});

// ---- WBR --------------------------------------------------------------------

router.get("/analytics/wbr", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  try {
    const reports = await listWbrReports(12);
    res.json({ reports });
  } catch (err) {
    sendError(req, res, err);
  }
});

router.get("/analytics/wbr/latest", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  try {
    const [latest] = await listWbrReports(1);
    res.json({ report: latest ?? null });
  } catch (err) {
    sendError(req, res, err);
  }
});

router.get("/analytics/wbr/:id", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    const report = await getWbrReport(id);
    if (!report) {
      res.status(404).json({ error: "report not found" });
      return;
    }
    res.json({ report });
  } catch (err) {
    sendError(req, res, err);
  }
});

router.post("/analytics/wbr/generate", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  try {
    let week;
    if (req.body?.weekStart) {
      const ws = new Date(req.body.weekStart);
      const we = new Date(req.body.weekEnd ?? Date.now());
      if (Number.isNaN(ws.getTime()) || Number.isNaN(we.getTime())) {
        res.status(400).json({ error: "invalid weekStart/weekEnd" });
        return;
      }
      if (we.getTime() <= ws.getTime()) {
        res.status(400).json({ error: "weekEnd must be after weekStart" });
        return;
      }
      week = { weekStart: ws, weekEnd: we };
    } else {
      week = lastFullWeek();
    }
    const report = await generateWbr(week);
    res.json({ report });
  } catch (err) {
    sendError(req, res, err);
  }
});

router.post("/analytics/wbr/:id/publish", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    const report = await getWbrReport(id);
    if (!report) {
      res.status(404).json({ error: "report not found" });
      return;
    }
    const result = await publishWbr(report);
    res.json({ result });
  } catch (err) {
    sendError(req, res, err);
  }
});

router.post("/analytics/wbr/simulate", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  const fuelIncreasePct = Number(req.body?.fuelIncreasePct ?? 0);
  const fuelFactor = 1.0 + (fuelIncreasePct / 100);
  try {
    const { weekStart, weekEnd } = lastFullWeek();
    const sim = await calculateWeeklyMargins(weekStart, weekEnd, fuelFactor);
    res.json({
      ok: true,
      fuelFactor,
      netMarginPct: sim.marginPct,
      thresholdAlert: sim.marginPct < 35.0,
      // The alert above is a comparison against a number that may be part
      // assumption. Ship the coverage with it so "no alert" can be read as
      // "we measured and we're fine" rather than "we didn't measure".
      foodCostCoveragePct: sim.foodCostCoveragePct,
      unmatchedItemNames: sim.unmatchedItemNames,
    });
  } catch (err) {
    sendError(req, res, err);
  }
});

// ---- Funnels (playbook Part 8 §8.3, A2) -------------------------------------

const MAX_FUNNEL_WINDOW_DAYS = 90;

/**
 * GET /analytics/funnels?days=N — the 5 named funnels (F1 discovery,
 * F2 checkout, F3 subscribe, F4 profiling, F5 trial→sub) computed from the
 * funnel_daily rollup over a trailing N-day window (default 7). Read-only:
 * freshness is bounded by the nightly funnelRollupScheduler tick.
 */
router.get("/analytics/funnels", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  const rawDays = Number(req.query["days"] ?? 7);
  if (!Number.isFinite(rawDays)) {
    res.status(400).json({ error: "invalid days" });
    return;
  }
  const days = Math.min(MAX_FUNNEL_WINDOW_DAYS, Math.max(1, Math.floor(rawDays)));
  // funnel_daily.day is a UTC date — window start is (days - 1) days before
  // today's UTC date so days=1 means "today only".
  const sinceDate = new Date();
  sinceDate.setUTCDate(sinceDate.getUTCDate() - (days - 1));
  const since = sinceDate.toISOString().slice(0, 10);
  try {
    const rows = await db
      .select({
        name: funnelDailyTable.name,
        events: sql<number>`sum(${funnelDailyTable.eventCount})::int`,
        sessions: sql<number>`sum(${funnelDailyTable.distinctSessions})::int`,
        users: sql<number>`sum(${funnelDailyTable.distinctUsers})::int`,
      })
      .from(funnelDailyTable)
      .where(
        and(
          gte(funnelDailyTable.day, since),
          inArray(funnelDailyTable.name, allFunnelEventNames()),
        ),
      )
      .groupBy(funnelDailyTable.name);
    const totalsByEvent = new Map<string, EventTotals>(
      rows.map((r) => [
        r.name,
        {
          events: Number(r.events ?? 0),
          sessions: Number(r.sessions ?? 0),
          users: Number(r.users ?? 0),
        },
      ]),
    );
    res.json({ days, since, funnels: computeAllFunnels(totalsByEvent) });
  } catch (err) {
    sendError(req, res, err);
  }
});

// ---- VoC --------------------------------------------------------------------

router.get("/analytics/voc/themes", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  try {
    const themes = await listVocThemes(4);
    res.json({ themes });
  } catch (err) {
    sendError(req, res, err);
  }
});

router.post("/analytics/voc/extract", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  try {
    const themes = await extractWeeklyVoc();
    res.json({ themes });
  } catch (err) {
    sendError(req, res, err);
  }
});

export default router;
