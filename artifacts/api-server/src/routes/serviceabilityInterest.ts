/**
 * Notify-me lead capture endpoint (OB-3 / II.3).
 * Captures user phone + unserviceable pincode when delivery is out of current Noida sectors.
 * Enforces our strict table projection {pincode, phone, createdAt}, returning 201 on initial
 * capture and idempotent 200 on duplicate (pincode + phone).
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod/v4";
import { db, serviceabilityInterestTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const interestSchema = z.object({
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "pincode must be exactly 6 digits"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91|0)?[1-9]\d{9}$/, "must be a valid Indian mobile number"),
});

router.post("/serviceability-interest", async (req: Request, res: Response) => {
  const parsed = interestSchema.safeParse(req.body ?? {});
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
    const existing = await db
      .select()
      .from(serviceabilityInterestTable)
      .where(
        and(
          eq(serviceabilityInterestTable.pincode, d.pincode),
          eq(serviceabilityInterestTable.phone, d.phone),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    await db.insert(serviceabilityInterestTable).values({
      pincode: d.pincode,
      phone: d.phone,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    req.log?.error?.({ err, pincode: d.pincode }, "serviceability interest capture failed");
    res.status(500).json({ error: "interest capture failed" });
  }
});

export default router;
