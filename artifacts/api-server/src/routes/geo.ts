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
const CACHE_MAX = 500;
// ~11m grid — a GPS fix twice from the same spot hits the cache.
const cache = new Map<string, GeoPlace>();
// Normalized-query cache for /geo/search — the same typed area re-searched
// (debounced keystrokes) only costs one upstream call.
const searchCache = new Map<string, GeoPlace[]>();

interface GeoPlace {
  formattedAddress: string;
  city: string;
  pincode: string;
}

// GOOGLE_API_KEY is shared with the Gemini AI stack (lib/integrations-gemini-ai,
// ai/model.ts), so a Gemini-motivated key rotation can silently strip the
// Geocoding API from these routes (observed live 2026-07-20: the rotated key
// was Gemini-only and every /geo/* call started returning REQUEST_DENIED).
// GOOGLE_MAPS_API_KEY, when set, decouples Maps from that blast radius.
function mapsApiKey(): string | undefined {
  return process.env["GOOGLE_MAPS_API_KEY"] || process.env["GOOGLE_API_KEY"];
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

/** Pull locality + postal_code out of a Google address_components array. */
function placeFrom(result: {
  formatted_address?: string;
  address_components?: Array<{ long_name: string; types: string[] }>;
}): GeoPlace {
  let city = "";
  let pincode = "";
  for (const comp of result.address_components ?? []) {
    if (comp.types.includes("locality")) city = comp.long_name;
    else if (comp.types.includes("postal_code")) pincode = comp.long_name;
  }
  return { formattedAddress: result.formatted_address ?? "", city, pincode };
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

  const apiKey = mapsApiKey();
  if (!apiKey) {
    res.status(503).json({ ok: false, error: "geocoding not configured" });
    return;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("region", "in");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REVERSE_TIMEOUT_MS);
  try {
    const gres = await fetch(url.toString(), { signal: ctrl.signal });
    if (!gres.ok) {
      logger.warn({ status: gres.status }, "geo/reverse: google non-200");
      res.status(502).json({ ok: false, error: "geocoder unavailable" });
      return;
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
      // Key/quota failure — a real outage, not "no address here".
      logger.error(
        { status: json.status, errorMessage: json.error_message },
        "geo/reverse: geocoder key/quota failure",
      );
      res.status(502).json({ ok: false, error: "geocoder unavailable" });
      return;
    }
    if (json.status !== "OK" || !json.results?.[0]) {
      // ZERO_RESULTS is a normal outcome (e.g. open water) — not an error.
      res.json({ ok: true, formattedAddress: "", city: "", pincode: "" });
      return;
    }
    const value = placeFrom(json.results[0]);
    remember(key, value);
    res.json({ ok: true, ...value });
  } catch (err) {
    logger.warn({ err }, "geo/reverse: request failed/timed out");
    res.status(502).json({ ok: false, error: "geocoder unavailable" });
  } finally {
    clearTimeout(timer);
  }
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

  const apiKey = mapsApiKey();
  if (!apiKey) {
    res.status(503).json({ ok: false, error: "geocoding not configured" });
    return;
  }

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
      logger.warn({ status: gres.status }, "geo/search: google non-200");
      res.status(502).json({ ok: false, error: "geocoder unavailable" });
      return;
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
      // Key/quota failure — surface as an outage so the picker shows its
      // "search unavailable" hint instead of a silent empty dropdown.
      logger.error(
        { status: json.status, errorMessage: json.error_message },
        "geo/search: geocoder key/quota failure",
      );
      res.status(502).json({ ok: false, error: "geocoder unavailable" });
      return;
    }
    if (json.status !== "OK" || !json.results?.length) {
      // ZERO_RESULTS is a normal "no matches" outcome — not an error.
      res.json({ ok: true, results: [] });
      return;
    }
    const results = json.results.slice(0, 5).map(placeFrom);
    rememberSearch(norm, results);
    res.json({ ok: true, results });
  } catch (err) {
    logger.warn({ err }, "geo/search: request failed/timed out");
    res.status(502).json({ ok: false, error: "geocoder unavailable" });
  } finally {
    clearTimeout(timer);
  }
});

export default router;
