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
  });

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { limit, offset, resourceType, resourceId, actorId } = parsed.data;

  const filters = [];
  if (resourceType) filters.push(eq(auditLogTable.resourceType, resourceType));
  if (resourceId) filters.push(eq(auditLogTable.resourceId, resourceId));
  if (actorId) filters.push(eq(auditLogTable.actorId, actorId));

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const logs = await db
    .select()
    .from(auditLogTable)
    .where(whereClause)
    .orderBy(desc(auditLogTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ logs });
});

export default router;
