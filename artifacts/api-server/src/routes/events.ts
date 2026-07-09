import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { db, funnelEventsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Keys that must never be persisted even if a client sends them —
// belt-and-suspenders on top of the client-side scrubber.
const BLOCKED_PROP_KEYS = new Set([
  "allergens",
  "conditions",
  "medicalConditions",
  "phone",
  "email",
  "address",
  "name",
]);

const eventSchema = z.object({
  name: z.string().regex(/^[a-z0-9_]{2,64}$/),
  props: z.record(z.string(), z.unknown()).optional(),
  sessionId: z.string().max(64).optional(),
  path: z.string().max(256).optional(),
  ts: z.number().int().optional(),
});

/**
 * POST /events — first-party funnel beacon from the SPA's track().
 * sendBeacon posts text/plain; parse it like /vitals does. Always 204:
 * analytics must never surface errors into the customer experience.
 */
router.post("/events", async (req: Request, res: Response) => {
  let raw = req.body;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { /* malformed — ignore */ }
  }
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    res.status(204).end();
    return;
  }
  const { name, props, sessionId, path } = parsed.data;
  const cleanProps: Record<string, unknown> = {};
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (BLOCKED_PROP_KEYS.has(k)) continue;
      if (typeof v === "string" && v.length > 256) continue;
      cleanProps[k] = v;
    }
  }
  const userId = req.isAuthenticated?.() ? (req.user as { id?: string } | undefined)?.id ?? null : null;
  try {
    await db.insert(funnelEventsTable).values({
      name,
      props: Object.keys(cleanProps).length > 0 ? cleanProps : null,
      sessionId: sessionId ?? null,
      userId,
      path: path ?? null,
    });
  } catch (err) {
    // Degrade to structured logs (same posture as /vitals) if the table
    // is missing — the boot migration creates it on next deploy.
    logger.warn({ err, event: name }, "funnel_event_insert_failed");
  }
  res.status(204).end();
});

export default router;
