import { Router, type IRouter, type Request, type Response } from "express";
import { rateLimit } from "../lib/rateLimit";
import { logger } from "../lib/logger";

/**
 * `/geo/reverse` — server-proxied reverse geocoding for the address picker.
 *
 * The frontend Maps key cannot boot the Maps JS canvas (Maps JavaScript API
 * is not enabled on it), so the browser has no Geocoder. The SERVER key
 * (GOOGLE_API_KEY) does have the Geocoding API enabled — the same key that
 * powers dispatch-distance geocoding in lib/geocode.ts. This route lets the
 * canvas-free picker turn a GPS fix into an address without any Maps JS.
 *
 * Unauthenticated by design (address entry happens pre-auth at checkout),
 * but per-IP rate limited and clamped to India's bounding box so it can't
 * be used as a free worldwide geocoding proxy.
 */

const router: IRouter = Router();

const REVERSE_TIMEOUT_MS = 4_000;
const SEARCH_TIMEOUT_MS = 4_000;
const PLACES_TIMEOUT_MS = 4_000;
const CACHE_MAX = 500;
// ~11m grid — a GPS fix twice from the same spot hits the cache.
const cache = new Map<string, GeoPlace>();
// Normalized-query cache for /geo/search — the same typed area re-searched
// (debounced keystrokes) only costs one upstream call.
const searchCache = new Map<string, GeoPlace[]>();

// Prediction cache for /geo/autocomplete, keyed on the normalized query.
const predictionCache = new Map<string, PlaceSuggestion[]>();
// Resolved-place cache for /geo/place, keyed on placeId. A place id is stable,
// so this never goes stale within a process lifetime.
const placeCache = new Map<string, ResolvedPlace>();

interface GeoPlace {
  formattedAddress: string;
  city: string;
  pincode: string;
}

/**
 * One row in the picker's suggestion list.
 *
 * `placeId` present ⇒ Places (New) prediction; the client resolves it through
 * `/geo/place` on tap, which is what yields a real PIN code and coordinates.
 * `placeId` empty ⇒ the Geocoding fallback below already carries everything it
 * is ever going to know, inline in `place`, so the client uses it as-is
 * rather than issuing a details call that would 404.
 */
interface PlaceSuggestion {
  placeId: string;
  primary: string;
  secondary: string;
  place?: GeoPlace;
}

interface ResolvedPlace extends GeoPlace {
  lat: number;
  lng: number;
}

// GOOGLE_API_KEY is shared with the Gemini AI stack (lib/integrations-gemini-ai,
// ai/model.ts), so a Gemini-motivated key rotation can silently strip the
// Geocoding API from these routes (observed live 2026-07-20: the rotated key
// was Gemini-only and every /geo/* call started returning REQUEST_DENIED).
// GOOGLE_MAPS_API_KEY, when set, decouples Maps from that blast radius.
// Dual-key resilience: return all configured unique keys so if the primary key
// expires or returns REQUEST_DENIED/OVER_QUERY_LIMIT, we automatically retry
// against the fallback key before surfacing an outage.
function getMapsApiKeys(): string[] {
  const keys = [process.env["GOOGLE_MAPS_API_KEY"], process.env["GOOGLE_API_KEY"]].filter(
    (k): k is string => typeof k === "string" && k.trim().length > 0,
  );
  return Array.from(new Set(keys));
}

// Geocoding statuses that mean the KEY/QUOTA is broken, not "no matches".
// These must surface as 502 (the picker shows its honest "search
// unavailable" hint) — never as ok-with-empty-results, which reads as a
// blank address and hides the outage from monitoring.
const KEY_FAILURE_STATUSES = new Set([
  "REQUEST_DENIED",
  "OVER_QUERY_LIMIT",
  "OVER_DAILY_LIMIT",
  "INVALID_REQUEST",
  "UNKNOWN_ERROR",
]);

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function remember(key: string, value: GeoPlace): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (typeof oldest === "string") cache.delete(oldest);
  }
  cache.set(key, value);
}

function rememberSearch(key: string, value: GeoPlace[]): void {
  if (searchCache.size >= CACHE_MAX) {
    const oldest = searchCache.keys().next().value;
    if (typeof oldest === "string") searchCache.delete(oldest);
  }
  searchCache.set(key, value);
}

/**
 * High-precision geographic place extraction for Indian addresses and NCR sectors.
 * Scans across all returned geocoder polygon tiers (premise → sector → sublocality → district)
 * to locate an authoritative 6-digit postal code and descriptive locality name,
 * while preferring clean street formatting over cryptic standalone plus codes.
 */
export function precisePlaceFrom(
  results: Array<{
    formatted_address?: string;
    address_components?: Array<{ long_name: string; types: string[] }>;
  }>,
): GeoPlace {
  if (!results.length) return { formattedAddress: "", city: "", pincode: "" };

  // Prefer human-readable formatted address over raw standalone plus-code prefixes
  let formattedAddress = results[0]?.formatted_address ?? "";
  if (formattedAddress.includes("+") && results.length > 1) {
    for (const r of results) {
      if (r.formatted_address && !r.formatted_address.split(",")[0]?.includes("+")) {
        formattedAddress = r.formatted_address;
        break;
      }
    }
  }

  let city = "";
  let pincode = "";

  // Harvest PIN code across all geometric polygon tiers in the geocode response
  for (const r of results) {
    for (const comp of r.address_components ?? []) {
      if (!pincode && comp.types.includes("postal_code") && /^[0-9]{4,10}$/.test(comp.long_name.trim())) {
        pincode = comp.long_name.trim();
      }
    }
  }

  // Harvest city/locality using hierarchical fallback: locality -> sublocality_level_1 -> sublocality -> administrative_area_level_2
  const cityTypes = ["locality", "sublocality_level_1", "sublocality", "administrative_area_level_2"];
  for (const targetType of cityTypes) {
    if (city) break;
    for (const r of results) {
      for (const comp of r.address_components ?? []) {
        if (comp.types.includes(targetType) && comp.long_name.trim().length > 1) {
          city = comp.long_name.trim();
          break;
        }
      }
      if (city) break;
    }
  }

  return { formattedAddress, city, pincode };
}

/** Pull locality + postal_code out of a single Google address_components array. */
function placeFrom(result: {
  formatted_address?: string;
  address_components?: Array<{ long_name: string; types: string[] }>;
}): GeoPlace {
  return precisePlaceFrom([result]);
}

router.get("/geo/reverse", async (req: Request, res: Response) => {
  const lat = Number(req.query["lat"]);
  const lng = Number(req.query["lng"]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ ok: false, error: "lat and lng are required numbers" });
    return;
  }
  // India bounding box (generous) — this is a delivery-address helper, not
  // a general geocoding proxy.
  if (lat < 6 || lat > 37 || lng < 68 || lng > 98) {
    res.status(400).json({ ok: false, error: "coordinates outside service region" });
    return;
  }

  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const allowed = await rateLimit(`geo:reverse:${ip}`, 60_000, 20);
  if (!allowed) {
    res.status(429).json({ ok: false, error: "rate limited" });
    return;
  }

  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit) {
    res.json({ ok: true, ...hit, cached: true });
    return;
  }

  const apiKeys = getMapsApiKeys();
  if (!apiKeys.length) {
    res.status(503).json({ ok: false, error: "geocoding not configured" });
    return;
  }

  let lastStatus = "502";
  for (const apiKey of apiKeys) {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("region", "in");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REVERSE_TIMEOUT_MS);
    try {
      const gres = await fetch(url.toString(), { signal: ctrl.signal });
      if (!gres.ok) {
        logger.warn({ status: gres.status }, "geo/reverse: google non-200, retrying fallback key if available");
        continue;
      }
      const json = (await gres.json()) as {
        status?: string;
        error_message?: string;
        results?: Array<{
          formatted_address?: string;
          address_components?: Array<{ long_name: string; types: string[] }>;
        }>;
      };
      if (json.status && KEY_FAILURE_STATUSES.has(json.status)) {
        lastStatus = json.status;
        logger.warn(
          { status: json.status },
          "geo/reverse: geocoder key failure on current candidate, retrying fallback key if available",
        );
        continue;
      }
      if (json.status !== "OK" || !json.results?.length) {
        // ZERO_RESULTS is a normal outcome (e.g. open water) — not an error.
        res.json({ ok: true, formattedAddress: "", city: "", pincode: "" });
        return;
      }
      const value = precisePlaceFrom(json.results);
      remember(key, value);
      res.json({ ok: true, ...value });
      return;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "geo/reverse: request failed/timed out on candidate key");
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  logger.error({ status: lastStatus }, "geo/reverse: all configured geocoding API keys exhausted or unavailable");
  res.status(502).json({ ok: false, error: "geocoder unavailable" });
});

/**
 * `/geo/search` — server-proxied forward geocoding (query → candidate
 * addresses) for the picker's search box. Same doctrine as /geo/reverse:
 * this is the fallback the picker uses when the browser Places (New) REST
 * key is absent or its call fails, so the search box is never a silent
 * dead-end. Constrained to India (region=in + components=country:IN),
 * viewport-biased to the NCR service area, and per-IP rate limited so it
 * can't be used as a free geocoding proxy.
 */
router.get("/geo/search", async (req: Request, res: Response) => {
  const q = String(req.query["q"] ?? "").trim();
  if (q.length < 3) {
    res.status(400).json({ ok: false, error: "q must be at least 3 characters" });
    return;
  }

  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const allowed = await rateLimit(`geo:search:${ip}`, 60_000, 20);
  if (!allowed) {
    res.status(429).json({ ok: false, error: "rate limited" });
    return;
  }

  const norm = q.toLowerCase().replace(/\s+/g, " ");
  const hit = searchCache.get(norm);
  if (hit) {
    res.json({ ok: true, results: hit, cached: true });
    return;
  }

  if (!getMapsApiKeys().length) {
    res.status(503).json({ ok: false, error: "geocoding not configured" });
    return;
  }
  const results = await geocodeSearch(q);
  if (results === null) {
    res.status(502).json({ ok: false, error: "geocoder unavailable" });
    return;
  }
  if (results.length > 0) rememberSearch(norm, results);
  res.json({ ok: true, results });
});

/**
 * Forward-geocode `q` into up to five candidate places.
 *
 * Returns `[]` for an honest "no matches" and `null` when every configured key
 * failed — the caller decides whether that is a 502 (/geo/search) or a
 * degraded empty list (/geo/autocomplete's fallback).
 */
async function geocodeSearch(q: string): Promise<GeoPlace[] | null> {
  const apiKeys = getMapsApiKeys();
  if (!apiKeys.length) return null;

  let lastStatus = "502";
  for (const apiKey of apiKeys) {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", q);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("region", "in");
    url.searchParams.set("components", "country:IN");
    // Viewport-bias toward the NCR service area (south,west|north,east) so a
    // partial query like "sector 18" resolves locally, not across India.
    url.searchParams.set("bounds", "28.20,76.80|28.95,77.75");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);
    try {
      const gres = await fetch(url.toString(), { signal: ctrl.signal });
      if (!gres.ok) {
        logger.warn({ status: gres.status }, "geo/search: google non-200, retrying fallback key if available");
        continue;
      }
      const json = (await gres.json()) as {
        status?: string;
        error_message?: string;
        results?: Array<{
          formatted_address?: string;
          address_components?: Array<{ long_name: string; types: string[] }>;
        }>;
      };
      if (json.status && KEY_FAILURE_STATUSES.has(json.status)) {
        lastStatus = json.status;
        logger.warn(
          { status: json.status },
          "geo/search: geocoder key failure on current candidate, retrying fallback key if available",
        );
        continue;
      }
      if (json.status !== "OK" || !json.results?.length) {
        // ZERO_RESULTS is a normal "no matches" outcome — not an error.
        return [];
      }
      return json.results.slice(0, 5).map((r) => placeFrom(r));
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "geo/search: request failed/timed out on candidate key");
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  logger.error({ status: lastStatus }, "geo/search: all configured geocoding API keys exhausted or unavailable");
  return null;
}

// ---------------------------------------------------------------------------
// Places (New) — real as-you-type autocomplete
// ---------------------------------------------------------------------------
//
// WHY THIS EXISTS. The picker's search box was wired to /geo/search, which is
// the FORWARD GEOCODER. A geocoder answers "where is this address?", not
// "what might this person be typing?": "Noida" returns exactly one coarse
// result whose postal_code component is absent, so the suggestion list showed
// a single row and selecting it produced an empty PIN — the serviceability
// check downstream then had nothing to check. That is the whole of the
// reported "address auto suggestions do not work".
//
// Places Autocomplete answers the right question and is cheap per keystroke,
// but it returns predictions, not addresses — a prediction has no PIN and no
// coordinates. So the pair is: /geo/autocomplete while typing (one call per
// debounced keystroke, ~5 rows), then /geo/place ONCE on the row the customer
// taps, which is the only call that costs a Place Details SKU.
//
// Session tokens: Google bills an autocomplete session (all keystrokes + the
// one details call) as a single unit when both carry the same token. The
// client mints one per open picker and passes it through; absent, each call
// simply bills on its own.
//
// Fallback: if the Places API is not enabled on either key (the live failure
// mode this codebase has already been bitten by once — see getMapsApiKeys),
// autocomplete degrades to the geocoder rather than to an empty list, and
// says so in `source` so the outage is visible in monitoring instead of
// looking like "the customer typed something unknown".

function rememberIn<T>(map: Map<string, T>, key: string, value: T): void {
  if (map.size >= CACHE_MAX) {
    const oldest = map.keys().next().value;
    if (typeof oldest === "string") map.delete(oldest);
  }
  map.set(key, value);
}

/** Places (New) uses `longText`/`types`; Geocoding uses `long_name`/`types`. */
function placeFromNewApi(detail: {
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
}): ResolvedPlace {
  const components = (detail.addressComponents ?? []).map((c) => ({
    long_name: c.longText ?? "",
    types: c.types ?? [],
  }));
  const base = precisePlaceFrom([
    { formatted_address: detail.formattedAddress ?? "", address_components: components },
  ]);
  return {
    ...base,
    lat: detail.location?.latitude ?? 0,
    lng: detail.location?.longitude ?? 0,
  };
}

router.get("/geo/autocomplete", async (req: Request, res: Response) => {
  const q = String(req.query["q"] ?? "").trim();
  if (q.length < 3) {
    res.status(400).json({ ok: false, error: "q must be at least 3 characters" });
    return;
  }
  const session = String(req.query["session"] ?? "").slice(0, 64);

  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  // Higher than /geo/search's 20/min: this one fires per debounced keystroke,
  // so a customer typing an address legitimately spends ~8 calls.
  const allowed = await rateLimit(`geo:autocomplete:${ip}`, 60_000, 60);
  if (!allowed) {
    res.status(429).json({ ok: false, error: "rate limited" });
    return;
  }

  const norm = q.toLowerCase().replace(/\s+/g, " ");
  const hit = predictionCache.get(norm);
  if (hit) {
    res.json({ ok: true, suggestions: hit, source: "places", cached: true });
    return;
  }

  const apiKeys = getMapsApiKeys();
  if (!apiKeys.length) {
    res.status(503).json({ ok: false, error: "geocoding not configured" });
    return;
  }

  for (const apiKey of apiKeys) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PLACES_TIMEOUT_MS);
    try {
      const pres = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
        body: JSON.stringify({
          input: q,
          includedRegionCodes: ["in"],
          // Same NCR rectangle the geocoder is biased to, so "sector 18"
          // resolves in Noida rather than in Chandigarh.
          locationBias: {
            rectangle: {
              low: { latitude: 28.2, longitude: 76.8 },
              high: { latitude: 28.95, longitude: 77.75 },
            },
          },
          ...(session ? { sessionToken: session } : {}),
        }),
        signal: ctrl.signal,
      });
      if (!pres.ok) {
        const body = await pres.text();
        logger.warn(
          { status: pres.status, body: body.slice(0, 300) },
          "geo/autocomplete: Places rejected the call, trying fallback key",
        );
        continue;
      }
      const json = (await pres.json()) as {
        suggestions?: Array<{
          placePrediction?: {
            placeId?: string;
            text?: { text?: string };
            structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
          };
        }>;
      };
      const suggestions: PlaceSuggestion[] = (json.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
        .slice(0, 6)
        .map((p) => ({
          placeId: p.placeId!,
          primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
          secondary: p.structuredFormat?.secondaryText?.text ?? "",
        }));
      // An empty prediction set is a real answer ("no such area"), not an
      // outage — cache and return it rather than falling through to the
      // geocoder, which would only re-confirm the same nothing.
      rememberIn(predictionCache, norm, suggestions);
      res.json({ ok: true, suggestions, source: "places" });
      return;
    } catch (err) {
      logger.warn(
        { err: (err as Error).message },
        "geo/autocomplete: Places request failed/timed out on candidate key",
      );
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  // Places unavailable on every key. Degrade to the geocoder so the search box
  // still does something, and label the response so this shows up as an
  // outage rather than as poor autocomplete.
  logger.error({}, "geo/autocomplete: Places unavailable on all keys — serving geocoder fallback");
  const geocoded = (searchCache.get(norm) ?? (await geocodeSearch(q))) ?? [];
  if (geocoded.length > 0) rememberSearch(norm, geocoded);
  res.json({
    ok: true,
    source: "geocode",
    suggestions: geocoded.map((p) => ({
      placeId: "",
      primary: p.city || "Area",
      secondary: p.formattedAddress,
      place: p,
    })),
  });
});

router.get("/geo/place", async (req: Request, res: Response) => {
  const placeId = String(req.query["placeId"] ?? "").trim();
  if (!placeId || placeId.length > 256) {
    res.status(400).json({ ok: false, error: "placeId is required" });
    return;
  }
  const session = String(req.query["session"] ?? "").slice(0, 64);

  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const allowed = await rateLimit(`geo:place:${ip}`, 60_000, 30);
  if (!allowed) {
    res.status(429).json({ ok: false, error: "rate limited" });
    return;
  }

  const hit = placeCache.get(placeId);
  if (hit) {
    res.json({ ok: true, ...hit, cached: true });
    return;
  }

  const apiKeys = getMapsApiKeys();
  if (!apiKeys.length) {
    res.status(503).json({ ok: false, error: "geocoding not configured" });
    return;
  }

  for (const apiKey of apiKeys) {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    if (session) url.searchParams.set("sessionToken", session);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PLACES_TIMEOUT_MS);
    try {
      const pres = await fetch(url.toString(), {
        headers: {
          "X-Goog-Api-Key": apiKey,
          // Field mask is mandatory on Places (New) and is what the SKU is
          // priced on — ask for exactly what the address form consumes.
          "X-Goog-FieldMask": "formattedAddress,location,addressComponents",
        },
        signal: ctrl.signal,
      });
      if (!pres.ok) {
        const body = await pres.text();
        logger.warn(
          { status: pres.status, body: body.slice(0, 300) },
          "geo/place: Places details rejected the call, trying fallback key",
        );
        continue;
      }
      const detail = (await pres.json()) as Parameters<typeof placeFromNewApi>[0];
      const value = placeFromNewApi(detail);
      rememberIn(placeCache, placeId, value);
      res.json({ ok: true, ...value });
      return;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "geo/place: request failed/timed out on candidate key");
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  logger.error({ placeId }, "geo/place: Places details unavailable on all keys");
  res.status(502).json({ ok: false, error: "place lookup unavailable" });
});

export default router;
