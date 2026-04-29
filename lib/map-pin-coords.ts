import { gaZipCentroid, normalizeUsZip5 } from "@/lib/ga-zip-centroids";
import { pointInPolygon } from "@/lib/geo";
import type { MapPolygonVertex } from "@/lib/map-polygon-query";

type Row = {
  id: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
};

/** Small stable offset so many listings in the same ZIP don’t stack on one pixel. */
function centroidJitter(id: string): { dLat: number; dLng: number } {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0) / 2 ** 32;
  const v = (Math.imul(h, 1103515245) >>> 0) / 2 ** 32;
  const scale = 0.0035;
  return { dLat: (u - 0.5) * scale, dLng: (v - 0.5) * scale };
}

/**
 * Last-resort map coordinates from our GA ZIP centroid table (same source as polygon ZIP matching).
 * When a polygon is active, only place a pin if that centroid lies inside the outline.
 */
export function applyZipCentroidPinCoords<T extends Row>(
  listings: T[],
  polygon?: ReadonlyArray<MapPolygonVertex> | undefined,
): T[] {
  if (process.env.DISABLE_MAP_ZIP_PIN_FALLBACK?.trim() === "true") return listings;

  return listings.map((l) => {
    if (l.latitude != null && l.longitude != null) return l;
    const zip = normalizeUsZip5(l.postal_code);
    const c = zip ? gaZipCentroid(zip) : null;
    if (!c) return l;
    if (polygon && polygon.length >= 3) {
      if (!pointInPolygon(c.lat, c.lng, polygon)) return l;
    }
    const { dLat, dLng } = centroidJitter(l.id);
    return { ...l, latitude: c.lat + dLat, longitude: c.lng + dLng };
  });
}
