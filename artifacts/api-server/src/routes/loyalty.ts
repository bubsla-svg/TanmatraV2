import { randomBytes } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuthUser as requireAuth } from "../middlewares/requireAuth";
import { idempotencyMiddleware } from "../middlewares/idempotency";
import { isOrderFinalizeDisabled } from "../lib/flags";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  creditLedgerTable,
  db,
  mealCreditsTable,
  notificationsTable,
  referralCodesTable,
  referralRedemptionsTable,
  userProfileTable,
} from "@workspace/db";
import {
  BRIDGE_CREDIT_MEALS,
  BRIDGE_CREDIT_EXPIRY_DAYS,
} from "../lib/bridgeCredit";
import { getPremiumSlugSet, userIsPremium } from "./premium";
import { makeBatchDishResolver } from "../lib/menuResolver";
import {
  FIRST_ORDER_DISCOUNT_BPS,
  FIRST_ORDER_DISCOUNT_CAP_PAISE,
  finalizeOrder,
  getCreditBalancePaise,
  getLoyaltyConstantsSnapshot,
  getSubscriptionLoyaltyProgress,
  listNotifications,
  redeemCreditAtomic,
  runLoyaltyEngineForUser,
  userIsFirstOrderEligible,
} from "../lib/loyaltyEngine";
import {
  defaultChannelForKind,
  dispatchNotificationEmail,
} from "../lib/notificationMail";
import { invalidateUserBrief } from "../lib/userBrief";
import { emitServerEvent } from "../lib/serverEvents";

const router: IRouter = Router();

// requireAuth: see shared middleware/requireAuth.ts

function parseIdParam(raw: unknown, res: Response): number | null {
  const value = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    res.status(400).json({ error: "invalid id" });
    return null;
  }
  return n;
}

function generateCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

router.get("/referral/me", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  let [code] = await db
    .select()
    .from(referralCodesTable)
    .where(eq(referralCodesTable.userId, userId));
  if (!code) {
    let attempt = 0;
    while (attempt < 5 && !code) {
      const candidate = generateCode();
      const inserted = await db
        .insert(referralCodesTable)
        .values({ userId, code: candidate })
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) {
        code = inserted[0];
        break;
      }
      // Either the code was taken, or this user already had one inserted
      // by a concurrent request — read it back and use that.
      [code] = await db
        .select()
        .from(referralCodesTable)
        .where(eq(referralCodesTable.userId, userId));
      attempt++;
    }
    if (!code) {
      res.status(500).json({ error: "could not allocate code" });
      return;
    }
  }
  const [redemptions, awards] = await Promise.all([
    db
      .select()
      .from(referralRedemptionsTable)
      .where(eq(referralRedemptionsTable.referrerUserId, userId))
      .orderBy(desc(referralRedemptionsTable.createdAt)),
    getLoyaltyConstantsSnapshot(),
  ]);
  res.json({
    code: code.code,
    awards: {
      referrerPaise: awards.REFERRER_AWARD_PAISE,
      refereePaise: awards.REFEREE_AWARD_PAISE,
    },
    redemptions,
  });
});

const redeemSchema = z.object({
  code: z.string().min(4).max(32),
});

router.post("/referral/redeem", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const codeStr = parsed.data.code.trim().toUpperCase();
  const [code] = await db
    .select()
    .from(referralCodesTable)
    .where(eq(referralCodesTable.code, codeStr));
  if (!code) {
    res.status(404).json({ error: "code not found" });
    return;
  }
  if (code.userId === userId) {
    res.status(400).json({ error: "cannot redeem your own code" });
    return;
  }
  const [existing] = await db
    .select()
    .from(referralRedemptionsTable)
    .where(eq(referralRedemptionsTable.refereeUserId, userId));
  if (existing) {
    res.status(409).json({ error: "already redeemed a referral" });
    return;
  }
  const constants = await getLoyaltyConstantsSnapshot();
  let redemption;
  try {
    [redemption] = await db
      .insert(referralRedemptionsTable)
      .values({
        codeId: code.id,
        referrerUserId: code.userId,
        refereeUserId: userId,
        referrerAwardPaise: constants.REFERRER_AWARD_PAISE,
        refereeAwardPaise: constants.REFEREE_AWARD_PAISE,
      })
      .returning();
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "23505"
    ) {
      res.status(409).json({ error: "already redeemed a referral" });
      return;
    }
    throw e;
  }
  // Credits are released only inside finalizeOrder once the referee
  // places a first server-recorded order. Notify the referrer that
  // a pending redemption exists.
  const channel = defaultChannelForKind("referral_redeemed");
  const isEmail = channel === "email";
  const [createdNotification] = await db
    .insert(notificationsTable)
    .values({
      userId: code.userId,
      kind: "referral_redeemed",
      title: "A friend joined with your code",
      body: `Credits land when they place their first order.`,
      channel,
      status: isEmail ? "pending" : "sent",
      sentAt: isEmail ? null : new Date(),
      dedupeKey: `referral_pending:${redemption.id}`,
      payload: { redemptionId: redemption.id, status: "pending" },
    })
    .onConflictDoNothing({
      target: [notificationsTable.userId, notificationsTable.dedupeKey],
    })
    .returning();
  if (createdNotification && isEmail) {
    setImmediate(() => {
      void dispatchNotificationEmail(createdNotification);
    });
  }
  res.json({ redemption, awardedPaise: 0, status: "pending_first_order" });
});

router.get("/credit-ledger", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const [entries, balance] = await Promise.all([
    db
      .select()
      .from(creditLedgerTable)
      .where(eq(creditLedgerTable.userId, userId))
      .orderBy(desc(creditLedgerTable.createdAt))
      .limit(100),
    getCreditBalancePaise(userId),
  ]);
  res.json({ entries, balancePaise: balance });
});

const redeemCreditSchema = z.object({
  paise: z.number().int().positive().max(10_000_000),
  note: z.string().max(128).optional(),
  refId: z.string().max(64).optional(),
});

router.post(
  "/credit-ledger/redeem",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const parsed = redeemCreditSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }
    const result = await redeemCreditAtomic({
      userId,
      paise: parsed.data.paise,
      refId: parsed.data.refId,
      note: parsed.data.note,
    });
    if (!result.ok) {
      res.status(409).json({ error: "insufficient credit balance" });
      return;
    }
    res.json({
      redeemedPaise: parsed.data.paise,
      balancePaise: result.balancePaise,
    });
  },
);

const finalizeOrderSchema = z.object({
  orderId: z.string().min(1).max(64),
  items: z
    .array(
      z.object({
        id: z.number().int().nonnegative(),
        name: z.string().min(1).max(128),
        qty: z.number().int().positive().max(100),
        price: z.number().int().nonnegative().max(1_000_000),
      }),
    )
    .min(1)
    .max(50),
  address: z
    .object({
      label: z.string().max(64).nullable().optional(),
      line: z.string().max(256).nullable().optional(),
      city: z.string().max(64).nullable().optional(),
      pincode: z.string().max(16).nullable().optional(),
      phone: z.string().max(32).nullable().optional(),
    })
    .optional(),
  applyCreditsPaise: z.number().int().nonnegative().max(10_000_000).optional(),
  /**
   * Corporate-subsidy INTENT, not an amount — deliberately a boolean so there
   * is no field here a client could use to name what its company pays. The
   * server derives the paise from company policy under a lock and subtracts it
   * from charge_paise (lib/corporateSubsidy.ts).
   *
   * Omitted means "yes", matching the checkout toggle's default, so a client
   * that predates this field keeps the behaviour its user already sees.
   */
  applySubsidy: z.boolean().optional(),
  scheduledFor: z.string().datetime().optional(),
  bundleSlugs: z.array(z.string().min(1).max(64)).max(10).optional(),
  deliverySlotId: z.number().int().positive().nullable().optional(),
  pickupLocationId: z.number().int().positive().nullable().optional(),
  fulfillmentType: z.enum(["delivery", "pickup"]).optional(),
  // Phase B2 — the web à la carte checkout sets this so a delivery order must
  // carry an explicit future slot (windows-only; no ASAP). Other clients that
  // omit it keep the legacy auto-pick, so this rolls out without breaking them.
  requireScheduledSlot: z.boolean().optional(),
  ecoPackagingOptIn: z.boolean().optional(),
  deliveryInstructions: z.string().max(512).nullable().optional(),
  subscriptionId: z.number().int().positive().nullable().optional(),
});

const SERVICEABLE_PINCODES = new Set([
  "110001", "110016", "110017", "110019", "110020", "110024", "110025", "110048", "110049", "110065", "122001", "122002", "122003", "122004", "122009", "122011", "122015", "122016", "122017", "122018",
  "201301", "201303", "201304", "201305", "201306", "201307", "201309", "201318",
  "201010", "201012", "201014",
  "110091", "110092", "110096"
]);

function isServiceablePincode(pincode: string | null | undefined): boolean {
  if (!pincode) return false;
  return SERVICEABLE_PINCODES.has(pincode.trim());
}

/**
 * GET /orders/first-order-offer
 *
 * First-order offer eligibility for the signed-in user. The checkout UI
 * uses this to show the projected discount; finalizeOrder re-checks
 * server-side, so this is display-only truth, not the charging decision.
 */
router.get("/orders/first-order-offer", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const eligible = await userIsFirstOrderEligible(userId);
  res.json({
    eligible,
    percentBps: FIRST_ORDER_DISCOUNT_BPS,
    capPaise: FIRST_ORDER_DISCOUNT_CAP_PAISE,
  });
});

// Owner containment gate (docs/MONEY-PATH-VERIFICATION.md "Settlement Trust
// Boundary"): while ORDER_FINALIZE_DISABLED is set, this route refuses with a
// typed 503. Mounted BEFORE idempotencyMiddleware, same reasoning as
// subscriptions.ts's planCheckoutGate: the client's idempotency key is stable
// for the whole checkout attempt, so a gated 503 must not be cached against
// it — the same key must perform a real create once the gate reopens.
function orderFinalizeGate(req: Request, res: Response, next: () => void): void {
  if (isOrderFinalizeDisabled()) {
    res.status(503).json({
      code: "CHECKOUT_TEMPORARILY_UNAVAILABLE",
      message: "Checkout is temporarily unavailable. Please try again shortly.",
      error: "Checkout is temporarily unavailable. Please try again shortly.",
    });
    return;
  }
  next();
}

router.post("/orders/finalize", orderFinalizeGate, idempotencyMiddleware, async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const parsed = finalizeOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  if (parsed.data.address?.pincode && !isServiceablePincode(parsed.data.address.pincode)) {
    res.status(422).json({ error: "we do not deliver to this pincode yet", code: "unserviceable_pincode" });
    return;
  }
  // Server-side premium-meal gating: if the cart contains any dish whose
  // slug is in the curated premium-only set, the user must be a paying
  // premium member. Resolve dish ids through the same merged catalog
  // resolver used for pricing so static and DB-only (synthetic id) dishes
  // both map correctly. Fails CLOSED — a resolver/db error rejects the
  // order rather than silently letting premium dishes through.
  try {
    const ids = parsed.data.items.map((i) => i.id).filter((id) => id > 0);
    if (ids.length > 0) {
      const [premiumSet, resolver] = await Promise.all([
        getPremiumSlugSet(),
        makeBatchDishResolver(),
      ]);
      const cartHasPremium = ids.some((id) => {
        const d = resolver.byId(id);
        return !!d && premiumSet.has(d.slug);
      });
      if (cartHasPremium && !(await userIsPremium(userId))) {
        res
          .status(403)
          .json({ error: "premium membership required for one or more items" });
        return;
      }
    }
  } catch (err) {
    req.log.error({ err }, "premium gate check failed");
    res.status(503).json({ error: "premium gate unavailable, try again" });
    return;
  }
  try {
    const { scheduledFor, ...rest } = parsed.data;
    const out = await finalizeOrder({
      userId,
      ...rest,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    });
    // Part 8 A4 — server-truth order_created. Fire-and-forget (emitServerEvent
    // never throws); duplicate finalize replays must not double-count.
    if (!out.duplicate) {
      void emitServerEvent(
        "order_created",
        { order_kind: "meal", charge_paise: out.chargePaise },
        userId,
      );
    }
    // Phase C2 — a customer's first à la carte order earns a one-time trial
    // credit (one free meal, one per customer). Additive and best-effort: it
    // never blocks or fails the order, and idempotent retries don't re-issue.
    if (!out.duplicate) {
      try {
        const existing = await db
          .select({ id: mealCreditsTable.id })
          .from(mealCreditsTable)
          .where(
            and(
              eq(mealCreditsTable.userId, userId),
              eq(mealCreditsTable.reason, "alacarte_bridge"),
            ),
          )
          .limit(1);
        if (existing.length === 0) {
          const expiresAt = new Date();
          expiresAt.setUTCDate(
            expiresAt.getUTCDate() + BRIDGE_CREDIT_EXPIRY_DAYS,
          );
          await db.insert(mealCreditsTable).values({
            userId,
            amount: BRIDGE_CREDIT_MEALS,
            reason: "alacarte_bridge",
            expiresAt,
          });
        }
      } catch (e) {
        req.log.warn({ e }, "bridge credit issuance failed");
      }
    }
    res.json(out);
  } catch (err) {
    req.log.error({ err }, "finalize order failed");
    const msg = err instanceof Error ? err.message : "";
    if (msg === "delivery slot full") {
      res.status(409).json({ error: msg });
      return;
    }
    if (msg.startsWith("order_id_conflict:")) {
      res.status(409).json({ error: msg, code: "order_id_conflict" });
      return;
    }
    if (msg.startsWith("safety_block:")) {
      const safety = (err as Error & {
        safetyBlock?: { codes: string[]; blocked: unknown };
      }).safetyBlock;
      const codes = safety?.codes ?? [];
      // Surface the most specific structured code at the top level so
      // clients can switch on `code` without parsing arrays. The
      // ordering reflects severity / specificity (allergen first since
      // it is the strictest patient-safety risk; unreviewed/blocked
      // dishes are operational gates rather than declared allergies).
      const ORDER = [
        "allergen_block",
        "diet_block",
        "ingredient_block",
        "keto_block",
        "unreviewed_dish",
      ] as const;
      const primary = ORDER.find((c) => codes.includes(c)) ?? codes[0] ?? "safety_block";
      res.status(422).json({
        error: msg,
        code: primary,
        codes,
        blocked: safety?.blocked ?? [],
      });
      return;
    }
    // Legacy: pre-shared-evaluator gate threw "allergen violation:". Keep
    // the mapping for any code path that still surfaces that string.
    if (msg.startsWith("allergen violation:")) {
      res.status(422).json({ error: msg, code: "allergen_violation" });
      return;
    }
    if (
      msg === "delivery slot required" ||
      msg === "delivery slot not found" ||
      msg === "delivery address required" ||
      msg === "pickup location required" ||
      msg === "pickup location unavailable"
    ) {
      res.status(400).json({ error: msg });
      return;
    }
    res.status(500).json({ error: "finalize failed" });
  }
});

router.get("/notifications", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const items = await listNotifications(userId);
  res.json({ notifications: items });
});

router.post(
  "/notifications/:id/dismiss",
  async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const id = parseIdParam(req.params.id, res);
    if (id === null) return;
    const [updated] = await db
      .update(notificationsTable)
      .set({ status: "dismissed" })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userId, userId),
        ),
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ notification: updated });
  },
);

router.get("/loyalty/progress", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const progress = await getSubscriptionLoyaltyProgress(userId);
  res.json({ progress });
});

router.post("/loyalty/run", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const result = await runLoyaltyEngineForUser(userId);
  res.json({
    triggered: result.notifications.length,
    notifications: result.notifications,
  });
});

const NOTIFICATION_KINDS = [
  "winback",
  "birthday",
  "anniversary",
  "loyalty_free_week",
  "loyalty_premium_unlock",
  "protein_streak",
  "referral_redeemed",
] as const;

const profileSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  anniversaryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  proteinGoalGrams: z.number().int().positive().max(500).optional(),
  proteinShortfallStreak: z.number().int().min(0).max(60).optional(),
  emailOptOut: z
    .record(z.enum(NOTIFICATION_KINDS), z.boolean())
    .optional(),
});

router.get("/profile", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const [profile] = await db
    .select()
    .from(userProfileTable)
    .where(eq(userProfileTable.userId, userId));
  res.json({ profile: profile ?? null });
});

async function upsertProfilePartial(
  userId: string,
  patch: z.infer<typeof profileSchema>,
) {
  // PATCH semantics: omitted fields stay untouched, including on first
  // insert (where they fall back to null/0 defaults).
  const insertValues = {
    userId,
    birthDate: patch.birthDate ?? null,
    anniversaryDate: patch.anniversaryDate ?? null,
    proteinGoalGrams: patch.proteinGoalGrams ?? null,
    proteinShortfallStreak: patch.proteinShortfallStreak ?? 0,
    emailOptOut: patch.emailOptOut ?? null,
  };
  const updateSet: Record<string, unknown> = {};
  if (patch.birthDate !== undefined) updateSet["birthDate"] = patch.birthDate;
  if (patch.anniversaryDate !== undefined)
    updateSet["anniversaryDate"] = patch.anniversaryDate;
  if (patch.proteinGoalGrams !== undefined)
    updateSet["proteinGoalGrams"] = patch.proteinGoalGrams;
  if (patch.proteinShortfallStreak !== undefined)
    updateSet["proteinShortfallStreak"] = patch.proteinShortfallStreak;
  if (patch.emailOptOut !== undefined)
    updateSet["emailOptOut"] = patch.emailOptOut;

  if (Object.keys(updateSet).length === 0) {
    const [existing] = await db
      .insert(userProfileTable)
      .values(insertValues)
      .onConflictDoNothing({ target: userProfileTable.userId })
      .returning();
    if (existing) return existing;
    const [row] = await db
      .select()
      .from(userProfileTable)
      .where(eq(userProfileTable.userId, userId));
    return row;
  }

  const [profile] = await db
    .insert(userProfileTable)
    .values(insertValues)
    .onConflictDoUpdate({ target: userProfileTable.userId, set: updateSet })
    .returning();
  return profile;
}

async function profileWriteHandler(req: Request, res: Response) {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const profile = await upsertProfilePartial(userId, parsed.data);
  invalidateUserBrief(userId);
  res.json({ profile });
}

router.put("/profile", profileWriteHandler);
router.patch("/profile", profileWriteHandler);

export default router;
