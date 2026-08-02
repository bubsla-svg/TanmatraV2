import { Router, type Request, type Response } from "express";
import { db, complianceLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireRole } from "../lib/adminGate";
import { seedComplianceLogsIfEmpty } from "../lib/complianceSeeder";
import { sendError } from "../lib/sendError";

const router = Router();

// 1. Fetch compliance logs (restricted to operational/admin staff)
router.get("/compliance/logs", async (req: Request, res: Response) => {
  if (!(await requireRole(req, res, "compliance"))) return;
  try {
    // Same idempotent lazy-seed idiom as contentRecipes.ts::ensureRecipeSeeds():
    // a no-op once the table has rows, so this never overwrites operator data.
    await seedComplianceLogsIfEmpty();
    const logs = await db
      .select()
      .from(complianceLogsTable)
      .orderBy(desc(complianceLogsTable.logDate))
      .limit(30);
    res.json({ ok: true, logs });
  } catch (err) {
    sendError(req, res, err, { event: "compliance.logs_fetch_failed" });
  }
});

// 2. Reject tampering attempts (enforcing immutability)
router.post("/compliance/logs", async (req: Request, res: Response) => {
  res.status(403).json({
    error: "Forbidden",
    message: "ISO 22000 compliance logs are immutable. Manual insertion is blocked to prevent data tampering.",
  });
});

router.put("/compliance/logs/:id", async (req: Request, res: Response) => {
  res.status(403).json({
    error: "Forbidden",
    message: "ISO 22000 compliance logs are immutable. Manual editing of historical data is prohibited by safety regulations.",
  });
});

router.patch("/compliance/logs/:id", (req: Request, res: Response) => {
  res.status(403).json({
    error: "Forbidden",
    message: "ISO 22000 compliance logs are immutable. Manual editing of historical data is prohibited by safety regulations.",
  });
});

router.delete("/compliance/logs/:id", async (req: Request, res: Response) => {
  res.status(403).json({
    error: "Forbidden",
    message: "ISO 22000 compliance logs are immutable. Historical safety logs cannot be deleted.",
  });
});

export default router;
