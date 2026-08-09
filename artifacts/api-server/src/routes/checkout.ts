import { Router, type IRouter, type Request, type Response } from "express";
import { db, ordersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { makeBatchDishResolver } from "../lib/menuResolver";
import { calculateCartTotals } from "../lib/cartMath";
import { resolveCustomizations, type CustomizationSelection } from "../lib/dishCustomizations";
import type { DishData } from "@workspace/menu-catalog";
import type { PreferencesForMatch } from "@workspace/preferences-match";
import {
  assessAllergenAck,
  findDishSafetyBlock,
  normalizeGuestPrefs,
} from "../lib/checkoutSafety";
import { isServiceablePincode, SERVICEABLE_PINCODES } from "@workspace/api-zod";
import { getDecryptedPreferences } from "../lib/userPreferences";
import { getPremiumSlugSet, userIsPremium } from "./premium";

const router: IRouter = Router();

/**
 * À-la-carte (single-meal, non-subscription) checkout gate. Defaults ENABLED to
 * preserve current behaviour; set env ALC_CHECKOUT_ENABLED=false to enforce
 * subscription-only ordering, at which point POST /orders refuses with 403.
 * This is the server-authoritative enforcement point (the client should also
 * hide the one-time CTA when disabled, but this refusal is what guarantees it).
 */
function alcCheckoutEnabled(): boolean {
  return (process.env["ALC_CHECKOUT_ENABLED"] ?? "true").toLowerCase() !== "false";
}

// Shared between POST /orders and POST /orders/quote so a quoted cart and a
// billed cart can never accept different shapes.
const orderItemsSchema = z
  .array(
    z.object({
      dishId: z.number().int().positive(),
      qty: z.number().int().min(1).max(20),
      // Customisation SELECTIONS, never a price — pricing is resolved
      // server-side against the dish's own `customizations` groups
      // (dishCustomizations.ts). A client can name a group and options; it
      // can never assert what those options cost.
      customizations: z
        .array(
          z.object({
            groupName: z.string().min(1).max(120),
            optionNames: z.array(z.string().min(1).max(120)).max(20),
          }),
        )
        .max(20)
        .optional(),
    }),
  )
  .min(1)
  .max(50);

const placeOrderSchema = z.object({
  externalOrderId: z.string().min(1).max(64),
  items: orderItemsSchema,
  phone: z.string().min(7).max(20),
  address: z.object({
    label: z.string().max(64).optional(),
    line1: z.string().min(1).max(256),
    line2: z.string().max(256).optional(),
    city: z.string().min(1).max(64),
    pincode: z.string().min(4).max(16),
  }),
  // DPDP Act consent for storing/using health data to fulfil the order. Required
  // to place an order — the buyflow (esp. guest checkout) must not proceed
  // without an explicit, logged acknowledgement.
  consent: z
    .object({
      accepted: z.boolean(),
      policyVersion: z.string().min(1).max(64),
    })
    .optional(),
  // Optional dietary-safety declaration for GUEST checkout (authenticated users
  // are screened against their saved preferences). Lets an anonymous buyer
  // declare allergens/conditions so the same server-side safety gate runs.
  guestPrefs: z
    .object({
      allergens: z.array(z.string().max(64)).max(30).optional(),
      dislikedIngredients: z.array(z.string().max(64)).max(30).optional(),
      medicalConditions: z.array(z.string().max(64)).max(30).optional(),
      cuisines: z.array(z.string().max(64)).max(30).optional(),
      dietaryStyle: z.enum(["omnivore", "vegetarian", "vegan", "pescatarian", "keto"]).optional(),
    })
    .optional(),
  // Set true to acknowledge allergen risk when a guest declares no dietary info
  // but the cart contains allergen/contraindication-flagged dishes.
  allergenAck: z.boolean().optional(),
});

/** The stable delivery ETA the order path has always promised (the status
 *  route counts its SLA window down from this). The quote shows the same
 *  figure so pre-payment timing equals post-payment timing. */
const ORDER_ETA_MINUTES = 25;

/** Advisory freshness window for a quote snapshot. The quote is stateless —
 *  POST /orders re-prices authoritatively regardless — so expiry here only
 *  tells the client when to stop trusting the DISPLAY and refresh. */
const QUOTE_TTL_MS = 15 * 60 * 1000;

type ValidatedCartItem = {
  id: number;
  name: string;
  qty: number;
  price: number;
  customizations?: string[];
};

/**
 * Item validation shared by POST /orders and POST /orders/quote — ONE source
 * of truth so a quoted cart and a billed cart can never diverge (the quote's
 * whole promise is display-equals-billed). Failure returns the exact
 * status/body the create path has always sent.
 */
function validateCartItems(
  items: z.infer<typeof orderItemsSchema>,
  resolver: Awaited<ReturnType<typeof makeBatchDishResolver>>,
  effectivePrefs: PreferencesForMatch | null,
):
  | { ok: true; validatedItems: ValidatedCartItem[]; resolvedDishes: DishData[] }
  | { ok: false; status: number; body: Record<string, unknown> } {
  const validatedItems: ValidatedCartItem[] = [];
  const resolvedDishes: DishData[] = [];
  for (const item of items) {
    const dish = resolver.byId(item.dishId);
    if (!dish) {
      return { ok: false, status: 422, body: { error: `unknown dish: ${item.dishId}` } };
    }
    if (!dish.isAvailable) {
      return {
        ok: false,
        status: 422,
        body: { error: `dish unavailable: ${dish.name}`, code: "dish_unavailable", dishId: dish.id, dishName: dish.name },
      };
    }
    const blockReasons = findDishSafetyBlock(dish, effectivePrefs);
    if (blockReasons) {
      return {
        ok: false,
        status: 422,
        body: { error: "Safety block", code: "safety_block", blocked: true, reasons: blockReasons },
      };
    }

    const customization = resolveCustomizations(
      dish.customizations,
      item.customizations as CustomizationSelection[] | undefined,
    );
    if (!customization.ok) {
      return {
        ok: false,
        status: 422,
        body: { error: `invalid customisation for ${dish.name}: ${customization.error}`, code: "invalid_customization" },
      };
    }

    resolvedDishes.push(dish);
    validatedItems.push({
      id: dish.id,
      name: dish.name,
      qty: item.qty,
      price: dish.price + customization.modifierPaise,
      ...(customization.labels.length > 0 && { customizations: customization.labels }),
    });
  }
  return { ok: true, validatedItems, resolvedDishes };
}

const quoteSchema = z.object({
  items: orderItemsSchema,
  pincode: z.string().min(4).max(16).optional(),
});

/**
 * POST /orders/quote
 *
 * Read-only pricing snapshot for the à-la-carte checkout (UX/UI Architecture
 * Phase 7: "Checkout must consume an immutable server-owned QuoteSnapshot").
 * Prices through the SAME validation helper and calculateCartTotals the
 * create path bills from, so the breakdown a customer reads equals the amount
 * they are charged. No auth, no DB writes, no idempotency — this creates
 * nothing. POST /orders remains the sole pricing authority at create time;
 * this endpoint only makes that same arithmetic visible before payment.
 */
router.post("/orders/quote", async (req: Request, res: Response) => {
  if (!alcCheckoutEnabled()) {
    res.status(403).json({
      error: "à-la-carte checkout is currently unavailable — please choose a plan",
      code: "alc_checkout_disabled",
    });
    return;
  }

  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const { items, pincode } = parsed.data;

  let resolver: Awaited<ReturnType<typeof makeBatchDishResolver>>;
  try {
    resolver = await makeBatchDishResolver();
  } catch (err) {
    req.log.error({ err }, "menuResolver unavailable at quote");
    res.status(503).json({ error: "menu unavailable, try again" });
    return;
  }

  // Guest-tolerant auth detection, same shape as the create path. The quote
  // screens with null prefs (a guest's declared prefs arrive only at create),
  // which still enforces the RD-review gate inside findDishSafetyBlock.
  const authUserId = req.isAuthenticated?.() ? req.user.id : null;
  const isGuest = authUserId === null;

  const validation = validateCartItems(items, resolver, null);
  if (!validation.ok) {
    res.status(validation.status).json(validation.body);
    return;
  }
  const { validatedItems, resolvedDishes } = validation;

  // Same premium gate as create, so a non-member learns at quote time — with
  // an editable cart in front of them — rather than at the payment step.
  try {
    const premiumSet = await getPremiumSlugSet();
    const cartHasPremium = resolvedDishes.some((d) => premiumSet.has(d.slug));
    if (cartHasPremium && (isGuest || !(await userIsPremium(authUserId!)))) {
      res.status(403).json({
        error: "premium membership required for one or more items",
        code: "premium_required",
      });
      return;
    }
  } catch (err) {
    req.log.error({ err }, "premium gate check failed at quote");
    res.status(503).json({ error: "premium gate unavailable, try again" });
    return;
  }

  const totals = calculateCartTotals(
    validatedItems.map((i) => ({ unitPrice: i.price, quantity: i.qty })),
  );

  res.json({
    status: "active",
    version: 1,
    expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    items: validatedItems.map((i) => ({
      id: i.id,
      name: i.name,
      qty: i.qty,
      unitPaise: i.price,
      linePaise: i.price * i.qty,
      ...(i.customizations && { customizations: i.customizations }),
    })),
    subtotalPaise: totals.subtotal,
    deliveryFeePaise: totals.deliveryFee,
    // Declared zeros, not omissions: packaging is bundled into dish prices and
    // no discount mechanism exists on this path. If either becomes real it
    // must come from here, never from client arithmetic.
    packagingPaise: 0,
    discountPaise: 0,
    taxPaise: totals.tax,
    payableNowPaise: totals.total,
    amountToFreeDeliveryPaise: totals.amountToFreeDelivery,
    etaMinutes: ORDER_ETA_MINUTES,
    serviceability: pincode
      ? { pincode: pincode.trim(), serviceable: isServiceablePincode(pincode) }
      : null,
  });
});

/**
 * POST /orders
 *
 * Guest checkout — no auth required. Creates a new order with server-side
 * price computation and returns a stable ETA. The client-supplied
 * `externalOrderId` acts as the idempotency key.
 */

router.post("/orders", async (req: Request, res: Response) => {
  if (!alcCheckoutEnabled()) {
    res.status(403).json({
      error: "à-la-carte checkout is currently unavailable — please choose a plan",
      code: "alc_checkout_disabled",
    });
    return;
  }

  const parsed = placeOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }

  const { externalOrderId, items, phone, address, consent, guestPrefs, allergenAck } = parsed.data;

  // DPDP consent gate: block order placement without an explicit acknowledgement.
  // This is the enforcement point the buyflow was missing (guest checkout could
  // place an order without ever consenting to health-data processing).
  if (!consent || consent.accepted !== true || !consent.policyVersion) {
    res.status(400).json({ error: "consent to the health-data policy is required to place an order", code: "consent_required" });
    return;
  }

  if (!isServiceablePincode(address.pincode)) {
    res.status(422).json({ error: "we do not deliver to this pincode yet", code: "unserviceable_pincode" });
    return;
  }

  let resolver: Awaited<ReturnType<typeof makeBatchDishResolver>>;
  try {
    resolver = await makeBatchDishResolver();
  } catch (err) {
    req.log.error({ err }, "menuResolver unavailable at checkout");
    res.status(503).json({ error: "menu unavailable, try again" });
    return;
  }

  // `?.()` (not a bare call): some test harnesses mount this router directly
  // on a bare Express app without Passport, where `isAuthenticated` is absent
  // — matches the guest-tolerant behaviour of the `(req as any).user?.id`
  // this replaced.
  const authUserId = req.isAuthenticated?.() ? req.user.id : null;
  const isGuest = authUserId === null;
  let authPrefs: PreferencesForMatch | null = null;
  if (authUserId) {
    // Decrypt-on-read: clinical arrays are envelope-encrypted at rest; the
    // safety gate below must compare plaintext allergens/conditions.
    const pRow = await getDecryptedPreferences(authUserId);
    if (pRow) {
      authPrefs = {
        allergens: pRow.allergens ?? [],
        dislikedIngredients: pRow.dislikedIngredients ?? [],
        medicalConditions: pRow.medicalConditions ?? [],
        cuisines: pRow.cuisines ?? [],
        dietaryStyle: pRow.dietaryStyle,
      };
    }
  }

  // Prefer saved authenticated prefs; otherwise fall back to a guest's declared
  // prefs (may be null). The strict safety gate below runs on EVERY checkout —
  // even with null prefs it enforces the RD-review gate — so a guest can no
  // longer bypass allergen/condition screening simply by not logging in.
  const effectivePrefs = authPrefs ?? normalizeGuestPrefs(guestPrefs);

  // Validate every item and build the server-authoritative cart — via the
  // same helper the quote endpoint prices through (display-equals-billed).
  const validation = validateCartItems(items, resolver, effectivePrefs);
  if (!validation.ok) {
    res.status(validation.status).json(validation.body);
    return;
  }
  const { validatedItems, resolvedDishes } = validation;

  // Server-side premium-meal gate, mirroring /orders/finalize's
  // (routes/loyalty.ts). Until the full-catalog à-la-carte opening
  // (2026-08-09) premium dishes were structurally unreachable here — they
  // were never in the curated hero set, so no storefront surface offered
  // them an Add button. Now every dish renders one, which makes THIS route
  // the enforcement point: premium dishes stay purchasable, but only by a
  // paying premium member. Guests can never hold a membership, so a guest
  // cart carrying a premium dish is refused outright. Fails CLOSED — a
  // resolver/db error rejects the order rather than silently letting
  // premium dishes through to non-members.
  try {
    const premiumSet = await getPremiumSlugSet();
    const cartHasPremium = resolvedDishes.some((d) => premiumSet.has(d.slug));
    if (cartHasPremium && (isGuest || !(await userIsPremium(authUserId!)))) {
      res.status(403).json({
        error: "premium membership required for one or more items",
        code: "premium_required",
      });
      return;
    }
  } catch (err) {
    req.log.error({ err }, "premium gate check failed");
    res.status(503).json({ error: "premium gate unavailable, try again" });
    return;
  }

  // Guest with no declared dietary info + a cart carrying allergen/contra dishes
  // must explicitly acknowledge allergen risk before we accept the order. This
  // turns a silent, structural skip into an informed decision.
  const ack = assessAllergenAck({ isGuest, effectivePrefs, cartDishes: resolvedDishes, allergenAck });
  if (ack.required) {
    res.status(422).json({
      error: "Please confirm you've reviewed the allergen information for this order.",
      code: "allergen_ack_required",
      allergens: ack.allergens,
      dishes: ack.dishes,
    });
    return;
  }

  // Server-side price computation.
  const totals = calculateCartTotals(
    validatedItems.map((i) => ({ unitPrice: i.price, quantity: i.qty }))
  );
  const totalPaise = totals.total;

  let row: { id: number };
  try {
    const inserted = await db
      .insert(ordersTable)
      .values({
        userId: authUserId,
        // Stated rather than defaulted: this is our own checkout, so the
        // channel is a decision here, not an accident of the column default.
        orderChannel: "own_app",
        externalOrderId,
        status: "placed",
        totalPaise,
        addressLabel: address.label ?? "Delivery address",
        addressLine: [address.line1, address.line2].filter(Boolean).join(", "),
        city: address.city,
        pincode: address.pincode,
        phone,
        items: validatedItems,
        fulfillmentType: "delivery",
      })
      .returning({ id: ordersTable.id });
    row = inserted[0]!;
  } catch (err) {
    // Postgres unique-constraint violation: duplicate externalOrderId for
    // the same userId (null for guests). PG error code 23505.
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("23505") || msg.includes("uniq_orders_user_external")) {
      res.status(409).json({ error: "duplicate order id", code: "duplicate_order" });
      return;
    }
    req.log.error({ err, externalOrderId }, "order insert failed");
    res.status(500).json({ error: "order creation failed" });
    return;
  }

  req.log.info({ externalOrderId, serverOrderId: row.id, totalPaise }, "guest order placed");

  // Record the DPDP consent as an audit trail (policy version, IP, UA,
  // timestamp). Authenticated users also get the consent stamped on their
  // profile ledger; a per-order snapshot for durable guest audit is a
  // follow-up migration.
  const consentAt = new Date();
  if (authUserId) {
    await db.update(usersTable).set({ dpdpConsentAt: consentAt }).where(eq(usersTable.id, authUserId));
  }
  req.log.info(
    {
      code: "dpdp_consent",
      serverOrderId: row.id,
      policyVersion: consent.policyVersion,
      ip: req.ip ?? null,
      ua: String(req.headers["user-agent"] ?? "").slice(0, 512),
      at: consentAt.toISOString(),
      authenticated: authUserId != null,
    },
    "dpdp consent recorded at checkout",
  );

  // No sendOrderConfirmation here, deliberately (paid-fulfilment invariant,
  // lib/paidGate.ts): this row was just inserted "placed" — unpaid — and the
  // WhatsApp/email template says "is confirmed... we are preparing your meal
  // now," which is false until payment settles. The capture writers
  // (routes/payments.ts verify/webhooks, lib/reconciliationScheduler.ts, the
  // verified zero-charge finalize) already send it on the placed→preparing
  // edge; sending it here as well means every abandoned or failed checkout
  // leaves the customer holding a confirmation for food nobody is cooking.

  res.status(201).json({
    orderId: externalOrderId,
    serverOrderId: row.id,
    status: "placed",
    etaMinutes: ORDER_ETA_MINUTES,
    totalPaise,
  });
});

/**
 * GET /orders/:externalOrderId/status
 *
 * No auth. Guests can poll their own order by the idempotency key they
 * generated at checkout. ETA counts down from the 25-minute SLA window.
 */
router.get("/orders/:externalOrderId/status", async (req: Request, res: Response) => {
  const externalOrderId = String(req.params.externalOrderId ?? "").trim();
  if (!externalOrderId) {
    res.status(400).json({ error: "missing order id" });
    return;
  }

  const rows = await db
    .select({ status: ordersTable.status, createdAt: ordersTable.createdAt })
    .from(ordersTable)
    .where(eq(ordersTable.externalOrderId, externalOrderId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "order not found" });
    return;
  }

  const etaMinutes = Math.max(
    0,
    25 - Math.floor((Date.now() - row.createdAt.getTime()) / 60000),
  );

  res.json({ orderId: externalOrderId, status: row.status, etaMinutes });
});

export default router;
