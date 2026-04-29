import { pointInPolygon } from "@/lib/geo";
import type { MapPolygonVertex } from "@/lib/map-polygon-query";

/** Minimal fields for address geocoding (avoids importing `UnifiedListing` from `listings-queries` → cycle). */
export type ListingGeocodeShape = {
  address_line: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
};

/** Set `DISABLE_ADDRESS_GEOCODE=true` to skip Photon (e.g. if you use Mapbox server-side instead). */
export function isAddressGeocodeEnabled(): boolean {
  return process.env.DISABLE_ADDRESS_GEOCODE?.trim() !== "true";
}

export function formatListingGeocodeQuery(l: ListingGeocodeShape): string | null {
  const line = l.address_line?.trim();
  const city = l.city?.trim();
  const state = l.state?.trim();
  const zip = l.postal_code?.trim();
  const parts = [line, city, state, zip].filter(Boolean);
  if (parts.length < 2) return null;
  if (!city && !state && line) return `${line}, USA`;
  return parts.join(", ");
}

type PhotonFeature = {
  geometry?: { type?: string; coordinates?: [number, number] };
};

type PhotonResponse = { features?: PhotonFeature[] };

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Forward geocode a postal address using Komoot’s public Photon API (OSM-backed, no API key).
 * Be conservative: short timeout, cache-friendly fetch for repeat addresses.
 */
export async function geocodeAddressWithPhoton(query: string): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim();
  if (q.length < 4) return null;

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "1");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "buyselleric/1.0 (+https://buyselleric.com)",
      },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PhotonResponse;
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const [lng, lat] = coords;
    if (!isValidLatLng(lat, lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fill missing lat/lng using Photon. When `polygon` is set, drop coords that fall outside the draw
 * (ZIP-centroid matches can geocode to a point outside the freehand outline).
 */
export async function enrichListingsWithPhotonGeocode<T extends ListingGeocodeShape>(
  listings: T[],
  options?: { polygon?: ReadonlyArray<MapPolygonVertex> | undefined },
): Promise<T[]> {
  if (!isAddressGeocodeEnabled()) return listings;

  const polygon = options?.polygon;
  const max = Math.min(30, Math.max(1, Number.parseInt(process.env.MAP_GEOCODE_MAX_PER_PAGE?.trim() ?? "24", 10) || 24));

  const indicesNeeding: number[] = [];
  for (let i = 0; i < listings.length; i++) {
    const l = listings[i]!;
    if (l.latitude != null && l.longitude != null) continue;
    if (!formatListingGeocodeQuery(l)) continue;
    indicesNeeding.push(i);
    if (indicesNeeding.length >= max) break;
  }
  if (indicesNeeding.length === 0) return listings;

  const concurrency = Math.min(4, Math.max(1, Number.parseInt(process.env.MAP_GEOCODE_CONCURRENCY?.trim() ?? "3", 10) || 3));
  const out = listings.map((l) => ({ ...l })) as T[];

  for (let i = 0; i < indicesNeeding.length; i += concurrency) {
    const batch = indicesNeeding.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (idx) => {
        const current = out[idx]!;
        const query = formatListingGeocodeQuery(current);
        if (!query) return;
        const hit = await geocodeAddressWithPhoton(query);
        if (!hit) return;
        if (polygon && polygon.length >= 3) {
          if (!pointInPolygon(hit.lat, hit.lng, polygon)) return;
        }
        out[idx] = { ...current, latitude: hit.lat, longitude: hit.lng };
      }),
    );
    if (i + concurrency < indicesNeeding.length) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  return out;
}
