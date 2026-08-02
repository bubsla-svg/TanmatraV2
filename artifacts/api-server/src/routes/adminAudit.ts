import { Router } from "express";
import { z } from "zod/v4";
import { db, auditLogTable } from "@workspace/db";
import { desc, eq, and, sql } from "drizzle-orm";
import { requireOps } from "../lib/adminGate";

const router = Router();

router.get("/admin/audit", async (req, res) => {
  const ops = requireOps(req, res);
  if (!ops) return;

  const querySchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
    resourceType: z.string().optional(),
    resourceId: z.string().optional(),
    actorId: z.string().optional(),
    action: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  });

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { limit, offset, resourceType, resourceId, actorId, action, startDate, endDate } = parsed.data;

  const filters = [];
  if (resourceType) filters.push(eq(auditLogTable.resourceType, resourceType));
  if (resourceId) filters.push(eq(auditLogTable.resourceId, resourceId));
  if (actorId) filters.push(eq(auditLogTable.actorId, actorId));
  if (action) filters.push(eq(auditLogTable.action, action));
  if (startDate) filters.push(sql`${auditLogTable.createdAt} >= ${new Date(startDate).toISOString()}`);
  if (endDate) filters.push(sql`${auditLogTable.createdAt} <= ${new Date(endDate).toISOString()}`);

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogTable)
    .where(whereClause);

  const logs = await db
    .select()
    .from(auditLogTable)
    .where(whereClause)
    .orderBy(desc(auditLogTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ logs, total: Number(count) });
});

export default router;
