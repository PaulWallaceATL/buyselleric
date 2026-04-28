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
