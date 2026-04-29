/** Earth mean radius in meters (WGS84). */
const R = 6_371_000;

/** Great-circle distance between two WGS84 points in meters. */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type GeoPoint = { lat: number; lng: number };

/**
 * Ray casting point-in-polygon (WGS84 lat/lng as plane — fine for city-scale lassos).
 * `ring` may be open or closed (repeated first vertex).
 */
export function pointInPolygon(lat: number, lng: number, ring: ReadonlyArray<GeoPoint>): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = ring[i]!;
    const pj = ring[j]!;
    const yi = pi.lat;
    const xi = pi.lng;
    const yj = pj.lat;
    const xj = pj.lng;
    const denom = yj - yi;
    if (Math.abs(denom) < 1e-14) continue;
    const crossesHorizontal = yi > lat !== yj > lat;
    if (!crossesHorizontal) continue;
    const xIntersect = ((xj - xi) * (lat - yi)) / denom + xi;
    if (lng < xIntersect) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(ring: ReadonlyArray<GeoPoint>): GeoPoint {
  let slat = 0;
  let slng = 0;
  for (const p of ring) {
    slat += p.lat;
    slng += p.lng;
  }
  const n = ring.length || 1;
  return { lat: slat / n, lng: slng / n };
}
