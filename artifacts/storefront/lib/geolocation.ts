/**
 * Polygon geofencing for delivery-zone evaluation.
 *
 * ── READ THIS BEFORE WIRING IT TO ANYTHING THAT GATES A REAL DELIVERY ───────
 * The ALGORITHMS here are real, verified and unit-tested. The ZONE COORDINATES
 * are NOT surveyed operational data — they are provisional bounding shapes,
 * flagged as such on every zone (`provisional: true`), and they must be
 * replaced with coordinates an operator has actually confirmed against the
 * kitchen's real 40-minute drive-time isochrone before anything downstream
 * treats them as authority.
 *
 * Until that happens, `isServiceablePincode` (lib/api-zod, 8 Noida pincodes)
 * REMAINS the serviceability authority, and `evaluateZone` is advisory: use it
 * to refine UX (which kitchen, how confident, is the pin near an edge), never
 * to overrule the pincode check. `authorityNote` on the result says so at the
 * call site so this cannot be forgotten by someone reading only the return
 * type.
 *
 * The reason for that split is not caution theatre. A polygon invented from
 * map intuition that says "serviceable" for an address the kitchen cannot
 * reach in 40 minutes produces an accepted order, a cold-chain breach and a
 * refund — the exact failure the strict thermal standard exists to prevent.
 * Guessing coordinates is cheap; the consequence is not.
 */

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

/** A closed ring. First and last vertex need not be repeated. */
export type Polygon = readonly LatLng[];

export interface DeliveryZone {
  readonly kitchenId: string;
  readonly label: string;
  readonly polygon: Polygon;
  /** True while the ring is an unsurveyed approximation. See the file header. */
  readonly provisional: boolean;
}

/**
 * Ray-casting point-in-polygon (crossing number).
 *
 * Chosen over a winding-number test because these rings are simple (non
 * self-intersecting) and ray casting is branch-cheap and allocation-free.
 *
 * Boundary behaviour is deliberately NOT specified as "inside" or "outside":
 * a pin that lands exactly on an edge is a coin flip in floating point, and
 * pretending otherwise invites a bug that reproduces once a month. Callers
 * that care about the margin should use `distanceToEdgeMetres` and treat a
 * near-zero result as "ask the user to drag the pin", which is what the
 * onboarding flow already asks them to do for weak GPS.
 */
export function isPointInPolygon(point: LatLng, polygon: Polygon): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const straddles = a.lat > point.lat !== b.lat > point.lat;
    if (!straddles) continue;
    // x-coordinate of the edge at the point's latitude.
    const crossLng = ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (point.lng < crossLng) inside = !inside;
  }
  return inside;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMetres(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Shortest distance from `point` to any edge of `polygon`, in metres. */
export function distanceToEdgeMetres(point: LatLng, polygon: Polygon): number {
  if (polygon.length === 0) return Number.POSITIVE_INFINITY;
  if (polygon.length === 1) return haversineMetres(point, polygon[0]!);

  let min = Number.POSITIVE_INFINITY;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    min = Math.min(min, distanceToSegmentMetres(point, polygon[j]!, polygon[i]!));
  }
  return min;
}

/**
 * Point-to-segment distance via a local equirectangular projection.
 *
 * Exact geodesic cross-track distance is overkill at city scale: over a few km
 * at Noida's latitude the projection error is well under a metre, which is far
 * below the GPS accuracy this is compared against. Using it keeps the maths
 * closed-form instead of iterative.
 */
function distanceToSegmentMetres(p: LatLng, a: LatLng, b: LatLng): number {
  const latRef = toRad((a.lat + b.lat) / 2);
  const x = (q: LatLng): number => toRad(q.lng) * Math.cos(latRef) * EARTH_RADIUS_M;
  const y = (q: LatLng): number => toRad(q.lat) * EARTH_RADIUS_M;

  const px = x(p);
  const py = y(p);
  const ax = x(a);
  const ay = y(a);
  const bx = x(b);
  const by = y(b);

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  // Projection parameter, clamped to the segment.
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/* ─────────────────────────── GPS accuracy grading ────────────────────────── */

/**
 * Above this radius a browser fix is cell-tower triangulation, not GPS, and
 * cannot be trusted to identify a building — which is what a 6 AM doorstep
 * drop needs. The onboarding flow surfaces a "drag the pin" prompt at this
 * threshold rather than silently accepting the fix.
 */
export const WEAK_GPS_ACCURACY_M = 150;

export type GpsConfidence = "precise" | "weak" | "unusable";

/**
 * `accuracy` is `GeolocationCoordinates.accuracy` — the 68th-percentile radius
 * in metres. It is never negative and never absent in practice, but it IS
 * sometimes `Infinity` on desktop browsers with no location hardware, so that
 * case is graded explicitly rather than compared into a silent `false`.
 */
export function gradeGpsAccuracy(accuracyMetres: number): GpsConfidence {
  if (!Number.isFinite(accuracyMetres) || accuracyMetres < 0) return "unusable";
  return accuracyMetres > WEAK_GPS_ACCURACY_M ? "weak" : "precise";
}

/* ──────────────────────────── zone evaluation ────────────────────────────── */

export type ZoneVerdict = "in-zone" | "out-of-zone";

export interface ZoneEvaluation {
  readonly verdict: ZoneVerdict;
  /** Every zone containing the point. Length > 1 means an overlap. */
  readonly matches: readonly DeliveryZone[];
  /** Metres to the nearest zone edge — inside or outside, always positive. */
  readonly distanceToNearestEdgeM: number;
  /** True when the pin sits close enough to an edge that GPS jitter could flip
   *  the verdict. Callers should ask the user to confirm rather than decide. */
  readonly nearEdge: boolean;
  /** Set while any consulted zone is provisional. Non-empty means DO NOT gate
   *  a real delivery on `verdict` alone. */
  readonly authorityNote: string | null;
}

/** Inside this band of an edge, a weak fix could put the pin on either side. */
const EDGE_UNCERTAINTY_M = WEAK_GPS_ACCURACY_M;

export function evaluateZone(point: LatLng, zones: readonly DeliveryZone[]): ZoneEvaluation {
  const matches = zones.filter((z) => isPointInPolygon(point, z.polygon));
  const distanceToNearestEdgeM = zones.reduce(
    (min, z) => Math.min(min, distanceToEdgeMetres(point, z.polygon)),
    Number.POSITIVE_INFINITY,
  );
  const consulted = matches.length > 0 ? matches : zones;
  const provisional = consulted.some((z) => z.provisional);

  return {
    verdict: matches.length > 0 ? "in-zone" : "out-of-zone",
    matches,
    distanceToNearestEdgeM,
    nearEdge: distanceToNearestEdgeM <= EDGE_UNCERTAINTY_M,
    authorityNote: provisional
      ? "Provisional zone geometry — advisory only. isServiceablePincode remains the serviceability authority."
      : null,
  };
}

/* ───────────────────── multi-kitchen overlap resolution ──────────────────── */

export interface KitchenLoad {
  readonly kitchenId: string;
  /** Open tickets on the kitchen display system right now. */
  readonly activePrepTickets: number;
}

/**
 * Pick which kitchen serves a pin that falls inside more than one zone.
 *
 * Lowest current KDS prep load wins. Ties break on `kitchenId` — arbitrary but
 * DETERMINISTIC, which matters more than which one wins: a non-deterministic
 * tiebreak means the same address can be assigned to different kitchens on two
 * reads, and a subscription that hops kitchens mid-cycle breaks batching.
 *
 * A kitchen with no load reading is treated as MAXIMALLY loaded, not zero.
 * Missing telemetry is not evidence of an idle kitchen, and defaulting it to 0
 * would route every order at the one kitchen whose reporting is broken.
 *
 * Returns null when `matches` is empty so the caller must handle out-of-zone
 * explicitly instead of receiving a fabricated assignment.
 */
export function resolveKitchen(
  matches: readonly DeliveryZone[],
  loads: readonly KitchenLoad[],
): DeliveryZone | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;

  const loadOf = (kitchenId: string): number =>
    loads.find((l) => l.kitchenId === kitchenId)?.activePrepTickets ??
    Number.POSITIVE_INFINITY;

  return [...matches].sort((a, b) => {
    const delta = loadOf(a.kitchenId) - loadOf(b.kitchenId);
    return delta !== 0 ? delta : a.kitchenId.localeCompare(b.kitchenId);
  })[0]!;
}

/* ────────────────────────────── zone registry ────────────────────────────── */

/**
 * PROVISIONAL Noida delivery geometry. Every ring here is a coarse bounding
 * shape drawn to exercise the engine, NOT a surveyed isochrone — hence
 * `provisional: true` on all of them, which makes `evaluateZone` stamp its
 * `authorityNote` on every result.
 *
 * Replacing these is an operations task, not a coding one: it needs the real
 * 40-minute drive-time boundary per kitchen, at the hours deliveries actually
 * run. When that arrives, flip `provisional` to false per zone and the note
 * clears itself.
 */
export const NOIDA_ZONES: readonly DeliveryZone[] = [
  {
    kitchenId: "noida-central",
    label: "Noida Central",
    provisional: true,
    polygon: [
      { lat: 28.6100, lng: 77.3050 },
      { lat: 28.6100, lng: 77.3700 },
      { lat: 28.5500, lng: 77.3700 },
      { lat: 28.5500, lng: 77.3050 },
    ],
  },
  {
    kitchenId: "noida-expressway",
    label: "Noida Expressway",
    provisional: true,
    // Deliberately overlaps `noida-central` between lat 28.5500–28.5700 so the
    // overlap path in `resolveKitchen` is exercised by real data, not only by
    // a synthetic test fixture.
    polygon: [
      { lat: 28.5700, lng: 77.3300 },
      { lat: 28.5700, lng: 77.4100 },
      { lat: 28.4900, lng: 77.4100 },
      { lat: 28.4900, lng: 77.3300 },
    ],
  },
];
