/**
 * Storefront API client helper for server-proxied geolocation and geocoding.
 * Keeps map interactions lightweight and resilient by routing search and GPS
 * fixes through /api/geo/reverse and /api/geo/search.
 */
import { apiGet, type FetchImpl } from "./apiClient";

export interface GeoPlace {
  formattedAddress: string;
  city: string;
  pincode: string;
}

export interface GeoSearchResponse {
  ok: boolean;
  results?: GeoPlace[];
}

export interface GeoReverseResponse extends GeoPlace {
  ok: boolean;
}

// Default NCR center: Noida Sector 18.
export const DEFAULT_MAP_CENTER = { lat: 28.5708, lng: 77.3260 } as const;

/** Convert a GPS latitude/longitude fix into structured address components. */
export async function reverseGeocode(
  lat: number,
  lng: number,
  fetchImpl?: FetchImpl,
): Promise<GeoPlace | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  try {
    const res = await apiGet<GeoReverseResponse>(
      `/geo/reverse?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`,
      fetchImpl,
    );
    if (!res.ok) return null;
    return {
      formattedAddress: res.formattedAddress || "",
      city: res.city || "",
      pincode: res.pincode || "",
    };
  } catch {
    return null;
  }
}

/** One row in the picker's suggestion list — see api-server routes/geo.ts. */
export interface PlaceSuggestion {
  placeId: string;
  primary: string;
  secondary: string;
  /** Present only on the geocoder-fallback shape, which has nothing further
   *  to resolve; a Places prediction carries a placeId instead. */
  place?: GeoPlace;
}

export interface ResolvedPlace extends GeoPlace {
  lat: number;
  lng: number;
}

/**
 * A Places autocomplete session token.
 *
 * All the keystrokes of one address entry plus the single details call are
 * billed as one session when they share a token, so the picker mints one per
 * open and discards it after a selection resolves.
 */
export function newPlacesSession(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** As-you-type suggestions. Returns [] on any failure — the picker still has
 *  the map and the manual PIN fallback, so a dead suggestion list must never
 *  throw into the sheet. */
export async function autocompletePlaces(
  query: string,
  session?: string,
  fetchImpl?: FetchImpl,
): Promise<PlaceSuggestion[]> {
  const clean = query.trim();
  if (clean.length < 3) return [];
  try {
    const res = await apiGet<{ ok: boolean; suggestions?: PlaceSuggestion[] }>(
      `/geo/autocomplete?q=${encodeURIComponent(clean)}${session ? `&session=${encodeURIComponent(session)}` : ""}`,
      fetchImpl,
    );
    return res.suggestions ?? [];
  } catch {
    return [];
  }
}

/** Resolve a tapped prediction into an address with a PIN code and coordinates. */
export async function resolvePlace(
  placeId: string,
  session?: string,
  fetchImpl?: FetchImpl,
): Promise<ResolvedPlace | null> {
  if (!placeId) return null;
  try {
    const res = await apiGet<{ ok: boolean } & ResolvedPlace>(
      `/geo/place?placeId=${encodeURIComponent(placeId)}${session ? `&session=${encodeURIComponent(session)}` : ""}`,
      fetchImpl,
    );
    if (!res.ok) return null;
    return {
      formattedAddress: res.formattedAddress || "",
      city: res.city || "",
      pincode: res.pincode || "",
      lat: res.lat,
      lng: res.lng,
    };
  } catch {
    return null;
  }
}

/** Forward geocode query text into candidate area locations. */
export async function searchLocation(
  query: string,
  fetchImpl?: FetchImpl,
): Promise<GeoPlace[]> {
  const clean = query.trim();
  if (clean.length < 3) return [];
  try {
    const res = await apiGet<GeoSearchResponse>(
      `/geo/search?q=${encodeURIComponent(clean)}`,
      fetchImpl,
    );
    return res.results ?? [];
  } catch {
    return [];
  }
}
