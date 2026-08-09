import {
  db,
  overrideDb,
  ordersTable,
  ridersTable,
  deliveryEventsTable,
  dispatchDecisionsTable,
  type Order,
  type Rider,
} from "@workspace/db";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { FULFILMENT_ASSIGNABLE_STATUSES, isFulfilmentAssignable, isPaidLive } from "./paidGate";
import { logger } from "./logger";
import { recordOpsAction, enqueueOpsAuditOutbox } from "./opsAudit";
import { emitDeliveryEvent } from "./realtime";
import { recordDispatchDuration } from "./dispatchMetrics";

export const DISPATCH_MODEL_VERSION = "v1-heuristic";

// Maximum minutes a STAT order may sit unassigned (status in
// placed/preparing/ready, no rider) before the dispatcher emits an
// `sla_breach` event. Kept small because STAT is reserved for
// clinically-urgent meals (e.g. post-procedure, hypoglycaemia
// recovery). The threshold is intentionally low (5 min) — the gain
// is in latency, not throughput.
export const STAT_DISPATCH_SLA_MIN = 5;

export type OrderPriority = "routine" | "urgent" | "stat";

// ─── Geo helpers ───────────────────────────────────────────────────────────

const METRO_CENTERS: Record<string, { lat: number; lng: number }> = {
  "201": { lat: 28.5355, lng: 77.391 }, // Noida / Greater Noida (service area)
  "122": { lat: 28.4595, lng: 77.0266 }, // Gurgaon (service area)
  "110": { lat: 28.6139, lng: 77.209 }, // Delhi
  "400": { lat: 19.076, lng: 72.8777 }, // Mumbai
  "600": { lat: 13.0827, lng: 80.2707 }, // Chennai
  "700": { lat: 22.5726, lng: 88.3639 }, // Kolkata
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Deterministic synthesis of a (lat,lng) for an address: pick the metro
// center by pincode prefix, then jitter ~±0.06° (~7km) using a stable hash
// of the address. Lets the dispatch service compute pairwise distances
// without a real geocoder.
export function addressLatLng(addr: {
  city?: string | null;
  pincode?: string | null;
  line?: string | null;
}): { lat: number; lng: number } {
  const pin = (addr.pincode ?? "").trim();
  const center = METRO_CENTERS[pin.slice(0, 3)] ?? { lat: 28.5355, lng: 77.391 };
  const seed = `${pin}|${addr.line ?? ""}|${addr.city ?? ""}`;
  const h = hash(seed);
  const dLat = (((h >>> 0) % 1200) - 600) / 10000; // ±0.06
  const dLng = ((((h >>> 8) >>> 0) % 1200) - 600) / 10000;
  return { lat: center.lat + dLat, lng: center.lng + dLng };
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function riderLatLng(rider: Rider): { lat: number; lng: number } {
  if (typeof rider.lat === "number" && typeof rider.lng === "number") {
    return { lat: rider.lat, lng: rider.lng };
  }
  // Fall back to zone center via metro lookup keyed by zone first 3 chars.
  // Riders are kept short-lived in dev/test, so this is mostly a safety net.
  const seed = `${rider.zone}|${rider.id}`;
  const h = hash(seed);
  const center = { lat: 28.5355, lng: 77.391 };
  return {
    lat: center.lat + (((h % 800) - 400) / 10000),
    lng: center.lng + ((((h >>> 8) % 800) - 400) / 10000),
  };
}

// Prefer the real geocoded coordinates persisted on the order at checkout.
// Fall back to the synthetic helper for legacy rows that pre-date Task #46
// (and for the rare case the geocoder was unavailable at checkout time).
export function orderDropLatLng(order: Order): { lat: number; lng: number } {
  if (
    typeof order.dropLat === "number" &&
    typeof order.dropLng === "number" &&
    !Number.isNaN(order.dropLat) &&
    !Number.isNaN(order.dropLng)
  ) {
    return { lat: order.dropLat, lng: order.dropLng };
  }
  return addressLatLng({
    city: order.city,
    pincode: order.pincode,
    line: order.addressLine,
  });
}

// ─── Food group / route compatibility ──────────────────────────────────────

const COLD_KEYWORDS =
  /salad|smoothie|juice|cold|chaas|lassi|raita|yogurt|shake|kombucha|fresh fruit/i;
const HOT_KEYWORDS =
  /curry|dal|rice|biryani|soup|stew|noodle|paratha|roti|gravy|tikka|bowl|pulao|sabzi/i;

export type FoodGroup = "hot" | "cold" | "mixed" | "unknown";

export function orderFoodGroup(order: Order): FoodGroup {
  const items = (order.items ?? []) as Array<{ name?: string }>;
  if (items.length === 0) return "unknown";
  let hot = 0;
  let cold = 0;
  for (const it of items) {
    const n = String(it?.name ?? "");
    if (COLD_KEYWORDS.test(n)) cold++;
    else if (HOT_KEYWORDS.test(n)) hot++;
  }
  if (hot > 0 && cold > 0) return "mixed";
  if (cold > 0) return "cold";
  if (hot > 0) return "hot";
  return "unknown";
}

// Two orders are route-compatible if neither violates the other's
// temperature requirements. Hot+cold should never share a bag.
export function foodGroupsCompatible(a: FoodGroup, b: FoodGroup): boolean {
  if (a === "unknown" || b === "unknown") return true;
  if (a === "mixed" || b === "mixed") return true; // mixed already carries both
  return a === b;
}

// Travel time proxy in minutes for a rider to reach a drop. Used to align
// rider arrival with kitchen-ready time.
const AVG_KMH = 24; // dense-city average
function travelMinutes(distanceKm: number): number {
  return (distanceKm / AVG_KMH) * 60;
}

// Expected minutes from "now" until the order is ready. Uses createdAt +
// a default prep window; orders already in `ready` return 0.
export function readyInMinutes(order: Order, prepMinutes = 12): number {
  if (order.status === "ready") return 0;
  const elapsedMin = (Date.now() - order.createdAt.getTime()) / 60_000;
  return Math.max(0, prepMinutes - elapsedMin);
}

// ─── Scoring ───────────────────────────────────────────────────────────────

export interface ScoreWeights {
  distanceKm: number;
  loadPerOrder: number;
  ratingBonus: number;
  readinessGapMin: number;
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  distanceKm: 1.0,
  loadPerOrder: 2.5,
  ratingBonus: 0.5,
  readinessGapMin: 0.2,
};

export interface ScoreBreakdown {
  distanceKm: number;
  load: number;
  rating: number;
  readinessGapMin: number;
  totalCost: number;
}

// Lower cost = better. Returns negative score so callers can sort desc.
// `kitchenReadyInMin` is how long until the order is ready; we penalize
// the absolute gap between rider arrival and kitchen-ready so neither
// the rider nor the food sits idle for long.
export function scoreRiderForOrder(
  rider: Rider,
  drop: { lat: number; lng: number },
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  kitchenReadyInMin = 0,
): { score: number; breakdown: ScoreBreakdown } {
  const distanceKm = haversineKm(riderLatLng(rider), drop);
  const load = rider.activeOrderCount;
  const rating = rider.rating ?? 5;
  const ratingPenalty = (5 - rating) * weights.ratingBonus;
  const arriveInMin = travelMinutes(distanceKm);
  const readinessGapMin = Math.abs(arriveInMin - kitchenReadyInMin);
  const totalCost =
    distanceKm * weights.distanceKm +
    load * weights.loadPerOrder +
    ratingPenalty +
    readinessGapMin * weights.readinessGapMin;
  return {
    score: -totalCost,
    breakdown: {
      distanceKm: Math.round(distanceKm * 100) / 100,
      load,
      rating,
      readinessGapMin: Math.round(readinessGapMin * 10) / 10,
      totalCost: Math.round(totalCost * 100) / 100,
    },
  };
}

// Naive baseline: nearest online rider, ignoring load/rating.
export function baselineNearest(
  drop: { lat: number; lng: number },
  riders: Rider[],
): { rider: Rider | null; distanceKm: number; score: number } {
  let best: { rider: Rider | null; distanceKm: number; score: number } = {
    rider: null,
    distanceKm: Infinity,
    score: -Infinity,
  };
  for (const r of riders) {
    if (r.status !== "online") continue;
    const d = haversineKm(riderLatLng(r), drop);
    if (d < best.distanceKm) best = { rider: r, distanceKm: d, score: -d };
  }
  return best;
}

// ─── Batching ──────────────────────────────────────────────────────────────

const BATCH_MAX_DETOUR_KM = 1.5;
const BATCH_WINDOW_MIN = 15;

export interface BatchEligibility {
  eligible: boolean;
  reason?: string;
  detourKm?: number;
}

export function checkBatchEligibility(
  baseDrop: {
    lat: number;
    lng: number;
    createdAt: Date;
    foodGroup: FoodGroup;
  },
  candidateDrop: {
    lat: number;
    lng: number;
    createdAt: Date;
    foodGroup: FoodGroup;
  },
): BatchEligibility {
  if (!foodGroupsCompatible(baseDrop.foodGroup, candidateDrop.foodGroup)) {
    return {
      eligible: false,
      reason: `food-type incompatible (${baseDrop.foodGroup} + ${candidateDrop.foodGroup})`,
    };
  }
  const detourKm = haversineKm(baseDrop, candidateDrop);
  if (detourKm > BATCH_MAX_DETOUR_KM) {
    return { eligible: false, reason: "drop too far", detourKm };
  }
  const minutesApart =
    Math.abs(baseDrop.createdAt.getTime() - candidateDrop.createdAt.getTime()) /
    60_000;
  if (minutesApart > BATCH_WINDOW_MIN) {
    return { eligible: false, reason: "outside batching window", detourKm };
  }
  return { eligible: true, detourKm };
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

export interface DispatchResult {
  ok: boolean;
  orderId: number;
  riderId: number | null;
  batched: boolean;
  batchKey: string;
  strategy: "smart" | "baseline" | "override";
  decisionId: number | null;
  reason?: string;
  breakdown?: ScoreBreakdown;
  baseline?: { riderId: number | null; distanceKm: number };
}

function newBatchKey(): string {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Spatial+time bound for batch-partner selection. Replaces the old
// "pincode-prefix LIKE + LIMIT 20" scan, which silently dropped the
// optimal partner under 10× load (it returned the first 20 rows by
// table-scan order, not by proximity). The new query bounds the
// candidate set by:
//
//   - bounding box around the new drop (BATCH_MAX_DETOUR_KM converted
//     to lat/lng degrees) — there is no dedicated spatial index on
//     (drop_lat, drop_lng) yet; the bbox columns are dense doubles
//     and the time prefilter (next bullet) keeps the candidate set
//     small enough that a seq scan over the windowed slice is cheap.
//     If row count grows past ~1M open orders, add a btree on
//     (status, drop_lat, drop_lng) or a GiST/PostGIS index;
//   - createdAt within BATCH_WINDOW_MIN of the new order, so a stale
//     partner from yesterday cannot be picked (existing
//     idx_orders_status_created supports this prefilter);
//   - status / rider / priority filters as before.
//
// Result: every geographically-eligible partner is evaluated, but the
// SQL still returns a small, bounded row set. Haversine refinement
// happens in JS exactly as before, so partner choice is a strict
// superset of the previous behaviour — never worse.
const KM_PER_LAT_DEGREE = 111.0;
/**
 * OA-MED-1.1 (TODO_optimization-auditor.md): the candidate loop below used to
 * issue one `ridersTable` query PER candidate, awaited sequentially — and the
 * bbox candidate query has no LIMIT, so the round-trip count scaled with open
 * orders in the zone. The pathological case is a zone where many eligible
 * partners' riders have gone offline: every one of them costs a round trip
 * only to `continue`.
 *
 * `onlineById` is passed in rather than fetched here. The caller already runs
 * `select * from riders where status = 'online'` a few lines later to rank
 * candidates, and this loop only ever accepts an ONLINE rider — so that query
 * is a strict superset of what the loop needs. Hoisting it above the call and
 * indexing it costs **zero net queries**, which beats the audit's suggested
 * `inArray` (that would have added one).
 *
 * Note the audit's second suggestion — "defer the dispatchDecisionsTable
 * lookup until a partner is actually chosen" — describes what this code
 * ALREADY does: that query sits after the online guard and immediately before
 * an unconditional `return`, so it runs 0 or 1 times per call, never N. Left
 * as-is; there was no N+1 there to fix.
 */
async function findBatchPartner(
  order: Order,
  drop: { lat: number; lng: number },
  onlineById: Map<number, Rider>,
): Promise<{ rider: Rider; batchKey: string; partnerOrderId: number } | null> {
  // Patient-safety: a STAT order is single-drop-only. Pairing it with
  // a routine partner would silently extend its delivery time by the
  // detour, defeating the entire point of marking it STAT.
  if (order.priority === "stat") return null;
  const partnerStatuses = ["rider_assigned", "ready"];
  const latDelta = BATCH_MAX_DETOUR_KM / KM_PER_LAT_DEGREE;
  // Longitude degrees shrink with latitude; guard against div-by-zero
  // at the poles even though we never operate there.
  const lngDelta =
    BATCH_MAX_DETOUR_KM /
    Math.max(1, KM_PER_LAT_DEGREE * Math.cos((drop.lat * Math.PI) / 180));
  const minLat = drop.lat - latDelta;
  const maxLat = drop.lat + latDelta;
  const minLng = drop.lng - lngDelta;
  const maxLng = drop.lng + lngDelta;
  const windowSinceMs = order.createdAt.getTime() - BATCH_WINDOW_MIN * 60_000;
  const windowUntilMs = order.createdAt.getTime() + BATCH_WINDOW_MIN * 60_000;
  const candidates = await db
    .select()
    .from(ordersTable)
    .where(
      and(
        // Only our own orders may be batch partners. The Petpooja rider
        // webhook (routes/petpooja.ts) writes `rider_id` on ANY meal order it
        // is told about — inserting a rider row for the aggregator's courier
        // if the phone is unknown — and `mapPetpoojaRiderStatus` maps straight
        // into `rider_assigned`/`ready`. Without this predicate a Zomato order
        // carrying a Zomato courier satisfies every condition below, and the
        // caller then assigns OUR order to THAT rider: a patient's clinical
        // meal handed to a courier we have no contract, tracking or cold-chain
        // assurance with. Today `rider.status !== "online"` further down
        // usually catches it (the webhook writes riders as "active"), but that
        // is incidental — it fails the moment the courier's phone matches one
        // of our own online riders.
        eq(ordersTable.orderChannel, "own_app"),
        inArray(ordersTable.status, partnerStatuses),
        sql`${ordersTable.riderId} is not null`,
        // Symmetric guard: a routine order also refuses to share a bag
        // with a STAT order — the STAT order's rider is committed to it
        // exclusively.
        sql`${ordersTable.priority} <> 'stat'`,
        // Spatial bbox; rows without geocoded drops are excluded here
        // and picked up by the legacy pincode fallback below.
        sql`${ordersTable.dropLat} between ${minLat} and ${maxLat}`,
        sql`${ordersTable.dropLng} between ${minLng} and ${maxLng}`,
        // Time bound: BATCH_WINDOW_MIN around the new order.
        gte(ordersTable.createdAt, new Date(windowSinceMs)),
        lte(ordersTable.createdAt, new Date(windowUntilMs)),
      ),
    );
  // Legacy fallback: rows missing dropLat/dropLng are invisible to the
  // bbox query. Scan the same pincode prefix (capped, time-bounded) so
  // they remain eligible without re-introducing the original cap on
  // geocoded rows.
  const sameZonePrefix = (order.pincode ?? "").slice(0, 3);
  if (sameZonePrefix) {
    const legacy = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          // Same channel guard as the bbox query above — this fallback is a
          // second door into the same decision, not a lesser one.
          eq(ordersTable.orderChannel, "own_app"),
          inArray(ordersTable.status, partnerStatuses),
          sql`${ordersTable.riderId} is not null`,
          sql`${ordersTable.priority} <> 'stat'`,
          isNull(ordersTable.dropLat),
          sql`${ordersTable.pincode} like ${sameZonePrefix + "%"}`,
          gte(ordersTable.createdAt, new Date(windowSinceMs)),
          lte(ordersTable.createdAt, new Date(windowUntilMs)),
        ),
      )
      .limit(50);
    candidates.push(...legacy);
  }
  const baseGroup = orderFoodGroup(order);
  for (const partner of candidates) {
    if (partner.id === order.id) continue;
    const partnerDrop = orderDropLatLng(partner);
    const elig = checkBatchEligibility(
      { ...drop, createdAt: order.createdAt, foodGroup: baseGroup },
      {
        ...partnerDrop,
        createdAt: partner.createdAt,
        foodGroup: orderFoodGroup(partner),
      },
    );
    if (!elig.eligible) continue;
    if (partner.riderId == null) continue;
    // Map miss == "no such rider, or not online" — the map is built from the
    // `status = 'online'` query, so this is exactly the old
    // `!rider || rider.status !== "online"` guard with no round trip.
    const rider = onlineById.get(partner.riderId);
    if (!rider) continue;
    // Reuse partner's batchKey if one exists.
    const [partnerDecision] = await db
      .select({ batchKey: dispatchDecisionsTable.batchKey })
      .from(dispatchDecisionsTable)
      .where(eq(dispatchDecisionsTable.orderId, partner.id))
      .orderBy(desc(dispatchDecisionsTable.createdAt))
      .limit(1);
    return {
      rider,
      batchKey: partnerDecision?.batchKey ?? newBatchKey(),
      partnerOrderId: partner.id,
    };
  }
  return null;
}

export interface DispatchOptions {
  operatorId?: string | null;
  allowBatch?: boolean;
  notes?: string | null;
}

export async function dispatchOrder(
  orderId: number,
  opts: DispatchOptions = {},
): Promise<DispatchResult> {
  const dispatchStartedAt = Date.now();
  try {
    return await dispatchOrderInner(orderId, opts);
  } finally {
    // Record on every exit — success, early-return (order not found,
    // no riders available, lock_busy), and thrown errors. The metric
    // budget alert fires on the dispatcher's actual wall-clock cost,
    // not just the happy path.
    recordDispatchDuration(Date.now() - dispatchStartedAt);
  }
}

async function dispatchOrderInner(
  orderId: number,
  opts: DispatchOptions = {},
): Promise<DispatchResult> {
  const allowBatch = opts.allowBatch ?? true;

  // Pre-flight outside the transaction: cheap existence check and read for
  // the partner search. Authoritative state is re-read with FOR UPDATE
  // inside the transaction to avoid races with concurrent dispatchers.
  const [orderPeek] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!orderPeek) {
    return {
      ok: false,
      orderId,
      riderId: null,
      batched: false,
      batchKey: "",
      strategy: "smart",
      decisionId: null,
      reason: "order not found",
    };
  }
  // Chokepoint. Every dispatch path converges here — the sweep below, the
  // BullMQ worker (lib/queue.ts), the ops AI agent (lib/ai/agents/ops.ts) and
  // POST /api/delivery/dispatch (routes/delivery.ts) all call dispatchOrder
  // with an orderId they got from somewhere else. Narrowing only the sweep's
  // scans would leave those three doors open, so the invariant is asserted
  // once, here: an order that did not arrive through our app never consumes
  // one of our riders. Zomato and Swiggy dispatch their own couriers; a bare
  // `pos` order is the counter's to hand over.
  if (orderPeek.orderChannel !== "own_app") {
    return {
      ok: false,
      orderId,
      riderId: null,
      batched: false,
      batchKey: "",
      strategy: "smart",
      decisionId: null,
      reason: "not an own-app order",
    };
  }
  // Second chokepoint invariant, same contract as the channel gate above: an
  // order that is not fulfilment-assignable never consumes a rider on a
  // FIRST assignment — "placed" is unpaid, "failed"/"cancelled" are resolved-
  // dead, "billed" is a settlement ledger row, and unknown statuses fail
  // closed (lib/paidGate.ts). Covers every door at once: the sweep, the
  // BullMQ auto-dispatch on ready, the ops AI agent's smart_dispatch_order,
  // and POST /api/delivery/dispatch. Reassignment of an in-flight order is
  // NOT this path (overrideAssignment is the deliberate, human escape
  // hatch). A non-"no riders available" reason counts as progress in the
  // sweep, so this refusal cannot spin the loop.
  if (!isFulfilmentAssignable(orderPeek.status)) {
    return {
      ok: false,
      orderId,
      riderId: null,
      batched: false,
      batchKey: "",
      strategy: "smart",
      decisionId: null,
      reason: "order not in a dispatchable status (unpaid or terminal)",
    };
  }
  const drop = orderDropLatLng(orderPeek);

  // Fetch the online-rider pool ONCE, before both consumers. It was already
  // fetched unconditionally a few lines below for ranking; hoisting it here
  // lets findBatchPartner index it instead of issuing one query per candidate
  // (OA-MED-1.1), at zero extra cost.
  //
  // Deliberately NOT locked or re-read: this is the pre-flight pass, and the
  // comment below already documents that authoritative rider state is re-read
  // `FOR UPDATE` inside the transaction. A batched rider that goes offline
  // between here and the commit is caught there and surfaces as "batch partner
  // rider unavailable" — so a marginally staler snapshot is already handled.
  const onlineRiders = await db
    .select()
    .from(ridersTable)
    .where(eq(ridersTable.status, "online"));
  const onlineById = new Map(onlineRiders.map((r) => [r.id, r]));

  // 1. Try to batch onto an existing assignment.
  let batchKey = newBatchKey();
  let batchedRider: Rider | null = null;
  let batched = false;
  if (allowBatch) {
    const partner = await findBatchPartner(orderPeek, drop, onlineById);
    if (partner) {
      batchedRider = partner.rider;
      batchKey = partner.batchKey;
      batched = true;
    }
  }

  // 2. Rank online riders by score. This is a read only — it does NOT
  // claim a rider. OA-DEEP-1.4: filter to `status = 'online'` in SQL
  // (idx_riders_status_load) instead of pulling every row and filtering
  // in JS. OA-DEEP-1.5: the old code picked `scored[0]` here and
  // committed to it before ever taking a lock — a read-then-write race.
  // Under concurrent dispatch (BullMQ worker, manual API, ops agent all
  // call dispatchOrder independently) every in-flight call reads the
  // same stale `activeOrderCount`, so several orders can each score the
  // same rider best and all commit to it, stacking assignments on one
  // rider while others idle. The actual claim — and the fallback to the
  // next-best candidate when the top one is already being claimed by a
  // concurrent transaction — happens under a row lock inside the
  // transaction below. (`onlineRiders` itself is fetched above, before the
  // batch attempt, so findBatchPartner can share it.)
  const readyMin = readyInMinutes(orderPeek);
  const ranked = batchedRider
    ? []
    : onlineRiders
        .map((r) => ({
          rider: r,
          ...scoreRiderForOrder(r, drop, DEFAULT_WEIGHTS, readyMin),
        }))
        .sort((a, b) => b.score - a.score);
  if (!batchedRider && ranked.length === 0) {
    return {
      ok: false,
      orderId,
      riderId: null,
      batched: false,
      batchKey,
      strategy: "smart",
      decisionId: null,
      reason: "no riders available",
    };
  }

  const baseline = baselineNearest(drop, onlineRiders);

  // 3. Persist assignment + audit trail. The order row is locked first,
  //    then the rider is claimed — same lock order in every caller
  //    (dispatchOrderInner, runOverrideTx), so there is no cross-lock
  //    deadlock risk.
  const txResult = await db.transaction(async (tx) => {
    // Task #7 bulkhead: the auto-dispatcher uses SKIP LOCKED so it
    // never queues behind a clinical override that holds the row lock.
    // If another tx already holds the row, the SELECT returns zero
    // rows and we report `lock_busy` — the dispatch loop treats that
    // like "already assigned" and moves on (the next loop iteration
    // will re-pick the order if it's still pending).
    const lockedRows = await tx.execute<{
      id: number;
      rider_id: number | null;
      status: string;
    }>(
      sql`select id, rider_id, status from ${ordersTable}
          where id = ${orderId} for update skip locked`,
    );
    const locked = (lockedRows.rows ?? lockedRows)[0] as
      | { id: number; rider_id: number | null; status: string }
      | undefined;
    if (!locked) {
      // SKIP LOCKED returns zero rows for either "row missing" or
      // "row currently locked by another tx" (e.g. the override
      // path). Distinguish the two with a cheap unlocked existence
      // check so the API contract preserves "not_found" fidelity:
      // dispatch loop callers treat lock_busy as "try later" but
      // not_found as a real client error.
      const exists = await tx.execute<{ id: number }>(
        sql`select 1 as id from ${ordersTable} where id = ${orderId} limit 1`,
      );
      const found = (exists.rows ?? exists)[0] as { id: number } | undefined;
      if (!found) {
        return { ok: false as const, reason: "order not found" };
      }
      return { ok: false as const, reason: "lock_busy" };
    }
    if (locked.rider_id != null) {
      return {
        ok: false as const,
        reason: "order already has a rider; use override to reassign",
        existingRiderId: locked.rider_id,
      };
    }
    // Authoritative status check UNDER the row lock — the pre-flight peek
    // is unlocked, so a concurrent cancel or payment-failed webhook can land
    // between peek and claim. FOR UPDATE means this read cannot go stale
    // before our claim commits, making the refusal a true DB-level
    // invariant (lib/paidGate.ts).
    if (!isFulfilmentAssignable(locked.status)) {
      return {
        ok: false as const,
        reason: "order not in a dispatchable status (unpaid or terminal)",
      };
    }

    // Atomic claim. SKIP LOCKED means we never block waiting on a rider
    // row another transaction is mid-assignment to — we just fall
    // through to the next-best candidate. Re-checking `status = 'online'`
    // under the lock also closes the (much rarer) window where a rider
    // went offline between the ranking read above and this claim.
    let claimedRider: Rider;
    let claimedScore: ReturnType<typeof scoreRiderForOrder>;
    if (batchedRider) {
      const riderRow = await tx.execute<{ id: number; status: string }>(
        sql`select id, status from ${ridersTable}
            where id = ${batchedRider.id} and status = 'online'
            for update skip locked`,
      );
      const rr = (riderRow.rows ?? riderRow)[0] as
        | { id: number; status: string }
        | undefined;
      if (!rr) {
        return { ok: false as const, reason: "batch partner rider unavailable" };
      }
      claimedRider = batchedRider;
      claimedScore = scoreRiderForOrder(batchedRider, drop, DEFAULT_WEIGHTS, readyMin);
    } else {
      let found: (typeof ranked)[number] | null = null;
      for (const cand of ranked) {
        const riderRow = await tx.execute<{ id: number; status: string }>(
          sql`select id, status from ${ridersTable}
              where id = ${cand.rider.id} and status = 'online'
              for update skip locked`,
        );
        const rr = (riderRow.rows ?? riderRow)[0] as
          | { id: number; status: string }
          | undefined;
        if (rr) {
          found = cand;
          break;
        }
      }
      if (!found) {
        // Every ranked candidate is either offline now or locked by a
        // concurrent claim. Distinct from "no riders available" (which
        // fires before the transaction when the fleet is genuinely
        // empty) so the sweep in dispatchReadyOrders doesn't mistake
        // transient contention for an exhausted rider pool — the order
        // stays unassigned and is re-picked on the sweep's next pass.
        return { ok: false as const, reason: "rider_claim_contended" };
      }
      claimedRider = found.rider;
      claimedScore = { score: found.score, breakdown: found.breakdown };
    }

    const before = { riderId: locked.rider_id, status: locked.status };
    await tx
      .update(ordersTable)
      .set({ riderId: claimedRider.id, status: "rider_assigned" })
      .where(eq(ordersTable.id, orderId));
    await tx
      .update(ridersTable)
      .set({ activeOrderCount: sql`${ridersTable.activeOrderCount} + 1` })
      .where(eq(ridersTable.id, claimedRider.id));
    await tx.insert(deliveryEventsTable).values({
      orderId,
      riderId: claimedRider.id,
      event: "rider_assigned",
      meta: {
        strategy: batched ? "smart-batched" : "smart",
        batchKey,
        riderName: claimedRider.name,
      },
    });
    const [row] = await tx
      .insert(dispatchDecisionsTable)
      .values({
        batchKey,
        orderId,
        chosenRiderId: claimedRider.id,
        chosenScore: claimedScore.score,
        chosenBreakdown:
          claimedScore.breakdown as unknown as Record<string, number | string>,
        chosenDistanceKm: claimedScore.breakdown.distanceKm,
        baselineRiderId: baseline.rider?.id ?? null,
        baselineScore: baseline.score === -Infinity ? null : baseline.score,
        baselineDistanceKm:
          baseline.distanceKm === Infinity ? null : baseline.distanceKm,
        strategy: "smart",
        batched: batched ? 1 : 0,
        operatorId: opts.operatorId ?? null,
        notes: opts.notes ?? null,
      })
      .returning({ id: dispatchDecisionsTable.id });
    if (opts.operatorId) {
      await recordOpsAction(
        {
          operatorId: opts.operatorId,
          agent: "ops_console",
          action: "dispatch_order",
          params: { orderId, batched },
          beforeState: before,
          afterState: { riderId: claimedRider.id, status: "rider_assigned" },
          status: "success",
          reasoning: opts.notes ?? "smart dispatch",
        },
        tx,
      );
    }
    return {
      ok: true as const,
      decisionId: row?.id ?? null,
      riderId: claimedRider.id,
      riderName: claimedRider.name,
      breakdown: claimedScore.breakdown,
    };
  });

  if (!txResult.ok) {
    return {
      ok: false,
      orderId,
      riderId: null,
      batched: false,
      batchKey,
      strategy: "smart",
      decisionId: null,
      reason: txResult.reason,
    };
  }

  emitDeliveryEvent(orderId, {
    event: "rider_assigned",
    riderId: txResult.riderId,
    riderName: txResult.riderName,
    batchKey,
    batched,
  });

  return {
    ok: true,
    orderId,
    riderId: txResult.riderId,
    batched,
    batchKey,
    strategy: "smart",
    decisionId: txResult.decisionId,
    breakdown: txResult.breakdown,
    baseline: {
      riderId: baseline.rider?.id ?? null,
      distanceKm:
        baseline.distanceKm === Infinity
          ? 0
          : Math.round(baseline.distanceKm * 100) / 100,
    },
  };
}

// Loop dispatch — every order in `placed`/`preparing`/`ready` without a rider.
//
// Ordering rules (priority is a hard pre-emption, not a soft weight):
//   1. Drain every STAT order, FIFO by createdAt, with batching disabled.
//   2. Then drain the urgent/routine queue, FIFO by createdAt, batching on.
// A STAT order placed at T+0 therefore dispatches before a routine order
// placed at T-10min, regardless of the routine order's age.
//
// Side-effect: at loop entry we scan STAT orders that have sat past
// `STAT_DISPATCH_SLA_MIN` without an assigned rider and emit a single
// `sla_breach` delivery event per breach. Idempotency is enforced by
// stamping `orders.sla_breach_at` in the same UPDATE that selected the
// row, so a second pass over the same row is a no-op even if the
// dispatcher loop runs many times per second.
export async function dispatchReadyOrders(opts: {
  operatorId?: string | null;
} = {}): Promise<{
  attempted: number;
  assigned: number;
  slaBreaches: number;
  results: DispatchResult[];
}> {
  const slaBreaches = await scanAndEmitStatSlaBreaches();
  // Unpaid ("placed") rows excluded — lib/paidGate.ts. Load-bearing for the
  // sweep loop too: the chokepoint below refuses non-assignable rows, and a
  // refused row the scan kept SELECTing would be re-paged every sweep.
  const liveStatuses = [...FULFILMENT_ASSIGNABLE_STATUSES];
  const results: DispatchResult[] = [];
  let statAttempted = 0;
  let otherAttempted = 0;
  // The single dispatcher decision that means "the rider pool is empty
  // for this order right now". Used as the no-progress sentinel below
  // — see `dispatchOrder` where this string is returned. Hard-coded to
  // catch drift if the message ever changes.
  const NO_RIDERS = "no riders available";
  const PAGE = 50;
  // Drain STAT in pages until the queue is empty. Hard preemption: we
  // must not start any routine dispatch while a single eligible STAT
  // order remains, so there is no upper cap on iterations — only the
  // empty-page break and a no-progress safety. Both are necessary:
  //   - empty-page break: normal exit when all STATs were assigned;
  //   - no-progress break: every STAT in the page failed with
  //     `NO_RIDERS`, meaning the rider pool is exhausted and re-paging
  //     would loop forever over the same rows.
  while (true) {
    const statBatch = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.orderKind, "meal"),
          // Load-bearing, not merely tidy. dispatchOrder now refuses a
          // non-own_app order outright, and this loop counts a non-NO_RIDERS
          // failure as *progress* — so it would neither assign the row nor
          // break, re-page the same row forever and spin. The scan must not
          // return rows the chokepoint will refuse.
          eq(ordersTable.orderChannel, "own_app"),
          inArray(ordersTable.status, liveStatuses),
          isNull(ordersTable.riderId),
          eq(ordersTable.priority, "stat"),
        ),
      )
      .orderBy(asc(ordersTable.createdAt))
      .limit(PAGE);
    if (statBatch.length === 0) break;
    statAttempted += statBatch.length;
    let progressed = 0;
    let noRiders = false;
    for (const o of statBatch) {
      try {
        const r = await dispatchOrder(o.id, { ...opts, allowBatch: false });
        results.push(r);
        if (r.ok) progressed += 1;
        else if (r.reason === NO_RIDERS) noRiders = true;
        else progressed += 1; // "order not found" / "already assigned" etc.
      } catch (err) {
        logger.error({ err, orderId: o.id }, "dispatchReadyOrders STAT failed");
        progressed += 1;
      }
    }
    if (progressed === 0 && noRiders) break;
  }
  // Hard-preemption gate: if any STAT order is still pending after the
  // STAT pass (i.e. it broke on the no-riders sentinel), skip the
  // routine pass entirely. Otherwise the routine pass — which is
  // allowed to *batch* onto already-assigned riders — could place
  // routine orders while STAT orders sit unassigned, defeating the
  // entire preemption guarantee.
  const [pendingStat] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.orderKind, "meal"),
        // Must match the STAT scan exactly. If this counted a channel the scan
        // skips, the gate would see a STAT order "still pending" that the scan
        // can never assign, and the routine pass would be starved forever.
        eq(ordersTable.orderChannel, "own_app"),
        inArray(ordersTable.status, liveStatuses),
        isNull(ordersTable.riderId),
        eq(ordersTable.priority, "stat"),
      ),
    );
  if ((pendingStat?.n ?? 0) > 0) {
    return {
      attempted: statAttempted,
      assigned: results.filter((r) => r.ok).length,
      slaBreaches,
      results,
    };
  }
  // Routine pass only after STAT is fully drained. Same paging shape so
  // a saturated routine queue isn't truncated to 50 either.
  while (true) {
    const otherBatch = await db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.orderKind, "meal"),
          // Same reason as the STAT scan: this loop has the identical
          // re-page-on-no-progress shape.
          eq(ordersTable.orderChannel, "own_app"),
          inArray(ordersTable.status, liveStatuses),
          isNull(ordersTable.riderId),
          sql`${ordersTable.priority} <> 'stat'`,
        ),
      )
      .orderBy(asc(ordersTable.createdAt))
      .limit(PAGE);
    if (otherBatch.length === 0) break;
    otherAttempted += otherBatch.length;
    let progressed = 0;
    let noRiders = false;
    for (const o of otherBatch) {
      try {
        const r = await dispatchOrder(o.id, opts);
        results.push(r);
        if (r.ok) progressed += 1;
        else if (r.reason === NO_RIDERS) noRiders = true;
        else progressed += 1;
      } catch (err) {
        logger.error({ err, orderId: o.id }, "dispatchReadyOrders failed");
        progressed += 1;
      }
    }
    if (progressed === 0 && noRiders) break;
  }
  return {
    attempted: statAttempted + otherAttempted,
    assigned: results.filter((r) => r.ok).length,
    slaBreaches,
    results,
  };
}

/**
 * Find every STAT order that is past the dispatch SLA, still without a
 * rider, and has not already been flagged. Stamp `sla_breach_at` and
 * emit one `sla_breach` delivery event per row. Returns the breach count.
 *
 * The UPDATE ... RETURNING runs as a single statement so two competing
 * dispatch loops can't both observe the row as un-flagged — Postgres
 * row locks serialise them and the loser sees zero rows in its RETURNING.
 */
async function scanAndEmitStatSlaBreaches(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STAT_DISPATCH_SLA_MIN * 60_000);
  // Stamp + event-insert MUST commit atomically: if we marked the row
  // and then crashed before inserting the event, the next loop would
  // skip the row (slaBreachAt is set) and the breach would be silently
  // lost. The transaction rolls back the stamp on any insert failure
  // so the next loop will re-detect and re-emit.
  const breached = await db.transaction(async (tx) => {
    const rows = await tx
      .update(ordersTable)
      .set({ slaBreachAt: now })
      .where(
        and(
          eq(ordersTable.priority, "stat"),
          isNull(ordersTable.riderId),
          isNull(ordersTable.slaBreachAt),
          // No "placed": an abandoned unpaid STAT order must not stamp a
          // permanent SLA breach five minutes after checkout.
          inArray(ordersTable.status, [...FULFILMENT_ASSIGNABLE_STATUSES]),
          lte(ordersTable.createdAt, cutoff),
        ),
      )
      .returning({
        id: ordersTable.id,
        createdAt: ordersTable.createdAt,
        status: ordersTable.status,
      });
    if (rows.length === 0) return [];
    const eventRows = rows.map((r) => ({
      orderId: r.id,
      event: "sla_breach",
      meta: {
        priority: "stat",
        thresholdMin: STAT_DISPATCH_SLA_MIN,
        ageMin:
          Math.round(
            ((now.getTime() - new Date(r.createdAt).getTime()) / 60_000) * 10,
          ) / 10,
        status: r.status,
      } as Record<string, unknown>,
    }));
    await tx.insert(deliveryEventsTable).values(eventRows);
    return rows.map((r) => ({
      orderId: r.id,
      ageMin:
        Math.round(
          ((now.getTime() - new Date(r.createdAt).getTime()) / 60_000) * 10,
        ) / 10,
    }));
  });
  // Real-time fan-out happens after commit so subscribers never see a
  // breach that has been rolled back.
  for (const b of breached) {
    emitDeliveryEvent(b.orderId, {
      event: "sla_breach",
      priority: "stat",
      thresholdMin: STAT_DISPATCH_SLA_MIN,
      ageMin: b.ageMin,
    });
  }
  return breached.length;
}

/**
 * Promote / demote an order between routine|urgent|stat. Writes an
 * audit row (the only callers should be staff endpoints). Returns the
 * row before and after so the route layer can surface the transition.
 */
export async function setOrderPriority(args: {
  orderId: number;
  priority: OrderPriority;
  operatorId: string;
  reason?: string;
}): Promise<
  | { ok: true; before: OrderPriority; after: OrderPriority }
  | { ok: false; reason: string }
> {
  const validated: OrderPriority = args.priority;
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select({ priority: ordersTable.priority, status: ordersTable.status })
      .from(ordersTable)
      .where(eq(ordersTable.id, args.orderId))
      .limit(1);
    if (!before) return { ok: false as const, reason: "order not found" };
    const set: Record<string, unknown> = { priority: validated };
    // Demoting away from STAT also clears any prior breach flag so a
    // future STAT promotion gets a fresh SLA window.
    if (validated !== "stat" && before.priority === "stat") {
      set["slaBreachAt"] = null;
    }
    await tx
      .update(ordersTable)
      .set(set)
      .where(eq(ordersTable.id, args.orderId));
    await recordOpsAction(
      {
        operatorId: args.operatorId,
        agent: "ops_console",
        action: "set_order_priority",
        params: { orderId: args.orderId, priority: validated },
        beforeState: { priority: before.priority },
        afterState: { priority: validated },
        status: "success",
        reasoning: args.reason ?? `priority -> ${validated}`,
      },
      tx,
    );
    return {
      ok: true as const,
      before: before.priority as OrderPriority,
      after: validated,
    };
  });
}

// Task #7 bulkhead — total wall-clock budget for the NOWAIT retry loop.
// Kept WELL under the 2 s SLO so even with the maximum number of
// retries the override responds inside the SLO. Each attempt that
// fails with `lock_not_available` (Postgres SQLSTATE 55P03) waits a
// short, jittered backoff and retries.
const OVERRIDE_NOWAIT_TOTAL_BUDGET_MS = 500;
const OVERRIDE_NOWAIT_BASE_BACKOFF_MS = 30;
const OVERRIDE_NOWAIT_MAX_BACKOFF_MS = 120;

function isLockNotAvailable(err: unknown): boolean {
  // Postgres throws SQLSTATE 55P03 ("lock_not_available") when a
  // FOR UPDATE NOWAIT can't acquire. node-postgres surfaces it as
  // err.code === '55P03', but drizzle re-wraps the error as a
  // DrizzleQueryError with the original on `.cause` — so we walk
  // the cause chain. Match defensively on the message text too.
  let cur: unknown = err;
  for (let depth = 0; depth < 5 && cur; depth++) {
    if (typeof cur !== "object") return false;
    const e = cur as { code?: string; message?: string; cause?: unknown };
    if (e.code === "55P03") return true;
    if (
      typeof e.message === "string" &&
      /lock_not_available|could not obtain lock/i.test(e.message)
    ) {
      return true;
    }
    cur = e.cause;
  }
  return false;
}

export async function overrideAssignment(args: {
  orderId: number;
  riderId: number;
  operatorId: string;
  notes?: string;
}): Promise<{
  ok: boolean;
  reason?: string;
  code?: "lock_busy" | "rider_unavailable" | "not_found";
  decisionId?: number;
}> {
  // Read order + rider from the OVERRIDE pool so even pre-flight reads
  // can't queue behind the main pool's saturated dispatch traffic.
  const [order] = await overrideDb
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, args.orderId))
    .limit(1);
  if (!order) return { ok: false, reason: "order not found", code: "not_found" };
  // The manual override is the one path that assigns a rider without going
  // through dispatchOrder, so it needs the invariant stated separately: an
  // operator cannot hand one of our riders to an order that arrived through
  // someone else's app, however deliberately they click.
  if (order.orderChannel !== "own_app")
    return { ok: false, reason: "not an own-app order", code: "not_found" };
  // lib/paidGate.ts's own contract: overrideAssignment is the status-free
  // human escape hatch for ASSIGNMENT (an operator may override which rider
  // an already-payable order gets, bypassing the scoring algorithm), never
  // for PAYMENT — it must still refuse an order whose payment has not
  // resolved. Paid-LIVE, not assignable: a deliberate reassignment of an
  // in-flight rider is a legitimate use of this path.
  if (!isPaidLive(order.status))
    return {
      ok: false,
      reason: "order not in a paid-live status",
      code: "not_found",
    };
  const [rider] = await overrideDb
    .select()
    .from(ridersTable)
    .where(eq(ridersTable.id, args.riderId))
    .limit(1);
  if (!rider) return { ok: false, reason: "rider not found", code: "not_found" };
  if (rider.status !== "online")
    return {
      ok: false,
      reason: `rider is ${rider.status}`,
      code: "rider_unavailable",
    };

  const drop = orderDropLatLng(order);
  const chosen = scoreRiderForOrder(rider, drop);

  // Retry loop wrapping the whole transaction. We retry the WHOLE tx,
  // not just the lock acquisition, because once `for update nowait`
  // throws Postgres has already aborted the surrounding tx.
  const startedAt = Date.now();
  let attempt = 0;
  let lastLockErr: unknown = null;
  while (Date.now() - startedAt < OVERRIDE_NOWAIT_TOTAL_BUDGET_MS) {
    attempt += 1;
    try {
      const txResult = await runOverrideTx(args, rider, chosen);
      if (!txResult.ok) {
        return { ok: false, reason: txResult.reason, code: "not_found" };
      }
      emitDeliveryEvent(args.orderId, {
        event: "rider_assigned",
        riderId: rider.id,
        riderName: rider.name,
        override: true,
      });
      return { ok: true, decisionId: txResult.decisionId ?? undefined };
    } catch (err) {
      if (!isLockNotAvailable(err)) throw err;
      lastLockErr = err;
      // Jittered exponential-ish backoff, but capped tight.
      const backoff = Math.min(
        OVERRIDE_NOWAIT_MAX_BACKOFF_MS,
        OVERRIDE_NOWAIT_BASE_BACKOFF_MS * 2 ** (attempt - 1),
      );
      const jitter = Math.floor(Math.random() * (backoff / 2));
      await new Promise((r) => setTimeout(r, backoff + jitter));
    }
  }
  logger.warn(
    { orderId: args.orderId, attempts: attempt, lastLockErr },
    "override_lock_busy: NOWAIT budget exhausted",
  );
  return {
    ok: false,
    reason: "lock_busy",
    code: "lock_busy",
  };
}

async function runOverrideTx(
  args: {
    orderId: number;
    riderId: number;
    operatorId: string;
    notes?: string;
  },
  rider: Rider,
  chosen: ReturnType<typeof scoreRiderForOrder>,
): Promise<
  | { ok: true; decisionId: number | null }
  | { ok: false; reason: string }
> {
  return overrideDb.transaction(async (tx) => {
    const lockedRows = await tx.execute<{
      id: number;
      rider_id: number | null;
      status: string;
    }>(
      sql`select id, rider_id, status from ${ordersTable}
          where id = ${args.orderId} for update nowait`,
    );
    const locked = (lockedRows.rows ?? lockedRows)[0] as
      | { id: number; rider_id: number | null; status: string }
      | undefined;
    if (!locked) throw new Error("order vanished mid-override");
    // Authoritative re-check UNDER the row lock — the pre-flight check in
    // overrideAssignment is unlocked, so a concurrent cancel or
    // payment-failed webhook can land between peek and claim.
    if (!isPaidLive(locked.status)) {
      return {
        ok: false as const,
        reason: "order not in a paid-live status",
      };
    }
    const before = { riderId: locked.rider_id, status: locked.status };
    if (locked.rider_id !== rider.id) {
      if (locked.rider_id != null) {
        await tx
          .update(ridersTable)
          .set({
            activeOrderCount: sql`GREATEST(${ridersTable.activeOrderCount} - 1, 0)`,
          })
          .where(eq(ridersTable.id, locked.rider_id));
      }
      await tx
        .update(ridersTable)
        .set({ activeOrderCount: sql`${ridersTable.activeOrderCount} + 1` })
        .where(eq(ridersTable.id, rider.id));
    }
    await tx
      .update(ordersTable)
      .set({ riderId: rider.id, status: "rider_assigned" })
      .where(eq(ordersTable.id, args.orderId));
    await tx.insert(deliveryEventsTable).values({
      orderId: args.orderId,
      riderId: rider.id,
      event: "rider_assigned",
      meta: {
        strategy: "override",
        operatorId: args.operatorId,
        riderName: rider.name,
        notes: args.notes,
      },
    });
    const [row] = await tx
      .insert(dispatchDecisionsTable)
      .values({
        batchKey: newBatchKey(),
        orderId: args.orderId,
        chosenRiderId: rider.id,
        chosenScore: chosen.score,
        chosenBreakdown:
          chosen.breakdown as unknown as Record<string, number | string>,
        chosenDistanceKm: chosen.breakdown.distanceKm,
        strategy: "override",
        batched: 0,
        operatorId: args.operatorId,
        notes: args.notes ?? null,
      })
      .returning({ id: dispatchDecisionsTable.id });
    // Task #7 bulkhead: enqueue audit to the outbox in the SAME tx
    // so the override commits atomically with its audit intent, but
    // the actual `ops_actions` insert happens off the critical path
    // by the background drain worker.
    //
    // Stable dedupe key: a logical override of `(operator, order, rider,
    // priorAssignment)` is the same EVENT regardless of how many times
    // the client retries the HTTP request. The unique constraint on
    // `dedupeKey` plus ON CONFLICT DO NOTHING collapses retries to one
    // audit row. We deliberately exclude wall-clock / random nonces.
    const dedupeKey =
      `override_dispatch:${args.operatorId}:${args.orderId}:${rider.id}` +
      `:${before.riderId ?? "none"}:${before.status}`;
    await enqueueOpsAuditOutbox(
      {
        operatorId: args.operatorId,
        agent: "ops_console",
        action: "override_dispatch",
        params: { orderId: args.orderId, riderId: rider.id },
        beforeState: before,
        afterState: { riderId: rider.id, status: "rider_assigned" },
        status: "success",
        reasoning: args.notes ?? "manual override",
      },
      tx,
      dedupeKey,
    );
    return { ok: true as const, decisionId: row?.id ?? null };
  });
}

// ─── Reporting ─────────────────────────────────────────────────────────────

export interface DispatchComparisonRow {
  day: string;
  decisions: number;
  smartTotalKm: number;
  baselineTotalKm: number;
  meanSavingsKm: number;
  batchedShare: number; // 0..1
}

export async function dispatchComparison(opts: {
  sinceDays?: number;
}): Promise<DispatchComparisonRow[]> {
  const sinceDays = opts.sinceDays ?? 14;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${dispatchDecisionsTable.createdAt}), 'YYYY-MM-DD')`,
      decisions: sql<number>`count(*)::int`,
      smartTotalKm: sql<number>`coalesce(sum(${dispatchDecisionsTable.chosenDistanceKm}), 0)::float`,
      baselineTotalKm: sql<number>`coalesce(sum(${dispatchDecisionsTable.baselineDistanceKm}), 0)::float`,
      batchedShare: sql<number>`(sum(${dispatchDecisionsTable.batched}))::float / nullif(count(*), 0)`,
    })
    .from(dispatchDecisionsTable)
    .where(
      and(
        gte(dispatchDecisionsTable.createdAt, since),
        eq(dispatchDecisionsTable.strategy, "smart"),
      ),
    )
    .groupBy(sql`date_trunc('day', ${dispatchDecisionsTable.createdAt})`)
    .orderBy(desc(sql`date_trunc('day', ${dispatchDecisionsTable.createdAt})`));
  return rows.map((r) => ({
    day: r.day,
    decisions: r.decisions,
    smartTotalKm: Math.round((r.smartTotalKm ?? 0) * 10) / 10,
    baselineTotalKm: Math.round((r.baselineTotalKm ?? 0) * 10) / 10,
    meanSavingsKm:
      Math.round(
        ((r.baselineTotalKm - r.smartTotalKm) / Math.max(1, r.decisions)) * 100,
      ) / 100,
    batchedShare: Math.round((r.batchedShare ?? 0) * 1000) / 1000,
  }));
}

export async function recentDispatchDecisions(limit = 20): Promise<
  Array<{
    id: number;
    orderId: number;
    chosenRiderId: number | null;
    baselineRiderId: number | null;
    chosenDistanceKm: number | null;
    baselineDistanceKm: number | null;
    strategy: string;
    notes: string | null;
    createdAt: string;
  }>
> {
  const rows = await db
    .select()
    .from(dispatchDecisionsTable)
    .orderBy(desc(dispatchDecisionsTable.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    chosenRiderId: r.chosenRiderId,
    baselineRiderId: r.baselineRiderId,
    chosenDistanceKm: r.chosenDistanceKm,
    baselineDistanceKm: r.baselineDistanceKm,
    strategy: r.strategy,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }));
}
