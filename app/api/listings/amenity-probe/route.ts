import { NextResponse } from "next/server";
import {
  AMENITY_CAPABILITY_KEYS,
  disableAmenityKey,
  enabledAmenityKeys,
  getAmenityRuntimeDisabled,
  resetAmenityRuntimeDisables,
  type AmenityCapabilityKey,
} from "@/lib/amenity-feed-capabilities";
import {
  amenitiesFromListingFilters,
  buildAmenityODataClauses,
  type ListingAmenities,
} from "@/lib/listing-amenities";
import { bridgeODataGet, getBridgeODataConfig } from "@/lib/bridge-odata";
import { getSparkODataConfig, sparkODataGet } from "@/lib/spark-odata";
import type { ListingFilters } from "@/lib/listings-queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Prod probe: hits Bridge + Spark with each amenity $filter (server tokens on Vercel).
 * GET /api/listings/amenity-probe
 * Optional: ?reset=1 to clear runtime disables first.
 *
 * Protect lightly — no secrets returned; rate-limit by not linking publicly.
 */

const ACTIVE =
  "((StandardStatus eq 'Active') or (tolower(StandardStatus) eq 'active') or (MlsStatus eq 'Active') or (tolower(MlsStatus) eq 'active'))";

const PROBE_AMENITIES: Array<{ key: AmenityCapabilityKey; amenities: ListingAmenities }> = [
  { key: "hasPool", amenities: { hasPool: true } },
  { key: "minGarageSpaces", amenities: { minGarageSpaces: 1 } },
  { key: "hasFireplace", amenities: { hasFireplace: true } },
  { key: "hasWaterfront", amenities: { hasWaterfront: true } },
  { key: "minYearBuilt", amenities: { minYearBuilt: 2000 } },
  { key: "maxYearBuilt", amenities: { maxYearBuilt: 2020 } },
  { key: "maxStories", amenities: { maxStories: 1 } },
  { key: "minAcres", amenities: { minAcres: 1 } },
  { key: "noHoa", amenities: { noHoa: true } },
];

type ProbeResult = {
  key: string;
  ok: boolean;
  count?: number;
  error?: string;
  filter?: string;
};

async function probeBridge(): Promise<{ configured: boolean; results: ProbeResult[] }> {
  const cfg = getBridgeODataConfig();
  if (!cfg) return { configured: false, results: [] };

  const results: ProbeResult[] = [];
  for (const { key, amenities } of PROBE_AMENITIES) {
    const clauses = buildAmenityODataClauses(amenities, "bridge", new Set([key]));
    const filter = [ACTIVE, ...clauses].join(" and ");
    try {
      const data = await bridgeODataGet<{ value?: unknown[]; "@odata.count"?: number }>(cfg, {
        $filter: filter,
        $top: "1",
        $select: "ListingKey",
        $count: "true",
      });
      results.push({
        key,
        ok: true,
        count: typeof data["@odata.count"] === "number" ? data["@odata.count"] : data.value?.length ?? 0,
        filter,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      disableAmenityKey("bridge", key);
      results.push({ key, ok: false, error: msg.slice(0, 240), filter });
    }
  }
  return { configured: true, results };
}

async function probeSpark(): Promise<{ configured: boolean; results: ProbeResult[] }> {
  const cfg = getSparkODataConfig();
  if (!cfg) return { configured: false, results: [] };

  const results: ProbeResult[] = [];
  for (const { key, amenities } of PROBE_AMENITIES) {
    const clauses = buildAmenityODataClauses(amenities, "spark", new Set([key]));
    const filter = [ACTIVE, ...clauses].join(" and ");
    try {
      const data = await sparkODataGet<{ value?: unknown[]; "@odata.count"?: number }>(cfg, {
        $filter: filter,
        $top: "1",
        $select: "ListingKey",
        $count: "true",
      });
      results.push({
        key,
        ok: true,
        count: typeof data["@odata.count"] === "number" ? data["@odata.count"] : data.value?.length ?? 0,
        filter,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      disableAmenityKey("spark", key);
      results.push({ key, ok: false, error: msg.slice(0, 240), filter });
    }
  }
  return { configured: true, results };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("reset") === "1") {
    resetAmenityRuntimeDisables();
  }

  // Smoke-check that amenity clause builder still accepts ListingFilters shape.
  void amenitiesFromListingFilters({} as ListingFilters);
  void AMENITY_CAPABILITY_KEYS;

  const [bridge, spark] = await Promise.all([probeBridge(), probeSpark()]);

  return NextResponse.json({
    ok: true,
    note: "Failed keys are runtime-disabled on this instance until cold start or ?reset=1. Prefer BRIDGE_AMENITY_DISABLE / SPARK_AMENITY_DISABLE for permanent disables.",
    bridge: {
      ...bridge,
      enabled: [...enabledAmenityKeys("bridge")],
      runtimeDisabled: getAmenityRuntimeDisabled("bridge"),
    },
    spark: {
      ...spark,
      enabled: [...enabledAmenityKeys("spark")],
      runtimeDisabled: getAmenityRuntimeDisabled("spark"),
    },
  });
}
