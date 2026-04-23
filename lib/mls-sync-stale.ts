/** ISO timestamp for rows older than `staleMinutes` (used by admin MLS stale cleanup). */
export function mlsSyncStaleCutoffIso(staleMinutes: number): string {
  return new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
}
