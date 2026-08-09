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

const placeOrderSchema = z.object({
  externalOrderId: z.string().min(1).max(64),
  items: z
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
    .max(50),
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

  // Validate every item and build the server-authoritative cart.
  const validatedItems: Array<{
    id: number;
    name: string;
    qty: number;
    price: number;
    customizations?: string[];
  }> = [];
  const resolvedDishes: DishData[] = [];
  for (const item of items) {
    const dish = resolver.byId(item.dishId);
    if (!dish) {
      res.status(422).json({ error: `unknown dish: ${item.dishId}` });
      return;
    }
    if (!dish.isAvailable) {
      res.status(422).json({ error: `dish unavailable: ${dish.name}`, code: "dish_unavailable" });
      return;
    }
    const blockReasons = findDishSafetyBlock(dish, effectivePrefs);
    if (blockReasons) {
      res.status(422).json({
        error: "Safety block",
        code: "safety_block",
        blocked: true,
        reasons: blockReasons,
      });
      return;
    }

    const customization = resolveCustomizations(
      dish.customizations,
      item.customizations as CustomizationSelection[] | undefined,
    );
    if (!customization.ok) {
      res.status(422).json({
        error: `invalid customisation for ${dish.name}: ${customization.error}`,
        code: "invalid_customization",
      });
      return;
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
    etaMinutes: 25,
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
