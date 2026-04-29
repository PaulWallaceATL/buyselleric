/**
 * Shared parsing for listing search `q` (Supabase + Bridge OData).
 */

/** "Atlanta, GA" → city + state for AND filters. Returns null if not a clean city/state pattern. */
export function parseCityStateSearchQuery(q: string): { city: string; state: string } | null {
  const trimmed = q.trim();
  const m = trimmed.match(/^(.+?),\s*(.+)$/);
  if (!m?.[1] || !m[2]) return null;
  const city = m[1].trim();
  const state = m[2].trim();
  if (!city || !state || city.length > 120 || state.length > 40) return null;
  // First segment with digits is almost certainly a street address, not a city name.
  if (/\d/.test(city)) return null;
  return { city, state };
}

const GA_STATE_CENTER = { lat: 32.7539, lng: -83.4609 };

/** Known city centers for map when MLS rows lack lat/lng (tiles + draw still work). */
const GA_CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  atlanta: { lat: 33.749, lng: -84.388 },
  savannah: { lat: 32.0809, lng: -81.0912 },
  augusta: { lat: 33.4735, lng: -82.0105 },
  columbus: { lat: 32.461, lng: -84.9877 },
  macon: { lat: 32.8407, lng: -83.6324 },
  athens: { lat: 33.9519, lng: -83.3576 },
  "sandy springs": { lat: 33.9304, lng: -84.3733 },
  roswell: { lat: 34.0232, lng: -84.3616 },
  marietta: { lat: 33.9526, lng: -84.5499 },
  alpharetta: { lat: 34.0754, lng: -84.2941 },
  decatur: { lat: 33.7748, lng: -84.2963 },
  lawrenceville: { lat: 33.9562, lng: -83.988 },
  norcross: { lat: 33.9412, lng: -84.2135 },
  gainesville: { lat: 34.2979, lng: -83.8241 },
  valdosta: { lat: 30.8327, lng: -83.2785 },
  rome: { lat: 34.2571, lng: -85.1647 },
  albany: { lat: 31.5785, lng: -84.1557 },
  "warner robins": { lat: 32.613, lng: -83.6242 },
};

/**
 * Map center when no listing pins have coordinates. Uses "City, ST" from `q` when
 * parseable; otherwise Georgia centroid.
 */
export function mapFallbackCenterFromSearchQ(q: string | undefined): { lat: number; lng: number } {
  const parsed = q?.trim() ? parseCityStateSearchQuery(q.trim()) : null;
  if (!parsed) return GA_STATE_CENTER;
  const key = parsed.city.toLowerCase();
  return GA_CITY_CENTERS[key] ?? GA_STATE_CENTER;
}
