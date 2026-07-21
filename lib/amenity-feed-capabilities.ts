/**
 * Per-feed amenity capability matrix.
 *
 * Prod-only credentials: we default to "try all" and disable individual keys
 * at runtime when OData rejects them (or after /api/listings/amenity-probe).
 * Optional env overrides permanently disable flaky fields:
 *   BRIDGE_AMENITY_DISABLE=hasPool,noHoa
 *   SPARK_AMENITY_DISABLE=maxStories
 */

import type { AmenityFeed } from "@/lib/listing-amenities";

export const AMENITY_CAPABILITY_KEYS = [
  "hasPool",
  "minGarageSpaces",
  "hasFireplace",
  "hasWaterfront",
  "minYearBuilt",
  "maxYearBuilt",
  "maxStories",
  "minAcres",
  "noHoa",
] as const;

export type AmenityCapabilityKey = (typeof AMENITY_CAPABILITY_KEYS)[number];

/** Runtime disables discovered via failed OData (process-local, resets on cold start). */
const runtimeDisabled: Record<AmenityFeed, Set<string>> = {
  bridge: new Set(),
  spark: new Set(),
};

function envDisabled(feed: AmenityFeed): Set<string> {
  const raw =
    feed === "bridge"
      ? process.env.BRIDGE_AMENITY_DISABLE?.trim()
      : process.env.SPARK_AMENITY_DISABLE?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Keys we should attempt on this feed right now. */
export function enabledAmenityKeys(feed: AmenityFeed): Set<string> {
  const disabled = new Set([...envDisabled(feed), ...runtimeDisabled[feed]]);
  return new Set(AMENITY_CAPABILITY_KEYS.filter((k) => !disabled.has(k)));
}

export function disableAmenityKey(feed: AmenityFeed, key: string): void {
  if ((AMENITY_CAPABILITY_KEYS as readonly string[]).includes(key)) {
    runtimeDisabled[feed].add(key);
  }
}

export function disableAllAmenities(feed: AmenityFeed): void {
  for (const k of AMENITY_CAPABILITY_KEYS) runtimeDisabled[feed].add(k);
}

export function resetAmenityRuntimeDisables(feed?: AmenityFeed): void {
  if (feed) runtimeDisabled[feed].clear();
  else {
    runtimeDisabled.bridge.clear();
    runtimeDisabled.spark.clear();
  }
}

export function getAmenityRuntimeDisabled(feed: AmenityFeed): string[] {
  return [...runtimeDisabled[feed]];
}
