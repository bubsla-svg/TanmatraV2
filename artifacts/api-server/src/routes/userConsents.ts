import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuthUser } from "../middlewares/requireAuth";
import { desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, userConsentsTable, type ConsentStatus } from "@workspace/db";
import { invalidateUserBrief } from "../lib/userBrief";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const consentSchema = z.object({
  purposeClinicalDelivery: z.boolean().optional(),
  purposeMarketing: z.boolean().optional(),
  purposeAiPersonalization: z.boolean().optional(),
  purposeHealthDataProcessing: z.boolean().optional(),
  consentVersion: z.string().trim().min(1).max(64).optional(),
  status: z.enum(["granted", "revoked", "expired"]).optional(),
});

function serializeConsent(row: typeof userConsentsTable.$inferSelect) {
  return {
    id: String(row.id),
    userId: row.userId,
    purposeClinicalDelivery: row.purposeClinicalDelivery,
    purposeMarketing: row.purposeMarketing,
    purposeAiPersonalization: row.purposeAiPersonalization,
    purposeHealthDataProcessing: row.purposeHealthDataProcessing,
    consentVersion: row.consentVersion,
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    status: row.status,
    grantedAt: row.grantedAt ? row.grantedAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}

async function getConsentHandler(req: Request, res: Response) {
  const userId = (req as Request & { user?: { id?: string } }).user?.id;
  if (!userId) {
    res.json({ consent: null, userConsent: null, consents: [] });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(userConsentsTable)
      .where(eq(userConsentsTable.userId, userId))
      .orderBy(desc(userConsentsTable.grantedAt))
      .limit(1);
    if (!row) {
      res.json({ consent: null, userConsent: null, consents: [] });
      return;
    }
    const serialized = serializeConsent(row);
    res.json({ consent: serialized, userConsent: serialized, consents: [serialized] });
  } catch (err) {
    logger.error({ err, userId }, "failed to fetch user consent");
    res.status(500).json({ error: "failed to fetch user consent" });
  }
}

async function upsertConsentHandler(req: Request, res: Response) {
  const userId = requireAuthUser(req, res);
  if (!userId) return;
  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const patch = parsed.data;
  const ipAddress = req.ip ?? null;
  const userAgent = (typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 512) : null);

  try {
    const [existing] = await db
      .select()
      .from(userConsentsTable)
      .where(eq(userConsentsTable.userId, userId))
      .orderBy(desc(userConsentsTable.grantedAt))
      .limit(1);

    let row;
    const now = new Date();
    const isRevoked =
      patch.status === "revoked" ||
      (patch.purposeClinicalDelivery === false &&
        patch.purposeAiPersonalization === false &&
        patch.purposeMarketing === false &&
        patch.purposeHealthDataProcessing === false);

    if (existing) {
      [row] = await db
        .update(userConsentsTable)
        .set({
          purposeClinicalDelivery: patch.purposeClinicalDelivery ?? existing.purposeClinicalDelivery,
          purposeMarketing: patch.purposeMarketing ?? existing.purposeMarketing,
          purposeAiPersonalization: patch.purposeAiPersonalization ?? existing.purposeAiPersonalization,
          purposeHealthDataProcessing: patch.purposeHealthDataProcessing ?? existing.purposeHealthDataProcessing,
          consentVersion: patch.consentVersion ?? existing.consentVersion,
          status: (patch.status as ConsentStatus) ?? (isRevoked ? "revoked" : existing.status),
          ipAddress: ipAddress || existing.ipAddress,
          userAgent: userAgent || existing.userAgent,
          grantedAt: now,
          revokedAt: isRevoked ? now : (patch.status === "granted" ? null : existing.revokedAt),
        })
        .where(eq(userConsentsTable.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(userConsentsTable)
        .values({
          userId,
          purposeClinicalDelivery: patch.purposeClinicalDelivery ?? true,
          purposeMarketing: patch.purposeMarketing ?? false,
          purposeAiPersonalization: patch.purposeAiPersonalization ?? false,
          purposeHealthDataProcessing: patch.purposeHealthDataProcessing ?? false,
          consentVersion: patch.consentVersion ?? "2023_DPDPA_v1",
          status: (patch.status as ConsentStatus) ?? (isRevoked ? "revoked" : "granted"),
          ipAddress,
          userAgent,
          grantedAt: now,
          revokedAt: isRevoked ? now : null,
        })
        .returning();
    }

    invalidateUserBrief(userId);
    const serialized = serializeConsent(row!);
    res.json({ consent: serialized, userConsent: serialized, consents: [serialized] });
  } catch (err) {
    logger.error({ err, userId }, "failed to upsert user consent");
    res.status(500).json({ error: "failed to save user consent" });
  }
}

router.get("/user-consents", getConsentHandler);
router.get("/consents", getConsentHandler);

router.post("/user-consents", upsertConsentHandler);
router.put("/user-consents", upsertConsentHandler);
router.patch("/user-consents", upsertConsentHandler);

router.post("/consents", upsertConsentHandler);
router.put("/consents", upsertConsentHandler);
router.patch("/consents", upsertConsentHandler);

export default router;
