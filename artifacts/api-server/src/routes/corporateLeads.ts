import { Router, type IRouter, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  corporateLeadsTable,
  funnelEventsTable,
  type CorporateLeadStatus,
} from "@workspace/db";
import { rateLimitMiddleware } from "../middlewares/rateLimitMiddleware";
import { requireRole } from "../lib/adminGate";

/**
 * Corporate / partnership lead capture (playbook Part 3.3 — "the fix" for
 * the WhatsApp lead leak). The gym, fitness-club, and corporate-wellness
 * landing forms POST here so leads land in our own pipeline
 * (corporate_leads → AdminSalesConsole) instead of a wa.me handoff.
 */

const router: IRouter = Router();

async function requireCatalog(req: Request, res: Response): Promise<boolean> {
  return (await requireRole(req, res, "growth")) !== null;
}

// Conservative public-form limit: a real HR/gym owner submits once (maybe
// twice after a typo); anything past 5/hour from one IP is scripted.
// Built from the shared Postgres-backed factory the address/order routes
// use, with a dedicated scope so it never shares a bucket with the older
// /corporate/inquiries form.
const corporateLeadRateLimit = rateLimitMiddleware(
  "corporate:leads",
  5,
  60 * 60_000,
);

export const TEAM_SIZE_BANDS = ["1-20", "21-100", "101-500", "500+"] as const;
const LEAD_STATUSES = ["new", "contacted", "qualified", "closed"] as const;

const leadSchema = z.object({
  kind: z.enum(["corporate", "gym", "fitness_club"]),
  name: z.string().trim().min(2).max(80),
  workEmail: z.email().max(254),
  company: z.string().trim().min(2).max(120),
  teamSizeBand: z.enum(TEAM_SIZE_BANDS),
  parkOrSector: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  message: z.string().trim().max(1000).optional(),
  source: z.string().trim().max(160).optional(),
});

function orNull(value: string | undefined): string | null {
  return value ? value : null;
}

// ---------- public: lead capture ----------

router.post(
  "/corporate-leads",
  corporateLeadRateLimit,
  async (req: Request, res: Response) => {
    const parsed = leadSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: "invalid payload",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    const d = parsed.data;
    try {
      await db.insert(corporateLeadsTable).values({
        kind: d.kind,
        name: d.name,
        workEmail: d.workEmail.toLowerCase(),
        company: d.company,
        teamSizeBand: d.teamSizeBand,
        parkOrSector: orNull(d.parkOrSector),
        phone: orNull(d.phone),
        message: orNull(d.message),
        source: orNull(d.source),
      });
    } catch (err) {
      req.log.error({ err, kind: d.kind }, "corporate lead insert failed");
      res.status(500).json({ error: "lead capture failed" });
      return;
    }
    // Funnel breadcrumb for the acquisition dashboards. Best-effort only —
    // analytics must never fail a captured lead, so any error is swallowed
    // into a warn log.
    try {
      const userId = req.isAuthenticated?.()
        ? ((req.user as { id?: string } | undefined)?.id ?? null)
        : null;
      await db.insert(funnelEventsTable).values({
        name: "corporate_lead_submitted",
        props: {
          kind: d.kind,
          team_size_band: d.teamSizeBand,
          source: d.source ?? null,
        },
        userId,
      });
    } catch (err) {
      req.log.warn({ err }, "corporate lead funnel event insert failed");
    }
    res.status(201).json({ ok: true });
  },
);

// ---------- admin: lead pipeline (AdminSalesConsole) ----------

router.get("/corporate-leads", async (req: Request, res: Response) => {
  if (!(await requireCatalog(req, res))) return;
  const rawStatus = req.query["status"];
  let status: CorporateLeadStatus | undefined;
  if (rawStatus !== undefined && rawStatus !== "") {
    const parsed = z.enum(LEAD_STATUSES).safeParse(rawStatus);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid status" });
      return;
    }
    status = parsed.data;
  }
  try {
    const leads = await db
      .select()
      .from(corporateLeadsTable)
      .where(status ? eq(corporateLeadsTable.status, status) : undefined)
      .orderBy(desc(corporateLeadsTable.createdAt))
      .limit(100);
    res.json({ leads });
  } catch (err) {
    req.log.error({ err }, "corporate lead list failed");
    res.status(500).json({ error: "lead list failed" });
  }
});

export default router;
