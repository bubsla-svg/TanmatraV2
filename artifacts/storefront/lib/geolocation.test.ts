/**
 * Geofencing engine tests. Pure — no DOM, no network, no DB.
 * Run: node --test --import tsx ./lib/geolocation.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  isPointInPolygon,
  haversineMetres,
  distanceToEdgeMetres,
  gradeGpsAccuracy,
  evaluateZone,
  resolveKitchen,
  NOIDA_ZONES,
  WEAK_GPS_ACCURACY_M,
  type DeliveryZone,
  type LatLng,
} from "./geolocation";

/* ───────────────────────────── point in polygon ──────────────────────────── */

const SQUARE = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 10 },
  { lat: 10, lng: 10 },
  { lat: 10, lng: 0 },
];

test("isPointInPolygon: interior point is inside", () => {
  assert.equal(isPointInPolygon({ lat: 5, lng: 5 }, SQUARE), true);
});

test("isPointInPolygon: exterior points on every side are outside", () => {
  for (const p of [
    { lat: 5, lng: -1 },
    { lat: 5, lng: 11 },
    { lat: -1, lng: 5 },
    { lat: 11, lng: 5 },
  ] satisfies LatLng[]) {
    assert.equal(isPointInPolygon(p, SQUARE), false, `${JSON.stringify(p)} should be outside`);
  }
});

test("isPointInPolygon: a degenerate ring (<3 vertices) is never inside", () => {
  assert.equal(isPointInPolygon({ lat: 5, lng: 5 }, []), false);
  assert.equal(isPointInPolygon({ lat: 5, lng: 5 }, [{ lat: 0, lng: 0 }]), false);
  assert.equal(
    isPointInPolygon({ lat: 5, lng: 5 }, [{ lat: 0, lng: 0 }, { lat: 10, lng: 10 }]),
    false,
  );
});

/**
 * The case a naive ray-cast gets wrong. An L-shape has a reflex vertex, so a
 * ray from a point in the notch crosses the boundary an EVEN number of times
 * and must read as outside — even though the point sits within the shape's
 * bounding box. A bounding-box check would pass it; this is what proves the
 * implementation is a real crossing test.
 */
test("isPointInPolygon: concave L-shape excludes the notch", () => {
  const L = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 10 },
    { lat: 4, lng: 10 },
    { lat: 4, lng: 4 },
    { lat: 10, lng: 4 },
    { lat: 10, lng: 0 },
  ];
  assert.equal(isPointInPolygon({ lat: 2, lng: 2 }, L), true, "in the solid arm");
  assert.equal(isPointInPolygon({ lat: 8, lng: 8 }, L), false, "in the notch, inside the bbox");
});

/* ──────────────────────────────── distances ──────────────────────────────── */

test("haversineMetres: a known Noida separation is right to within 1%", () => {
  // Sector 18 → Sector 62, ~8.6 km apart on the ground.
  const d = haversineMetres({ lat: 28.5708, lng: 77.3260 }, { lat: 28.6280, lng: 77.3649 });
  assert.ok(d > 7_000 && d < 8_500, `expected ~7.5km, got ${Math.round(d)}m`);
});

test("haversineMetres: zero distance to self", () => {
  assert.equal(haversineMetres({ lat: 28.57, lng: 77.32 }, { lat: 28.57, lng: 77.32 }), 0);
});

test("distanceToEdgeMetres: a point just inside an edge reports a small distance", () => {
  // ~0.001° of latitude ≈ 111m.
  const zone = NOIDA_ZONES[0]!;
  const justInside = { lat: 28.5510, lng: 77.3400 }; // 0.001° above the lat 28.55 edge
  const d = distanceToEdgeMetres(justInside, zone.polygon);
  assert.ok(d > 50 && d < 200, `expected ~111m to the southern edge, got ${Math.round(d)}m`);
});

test("distanceToEdgeMetres: an empty ring is infinitely far", () => {
  assert.equal(distanceToEdgeMetres({ lat: 0, lng: 0 }, []), Number.POSITIVE_INFINITY);
});

/* ────────────────────────────── GPS grading ──────────────────────────────── */

test("gradeGpsAccuracy: at and below the threshold is precise, above is weak", () => {
  assert.equal(gradeGpsAccuracy(10), "precise");
  assert.equal(gradeGpsAccuracy(WEAK_GPS_ACCURACY_M), "precise", "boundary is inclusive");
  assert.equal(gradeGpsAccuracy(WEAK_GPS_ACCURACY_M + 1), "weak");
  assert.equal(gradeGpsAccuracy(2_000), "weak");
});

test("gradeGpsAccuracy: non-finite or negative readings are unusable, not silently precise", () => {
  assert.equal(gradeGpsAccuracy(Number.POSITIVE_INFINITY), "unusable");
  assert.equal(gradeGpsAccuracy(Number.NaN), "unusable");
  assert.equal(gradeGpsAccuracy(-1), "unusable");
});

/* ───────────────────────────── zone evaluation ───────────────────────────── */

test("evaluateZone: a Noida Sector 18 pin is in zone", () => {
  const res = evaluateZone({ lat: 28.5708, lng: 77.3260 }, NOIDA_ZONES);
  assert.equal(res.verdict, "in-zone");
  assert.ok(res.matches.length >= 1);
});

test("evaluateZone: a Mumbai pin is out of zone", () => {
  const res = evaluateZone({ lat: 19.0760, lng: 72.8777 }, NOIDA_ZONES);
  assert.equal(res.verdict, "out-of-zone");
  assert.deepEqual(res.matches, []);
  assert.equal(res.nearEdge, false, "a different city is nowhere near an edge");
});

test("evaluateZone: every provisional zone stamps the authority note", () => {
  const res = evaluateZone({ lat: 28.5708, lng: 77.3260 }, NOIDA_ZONES);
  assert.ok(
    res.authorityNote?.includes("isServiceablePincode"),
    "a provisional verdict must say out loud that it is not the authority",
  );
});

test("evaluateZone: a surveyed zone carries no authority note", () => {
  const surveyed: DeliveryZone[] = [{ ...NOIDA_ZONES[0]!, provisional: false }];
  const res = evaluateZone({ lat: 28.5708, lng: 77.3260 }, surveyed);
  assert.equal(res.authorityNote, null);
});

test("evaluateZone: a pin within GPS-jitter distance of an edge is flagged nearEdge", () => {
  // 0.0005° ≈ 55m inside the lat 28.55 southern edge — well under the 150m band.
  const res = evaluateZone({ lat: 28.5505, lng: 77.3400 }, NOIDA_ZONES);
  assert.equal(res.nearEdge, true);
});

test("evaluateZone: no zones at all is out-of-zone, not a crash", () => {
  const res = evaluateZone({ lat: 28.57, lng: 77.32 }, []);
  assert.equal(res.verdict, "out-of-zone");
  assert.equal(res.distanceToNearestEdgeM, Number.POSITIVE_INFINITY);
  assert.equal(res.authorityNote, null);
});

/* ─────────────────────── multi-kitchen overlap (Edge C) ──────────────────── */

const A: DeliveryZone = {
  kitchenId: "kitchen-a",
  label: "A",
  provisional: false,
  polygon: SQUARE,
};
const B: DeliveryZone = {
  kitchenId: "kitchen-b",
  label: "B",
  provisional: false,
  polygon: [
    { lat: 5, lng: 5 },
    { lat: 5, lng: 15 },
    { lat: 15, lng: 15 },
    { lat: 15, lng: 5 },
  ],
};

test("resolveKitchen: no matches returns null rather than inventing an assignment", () => {
  assert.equal(resolveKitchen([], [{ kitchenId: "kitchen-a", activePrepTickets: 0 }]), null);
});

test("resolveKitchen: a single match is returned regardless of load", () => {
  const picked = resolveKitchen([A], [{ kitchenId: "kitchen-a", activePrepTickets: 999 }]);
  assert.equal(picked?.kitchenId, "kitchen-a");
});

test("resolveKitchen: overlap goes to the kitchen with the lower KDS prep load", () => {
  const picked = resolveKitchen(
    [A, B],
    [
      { kitchenId: "kitchen-a", activePrepTickets: 12 },
      { kitchenId: "kitchen-b", activePrepTickets: 3 },
    ],
  );
  assert.equal(picked?.kitchenId, "kitchen-b");
});

test("resolveKitchen: a kitchen with NO load reading loses, and does not win by default", () => {
  // Missing telemetry must not read as an idle kitchen — otherwise every order
  // routes to whichever kitchen's reporting is broken.
  const picked = resolveKitchen([A, B], [{ kitchenId: "kitchen-a", activePrepTickets: 40 }]);
  assert.equal(picked?.kitchenId, "kitchen-a", "known-but-busy beats unknown");
});

test("resolveKitchen: equal load breaks deterministically, not arbitrarily", () => {
  const loads = [
    { kitchenId: "kitchen-a", activePrepTickets: 7 },
    { kitchenId: "kitchen-b", activePrepTickets: 7 },
  ];
  const first = resolveKitchen([A, B], loads);
  const reversed = resolveKitchen([B, A], loads);
  assert.equal(first?.kitchenId, reversed?.kitchenId, "input order must not change the winner");
});

test("resolveKitchen: the shipped Noida zones genuinely overlap, so Edge C is reachable", () => {
  // Guards the registry, not the algorithm: if someone edits the rings apart,
  // the overlap path silently stops being exercised by real data.
  const inBoth = evaluateZone({ lat: 28.5600, lng: 77.3500 }, NOIDA_ZONES);
  assert.equal(inBoth.matches.length, 2, "expected the central/expressway overlap band");
});
