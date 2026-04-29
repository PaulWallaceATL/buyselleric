/** Session snapshot so after /listings navigation the map can reopen at the same pan/zoom as the finished stroke. */

export const MAP_DRAW_VIEWPORT_STORAGE_KEY = "buyselleric_mapDrawViewport_v1";

export type StoredDrawViewport = {
  mapPoly: string;
  lat: number;
  lng: number;
  zoom: number;
};

export function writeDrawViewport(stored: StoredDrawViewport): void {
  try {
    sessionStorage.setItem(MAP_DRAW_VIEWPORT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* quota / private mode */
  }
}

export function peekDrawViewport(mapPolyUrl: string | null): StoredDrawViewport | null {
  if (typeof window === "undefined" || !mapPolyUrl) return null;
  try {
    const raw = sessionStorage.getItem(MAP_DRAW_VIEWPORT_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<StoredDrawViewport>;
    if (typeof o.mapPoly !== "string" || o.mapPoly !== mapPolyUrl) return null;
    const lat = Number(o.lat);
    const lng = Number(o.lng);
    const zoom = Number(o.zoom);
    if (![lat, lng, zoom].every((n) => Number.isFinite(n))) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || zoom < 1 || zoom > 22) return null;
    return { mapPoly: o.mapPoly, lat, lng, zoom };
  } catch {
    return null;
  }
}
