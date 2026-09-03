/**
 * Public referral-offer lookup — the ONE thing a cold visitor arriving on
 * `/r/<code>` needs before they will hand over anything: is this real, and what
 * do I get?
 *
 * PUBLIC ON PURPOSE, and the reason is a money rule, not convenience. Law 1
 * says the offer is stated before the ask, and the storefront's rule is that
 * the SERVER owns every amount the customer reads. A referral landing that
 * prints an award figure the browser made up would break both at once. So the
 * figure comes from the same `getLoyaltyConstantsSnapshot()` that
 * `/referral/redeem` writes into the redemption row — one source, no drift
 * between what the landing promises and what the account is later credited.
 *
 * The referrer's FIRST NAME is returned, nothing else — no phone, no email, no
 * last name, no user id. It is what makes the line read "Rohit sent you …"
 * instead of "a friend sent you …", and it is data the referrer published
 * themselves by sharing their own link. The rate limit below is what keeps that
 * from becoming a name-harvesting oracle over the 8-hex code space.
 *
 * NEVER 404s (Law 10): an unknown or mistyped code answers `valid: false` with
 * the standing offer still stated, so the landing can say "that code didn't
 * work, here's the deal anyway" instead of dead-ending a scan.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, referralCodesTable, usersTable } from "@workspace/db";
import { getLoyaltyConstantsSnapshot } from "../lib/loyaltyEngine";
import { rateLimitMiddleware } from "../middlewares/rateLimitMiddleware";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/** Codes are `randomBytes(4).toString("hex").toUpperCase()` — 8 hex chars.
 *  Accepts a slightly wider shape so a hand-typed code with the wrong case or
 *  stray spaces resolves instead of being rejected as malformed. */
export function normalizeReferralCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{4,32}$/.test(code) ? code : null;
}

// Tight on purpose — see the header note. A real visitor resolves ONE code per
// landing; anything approaching this ceiling is enumerating.
const offerRateLimit = rateLimitMiddleware("referral:offer", 20, 60_000);

router.get("/referral/offer/:code", offerRateLimit, async (req: Request, res: Response) => {
  const awards = await getLoyaltyConstantsSnapshot();
  const refereeAwardPaise = awards.REFEREE_AWARD_PAISE;
  const code = normalizeReferralCode(String(req.params["code"] ?? ""));
  if (!code) {
    res.json({ valid: false, refereeAwardPaise });
    return;
  }
  try {
    const [row] = await db
      .select({ firstName: usersTable.firstName })
      .from(referralCodesTable)
      .innerJoin(usersTable, eq(usersTable.id, referralCodesTable.userId))
      .where(eq(referralCodesTable.code, code))
      .limit(1);
    if (!row) {
      res.json({ valid: false, refereeAwardPaise });
      return;
    }
    res.json({
      valid: true,
      code,
      // Trimmed to a display-safe length; absent rather than empty when the
      // account never filled one in, so the caller falls back to "a friend"
      // instead of rendering "  sent you …".
      referrerFirstName: row.firstName?.trim().slice(0, 24) || undefined,
      refereeAwardPaise,
    });
  } catch (err) {
    // A lookup failure must not cost the visit. Answer with the standing offer
    // and let the landing sell; the code can still be applied at checkout.
    logger.warn({ err }, "referral_offer_lookup_failed");
    res.json({ valid: false, refereeAwardPaise });
  }
});

export default router;
