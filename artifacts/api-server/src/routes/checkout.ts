import { Router, type IRouter, type Request, type Response } from "express";
import { db, ordersTable, userPreferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { makeBatchDishResolver } from "../lib/menuResolver";
import { calculateCartTotals } from "../lib/cartMath";
import type { DishData } from "@workspace/menu-catalog";
import type { PreferencesForMatch } from "@workspace/preferences-match";
import {
  assessAllergenAck,
  findDishSafetyBlock,
  normalizeGuestPrefs,
} from "../lib/checkoutSafety";
import { isServiceablePincode, SERVICEABLE_PINCODES } from "@workspace/api-zod";
import { sendOrderConfirmation } from "../lib/orderNotification";

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

  const { externalOrderId, items, phone, address, guestPrefs, allergenAck } = parsed.data;

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

  const authUserId = (req as any).user?.id ?? null;
  const isGuest = authUserId === null;
  let authPrefs: PreferencesForMatch | null = null;
  if (authUserId) {
    const [pRow] = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, authUserId)).limit(1);
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
  const validatedItems: Array<{ id: number; name: string; qty: number; price: number }> = [];
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
    resolvedDishes.push(dish);
    validatedItems.push({ id: dish.id, name: dish.name, qty: item.qty, price: dish.price });
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
  void sendOrderConfirmation(row.id);

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
