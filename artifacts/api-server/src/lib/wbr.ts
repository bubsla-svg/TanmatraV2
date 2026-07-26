import { generateText } from "ai";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  db,
  wbrReportsTable,
  isMealOrderItem,
  menuItemsTable,
  ordersTable,
  packagingItemsTable,
  type WbrReport,
} from "@workspace/db";
import { DEFAULT_MODEL_ID, getModel } from "./ai/model";
import {
  buildDishCostIndex,
  lookupUnitFoodCostPaise,
  type DishCostIndex,
} from "./dishCostIndex";
import { logger } from "./logger";
import { loadDynamicRecipeCosts } from "./menuEngineering";

// All read paths in this file go through the curated `safe_*` views (see
// safeSql.ts / ensureSafeViews). The views expose only the non-PII columns
// the analytics pack is permitted to see, matching the same governance
// boundary the NL "Ask the data" surface uses.

export interface WbrInput {
  weekStart: Date;
  weekEnd: Date;
}

function isoMonday(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

export function lastFullWeek(now = new Date()): WbrInput {
  const thisMon = isoMonday(now);
  const weekStart = new Date(thisMon);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const weekEnd = new Date(thisMon);
  return { weekStart, weekEnd };
}

interface OrderSlice {
  orders: number;
  revenuePaise: number;
  uniqueUsers: number;
}

// Exported for wbr.channel.test.ts. The claim under test is that revenueMix
// partitions THE HEADLINE NUMBER — so the test has to compare against the
// function that produces the headline, not against a re-implementation of it
// that could drift in the same direction on the same day.
export async function aggregateWindow(start: Date, end: Date): Promise<OrderSlice> {
  const r = await db.execute<{ orders: number; revenue_paise: string; unique_users: number }>(
    sql`select count(*)::int as orders,
               coalesce(sum(total_paise), 0)::bigint as revenue_paise,
               count(distinct user_id)::int as unique_users
        from safe_orders
        where created_at >= ${start} and created_at < ${end}`,
  );
  const row = r.rows[0];
  return {
    orders: Number(row?.orders ?? 0),
    revenuePaise: Number(row?.revenue_paise ?? 0),
    uniqueUsers: Number(row?.unique_users ?? 0),
  };
}

async function ordersByDay(start: Date, end: Date) {
  const r = await db.execute<{ day: string; orders: number; revenue_paise: string }>(
    sql`select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
               count(*)::int as orders,
               coalesce(sum(total_paise), 0)::bigint as revenue_paise
        from safe_orders
        where created_at >= ${start} and created_at < ${end}
        group by 1 order by 1`,
  );
  return r.rows.map((row) => ({
    day: String(row.day),
    orders: Number(row.orders),
    revenuePaise: Number(row.revenue_paise),
  }));
}

/**
 * The composition of the revenue number above, by channel and kind.
 *
 * `aggregateWindow` sums `total_paise` over every row in the window, which is
 * every order the business touched — Zomato, Swiggy, POS walk-ins and
 * marketplace goods alongside our own storefront. That has always been true and
 * has never been visible: until `order_channel` and `order_kind` were added to
 * safe_orders, this file could not have filtered on them if it wanted to, and
 * neither could the "Ask the data" model working from the same views.
 *
 * This does NOT decide the attribution question — whether the headline
 * `revenuePaise` should exclude aggregator rows is an owner call, and silently
 * restating a number that has been published to Slack for weeks would be the
 * wrong way to raise it. It reports the mix so the call can be made from data.
 */
interface ChannelSlice {
  channel: string;
  orderKind: string;
  orders: number;
  revenuePaise: number;
}

// Exported for wbr.channel.test.ts: this is the unit that carries the claim
// (the breakdown partitions the headline total exactly), and asserting it
// through generateWbr would drag an LLM call into the test.
export async function revenueMix(start: Date, end: Date): Promise<ChannelSlice[]> {
  const r = await db.execute<{
    order_channel: string;
    order_kind: string;
    orders: number;
    revenue_paise: string;
  }>(
    sql`select order_channel, order_kind,
               count(*)::int as orders,
               coalesce(sum(total_paise), 0)::bigint as revenue_paise
        from safe_orders
        where created_at >= ${start} and created_at < ${end}
        group by 1, 2
        order by revenue_paise desc, order_channel`,
  );
  return r.rows.map((row) => ({
    channel: String(row.order_channel),
    orderKind: String(row.order_kind),
    orders: Number(row.orders),
    revenuePaise: Number(row.revenue_paise),
  }));
}

/**
 * Our own revenue: every kind, but only the channel that is our customers.
 * Deliberately not restricted to `meal` — an own-app marketplace order is as
 * much ours as an own-app meal is.
 */
export function ownAppRevenuePaise(mix: ChannelSlice[]): number {
  return mix
    .filter((s) => s.channel === "own_app")
    .reduce((sum, s) => sum + s.revenuePaise, 0);
}

async function topDishes(start: Date, end: Date) {
  const r = await db.execute<{ name: string; units: string }>(
    sql`select item->>'name' as name,
               sum((item->>'qty')::int) as units
        from safe_orders
        cross join lateral jsonb_array_elements(items) as item
        where created_at >= ${start} and created_at < ${end}
          and item->>'name' is not null
        group by 1
        order by units desc nulls last
        limit 5`,
  );
  return r.rows.map((row) => ({
    name: String(row.name),
    units: Number(row.units),
  }));
}

async function anomaliesFired(start: Date, end: Date): Promise<number> {
  const r = await db.execute<{ c: number }>(
    sql`select count(*)::int as c
        from safe_anomaly_alerts
        where created_at >= ${start} and created_at < ${end}`,
  );
  return Number(r.rows[0]?.c ?? 0);
}

function pctDelta(curr: number, prev: number): string {
  if (prev <= 0) return curr > 0 ? "new" : "0%";
  const d = ((curr - prev) / prev) * 100;
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d.toFixed(1)}%`;
}

/**
 * One sentence, present only when the headline revenue is not all ours.
 *
 * The point is that `revenuePaise` has always included aggregator and
 * marketplace rows and the commentary has always described it as if it did not.
 * Naming the gap is the smallest honest fix; changing the number is the owner's
 * call (claude/order-channel-split.md §6 row 7).
 */
export function mixCaveat(kpis: WbrReport["kpis"]): string {
  const own = kpis.ownAppRevenuePaise;
  if (own == null || kpis.revenuePaise <= 0 || own >= kpis.revenuePaise) return "";
  const otherPaise = kpis.revenuePaise - own;
  const share = (otherPaise / kpis.revenuePaise) * 100;
  const channels = (kpis.revenueMix ?? [])
    .filter((s) => s.channel !== "own_app" && s.revenuePaise > 0)
    .map((s) => s.channel);
  const named = [...new Set(channels)].join(", ");
  return `Of that revenue, ₹${(otherPaise / 100).toFixed(0)} (${share.toFixed(1)}%) came from orders we did not originate${named ? ` (${named})` : ""} — own-app revenue was ₹${(own / 100).toFixed(0)}.`;
}

function templateCommentary(kpis: WbrReport["kpis"]): string {
  return [
    `Last week we shipped ${kpis.orders} orders (${pctDelta(kpis.orders, kpis.ordersPrev)} vs the prior week) for ₹${(kpis.revenuePaise / 100).toFixed(0)} revenue (${pctDelta(kpis.revenuePaise, kpis.revenuePaisePrev)}).`,
    `Active customers: ${kpis.activeCustomers} (${pctDelta(kpis.activeCustomers, kpis.activeCustomersPrev)}). AOV ₹${(kpis.avgOrderPaise / 100).toFixed(0)}.`,
    kpis.topDishes.length
      ? `Top dishes: ${kpis.topDishes.map((d) => `${d.name} (${d.units})`).join(", ")}.`
      : "",
    kpis.anomaliesFired
      ? `${kpis.anomaliesFired} metric anomalies fired — review on the Ops page.`
      : "No anomalies fired this week.",
    // Only says anything when there is something to say. A week that is wholly
    // own-app reads exactly as it did before this branch; a week that is not
    // stops looking like one.
    mixCaveat(kpis),
  ]
    .filter(Boolean)
    .join(" ");
}

async function aiCommentary(kpis: WbrReport["kpis"]): Promise<{ text: string; modelId: string }> {
  try {
    const { text } = await generateText({
      model: getModel(DEFAULT_MODEL_ID),
      system:
        "You are an analyst writing a short weekly business review for a wellness food brand. 4-6 sentences. Lead with the headline number, mention week-over-week change, call out one risk and one opportunity. No emoji.",
      prompt: `KPIs (paise = 1/100 INR):\n${JSON.stringify(kpis, null, 2)}`,
      temperature: 0.4,
    });
    if (text.trim()) return { text: text.trim(), modelId: DEFAULT_MODEL_ID };
  } catch (err) {
    logger.warn({ err }, "wbr ai commentary failed; using template");
  }
  return { text: templateCommentary(kpis), modelId: "template" };
}

export interface WeeklyMarginResult {
  marginPct: number;
  totalCostPaise: number;
  foodCostPaise: number;
  /** Units whose food cost came from a costed recipe — i.e. measured. */
  measuredUnits: number;
  /** Units costed from the default-margin assumption instead. */
  estimatedUnits: number;
  /** Units that contributed no food cost at all: no recipe, no price. */
  uncostedUnits: number;
  /** measuredUnits as a share of all units, 0–100 with one decimal. */
  foodCostCoveragePct: number;
  /** Distinct order-line names that matched no menu item, capped for logging. */
  unmatchedItemNames: string[];
}

/**
 * Net margin for a window, and — just as important — how much of it was
 * measured rather than assumed.
 *
 * The margin here is not decoration. `/analytics/wbr/simulate` turns it into
 * `thresholdAlert: marginPct < 35`, so it is the trigger for the alarm that is
 * supposed to tell the business its unit economics have gone underwater.
 * Before this function resolved dish names correctly, the food cost of nearly
 * every line silently resolved to zero, the reported margin ran roughly thirty
 * points high, and that alarm could not ring. An alarm wired to a number that
 * cannot reach the threshold is worse than no alarm, because it reads as an
 * all-clear. `foodCostCoveragePct` is what lets a reader tell the two apart.
 */
export async function calculateWeeklyMargins(
  start: Date,
  end: Date,
  fuelFactor = 1.0,
): Promise<WeeklyMarginResult> {
  const foodCostMap = await loadDynamicRecipeCosts();
  const menuItems = await db
    .select({
      slug: menuItemsTable.slug,
      name: menuItemsTable.name,
      pricePaise: menuItemsTable.pricePaise,
    })
    .from(menuItemsTable);
  // Order lines carry a display name; recipe costs are keyed by slug. The
  // index owns that translation so it is done once, one way, and testably.
  const costIndex: DishCostIndex = buildDishCostIndex(menuItems, foodCostMap);
  const packaging = await db.select().from(packagingItemsTable);
  const avgPackCostPaise =
    packaging.length > 0
      ? Math.round(
          packaging.reduce(
            (sum, item) => sum + (item.pricePerPiecePaise ?? 0),
            0,
          ) / packaging.length,
        )
      : 1500;

  const orders = await db
    .select({
      id: ordersTable.id,
      totalPaise: ordersTable.totalPaise,
      items: ordersTable.items,
    })
    .from(ordersTable)
    .where(
      and(
        gte(ordersTable.createdAt, start),
        sql`${ordersTable.createdAt} < ${end}`,
        eq(ordersTable.orderKind, "meal"),
      ),
    );

  let grossRevenuePaise = 0;
  let totalCostPaise = 0;
  let foodCostPaise = 0;
  let measuredUnits = 0;
  let estimatedUnits = 0;
  let uncostedUnits = 0;
  const unmatched = new Set<string>();

  for (const order of orders) {
    grossRevenuePaise += order.totalPaise;

    let orderFoodCostPaise = 0;
    let orderPackCostPaise = 0;
    if (Array.isArray(order.items)) {
      for (const it of order.items) {
        if (!it || typeof it !== "object") continue;
        const qty = Math.max(1, Math.round(Number(it.qty ?? 1)));
        // Packaging and delivery arithmetic is untouched by this change: one
        // packed unit is one packed unit whether or not we know its recipe.
        orderPackCostPaise += avgPackCostPaise * qty;

        const rawName = String(it.name ?? "");
        // The query filters orderKind = 'meal', so every line should be a meal
        // line; the narrowing is what makes `it.price` type-safe to read.
        const linePricePaise = isMealOrderItem(it)
          ? Math.max(0, Math.round(Number(it.price ?? 0)))
          : 0;
        const resolved = lookupUnitFoodCostPaise(
          costIndex,
          rawName,
          linePricePaise,
        );
        if (resolved.slug === null && rawName) unmatched.add(rawName);
        if (resolved.basis === "recipe") measuredUnits += qty;
        else if (resolved.basis === "estimate") estimatedUnits += qty;
        else uncostedUnits += qty;
        orderFoodCostPaise += resolved.costPaise * qty;
      }
    }

    const orderDeliveryCostPaise = Math.round(4500 * fuelFactor);
    foodCostPaise += orderFoodCostPaise;
    totalCostPaise +=
      orderFoodCostPaise + orderPackCostPaise + orderDeliveryCostPaise;
  }

  const netMarginPct =
    grossRevenuePaise > 0
      ? Math.round(((grossRevenuePaise - totalCostPaise) / grossRevenuePaise) * 1000) / 10
      : 0;

  const totalUnits = measuredUnits + estimatedUnits + uncostedUnits;
  const foodCostCoveragePct =
    totalUnits > 0 ? Math.round((measuredUnits / totalUnits) * 1000) / 10 : 0;

  if (totalUnits > 0 && measuredUnits < totalUnits) {
    logger.warn(
      {
        coveragePct: foodCostCoveragePct,
        measuredUnits,
        estimatedUnits,
        uncostedUnits,
        unmatchedItemNames: [...unmatched].slice(0, 20),
      },
      "weekly margin: some units had no costed recipe — the reported net margin is part assumption, and the 35% threshold alert is only as trustworthy as this coverage",
    );
  }

  return {
    marginPct: netMarginPct,
    totalCostPaise,
    foodCostPaise,
    measuredUnits,
    estimatedUnits,
    uncostedUnits,
    foodCostCoveragePct,
    unmatchedItemNames: [...unmatched].slice(0, 50),
  };
}

export async function generateWbr(input?: Partial<WbrInput>): Promise<WbrReport> {
  const { weekStart, weekEnd } = {
    ...lastFullWeek(),
    ...input,
  } as WbrInput;
  const prevStart = new Date(weekStart);
  prevStart.setUTCDate(prevStart.getUTCDate() - 7);
  const prevEnd = new Date(weekStart);

  const [curr, prev, byDay, top, fired, marginDetails, mix, mixPrev] = await Promise.all([
    aggregateWindow(weekStart, weekEnd),
    aggregateWindow(prevStart, prevEnd),
    ordersByDay(weekStart, weekEnd),
    topDishes(weekStart, weekEnd),
    anomaliesFired(weekStart, weekEnd),
    calculateWeeklyMargins(weekStart, weekEnd),
    revenueMix(weekStart, weekEnd),
    revenueMix(prevStart, prevEnd),
  ]);

  const kpis: WbrReport["kpis"] = {
    orders: curr.orders,
    ordersPrev: prev.orders,
    revenuePaise: curr.revenuePaise,
    revenuePaisePrev: prev.revenuePaise,
    activeCustomers: curr.uniqueUsers,
    activeCustomersPrev: prev.uniqueUsers,
    avgOrderPaise: curr.orders > 0 ? Math.round(curr.revenuePaise / curr.orders) : 0,
    topDishes: top,
    anomaliesFired: fired,
    netMarginPct: marginDetails.marginPct,
    // `revenuePaise` above is every channel and every kind, unchanged. These
    // two say what is inside it. `netMarginPct` has the same exposure and is
    // NOT corrected here: it divides an all-channel gross by our own cost model
    // (calculateWeeklyMargins filters order_kind = 'meal' but no channel), so
    // an aggregator week reads as a margin on revenue we did not price. That is
    // the same attribution decision, and it belongs with the same owner.
    revenueMix: mix,
    ownAppRevenuePaise: ownAppRevenuePaise(mix),
    ownAppRevenuePaisePrev: ownAppRevenuePaise(mixPrev),
    // Published alongside the margin on purpose. The commentary prompt below
    // is handed the whole kpis object, so the model can see — and say — when
    // the headline margin rests on assumed food costs rather than measured
    // ones. A margin without its coverage is a number without its error bar.
    foodCostCoveragePct: marginDetails.foodCostCoveragePct,
  };
  const chartSpec = {
    revenueByDay: byDay.map((d) => ({ day: d.day, revenuePaise: d.revenuePaise })),
    ordersByDay: byDay.map((d) => ({ day: d.day, orders: d.orders })),
  };
  const { text: commentary, modelId } = await aiCommentary(kpis);

  const [row] = await db
    .insert(wbrReportsTable)
    .values({ weekStart, weekEnd, kpis, chartSpec, commentary, modelId })
    .onConflictDoUpdate({
      target: wbrReportsTable.weekStart,
      set: { weekEnd, kpis, chartSpec, commentary, modelId },
    })
    .returning();
  if (!row) throw new Error("wbr insert failed");
  return row;
}

export async function listWbrReports(limit = 12): Promise<WbrReport[]> {
  return db
    .select()
    .from(wbrReportsTable)
    .orderBy(desc(wbrReportsTable.weekStart))
    .limit(limit);
}

export async function getWbrReport(id: number): Promise<WbrReport | null> {
  const [row] = await db
    .select()
    .from(wbrReportsTable)
    .where(eq(wbrReportsTable.id, id))
    .limit(1);
  return row ?? null;
}
