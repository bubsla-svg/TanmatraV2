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
const CACHE_MAX = 500;
// ~11m grid — a GPS fix twice from the same spot hits the cache.
const cache = new Map<string, ReverseResult>();

interface ReverseResult {
  formattedAddress: string;
  city: string;
  pincode: string;
}

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function remember(key: string, value: ReverseResult): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (typeof oldest === "string") cache.delete(oldest);
  }
  cache.set(key, value);
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

  const apiKey = process.env["GOOGLE_API_KEY"];
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
      results?: Array<{
        formatted_address?: string;
        address_components?: Array<{ long_name: string; types: string[] }>;
      }>;
    };
    if (json.status !== "OK" || !json.results?.[0]) {
      // ZERO_RESULTS is a normal outcome (e.g. open water) — not an error.
      res.json({ ok: true, formattedAddress: "", city: "", pincode: "" });
      return;
    }
    const first = json.results[0];
    let city = "";
    let pincode = "";
    for (const comp of first.address_components ?? []) {
      if (comp.types.includes("locality")) city = comp.long_name;
      else if (comp.types.includes("postal_code")) pincode = comp.long_name;
    }
    const value: ReverseResult = {
      formattedAddress: first.formatted_address ?? "",
      city,
      pincode,
    };
    remember(key, value);
    res.json({ ok: true, ...value });
  } catch (err) {
    logger.warn({ err }, "geo/reverse: request failed/timed out");
    res.status(502).json({ ok: false, error: "geocoder unavailable" });
  } finally {
    clearTimeout(timer);
  }
});

export default router;
