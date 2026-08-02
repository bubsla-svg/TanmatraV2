import { Router } from "express";
import { z } from "zod/v4";
import { db, adminRolesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireRole } from "../lib/adminGate";
import { recordAdminAction } from "../lib/adminAudit";

const router = Router();

const CANONICAL_ROLES = [
  "owner",
  "finance",
  "catalog",
  "kitchen",
  "support",
  "growth",
  "compliance",
  "readonly",
] as const;

type CanonicalRole = typeof CANONICAL_ROLES[number];

const isValidRole = (role: string): role is CanonicalRole => {
  return CANONICAL_ROLES.includes(role as CanonicalRole);
};

// GET /admin/roles?userId=<id>
router.get("/admin/roles", async (req, res) => {
  const operator = await requireRole(req, res, "owner");
  if (!operator) return;

  const querySchema = z.object({
    userId: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
  });

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { userId, limit, offset } = parsed.data;

  const query = db.select().from(adminRolesTable);
  
  if (userId) {
    query.where(eq(adminRolesTable.userId, userId));
  }

  const roles = await query.limit(limit).offset(offset);

  res.json({ roles });
});

// POST /admin/roles
router.post("/admin/roles", async (req, res) => {
  const operator = await requireRole(req, res, "owner");
  if (!operator) return;

  const bodySchema = z.object({
    userId: z.string(),
    role: z.string(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const { userId, role } = parsed.data;

  if (!isValidRole(role)) {
    res.status(422).json({ error: "invalid_role" });
    return;
  }

  // Validate userId exists
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  try {
    let message = "Role granted";

    await db.transaction(async (tx) => {
      // If operatorId is synthetic (e.g. "admin-token" or "admin:username"),
      // set assignedBy to null to avoid FK constraint violation.
      // Assuming real user IDs are UUIDs (standard in this repo).
      // A more robust check might be to try/catch or check user existence,
      // but skipping for synthetic prefixes is simplest and matches usage.
      const isRealUser = operator.operatorId && 
        !operator.operatorId.startsWith("admin-") && 
        !operator.operatorId.startsWith("admin:");

      const inserted = await tx
        .insert(adminRolesTable)
        .values({
          userId,
          role,
          assignedBy: isRealUser ? operator.operatorId : null,
        })
        .onConflictDoNothing({ target: [adminRolesTable.userId, adminRolesTable.role] })
        .returning();

      if (inserted.length === 0) {
        message = "Role already granted";
        return;
      }

      await recordAdminAction(
        {
          operatorId: operator.operatorId!,
          action: "admin.role_grant",
          resourceType: "admin_role",
          resourceId: userId,
          afterState: { role },
        },
        tx
      );
    });

    res.status(200).json({ message });
  } catch (err) {
    req.log?.error({ err }, "Failed to grant role");
    res.status(500).json({ error: "Failed to grant role" });
  }
});

// DELETE /admin/roles/:userId/:role
router.delete("/admin/roles/:userId/:role", async (req, res) => {
  const operator = await requireRole(req, res, "owner");
  if (!operator) return;

  const { userId, role } = req.params;

  if (!isValidRole(role)) {
    res.status(422).json({ error: "invalid_role" });
    return;
  }

  // We can drop the pre-existence check and rely on DELETE ... RETURNING
  // to detect if anything was deleted, ensuring atomicity and single audit.

  try {
    let deleted = false;

    await db.transaction(async (tx) => {
      const deletedRows = await tx
        .delete(adminRolesTable)
        .where(
          and(
            eq(adminRolesTable.userId, userId),
            eq(adminRolesTable.role, role)
          )
        )
        .returning();

      if (deletedRows.length === 0) {
        return; // Will result in 404 outside
      }

      deleted = true;

      await recordAdminAction(
        {
          operatorId: operator.operatorId!,
          action: "admin.role_revoke",
          resourceType: "admin_role",
          resourceId: userId,
          beforeState: { role },
        },
        tx
      );
    });

    if (!deleted) {
      res.status(404).json({ error: "grant_not_found" });
      return;
    }

    res.status(200).json({ message: "Role revoked" });
  } catch (err) {
    req.log?.error({ err }, "Failed to revoke role");
    res.status(500).json({ error: "Failed to revoke role" });
  }
});

export default router;
