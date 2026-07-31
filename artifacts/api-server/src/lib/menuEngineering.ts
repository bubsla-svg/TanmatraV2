import { and, desc, eq, gte, sql } from "drizzle-orm";
import { generateText } from "ai";
import {
  db,
  menuItemsTable,
  menuEngineeringRunsTable,
  menuEngineeringDishStatsTable,
  ordersTable,
  isMealOrderItem,
  pricingSuggestionsTable,
  recipesTable,
  recipeIngredientsTable,
  inventoryItemsTable,
  type DishClassification,
  type DishRecommendation,
  type MenuEngineeringDishStat,
  type MenuEngineeringRun,
  type PricingSuggestion,
  type PricingSuggestionStatus,
} from "@workspace/db";
import { DISHES } from "@workspace/menu-catalog";
import { DEFAULT_MODEL_ID, getModel } from "./ai/model";
import { logger } from "./logger";
import { findBySlug, updatePrice } from "./menu";
import { recordOpsAction } from "./opsAudit";

// ---- Domain helpers ----------------------------------------------------------

export type Daypart = "breakfast" | "lunch" | "snacks" | "dinner";

export function dayPartFromHour(hour: number): Daypart {
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snacks";
  return "dinner";
}

// Lightweight zoning by Indian PIN prefix. Real geocoding is out of scope
// here; we just need a stable bucket per address for elasticity slicing.
export function zoneFromPincode(pin: string | null | undefined): string {
  if (!pin) return "unzoned";
  const trimmed = pin.replace(/\D/g, "").slice(0, 6);
  if (trimmed.length < 3) return "unzoned";
  return `pin-${trimmed.slice(0, 3)}`;
}

// ---- Stat aggregation --------------------------------------------------------

interface DishAccumulator {
  slug: string;
  name: string;
  ordersCount: number;
  unitsSold: number;
  revenuePaise: number;
  marginPaise: number;
}

/**
 * A food cost in paise, or `null` meaning "we could not establish one".
 *
 * The distinction is load-bearing. Food does not cost zero, so a zero here is
 * never a measurement — it is the absence of one. Conflating the two is how a
 * dish with no matched ingredients came to be scored at 100% margin, ranked a
 * star, and handed a +5% price rise. See `costPerUnitPaise` below.
 */
export type FoodCostPaise = number | null;

/**
 * Margin assumed when no food cost is known. It is a placeholder, not a
 * finding — every dish scored on it is scored on the same guess.
 */
export const DEFAULT_MARGIN_PCT = 0.35;
const DEFAULT_MARGIN_PCT_LABEL = `${Math.round(DEFAULT_MARGIN_PCT * 100)}%`;

function parseGrams(text: string): number {
  const match = text.match(/(\d+)\s*g/i);
  return match ? parseInt(match[1], 10) : 0;
}

interface PricedItem {
  slug: string;
  name: string;
  pricePaise: number;
  foodCostPaise: FoodCostPaise;
}

/**
 * Per-recipe food cost, keyed by recipe slug.
 *
 * Returns `null` for any recipe whose cost we could not establish — no
 * ingredient matched an inventory row, the quantities did not parse, the
 * matched inventory rows carry no price, and `recipes.food_cost_paise` is unset
 * or zero. Callers MUST NOT coerce that null to 0; see `costPerUnitPaise`.
 */
export async function loadDynamicRecipeCosts(): Promise<
  Map<string, FoodCostPaise>
> {
  const recipes = await db.select().from(recipesTable);
  const ingredients = await db.select().from(recipeIngredientsTable);
  const inventory = await db.select().from(inventoryItemsTable);

  const recipeCostMap = new Map<string, FoodCostPaise>();
  const unknown: string[] = [];

  // Group ingredients by recipe once instead of re-filtering the whole
  // ingredient list per recipe (was O(recipes × ingredients)).
  const ingredientsByRecipe = new Map<number, typeof ingredients>();
  for (const ing of ingredients) {
    const list = ingredientsByRecipe.get(ing.recipeId);
    if (list) list.push(ing);
    else ingredientsByRecipe.set(ing.recipeId, [ing]);
  }

  // The ingredient→inventory match is a two-way fuzzy substring test, so it
  // cannot become a hash lookup without changing which row wins. Memoise it
  // by ingredient name instead: the same names recur across recipes, so this
  // collapses O(ingredients × inventory) to O(distinct names × inventory)
  // while preserving `Array.find`'s first-match-wins semantics exactly.
  const lowerInventory = inventory.map((inv) => ({
    inv,
    product: inv.product.toLowerCase(),
  }));
  const matchCache = new Map<string, (typeof inventory)[number] | undefined>();
  function matchInventory(
    ingNameLower: string,
  ): (typeof inventory)[number] | undefined {
    const cached = matchCache.get(ingNameLower);
    if (cached !== undefined || matchCache.has(ingNameLower)) return cached;
    const found = lowerInventory.find(
      (e) =>
        e.product.includes(ingNameLower) || ingNameLower.includes(e.product),
    )?.inv;
    matchCache.set(ingNameLower, found);
    return found;
  }

  for (const recipe of recipes) {
    const recipeIngs = ingredientsByRecipe.get(recipe.id) ?? [];
    let totalCostPaise = 0;

    for (const ing of recipeIngs) {
      const ingNameLower = ing.ingredient.toLowerCase();
      const match = matchInventory(ingNameLower);

      if (match) {
        const grams = parseGrams(ing.quantityText || ing.rawText);
        const perKgCost = match.perKgUnitPaise ?? match.buyingPricePaise ?? 0;
        const ingCost = Math.round((grams / 1000) * perKgCost);
        totalCostPaise += ingCost;
      }
    }

    const computed =
      totalCostPaise > 0 ? totalCostPaise : (recipe.foodCostPaise ?? 0);
    if (computed > 0) {
      recipeCostMap.set(recipe.slug, computed);
    } else {
      // Record the miss explicitly rather than storing 0. Ingredient→inventory
      // matching is fuzzy substring matching, so misses are routine and silent.
      recipeCostMap.set(recipe.slug, null);
      unknown.push(recipe.slug);
    }
  }

  if (unknown.length > 0) {
    logger.warn(
      { count: unknown.length, slugs: unknown.slice(0, 20) },
      "recipe food cost could not be established — margin for these dishes is an estimate, not a measurement",
    );
  }

  return recipeCostMap;
}

/**
 * The cost to use for one unit of a dish.
 *
 * A known, positive cost is used as-is. Anything else — null, zero, or a
 * negative from bad data — falls back to the default-margin estimate, the same
 * fallback a dish with no recipe at all gets. Before this existed, `?? default`
 * treated a stored 0 as a real measurement, so the dish we knew the LEAST about
 * scored the HIGHEST margin and won the star ranking on the strength of missing
 * data.
 */
export function costPerUnitPaise(
  foodCostPaise: FoodCostPaise,
  pricePaise: number,
  defaultMarginPct: number,
): { costPaise: number; estimated: boolean } {
  if (foodCostPaise != null && foodCostPaise > 0) {
    return { costPaise: foodCostPaise, estimated: false };
  }
  return {
    costPaise: Math.max(0, Math.round(pricePaise * (1 - defaultMarginPct))),
    estimated: true,
  };
}

async function loadPricedItems(): Promise<Map<string, PricedItem>> {
  const dynamicCosts = await loadDynamicRecipeCosts();
  const items = await db
    .select({
      slug: menuItemsTable.slug,
      name: menuItemsTable.name,
      pricePaise: menuItemsTable.pricePaise,
    })
    .from(menuItemsTable);

  const out = new Map<string, PricedItem>();
  for (const row of items) {
    const raw = dynamicCosts.get(row.slug);
    // `undefined` (no recipe row at all) and `null` (recipe exists, cost
    // unknown) are the same thing to us: unknown. A stored non-positive is too.
    const cost: FoodCostPaise = raw != null && raw > 0 ? raw : null;
    out.set(row.slug, {
      slug: row.slug,
      name: row.name,
      pricePaise: row.pricePaise,
      foodCostPaise: cost,
    });
    // Allow lookups by name too — order items historically only carry name.
    out.set(`name:${row.name.toLowerCase()}`, {
      slug: row.slug,
      name: row.name,
      pricePaise: row.pricePaise,
      foodCostPaise: cost,
    });
  }
  return out;
}

// Aggregate orders within [windowStart, windowEnd] into per-slug stats.
// Margin defaults to 35% of price when no recipe cost is available — flagged
// in the run summary so editors know the scores are estimates.
export interface AggregateOptions {
  windowStart: Date;
  windowEnd: Date;
  defaultMarginPct?: number;
}

export interface AggregateResult {
  totalOrders: number;
  stats: DishAccumulator[];
  unmatchedItemNames: string[];
  /**
   * Slugs whose margin was computed from the default-margin estimate because
   * no food cost could be established. Their scores are not measurements, and
   * anything downstream that turns a score into money should say so.
   */
  estimatedCostSlugs: string[];
}

export async function aggregateDishStats(
  opts: AggregateOptions,
): Promise<AggregateResult> {
  const defaultMarginPct = opts.defaultMarginPct ?? DEFAULT_MARGIN_PCT;
  const orders = await db
    .select({ id: ordersTable.id, items: ordersTable.items })
    .from(ordersTable)
    .where(
      and(
        gte(ordersTable.createdAt, opts.windowStart),
        sql`${ordersTable.createdAt} < ${opts.windowEnd}`,
        eq(ordersTable.orderKind, "meal"),
      ),
    );
  const priced = await loadPricedItems();
  const accum = new Map<string, DishAccumulator>();
  const unmatched = new Set<string>();
  const estimatedCost = new Set<string>();
  for (const order of orders) {
    if (!Array.isArray(order.items)) continue;
    for (const it of order.items) {
      if (!it || typeof it !== "object") continue;
      // Query already filters orderKind = 'meal', but the column type is a
      // meal/marketplace union — narrow per-item so it.price is safe below.
      if (!isMealOrderItem(it)) continue;
      const name = String(it.name ?? "");
      if (!name) continue;
      const lookup =
        priced.get(`name:${name.toLowerCase()}`) ??
        // Some legacy data may have used slug as name
        priced.get(name);
      if (!lookup) {
        unmatched.add(name);
        continue;
      }
      const qty = Math.max(1, Math.round(Number(it.qty ?? 1)));
      // orders.items.price is stored in paise by finalizeOrder() — see
      // loyaltyEngine.ts. We do NOT multiply by 100 here; doing so would
      // inflate revenue by 100x.
      const unitPricePaise = Math.max(
        0,
        Math.round(Number(it.price ?? lookup.pricePaise)),
      );
      const revenuePaise = unitPricePaise * qty;
      const cost = costPerUnitPaise(
        lookup.foodCostPaise,
        lookup.pricePaise,
        defaultMarginPct,
      );
      if (cost.estimated) estimatedCost.add(lookup.slug);
      const marginPaise = (unitPricePaise - cost.costPaise) * qty;
      const cur = accum.get(lookup.slug) ?? {
        slug: lookup.slug,
        name: lookup.name,
        ordersCount: 0,
        unitsSold: 0,
        revenuePaise: 0,
        marginPaise: 0,
      };
      cur.ordersCount += 1;
      cur.unitsSold += qty;
      cur.revenuePaise += revenuePaise;
      cur.marginPaise += marginPaise;
      accum.set(lookup.slug, cur);
    }
  }
  return {
    totalOrders: orders.length,
    stats: [...accum.values()],
    unmatchedItemNames: [...unmatched],
    estimatedCostSlugs: [...estimatedCost],
  };
}

// ---- Classification ----------------------------------------------------------

interface ClassifiedDish extends DishAccumulator {
  popularityScore: number; // 0..1
  marginScore: number; // 0..1
  classification: DishClassification;
  recommendation: DishRecommendation;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function recommendationFor(
  classification: DishClassification,
): DishRecommendation {
  switch (classification) {
    case "star":
      return "promote";
    case "puzzle":
      return "reprice";
    case "plowhorse":
      // A plowhorse is high-volume / low-margin. "hold" understates the leak on
      // a menu bleeding margin to discounts — it needs a reprice or a recost.
      return "reprice_or_recost";
    case "dog":
      return "retire";
  }
}

export function classifyDishes(stats: DishAccumulator[]): ClassifiedDish[] {
  if (stats.length === 0) return [];
  const popMedian = median(stats.map((s) => s.unitsSold));
  // Use absolute margin contribution rather than per-unit %, so a tiny-but-
  // popular cheap dish doesn't appear as a star solely on margin %.
  const marginMedian = median(stats.map((s) => s.marginPaise));
  const popMax = Math.max(1, ...stats.map((s) => s.unitsSold));
  const marginMax = Math.max(1, ...stats.map((s) => s.marginPaise));
  return stats.map((s) => {
    const popularity = s.unitsSold >= popMedian;
    const margin = s.marginPaise >= marginMedian;
    const classification: DishClassification = popularity
      ? margin
        ? "star"
        : "plowhorse"
      : margin
        ? "puzzle"
        : "dog";
    return {
      ...s,
      popularityScore: Math.round((s.unitsSold / popMax) * 100) / 100,
      marginScore:
        Math.round((Math.max(0, s.marginPaise) / marginMax) * 100) / 100,
      classification,
      recommendation: recommendationFor(classification),
    };
  });
}

// ---- Commentary --------------------------------------------------------------

const COMMENTARY_TIMEOUT_MS = 12_000;

interface CommentaryInput {
  slug: string;
  name: string;
  classification: DishClassification;
  unitsSold: number;
  revenuePaise: number;
  marginPaise: number;
  recommendation: DishRecommendation;
}

// Generates one short commentary per dish in a single batched call. Falls
// back to a deterministic template if the model fails — commentary is
// advisory and must never block a run.
export async function generateBatchCommentary(
  dishes: CommentaryInput[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (dishes.length === 0) return out;
  const fallback = (d: CommentaryInput): string => {
    const rupees = (d.revenuePaise / 100).toFixed(0);
    return `${d.unitsSold} units sold and ₹${rupees} revenue. Classified as ${d.classification}; suggested action: ${d.recommendation}.`;
  };
  const slim = dishes.slice(0, 80).map((d) => ({
    slug: d.slug,
    name: d.name,
    classification: d.classification,
    units: d.unitsSold,
    revenueRupees: Math.round(d.revenuePaise / 100),
    marginRupees: Math.round(d.marginPaise / 100),
    recommendation: d.recommendation,
  }));
  const prompt = `You are a menu engineering analyst for Tanmatra, a wellness food brand.
For each dish below, write exactly TWO short sentences (max 32 words total)
explaining its current performance and the recommended action. Plain English,
no marketing fluff, no medical claims.

Return STRICT JSON: an array of objects with "slug" and "commentary" only.
Do not wrap in markdown. Do not add other fields.

Dishes:
${JSON.stringify(slim, null, 2)}`;
  try {
    const result = await Promise.race([
      generateText({ model: getModel(), prompt }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("commentary timeout")),
          COMMENTARY_TIMEOUT_MS,
        ),
      ),
    ]);
    const text = result.text.trim().replace(/^```json\s*|```\s*$/g, "");
    const parsed = JSON.parse(text) as Array<{
      slug?: string;
      commentary?: string;
    }>;
    for (const row of parsed) {
      if (row?.slug && typeof row.commentary === "string") {
        out.set(row.slug, row.commentary.trim().slice(0, 280));
      }
    }
  } catch (err) {
    logger.warn({ err }, "menu engineering commentary fell back to template");
  }
  for (const d of dishes) {
    if (!out.has(d.slug)) out.set(d.slug, fallback(d));
  }
  return out;
}

// ---- Persisting a run --------------------------------------------------------

export interface RunOptions {
  sinceDays?: number;
  operatorId?: string | null;
}

export interface RunResult {
  run: MenuEngineeringRun;
  stats: MenuEngineeringDishStat[];
  unmatchedItemNames: string[];
}

export async function runMenuEngineering(opts: RunOptions): Promise<RunResult> {
  const sinceDays = Math.max(1, Math.min(180, opts.sinceDays ?? 30));
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - sinceDays * 86_400_000);
  const agg = await aggregateDishStats({ windowStart, windowEnd });
  if (agg.estimatedCostSlugs.length > 0) {
    logger.warn(
      {
        count: agg.estimatedCostSlugs.length,
        of: agg.stats.length,
        slugs: agg.estimatedCostSlugs.slice(0, 20),
      },
      "menu engineering: these dishes were scored on an ESTIMATED margin — fix their recipe/inventory costing before acting on their pricing suggestions",
    );
  }
  const classified = classifyDishes(agg.stats);
  const commentary = await generateBatchCommentary(
    classified.map((c) => ({
      slug: c.slug,
      name: c.name,
      classification: c.classification,
      unitsSold: c.unitsSold,
      revenuePaise: c.revenuePaise,
      marginPaise: c.marginPaise,
      recommendation: c.recommendation,
    })),
  );
  const result = await db.transaction(async (tx) => {
    const [run] = await tx
      .insert(menuEngineeringRunsTable)
      .values({
        windowStart,
        windowEnd,
        modelId: DEFAULT_MODEL_ID,
        totalDishes: classified.length,
        totalOrders: agg.totalOrders,
      })
      .returning();
    if (!run) throw new Error("failed to create menu engineering run");
    const statRows =
      classified.length === 0
        ? []
        : await tx
            .insert(menuEngineeringDishStatsTable)
            .values(
              classified.map((c) => ({
                runId: run.id,
                slug: c.slug,
                name: c.name,
                ordersCount: c.ordersCount,
                unitsSold: c.unitsSold,
                revenuePaise: c.revenuePaise,
                marginPaise: c.marginPaise,
                popularityScore: Math.round(c.popularityScore * 100),
                marginScore: Math.round(c.marginScore * 100),
                classification: c.classification,
                recommendation: c.recommendation,
                commentary: commentary.get(c.slug) ?? "",
              })),
            )
            .returning();
    return { run, stats: statRows };
  });
  await recordOpsAction({
    operatorId: opts.operatorId ?? null,
    agent: "menu-engineering",
    action: "menu_engineering_run",
    params: { sinceDays },
    beforeState: null,
    afterState: {
      runId: result.run.id,
      dishes: result.stats.length,
      unmatched: agg.unmatchedItemNames.length,
      estimatedCost: agg.estimatedCostSlugs.length,
      estimatedCostSlugs: agg.estimatedCostSlugs.slice(0, 50),
    },
    status: "success",
    reasoning: "scored dishes and generated commentary",
  });
  return { ...result, unmatchedItemNames: agg.unmatchedItemNames };
}

// ---- Pricing suggester -------------------------------------------------------

// Simple heuristic recommender keyed off the classification. We bias toward
// small, reversible nudges; predicted impact is a deliberately wide band so
// editors don't read it as a forecast.
function suggestPriceForClass(
  classification: DishClassification,
  currentPaise: number,
): {
  suggestedPaise: number;
  rationale: string;
  pctLowX10: number;
  pctHighX10: number;
} {
  const round50 = (n: number): number => Math.max(50, Math.round(n / 50) * 50);
  switch (classification) {
    case "star":
      return {
        suggestedPaise: round50(currentPaise * 1.05),
        rationale:
          "High demand and strong margin — small price lift likely sticky.",
        pctLowX10: 10,
        pctHighX10: 60,
      };
    case "puzzle":
      return {
        suggestedPaise: round50(currentPaise * 0.93),
        rationale:
          "Good margin but weak demand — modest price drop may unlock volume.",
        pctLowX10: -20,
        pctHighX10: 80,
      };
    case "plowhorse":
      return {
        suggestedPaise: round50(currentPaise * 1.02),
        rationale:
          "Popular but thin margin — protect price; consider portion or cost work.",
        pctLowX10: -10,
        pctHighX10: 30,
      };
    case "dog":
      return {
        suggestedPaise: round50(currentPaise * 0.9),
        rationale: "Low demand and low margin — discount to clear or retire.",
        pctLowX10: -50,
        pctHighX10: 20,
      };
  }
}

// Build a per-zone, per-daypart suggestion when there is enough demand in
// that slice; otherwise fall back to a single (all, all) suggestion.
// `nameToSlug` MUST be the same lookup used in aggregation so the slice
// counts correspond to the same orders that produced the run stats.
type SliceKey = string; // `${zone}:${daypart}`
type SliceCounts = Map<SliceKey, { count: number; zone: string; daypart: Daypart }>;

/**
 * One-pass replacement for calling this window's order scan once per dish.
 * `buildDishSuggestions` used to independently re-fetch and re-scan the
 * *entire* orders window for every dish in the run — O(dishes × orders ×
 * items) round-trips and JS work for a single pricing run. Fetch the window
 * once here and bucket every dish's slice counts from the same pass, so the
 * per-dish loop in `buildPricingSuggestionsForRun` becomes a map lookup.
 */
export async function buildSliceCountsBySlug(
  windowStart: Date,
  windowEnd: Date,
  nameToSlug: Map<string, string>,
): Promise<Map<string, SliceCounts>> {
  const orders = await db
    .select({
      pincode: ordersTable.pincode,
      createdAt: ordersTable.createdAt,
      items: ordersTable.items,
    })
    .from(ordersTable)
    .where(
      and(
        gte(ordersTable.createdAt, windowStart),
        sql`${ordersTable.createdAt} < ${windowEnd}`,
        eq(ordersTable.orderKind, "meal"),
      ),
    );
  const bySlug = new Map<string, SliceCounts>();
  for (const o of orders) {
    if (!Array.isArray(o.items)) continue;
    const zone = zoneFromPincode(o.pincode);
    const daypart = dayPartFromHour(o.createdAt.getUTCHours());
    const key: SliceKey = `${zone}:${daypart}`;
    // An order counts once per dish it contains, matching the original
    // per-dish `.some(...)` presence check — not once per matching item, so
    // a duplicate line for the same dish in one order still counts as 1.
    const slugsInOrder = new Set<string>();
    for (const it of o.items) {
      const n = (it as { name?: string }).name ?? "";
      const slug = nameToSlug.get(n.toLowerCase());
      if (slug) slugsInOrder.add(slug);
    }
    for (const slug of slugsInOrder) {
      const slices = bySlug.get(slug) ?? new Map();
      const cur = slices.get(key) ?? { count: 0, zone, daypart };
      cur.count += 1;
      slices.set(key, cur);
      bySlug.set(slug, slices);
    }
  }
  return bySlug;
}

function buildDishSuggestions(
  runId: number,
  slug: string,
  classification: DishClassification,
  currentPaise: number,
  slices: SliceCounts,
  costEstimated: boolean,
): Array<typeof pricingSuggestionsTable.$inferInsert> {
  const base = suggestPriceForClass(classification, currentPaise);
  // Approving an "all/all" suggestion writes menu_items.price_paise, which is
  // what the customer pays. If the margin behind it was assumed rather than
  // measured, the human approving it has to be told — in the row itself, not
  // in a log line nobody reads.
  const rationale = costEstimated
    ? `${base.rationale} ⚠ MARGIN IS ESTIMATED: no food cost could be established for this dish (no recipe ingredient matched an inventory row), so its margin is the flat ${DEFAULT_MARGIN_PCT_LABEL} assumption, not a measurement. Fix the recipe costing before applying a price change.`
    : base.rationale;
  const rows: Array<typeof pricingSuggestionsTable.$inferInsert> = [
    {
      runId,
      slug,
      zone: "all",
      daypart: "all",
      currentPaise,
      suggestedPaise: base.suggestedPaise,
      expectedRevenueDeltaPctLow: base.pctLowX10,
      expectedRevenueDeltaPctHigh: base.pctHighX10,
      rationale,
      status: "pending",
    },
  ];
  // Only emit slice-level suggestions when there is enough volume to
  // distinguish signal from noise.
  for (const slice of slices.values()) {
    if (slice.count < 8) continue;
    rows.push({
      runId,
      slug,
      zone: slice.zone,
      daypart: slice.daypart,
      currentPaise,
      suggestedPaise: base.suggestedPaise,
      expectedRevenueDeltaPctLow: base.pctLowX10,
      expectedRevenueDeltaPctHigh: base.pctHighX10,
      rationale: `${rationale} (${slice.count} orders in ${slice.zone}/${slice.daypart}.)`,
      status: "pending",
    });
  }
  return rows;
}

export async function buildPricingSuggestionsForRun(
  runId: number,
  operatorId?: string | null,
): Promise<PricingSuggestion[]> {
  const [run] = await db
    .select()
    .from(menuEngineeringRunsTable)
    .where(eq(menuEngineeringRunsTable.id, runId))
    .limit(1);
  if (!run) throw new Error("run not found");
  const stats = await db
    .select()
    .from(menuEngineeringDishStatsTable)
    .where(eq(menuEngineeringDishStatsTable.runId, runId));
  const items = await db
    .select({
      slug: menuItemsTable.slug,
      name: menuItemsTable.name,
      pricePaise: menuItemsTable.pricePaise,
    })
    .from(menuItemsTable);
  const priceMap = new Map(items.map((i) => [i.slug, i.pricePaise]));
  // Build the same name→slug lookup that aggregation uses, so slice counts
  // correspond to the orders that produced the stats.
  const nameToSlug = new Map(
    items.map((i) => [i.name.toLowerCase(), i.slug] as const),
  );
  // Re-derive which dishes have a real food cost. The dish-stats table records
  // the margin but not whether it was measured, and that difference decides
  // whether we can put a price rise in front of an operator without a caveat.
  const costs = await loadDynamicRecipeCosts();
  const costEstimatedFor = (slug: string): boolean => {
    const c = costs.get(slug);
    return !(c != null && c > 0);
  };
  const sliceCountsBySlug = await buildSliceCountsBySlug(
    run.windowStart,
    run.windowEnd,
    nameToSlug,
  );
  const allRows: Array<typeof pricingSuggestionsTable.$inferInsert> = [];
  for (const s of stats) {
    const currentPaise = priceMap.get(s.slug);
    if (currentPaise == null) continue;
    const rows = buildDishSuggestions(
      runId,
      s.slug,
      s.classification as DishClassification,
      currentPaise,
      sliceCountsBySlug.get(s.slug) ?? new Map(),
      costEstimatedFor(s.slug),
    );
    allRows.push(...rows);
  }
  if (allRows.length === 0) return [];
  // Refresh-by-replace: drop pending suggestions for this run before inserting
  // the new batch, so re-running doesn't pile up duplicates.
  const inserted = await db.transaction(async (tx) => {
    await tx
      .delete(pricingSuggestionsTable)
      .where(
        and(
          eq(pricingSuggestionsTable.runId, runId),
          eq(pricingSuggestionsTable.status, "pending"),
        ),
      );
    return tx
      .insert(pricingSuggestionsTable)
      .values(allRows)
      .returning();
  });
  await recordOpsAction({
    operatorId: operatorId ?? null,
    agent: "menu-engineering",
    action: "pricing_suggestions_run",
    params: { runId },
    beforeState: null,
    afterState: { count: inserted.length },
    status: "success",
    reasoning: "regenerated pending pricing suggestions",
  });
  return inserted;
}

// ---- Decisions ---------------------------------------------------------------

export interface DecisionResult {
  suggestion: PricingSuggestion;
  appliedPricePaise?: number;
}

async function settleSuggestion(
  id: number,
  status: PricingSuggestionStatus,
  operatorId: string | null,
): Promise<PricingSuggestion> {
  // Conditional update guards against TOCTOU: if two operators race to
  // approve/dismiss the same suggestion, only one UPDATE will match.
  const [updated] = await db
    .update(pricingSuggestionsTable)
    .set({ status, decidedBy: operatorId, decidedAt: new Date() })
    .where(
      and(
        eq(pricingSuggestionsTable.id, id),
        eq(pricingSuggestionsTable.status, "pending"),
      ),
    )
    .returning();
  if (!updated) {
    const [existing] = await db
      .select({ status: pricingSuggestionsTable.status })
      .from(pricingSuggestionsTable)
      .where(eq(pricingSuggestionsTable.id, id))
      .limit(1);
    if (!existing) throw new Error("suggestion not found");
    throw new Error("suggestion already decided");
  }
  return updated;
}

export async function approvePricingSuggestion(
  id: number,
  operatorId: string | null,
): Promise<DecisionResult> {
  const updated = await settleSuggestion(id, "approved", operatorId);
  // Only apply price changes when the suggestion is for "all" zones/dayparts;
  // slice-level suggestions are insight-only — we don't have per-slice price
  // overrides in the catalog yet.
  // Checkout (loyaltyEngine.finalizeOrder) prices off the merged catalog
  // (menuResolver.getMergedCatalog), which overlays menu_items rows on top
  // of the static `@workspace/menu-catalog` DISHES seed. So updating
  // menu_items.pricePaise here is what makes the approved price actually
  // apply at checkout. For static-only dishes that have never been touched
  // in the CMS there is no menu_items row yet — in that case we seed one
  // from the static dish first so the override has somewhere to live.
  // Reuse the existing CMS price-change flow (lib/menu.updatePrice) so the
  // audit trail and any future hooks fire identically to a manual edit. We
  // only mutate when the suggestion targets the global price ("all/all").
  let appliedPricePaise: number | undefined;
  if (updated.zone === "all" && updated.daypart === "all") {
    let before = await findBySlug(updated.slug);
    let seededFromStatic = false;
    if (!before) {
      const stat = DISHES.find((d) => d.slug === updated.slug);
      if (stat) {
        const [seeded] = await db
          .insert(menuItemsTable)
          .values({
            slug: stat.slug,
            name: stat.name,
            description: stat.description,
            longDescription: stat.longDescription,
            pricePaise: stat.price,
            category: stat.category,
            kitchenLocation: stat.kitchen,
            isVeg: stat.isVeg,
            isAvailable: stat.isAvailable,
            imageUrl: stat.image,
            allergens: stat.allergens,
            macros: {
              kcal: stat.macros.calories,
              proteinG: stat.macros.protein,
              carbsG: stat.macros.carbs,
              fatG: stat.macros.fat,
            },
          })
          .onConflictDoNothing({ target: menuItemsTable.slug })
          .returning();
        before = seeded ?? (await findBySlug(updated.slug));
        seededFromStatic = Boolean(seeded);
      }
    }
    if (before) {
      const item = await updatePrice(updated.slug, updated.suggestedPaise);
      appliedPricePaise = item?.pricePaise;
      await recordOpsAction({
        operatorId,
        agent: "menu-engineering",
        action: "cms_update_price",
        params: {
          slug: updated.slug,
          pricePaise: updated.suggestedPaise,
          source: "menu_engineering_suggestion",
          suggestionId: id,
          seededFromStatic,
        },
        beforeState: { pricePaise: before.pricePaise },
        afterState: { pricePaise: item?.pricePaise ?? null },
        status: "success",
        reasoning: "approved menu engineering pricing suggestion",
      });
    }
  }
  await recordOpsAction({
    operatorId,
    agent: "menu-engineering",
    action: "pricing_suggestion_approved",
    params: { id, slug: updated.slug },
    beforeState: { currentPaise: updated.currentPaise },
    afterState: { suggestedPaise: updated.suggestedPaise, appliedPricePaise },
    status: "success",
    reasoning: "human-approved pricing change",
  });
  return { suggestion: updated, appliedPricePaise };
}

export async function dismissPricingSuggestion(
  id: number,
  operatorId: string | null,
): Promise<DecisionResult> {
  const updated = await settleSuggestion(id, "dismissed", operatorId);
  await recordOpsAction({
    operatorId,
    agent: "menu-engineering",
    action: "pricing_suggestion_dismissed",
    params: { id, slug: updated.slug },
    beforeState: null,
    afterState: null,
    status: "success",
    reasoning: "human dismissed pricing suggestion",
  });
  return { suggestion: updated };
}

// ---- Read helpers ------------------------------------------------------------

export async function getLatestRun(): Promise<MenuEngineeringRun | null> {
  const [row] = await db
    .select()
    .from(menuEngineeringRunsTable)
    .orderBy(desc(menuEngineeringRunsTable.runAt))
    .limit(1);
  return row ?? null;
}

export async function getRunStats(
  runId: number,
): Promise<MenuEngineeringDishStat[]> {
  return db
    .select()
    .from(menuEngineeringDishStatsTable)
    .where(eq(menuEngineeringDishStatsTable.runId, runId))
    .orderBy(desc(menuEngineeringDishStatsTable.popularityScore));
}

export async function listPendingSuggestions(
  runId?: number,
): Promise<PricingSuggestion[]> {
  if (runId) {
    return db
      .select()
      .from(pricingSuggestionsTable)
      .where(
        and(
          eq(pricingSuggestionsTable.runId, runId),
          eq(pricingSuggestionsTable.status, "pending"),
        ),
      )
      .orderBy(desc(pricingSuggestionsTable.createdAt));
  }
  return db
    .select()
    .from(pricingSuggestionsTable)
    .where(eq(pricingSuggestionsTable.status, "pending"))
    .orderBy(desc(pricingSuggestionsTable.createdAt));
}

export async function listSuggestionsForSlug(
  slug: string,
): Promise<PricingSuggestion[]> {
  return db
    .select()
    .from(pricingSuggestionsTable)
    .where(eq(pricingSuggestionsTable.slug, slug))
    .orderBy(desc(pricingSuggestionsTable.createdAt));
}
