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
