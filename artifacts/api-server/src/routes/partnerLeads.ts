import { Router, type IRouter, type Request, type Response } from "express";
import { desc, eq, inArray, and } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  corporateLeadsTable,
  funnelEventsTable,
  type CorporateLeadKind,
  type CorporateLeadStatus,
} from "@workspace/db";
import { rateLimitMiddleware } from "../middlewares/rateLimitMiddleware";
import { requireRole } from "../lib/adminGate";

/**
 * Partnership lead capture (gyms, dietitians/RDs, trainers).
 * Mirrors corporateLeads.ts in validation, rate-limiting, and storage in
 * corporate_leads with the appropriate kind ('gym' | 'rd' | 'trainer' | 'dietitian').
 */
const router: IRouter = Router();

async function requireCatalog(req: Request, res: Response): Promise<boolean> {
  return (await requireRole(req, res, "growth")) !== null;
}

const partnerLeadRateLimit = rateLimitMiddleware(
  "partner:leads",
  5,
  60 * 60_000,
);

const PARTNER_KINDS: readonly CorporateLeadKind[] = ["gym", "rd", "trainer", "dietitian", "fitness_club"];
const LEAD_STATUSES = ["new", "contacted", "qualified", "closed"] as const;

const partnerLeadSchema = z.object({
  kind: z.enum(["gym", "rd", "trainer", "dietitian", "fitness_club"]),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).optional(),
  workEmail: z.string().trim().email().max(254).optional(),
  company: z.string().trim().max(120).optional(),
  teamSizeBand: z.string().trim().max(32).optional(),
  parkOrSector: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  rdRegNo: z.string().trim().max(80).optional(),
  practiceSetting: z.string().trim().max(64).optional(),
  message: z.string().trim().max(1000).optional(),
  source: z.string().trim().max(160).optional(),
}).refine((data) => Boolean(data.email || data.workEmail), {
  message: "email or workEmail is required",
  path: ["email"],
}).refine((data) => {
  if (data.kind === "rd" || data.kind === "dietitian") {
    if (!data.rdRegNo || data.rdRegNo.length < 4 || !/^[A-Za-z0-9][A-Za-z0-9\s/.-]{2,30}$/.test(data.rdRegNo)) {
      return false;
    }
  }
  return true;
}, {
  message: "invalid RD registration number format (e.g. RD-1234 or IDA/5678)",
  path: ["rdRegNo"],
});

function orNull(value: string | undefined): string | null {
  return value ? value : null;
}

// ---------- public: partner lead capture ----------

router.post(
  "/partners/leads",
  partnerLeadRateLimit,
  async (req: Request, res: Response) => {
    const parsed = partnerLeadSchema.safeParse(req.body ?? {});
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
    const resolvedEmail = (d.email || d.workEmail)!.toLowerCase();
    const resolvedCompany = d.company || (d.kind === "rd" || d.kind === "dietitian" ? (d.practiceSetting || "Independent RD") : d.name);
    const resolvedTeamSizeBand = d.teamSizeBand || (d.kind === "rd" || d.kind === "dietitian" ? (d.practiceSetting || "N/A") : "1-20");

    try {
      await db.insert(corporateLeadsTable).values({
        kind: d.kind as CorporateLeadKind,
        name: d.name,
        workEmail: resolvedEmail,
        company: resolvedCompany,
        teamSizeBand: resolvedTeamSizeBand,
        parkOrSector: orNull(d.parkOrSector),
        phone: orNull(d.phone),
        message: orNull(d.message),
        source: orNull(d.source),
        rdRegNo: orNull(d.rdRegNo),
        practiceSetting: orNull(d.practiceSetting),
      });
    } catch (err) {
      req.log.error({ err, kind: d.kind }, "partner lead insert failed");
      res.status(500).json({ error: "lead capture failed" });
      return;
    }

    try {
      const userId = req.isAuthenticated?.()
        ? ((req.user as { id?: string } | undefined)?.id ?? null)
        : null;
      await db.insert(funnelEventsTable).values({
        name: "partner_lead_submitted",
        props: {
          kind: d.kind,
          source: d.source ?? null,
          practice_setting: d.practiceSetting ?? null,
          rd_reg_no_present: Boolean(d.rdRegNo),
        },
        userId,
      });
    } catch (err) {
      req.log.warn({ err }, "partner lead funnel event insert failed");
    }

    res.status(201).json({ ok: true });
  },
);

// ---------- admin: partner lead pipeline ----------

router.get("/partners/leads", async (req: Request, res: Response) => {
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
      .where(
        status
          ? and(inArray(corporateLeadsTable.kind, PARTNER_KINDS), eq(corporateLeadsTable.status, status))
          : inArray(corporateLeadsTable.kind, PARTNER_KINDS)
      )
      .orderBy(desc(corporateLeadsTable.createdAt))
      .limit(100);
    res.json({ leads });
  } catch (err) {
    req.log.error({ err }, "partner lead list failed");
    res.status(500).json({ error: "lead list failed" });
  }
});

export default router;
