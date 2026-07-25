import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import {
  db,
  inventoryItemsTable,
  packagingItemsTable,
  recipesTable,
  recipeIngredientsTable,
  ordersTable,
  kitchenStockTable,
  supplierBatchesTable,
} from "@workspace/db";
import { and, asc, eq, ilike, or, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import {
  ackAlert,
  buildDailyDigest,
  closeAlert,
  listAlerts,
  runAnomalyScan,
  snoozeAlert,
} from "../lib/anomalies";
import { sendDailyDigest } from "../lib/anomalyDigestSender";
import { requireOps as gateRequireOps } from "../lib/adminGate";
import { sendDeliveryDelaySms } from "../lib/sms";

const router: IRouter = Router();

function requireOps(req: Request, res: Response): boolean {
  return gateRequireOps(req, res) !== null;
}

router.get("/anomalies", async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const status = (typeof req.query.status === "string" ? req.query.status : "active") as
    | "open"
    | "ack"
    | "snoozed"
    | "closed"
    | "active";
  const limit = parseInt(String(req.query.limit ?? "50"), 10) || 50;
  const rows = await listAlerts({ status, limit });
  res.json({ rows });
});

router.post("/anomalies/scan", async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const results = await runAnomalyScan();
  res.json({ results });
});

const idParam = z.object({ id: z.coerce.number().int().positive() });
const snoozeBody = z.object({
  minutes: z.number().int().positive().max(24 * 60),
});

router.post("/anomalies/:id/ack", async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const parsed = idParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const row = await ackAlert(parsed.data.id, req.user?.id ?? null);
  if (!row) {
    res.status(404).json({ error: "alert not found" });
    return;
  }
  res.json({ alert: row });
});

router.post("/anomalies/:id/snooze", async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const idP = idParam.safeParse(req.params);
  const bodyP = snoozeBody.safeParse(req.body);
  if (!idP.success || !bodyP.success) {
    res.status(400).json({ error: "invalid payload" });
    return;
  }
  const row = await snoozeAlert(
    idP.data.id,
    bodyP.data.minutes,
    req.user?.id ?? null,
  );
  if (!row) {
    res.status(404).json({ error: "alert not found" });
    return;
  }
  res.json({ alert: row });
});

router.post("/anomalies/:id/close", async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const parsed = idParam.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  const row = await closeAlert(parsed.data.id, req.user?.id ?? null);
  if (!row) {
    res.status(404).json({ error: "alert not found" });
    return;
  }
  res.json({ alert: row });
});

router.get("/anomalies/digest", async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const digest = await buildDailyDigest();
  res.json(digest);
});

router.post("/anomalies/digest/send", async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const out = await sendDailyDigest();
  res.json(out);
});

router.get("/packaging", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(packagingItemsTable)
    .orderBy(asc(packagingItemsTable.itemNo));
  res.json({ items: rows });
});

router.get("/measurements", (_req: Request, res: Response) => {
  res.json({
    weight: {
      base: { kg: 1, gm: 1000 },
      conversions: [
        { name: "1 cup", grams: 120 },
        { name: "1/2 cup", grams: 60 },
        { name: "1/4 cup", grams: 30 },
        { name: "1 tablespoon", grams: 8 },
        { name: "1/2 tablespoon", grams: 4 },
        { name: "1 teaspoon", grams: 3 },
        { name: "1/2 teaspoon", grams: 1.5 },
      ],
    },
    volume: {
      base: { ltr: 1, ml: 1000 },
      conversions: [
        { name: "1 cup", ml: 240 },
        { name: "1/2 cup", ml: 120 },
        { name: "1/4 cup", ml: 60 },
        { name: "1 tablespoon", ml: 15 },
        { name: "1/2 tablespoon", ml: 7.5 },
        { name: "1 teaspoon", ml: 5 },
        { name: "1/2 teaspoon", ml: 2.5 },
      ],
    },
  });
});

router.get("/inventory", async (req: Request, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const baseQuery = db.select().from(inventoryItemsTable);
  const rows = q
    ? await baseQuery
        .where(ilike(inventoryItemsTable.product, `%${q}%`))
        .orderBy(asc(inventoryItemsTable.itemNo))
    : await baseQuery.orderBy(asc(inventoryItemsTable.itemNo));
  res.json({ items: rows });
});

router.get("/recipes", async (req: Request, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const baseQuery = db
    .select({
      id: recipesTable.id,
      recipeNo: recipesTable.recipeNo,
      name: recipesTable.name,
      slug: recipesTable.slug,
      servingSize: recipesTable.servingSize,
      foodCostPaise: recipesTable.foodCostPaise,
    })
    .from(recipesTable);
  const rows = q
    ? await baseQuery
        .where(or(ilike(recipesTable.name, `%${q}%`), ilike(recipesTable.slug, `%${q}%`)))
        .orderBy(asc(recipesTable.recipeNo))
    : await baseQuery.orderBy(asc(recipesTable.recipeNo));
  res.json({ recipes: rows });
});

router.get("/recipes/:slug", async (req: Request, res: Response) => {
  const [recipe] = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.slug, String(req.params["slug"] ?? "")))
    .limit(1);
  if (!recipe) {
    res.status(404).json({ error: "recipe not found" });
    return;
  }
  const ingredients = await db
    .select()
    .from(recipeIngredientsTable)
    .where(eq(recipeIngredientsTable.recipeId, recipe.id))
    .orderBy(asc(recipeIngredientsTable.position));
  res.json({ recipe, ingredients });
});

/**
 * The kitchen display board — and the place the "two boards" decision lives.
 *
 * One kitchen, two screens: this board shows the orders that arrived through
 * our app, Petpooja's own screen shows the orders that arrived through
 * Petpooja (aggregator, counter, phone). Every ticket is on exactly one board,
 * none on both, none on neither — which is the property that makes two boards
 * safe rather than merely tolerable.
 *
 * The alternative — one board with a channel badge per ticket — is a better
 * product and a one-line change here (drop the orderChannel predicate). It is
 * NOT safe yet: POST /petpooja/saveorder has no idempotency guard, so a
 * retried push writes the same order two or three times and the kitchen would
 * cook it two or three times. Do that branch first. See §5 of
 * claude/order-channel-split.md.
 */
router.get("/kds/orders", async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const rows = await db
    .select({
      id: ordersTable.id,
      externalOrderId: ordersTable.externalOrderId,
      status: ordersTable.status,
      items: ordersTable.items,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .where(
      and(
        inArray(ordersTable.status, ["placed", "preparing"]),
        eq(ordersTable.orderKind, "meal"),
        eq(ordersTable.orderChannel, "own_app"),
      ),
    )
    .orderBy(asc(ordersTable.createdAt));
  res.json({ orders: rows });
});

router.post("/kds/orders/:id/ready", async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const orderId = parseInt(String(req.params.id ?? ""), 10);
  // Mirrors the queue's predicate. A board that cannot show a ticket must not
  // be able to advance it either — otherwise the guard above is decoration
  // that any client holding an order id can step around.
  const advanced = await db
    .update(ordersTable)
    .set({ status: "ready" })
    .where(
      and(
        eq(ordersTable.id, orderId),
        eq(ordersTable.orderKind, "meal"),
        eq(ordersTable.orderChannel, "own_app"),
      ),
    )
    .returning({ id: ordersTable.id });
  // This used to answer `{ok:true}` unconditionally, so a click on a ticket
  // that had already left the board reported success and changed nothing.
  // Adding a predicate makes that silent no-op reachable in a new way — a
  // stale board, an aggregator ticket — so the endpoint now says which
  // happened. Ops needs to know the food was not in fact marked ready.
  if (advanced.length === 0) {
    res.status(404).json({ ok: false, error: "no such order on this board", code: "order_not_on_board" });
    return;
  }
  res.json({ ok: true });
});

const deliveryBatchSchema = z.object({
  product: z.string().min(1),
  farmOrigin: z.string().min(1),
  harvestDate: z.string().min(1),
  batchCode: z.string().min(1),
  quantity: z.number().positive(),
});

router.post("/supplier/deliver", async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const parsed = deliveryBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid payload", issues: parsed.error.issues });
    return;
  }
  const { product, farmOrigin, harvestDate, batchCode, quantity } = parsed.data;
  // Generate a scannable barcode token that uniquely identifies this crate.
  const barcodeToken = `BARCODE-${product.toUpperCase().slice(0, 3)}-${Date.now()}`;

  // Persist the delivery batch so the ISO audit trail (farm origin, harvest
  // date, batch code) is durable rather than echoed back and dropped.
  const [batch] = await db
    .insert(supplierBatchesTable)
    .values({
      product,
      farmOrigin,
      harvestDate,
      batchCode,
      quantity,
      barcodeToken,
      status: "delivered",
    })
    .returning();

  res.json({
    ok: true,
    id: batch.id,
    barcodeToken,
    product,
    farmOrigin,
    harvestDate,
    batchCode,
    quantity,
    status: batch.status,
  });
});

const intakeSchema = z.object({
  barcodeToken: z.string().min(1),
});

router.post("/supplier/intake", async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const parsed = intakeSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "missing barcodeToken", issues: parsed.error.issues });
    return;
  }
  const { barcodeToken } = parsed.data;

  // Resolve the crate by its scanned token so the traceability fields
  // (farm origin, harvest date, batch code) captured at delivery are
  // preserved and linked to this intake rather than dropped.
  const batches = await db
    .select()
    .from(supplierBatchesTable)
    .where(eq(supplierBatchesTable.barcodeToken, barcodeToken))
    .limit(1);

  if (batches.length === 0) {
    res
      .status(404)
      .json({ error: `barcode not recognised: ${barcodeToken}` });
    return;
  }

  const batch = batches[0];
  const product = batch.product;
  const quantity = batch.quantity;

  // Find inventory item matching this product (e.g. Spinach)
  const items = await db
    .select()
    .from(inventoryItemsTable)
    .where(ilike(inventoryItemsTable.product, `%${product}%`))
    .limit(1);

  if (items.length === 0) {
    res.status(404).json({ error: `inventory item not found: ${product}` });
    return;
  }

  const item = items[0];

  // Update kitchen stock balance
  const stocks = await db
    .select()
    .from(kitchenStockTable)
    .where(eq(kitchenStockTable.inventoryItemId, item.id))
    .limit(1);

  if (stocks.length === 0) {
    // If no stock record exists yet, insert a default one
    await db.insert(kitchenStockTable).values({
      inventoryItemId: item.id,
      onHandQty: quantity,
      zone: "default",
      unit: "kg",
      parLevel: 10,
      reorderQty: 20,
    });
  } else {
    // Update existing stock
    await db
      .update(kitchenStockTable)
      .set({
        onHandQty: stocks[0].onHandQty + quantity,
      })
      .where(eq(kitchenStockTable.id, stocks[0].id));
  }

  // Link intake back to the traceability record: mark the crate received.
  const [received] = await db
    .update(supplierBatchesTable)
    .set({ status: "received", receivedAt: new Date() })
    .where(eq(supplierBatchesTable.id, batch.id))
    .returning();

  res.json({
    ok: true,
    product,
    added: quantity,
    barcodeToken,
    batch: {
      id: received.id,
      status: received.status,
      receivedAt: received.receivedAt,
      farmOrigin: received.farmOrigin,
      harvestDate: received.harvestDate,
      batchCode: received.batchCode,
    },
  });
});

router.post("/kds/orders/:id/simulate-delay", async (req: Request, res: Response) => {
  if (!requireOps(req, res)) return;
  const orderId = parseInt(String(req.params.id ?? ""), 10);
  
  // Set createdAt to 25 minutes ago
  const delayedTime = new Date(Date.now() - 25 * 60_000);
  
  await db
    .update(ordersTable)
    .set({ createdAt: delayedTime })
    .where(eq(ordersTable.id, orderId));

  // Attempt a real delay-alert SMS. Today no transactional SMS provider is
  // wired (see lib/sms.ts), so this is a no-op that returns sent:false — we
  // only report smsSent:true when a message was actually dispatched.
  const delayMessage = `Delay Alert for Order #${orderId}: Your Tanmatra wrap is taking a bit longer to prepare due to peak demand. Rest assured, our kitchen is crafting it now!`;
  const smsResult = await sendDeliveryDelaySms({ orderId, message: delayMessage });

  if (!smsResult.sent) {
    logger.warn(
      { orderId, reason: smsResult.reason },
      "ops.simulate_delay.delay_sms_not_sent",
    );
    res.json({
      ok: true,
      smsSent: false,
      reason: smsResult.reason ?? "no transactional SMS provider configured",
      newCreatedAt: delayedTime,
    });
    return;
  }

  res.json({ ok: true, smsSent: true, newCreatedAt: delayedTime });
});

export default router;
