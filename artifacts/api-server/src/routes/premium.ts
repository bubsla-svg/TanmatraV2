import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod/v4";
import {
  db,
  premiumMembershipsTable,
  premiumMealsTable,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { razorpayCredentials, razorpayBasicAuth } from "../lib/razorpayRecurring";

const router: IRouter = Router();

const PREMIUM_PRICE_PAISE = 99900;
const PERIOD_DAYS = 30;
const FREE_RD_CONSULTS_PER_PERIOD = 1;

// Slugs must exist in the live catalog (DB or static fallback) so the
// premium badge + gate are observable end-to-end. These are the most
// chef-driven dishes in the current catalog.
const SEED_PREMIUM_SLUGS = [
  { slug: "alfredo-pasta-prawns", reason: "Premium prawn pasta — chef's selection" },
  { slug: "pesto-pasta-prawns", reason: "Premium prawn pasta — chef's selection" },
  { slug: "crispy-peri-peri-chicken-burrito-wrap", reason: "Signature peri-peri build" },
];

let premiumSeeded = false;
async function ensurePremiumSeeded() {
  if (premiumSeeded) return;
  for (const s of SEED_PREMIUM_SLUGS) {
    await db
      .insert(premiumMealsTable)
      .values({ dishSlug: s.slug, reason: s.reason })
      .onConflictDoNothing({ target: premiumMealsTable.dishSlug });
  }
  premiumSeeded = true;
}

function addDaysUtc(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

// A membership is treated as "still premium" if it is `active` (renewing)
// OR `cancelled` (won't auto-renew but still inside its paid period).
// Both grant entitlements until `currentPeriodEnd`. Only `expired` /
// `pending_payment` are non-premium.
async function loadActive(userId: string) {
  const [row] = await db
    .select()
    .from(premiumMembershipsTable)
    .where(
      and(
        eq(premiumMembershipsTable.userId, userId),
        inArray(premiumMembershipsTable.status, ["active", "cancelled"]),
      ),
    )
    .orderBy(desc(premiumMembershipsTable.createdAt))
    .limit(1);
  if (!row) return null;
  if (new Date(row.currentPeriodEnd).getTime() <= Date.now()) {
    await db
      .update(premiumMembershipsTable)
      .set({ status: "expired" })
      .where(eq(premiumMembershipsTable.id, row.id));
    return null;
  }
  return row;
}

export async function userIsPremium(userId: string): Promise<boolean> {
  const m = await loadActive(userId);
  return !!m;
}

export async function getPremiumSlugSet(): Promise<Set<string>> {
  // Ensure the registry is seeded even on a fresh DB before checkout
  // finalize ever calls /premium/me — otherwise the gate would silently
  // pass premium meals through to non-members.
  await ensurePremiumSeeded();
  const rows = await db.select().from(premiumMealsTable);
  return new Set(rows.map((r) => r.dishSlug));
}

router.get("/premium/me", async (req: Request, res: Response) => {
  await ensurePremiumSeeded();
  if (!req.isAuthenticated()) {
    res.json({ membership: null, isPremium: false, pricePaise: PREMIUM_PRICE_PAISE });
    return;
  }
  const m = await loadActive(req.user.id);
  res.json({
    membership: m,
    isPremium: !!m,
    pricePaise: PREMIUM_PRICE_PAISE,
  });
});

router.post("/premium/subscribe", async (req: Request, res: Response) => {
  await ensurePremiumSeeded();
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const existing = await loadActive(req.user.id);
  // Resume auto-renewal for a cancelled-but-still-in-period membership. This is
  // free — they already paid for the current period; we only re-enable renewal.
  if (existing?.status === "cancelled") {
    const [resumed] = await db
      .update(premiumMembershipsTable)
      .set({ status: "active", cancelledAt: null })
      .where(eq(premiumMembershipsTable.id, existing.id))
      .returning();
    res.json({ membership: resumed, isPremium: true, resumed: true });
    return;
  }
  if (existing) {
    res.status(409).json({ error: "already a premium member", membership: existing });
    return;
  }
  // A BRAND-NEW membership is a paid action: money integrity requires the
  // checkout → Razorpay → verify path (below), never a free activation here.
  res.status(409).json({ error: "payment required — start checkout", code: "payment_required" });
});

const premiumVerifySchema = z.object({
  razorpayPaymentId: z.string().min(1).max(64),
  razorpayOrderId: z.string().min(1).max(64),
  razorpaySignature: z.string().min(1).max(256),
});

/**
 * Open a Razorpay order for a NEW premium membership at the SERVER price. Mirrors
 * the appointment-payment path: create (or reuse) a `pending_payment` row, bind
 * the gateway order id to it, and return only ids + the server amount to the
 * client. `loadActive` ignores `pending_payment`, so a stale attempt never
 * blocks a fresh checkout.
 */
router.post("/premium/checkout", async (req: Request, res: Response) => {
  await ensurePremiumSeeded();
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const active = await loadActive(req.user.id);
  if (active) {
    res.status(409).json({ error: "already a premium member", membership: active });
    return;
  }
  const creds = razorpayCredentials();
  if (!creds) {
    res.status(503).json({ error: "payment gateway not configured" });
    return;
  }
  const [keyId, keySecret] = creds;

  const now = new Date();
  const [pending] = await db
    .select()
    .from(premiumMembershipsTable)
    .where(
      and(
        eq(premiumMembershipsTable.userId, req.user.id),
        eq(premiumMembershipsTable.status, "pending_payment"),
      ),
    )
    .orderBy(desc(premiumMembershipsTable.createdAt))
    .limit(1);
  let membershipId: number;
  if (pending) {
    membershipId = pending.id;
  } else {
    const [created] = await db
      .insert(premiumMembershipsTable)
      .values({
        userId: req.user.id,
        status: "pending_payment",
        monthlyPricePaise: PREMIUM_PRICE_PAISE,
        startedAt: now,
        currentPeriodEnd: addDaysUtc(now, PERIOD_DAYS),
        rdConsultsUsedThisPeriod: 0,
        rdConsultsPerPeriod: FREE_RD_CONSULTS_PER_PERIOD,
      })
      .returning();
    if (!created) {
      res.status(500).json({ error: "could not start checkout" });
      return;
    }
    membershipId = created.id;
  }

  const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: PREMIUM_PRICE_PAISE,
      currency: "INR",
      receipt: `premium-${membershipId}`,
      payment_capture: 1,
    }),
  });
  if (!rpRes.ok) {
    let body: unknown;
    try {
      body = await rpRes.json();
    } catch {
      body = await rpRes.text();
    }
    req.log.error({ status: rpRes.status, body }, "Razorpay premium order creation failed");
    res.status(502).json({ error: "payment gateway error" });
    return;
  }
  const rp = (await rpRes.json()) as { id: string; amount: number; currency: string };
  await db
    .update(premiumMembershipsTable)
    .set({ razorpayOrderId: rp.id })
    .where(eq(premiumMembershipsTable.id, membershipId));
  res.json({ razorpayOrderId: rp.id, amount: rp.amount, currency: rp.currency, keyId });
});

/**
 * Verify the Razorpay signature and activate the membership. The atomic guarded
 * update binds THIS payment to the `pending_payment` row whose stored
 * `razorpayOrderId` matches — replaying another order's valid signature updates
 * zero rows (→ 409), exactly as the appointment path defends.
 */
router.post("/premium/verify", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const creds = razorpayCredentials();
  if (!creds) {
    res.status(503).json({ error: "payment gateway not configured" });
    return;
  }
  const [, keySecret] = creds;
  const parsed = premiumVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = parsed.data;
  const expected = createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  let valid = false;
  try {
    valid = timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(razorpaySignature, "hex"));
  } catch {
    valid = false;
  }
  if (!valid) {
    req.log.warn({ userId: req.user.id, razorpayOrderId }, "invalid premium payment signature");
    res.status(400).json({ error: "invalid payment signature" });
    return;
  }
  const now = new Date();
  const [row] = await db
    .update(premiumMembershipsTable)
    .set({
      status: "active",
      razorpayPaymentId,
      startedAt: now,
      currentPeriodEnd: addDaysUtc(now, PERIOD_DAYS),
      rdConsultsUsedThisPeriod: 0,
      rdConsultsPerPeriod: FREE_RD_CONSULTS_PER_PERIOD,
    })
    .where(
      and(
        eq(premiumMembershipsTable.userId, req.user.id),
        eq(premiumMembershipsTable.razorpayOrderId, razorpayOrderId),
        eq(premiumMembershipsTable.status, "pending_payment"),
      ),
    )
    .returning();
  if (!row) {
    res.status(409).json({ error: "payment could not be applied" });
    return;
  }
  req.log.info({ userId: req.user.id }, "premium membership paid");
  res.json({ ok: true, membership: row, isPremium: true });
});

router.post("/premium/cancel", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const m = await loadActive(req.user.id);
  if (!m) {
    res.status(404).json({ error: "no active membership" });
    return;
  }
  // The user keeps premium until the period ends; we just stop renewal.
  const [updated] = await db
    .update(premiumMembershipsTable)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(premiumMembershipsTable.id, m.id))
    .returning();
  res.json({ membership: updated });
});

router.post(
  "/premium/use-rd-consult",
  async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const m = await loadActive(req.user.id);
    if (!m) {
      res.status(403).json({ error: "premium membership required" });
      return;
    }
    if (m.rdConsultsUsedThisPeriod >= m.rdConsultsPerPeriod) {
      res
        .status(409)
        .json({ error: "no free RD consults remaining this period" });
      return;
    }
    const [updated] = await db
      .update(premiumMembershipsTable)
      .set({ rdConsultsUsedThisPeriod: m.rdConsultsUsedThisPeriod + 1 })
      .where(eq(premiumMembershipsTable.id, m.id))
      .returning();
    res.json({
      membership: updated,
      remaining: updated.rdConsultsPerPeriod - updated.rdConsultsUsedThisPeriod,
    });
  },
);

router.get("/premium/meals", async (_req: Request, res: Response) => {
  await ensurePremiumSeeded();
  const rows = await db.select().from(premiumMealsTable);
  res.json({ slugs: rows.map((r) => r.dishSlug), meals: rows });
});

export default router;
