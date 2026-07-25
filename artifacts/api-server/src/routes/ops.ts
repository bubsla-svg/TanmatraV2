import {
  Router,
  type IRouter,
  type NextFunction,
  type Request,
  type Response,
} from "express";
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
import { executeBomExplosion as executeBom, generateMorningPrepBrief } from "../lib/bomEngine";
import { scanAndExecuteRiderFallbacks } from "../lib/logisticsEngine";
import { evaluateWholesalePriceSpike } from "../lib/marginGuardrailEngine";

const router: IRouter = Router();

/**
 * Ops scope is required for EVERY route on this router, enforced here as
 * router-level middleware rather than as a call at the top of each handler.
 *
 * That distinction is not stylistic. The per-handler form shipped four routes
 * without the guard — `/inventory`, `/packaging`, `/recipes` and
 * `/recipes/:slug` — which served the full inventory list, the packaging list
 * and the recipe book (`food_cost_paise`, i.e. our unit economics, included) to
 * any unauthenticated caller who could reach the API. Nothing flagged it,
 * because "did the author remember to write one line?" is not a checkable
 * invariant. "Is there a router.use gate?" is.
 *
 * gateRequireOps sends its own 403 and returns null on failure, so a rejected
 * request must NOT call next().
 */
router.use((req: Request, res: Response, next: NextFunction) => {
  if (gateRequireOps(req, res) === null) return; // 403 already written
  next();
});

router.get("/anomalies", async (req: Request, res: Response) => {
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

router.post("/anomalies/scan", async (_req: Request, res: Response) => {
  const results = await runAnomalyScan();
  res.json({ results });
});

const idParam = z.object({ id: z.coerce.number().int().positive() });
const snoozeBody = z.object({
  minutes: z.number().int().positive().max(24 * 60),
});

router.post("/anomalies/:id/ack", async (req: Request, res: Response) => {
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

router.get("/anomalies/digest", async (_req: Request, res: Response) => {
  const digest = await buildDailyDigest();
  res.json(digest);
});

router.post("/anomalies/digest/send", async (_req: Request, res: Response) => {
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
 * The statuses a ticket can be in while it is still food the kitchen owes
 * someone. Shared deliberately by the board query and the ready mutation
 * below: those two predicates ARE the contract — a ticket the board cannot
 * show must not be a ticket the board can advance — and when they were
 * written out separately they silently drifted apart. Change them together
 * or not at all. Pinned by routes/ops.kds.test.ts.
 */
const KDS_BOARD_STATUSES = ["placed", "preparing"];

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
// No per-handler gate call here: the router.use above covers every route on
// this router, and the per-handler form is exactly what let four routes ship
// unguarded. `_req` because the gate now reads the request, not the handler.
router.get("/kds/orders", async (_req: Request, res: Response) => {
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
        inArray(ordersTable.status, KDS_BOARD_STATUSES),
        eq(ordersTable.orderKind, "meal"),
        eq(ordersTable.orderChannel, "own_app"),
      ),
    )
    .orderBy(asc(ordersTable.createdAt));
  res.json({ orders: rows });
});

router.post("/kds/orders/:id/ready", async (req: Request, res: Response) => {
  const orderId = parseInt(String(req.params.id ?? ""), 10);
  // parseInt("abc") is NaN, and an unguarded NaN reaches Postgres as an
  // invalid integer literal — the driver throws and Express answers with a
  // 500 HTML error page. An id that is not an id is not on the board; say so
  // in the same shape as every other off-board answer.
  if (!Number.isInteger(orderId)) {
    res
      .status(404)
      .json({ ok: false, error: "no such order on this board", code: "order_not_on_board" });
    return;
  }
  // Mirrors the board query's predicate exactly — same statuses, same kind,
  // same channel. A ticket the board cannot show must not be a ticket the
  // board can advance, otherwise the guard on the read side is decoration
  // that any client holding an order id can step around.
  //
  // The status clause is the one that is easy to leave out, and leaving it
  // out is not a cosmetic bug: without it this UPDATE matches a row in ANY
  // status, so a stale kitchen tab could drag a `delivered` order back to
  // `ready`, or resurrect a `cancelled` one onto the board to be cooked. It
  // also made the 404 below unreachable for the case it exists to report —
  // a second click on an already-advanced ticket re-set `ready` to `ready`,
  // matched a row, and answered `{ok:true}`.
  const advanced = await db
    .update(ordersTable)
    .set({ status: "ready" })
    .where(
      and(
        eq(ordersTable.id, orderId),
        inArray(ordersTable.status, KDS_BOARD_STATUSES),
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

// Phase 1A: 4:00 AM Morning Brief prep aggregation for expediter KDS terminals
router.get("/kds/prep-brief", async (req: Request, res: Response) => {
  const dateStr = (req.query["forDate"] as string) || new Date().toISOString().slice(0, 10);
  try {
    const summary = await generateMorningPrepBrief(dateStr);
    res.json({ forDate: dateStr, stationPrep: summary });
  } catch (err) {
    logger.error({ err }, "ops.kds.prep_brief_failed");
    res.status(500).json({ error: "Failed to assemble morning prep brief" });
  }
});

const bomExplodeSchema = z.object({
  items: z.array(
    z.object({
      dishSlug: z.string().min(1),
      quantity: z.number().int().positive().default(1),
    })
  ),
});

// Phase 1A: Autonomous runtime BOM explosion and predictive PO replenishment trigger
router.post("/kds/orders/:id/explode-bom", async (req: Request, res: Response) => {
  const parsed = bomExplodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "malformed order items for BOM explosion" });
    return;
  }

  try {
    const results = await executeBom(parsed.data.items);
    res.json({ ok: true, deductions: results });
  } catch (err) {
    logger.error({ err, orderId: req.params.id }, "ops.kds.bom_explosion_failed");
    res.status(500).json({ error: "Failed to execute BOM explosion and inventory deduction" });
  }
});

// Phase 2: Autonomous Logistics Fallback & Rider Geotracking DLQ trigger
router.all("/logistics/scan-fallbacks", async (_req: Request, res: Response) => {
  try {
    const interventions = await scanAndExecuteRiderFallbacks(24);
    res.json({ ok: true, interventions });
  } catch (err) {
    logger.error({ err }, "ops.logistics.fallback_scan_failed");
    res.status(500).json({ error: "Failed to scan logistics delivery queues" });
  }
});

const wholesaleSpikeSchema = z.object({
  inventoryItemId: z.number().int().positive(),
  newUnitPricePaise: z.number().int().positive(),
});

// Phase 3: Dynamic Wholesale Margin Protection Guardrail
router.post("/logistics/evaluate-wholesale-spike", async (req: Request, res: Response) => {
  const parsed = wholesaleSpikeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "malformed parameters for wholesale cost evaluation" });
    return;
  }
  try {
    const result = await evaluateWholesalePriceSpike(parsed.data.inventoryItemId, parsed.data.newUnitPricePaise);
    if (!result) {
      res.status(404).json({ error: "Inventory item not located" });
      return;
    }
    res.json({ ok: true, evaluation: result });
  } catch (err) {
    logger.error({ err }, "ops.guardrail.wholesale_spike_error");
    res.status(500).json({ error: "Failed to evaluate wholesale price margin guardrail" });
  }
});

export default router;
