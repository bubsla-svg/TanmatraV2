/**
 * Printed-code acquisition (QR funnel).
 *
 * A QR on a box, a poster or a gym standee encodes `tanmatra.food/q/<src>`.
 * The storefront's `/q/[src]` handler calls THIS route server-side, then issues
 * the 302. Two things have to happen in that one hop and both live here:
 *
 *  1. RESOLVE. The printed code is a lookup key, not a URL. `/q/box` can be
 *     repointed to a different landing next month without anyone reprinting the
 *     sticker already on a customer's door.
 *
 *  2. COUNT. `qr_scans` is the DENOMINATOR of "scans → paid %", the only number
 *     that can tell a working placement from a wasted print run. A scan that
 *     bounces off the landing leaves no other trace anywhere, so if it is not
 *     written here it does not exist.
 *
 * NEVER 404, NEVER 5xx TO THE CALLER. An unknown or retired code resolves to
 * the generic landing with `known: false` — a misprint, a code retired while
 * posters are still up, or a typed URL must all end on a page that sells, not
 * on an error (Law 10). Same posture for a database failure: the redirect is
 * the customer's journey and the scan row is our bookkeeping, so losing the
 * row must never cost the visit.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import { db, qrPlacementsTable, qrScansTable } from "@workspace/db";
import { rateLimitMiddleware } from "../middlewares/rateLimitMiddleware";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Where an unknown, retired or malformed code lands. A constant rather than a
 * per-placement default: this is the answer when the lookup produced NOTHING,
 * so there is no row to read it from.
 */
export const GENERIC_LANDING = "/start";

/**
 * Printed codes are short, lowercase and URL-safe. The QR encodes the
 * all-uppercase form (HTTPS://TANMATRA.FOOD/Q/BOX) because uppercase fits QR
 * alphanumeric mode and yields a lower-density symbol that scans from farther
 * away — so the case fold on the way in is REQUIRED, not cosmetic: URL paths
 * are case-sensitive by spec and `/Q/BOX` would otherwise miss `box` entirely.
 */
export function normalizeQrCode(raw: string): string | null {
  const code = raw.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(code) ? code : null;
}

/**
 * A destination we are willing to redirect to.
 *
 * Same-origin, absolute-path only. `//evil.example` is a protocol-relative URL
 * that browsers treat as a different HOST while looking like a path — the
 * classic open-redirect shape, and this table is exactly the kind of operator-
 * editable data where one would arrive by accident. A backslash is checked too
 * because some browsers normalise `/\` to `//`.
 */
export function isSafeDestination(dest: string): boolean {
  return /^\/(?![/\\])[\w\-./?=&%:+]*$/.test(dest);
}

const scanSchema = z.object({
  code: z.string().min(1).max(64),
  ref: z.string().max(64).optional(),
  sessionId: z.string().max(64).optional(),
});

// The scan endpoint is called once per physical scan from the storefront's
// server, not from a browser, so the ceiling only has to be above a real
// poster's burst (a standee at a crowded gym, one QR printed on every box in a
// delivery run) while still bounding a script pointed at it.
const scanRateLimit = rateLimitMiddleware("qr:scan", 240, 60_000);

router.post("/qr/scan", scanRateLimit, async (req: Request, res: Response) => {
  const parsed = scanSchema.safeParse(req.body ?? {});
  // A malformed body is still a scan that has to land somewhere. Answer with
  // the generic landing rather than a 400 the redirect handler would have to
  // invent a fallback for anyway.
  if (!parsed.success) {
    res.json({ src: null, known: false, destination: GENERIC_LANDING });
    return;
  }
  const code = normalizeQrCode(parsed.data.code);
  if (!code) {
    res.json({ src: null, known: false, destination: GENERIC_LANDING });
    return;
  }

  let destination = GENERIC_LANDING;
  let known = false;
  try {
    const [placement] = await db
      .select({ destination: qrPlacementsTable.destination })
      .from(qrPlacementsTable)
      .where(and(eq(qrPlacementsTable.code, code), eq(qrPlacementsTable.active, true)))
      .limit(1);
    if (placement && isSafeDestination(placement.destination)) {
      destination = placement.destination;
      known = true;
    } else if (placement) {
      // A row exists but its destination is not a safe same-origin path. Count
      // the scan as known (the placement IS real and its print run should get
      // credit) and send the visitor somewhere that works.
      known = true;
      logger.warn({ code, destination: placement.destination }, "qr_placement_unsafe_destination");
    }
  } catch (err) {
    // Resolution failed. The generic landing sells the same offer, so the
    // visitor loses nothing but the placement's attribution.
    logger.warn({ err, code }, "qr_placement_lookup_failed");
  }

  try {
    await db.insert(qrScansTable).values({
      code,
      known,
      ref: parsed.data.ref ?? null,
      sessionId: parsed.data.sessionId ?? null,
    });
  } catch (err) {
    // Degrade to a structured log, same posture as the /events beacon: the
    // scoreboard loses a row, the customer loses nothing.
    logger.warn({ err, code }, "qr_scan_insert_failed");
  }

  res.json({ src: code, known, destination });
});

export default router;
