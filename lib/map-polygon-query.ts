/** URL query key for drawn map search area. */
export const MAP_POLYGON_QUERY_KEY = "mapPoly";

export type MapPolygonVertex = { lat: number; lng: number };

const MAX_VERTICES = 40;
const MAX_ENCODED_LEN = 2000;

function roundCoord(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Serialize ring for `mapPoly` query (pipe-separated lat,lng pairs). */
export function encodeMapPolygonQuery(ring: ReadonlyArray<MapPolygonVertex>): string {
  let maxPts = MAX_VERTICES;
  for (;;) {
    const simplified = simplifyRingForQuery(ring, maxPts);
    const encoded = simplified.map((p) => `${roundCoord(p.lat)},${roundCoord(p.lng)}`).join("|");
    if (encoded.length <= MAX_ENCODED_LEN || maxPts <= 4) return encoded;
    maxPts = Math.max(4, Math.floor(maxPts * 0.75));
  }
}

/** If a pair was stored lng,lat (common mistake), swap for continental US–style coordinates. */
function normalizeDecodedLatLngPair(a: number, b: number): { lat: number; lng: number } {
  const looksLikeLngLat =
    a < -55 && a > -130 && b > 22 && b < 50 && !(b < -55 && b > -130 && a > 22 && a < 50);
  if (looksLikeLngLat) return { lat: b, lng: a };
  return { lat: a, lng: b };
}

export function decodeMapPolygonQuery(val: string | string[] | undefined): MapPolygonVertex[] | undefined {
  if (typeof val !== "string" || val.length < 5 || val.length > MAX_ENCODED_LEN) return undefined;
  const parts = val.split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 3 || parts.length > MAX_VERTICES) return undefined;
  const ring: MapPolygonVertex[] = [];
  for (const part of parts) {
    const bits = part.split(",").map((x) => Number(x.trim()));
    const a = bits[0];
    const b = bits[1];
    if (a === undefined || b === undefined) return undefined;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
    const { lat, lng } = normalizeDecodedLatLngPair(a, b);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
    ring.push({ lat, lng });
  }
  if (ring.length < 3) return undefined;
  return ring;
}

/** Reduce vertices for URL length while keeping shape roughly intact. */
export function simplifyRingForQuery(
  ring: ReadonlyArray<MapPolygonVertex>,
  maxPoints: number,
): MapPolygonVertex[] {
  if (ring.length <= maxPoints) return [...ring];
  const step = Math.ceil(ring.length / maxPoints);
  const out: MapPolygonVertex[] = [];
  for (let i = 0; i < ring.length; i += step) {
    out.push(ring[i]!);
  }
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (out[0]!.lat !== first.lat || out[0]!.lng !== first.lng) out.unshift(first);
  if (out[out.length - 1]!.lat !== last.lat || out[out.length - 1]!.lng !== last.lng) out.push(last);
  return out.slice(0, maxPoints);
}
