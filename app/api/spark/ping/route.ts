import { NextResponse, type NextRequest } from "next/server";
import { getSparkODataConfig, sparkODataGet } from "@/lib/spark-odata";

export const dynamic = "force-dynamic";

type CountedProbe = {
  label: string;
  filter: string;
  count: number | null;
  sampleCity?: string | undefined;
  sampleState?: string | undefined;
  error?: string | undefined;
};

async function probeCount(
  cfg: ReturnType<typeof getSparkODataConfig>,
  label: string,
  filter: string,
  selectOverride?: string,
): Promise<CountedProbe> {
  if (!cfg) return { label, filter, count: null, error: "no_config" };
  try {
    const data = await sparkODataGet<{ value?: Array<Record<string, unknown>>; ["@odata.count"]?: number }>(cfg, {
      $filter: filter,
      $top: "1",
      $select: selectOverride ?? "ListingKey,ListingId,City,StateOrProvince",
      $count: "true",
    });
    const sample = data.value?.[0];
    return {
      label,
      filter,
      count: typeof data["@odata.count"] === "number" ? data["@odata.count"] : null,
      sampleCity: sample?.City ? String(sample.City) : undefined,
      sampleState: sample?.StateOrProvince ? String(sample.StateOrProvince) : undefined,
    };
  } catch (e) {
    return { label, filter, count: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Spark RESO Web API connectivity + content diagnostic.
 *
 * - GET /api/spark/ping              → quick smoke test
 * - GET /api/spark/ping?diag=1       → also probes a handful of canned filters
 *                                       (active count, city=Macon, state=GA, …)
 *                                       so you can see which queries return rows.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const cfg = getSparkODataConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_configured",
        hint: "Set SPARK_ACCESS_TOKEN on Vercel (and optionally SPARK_API_FEED_ID), then redeploy.",
      },
      { status: 200 },
    );
  }

  const wantsDiag = req.nextUrl.searchParams.get("diag") === "1";

  try {
    const data = await sparkODataGet<{ value?: unknown[] }>(cfg, {
      $filter: "ListPrice ge 1",
      $top: "1",
      $select: "ListingKey,ListingId,City,StateOrProvince",
    });
    const sampleCount = Array.isArray(data.value) ? data.value.length : 0;

    if (!wantsDiag) {
      return NextResponse.json({
        ok: true,
        apiFeedId: cfg.apiFeedId || null,
        entityPath: cfg.entityPath,
        baseUrl: cfg.baseUrl,
        sampleCount,
        hint: "Append ?diag=1 to inspect per-filter counts.",
      });
    }

    // Build filters exactly the way lib/spark-listings.ts does so we can see
    // what the real query against Spark looks like + whether it returns rows
    // or silently fails.
    const ACTIVE_FILTER =
      "((StandardStatus eq 'Active') or (StandardStatus eq 'active') or (StandardStatus eq 'ACTIVE') or (MlsStatus eq 'Active') or (MlsStatus eq 'active') or (MlsStatus eq 'ACTIVE'))";
    const CITY_MACON_VARIANTS = "(City eq 'Macon' or City eq 'macon' or City eq 'MACON')";
    const STATE_GA_VARIANTS = "(StateOrProvince eq 'GA' or StateOrProvince eq 'Georgia')";

    const probes = await Promise.all([
      probeCount(cfg, "any", "ListPrice ge 1"),
      probeCount(cfg, "active_eq_Active", "StandardStatus eq 'Active'"),
      probeCount(cfg, "active_eq_lower", "StandardStatus eq 'active'"),
      probeCount(cfg, "mlsstatus_eq_Active", "MlsStatus eq 'Active'"),
      probeCount(cfg, "mlsstatus_eq_lower", "MlsStatus eq 'active'"),
      probeCount(cfg, "city_macon_eq", "City eq 'Macon'"),
      probeCount(cfg, "city_macon_lower", "City eq 'macon'"),
      probeCount(cfg, "city_macon_upper", "City eq 'MACON'"),
      probeCount(cfg, "state_GA_eq", "StateOrProvince eq 'GA'"),
      probeCount(cfg, "state_Georgia_eq", "StateOrProvince eq 'Georgia'"),
      // Exact filter shape produced by buildFilter() for q="Macon, GA".
      probeCount(cfg, "ACTIVE_only", ACTIVE_FILTER),
      probeCount(
        cfg,
        "exact_buildFilter_macon_GA",
        `${ACTIVE_FILTER} and ${CITY_MACON_VARIANTS} and ${STATE_GA_VARIANTS}`,
      ),
      // Minimal that worked before — sanity reference.
      probeCount(
        cfg,
        "minimal_macon_active_GA",
        "StandardStatus eq 'Active' and City eq 'Macon' and StateOrProvince eq 'GA'",
      ),
      // Probe the EXACT $select used by lib/spark-listings.ts SELECT_GRID.
      probeCount(
        cfg,
        "buildFilter+SELECT_GRID",
        `${ACTIVE_FILTER} and ${CITY_MACON_VARIANTS} and ${STATE_GA_VARIANTS}`,
        "ListingKey,ListingId,UnparsedAddress,StreetNumber,StreetDirPrefix,StreetName,StreetSuffix,StreetDirSuffix,UnitNumber,City,StateOrProvince,PostalCode,ListPrice,BedroomsTotal,BathroomsTotalInteger,BathroomsFull,BathroomsHalf,BathroomsTotalDecimal,LivingArea,PropertyType,PropertySubType,StandardStatus,MlsStatus,SubdivisionName,Latitude,Longitude,ListAgentFullName,ListOfficeName,Media,ModificationTimestamp",
      ),
      // Probe with no $select — let the server return everything.
      probeCount(cfg, "buildFilter+no_select", `${ACTIVE_FILTER} and ${CITY_MACON_VARIANTS} and ${STATE_GA_VARIANTS}`, ""),
    ]);

    return NextResponse.json({
      ok: true,
      apiFeedId: cfg.apiFeedId || null,
      entityPath: cfg.entityPath,
      baseUrl: cfg.baseUrl,
      sampleCount,
      probes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        apiFeedId: cfg.apiFeedId || null,
        entityPath: cfg.entityPath,
        baseUrl: cfg.baseUrl,
        hint: "Check SPARK_ACCESS_TOKEN and the Vercel logs for sparkSearchWithFilters / this route.",
      },
      { status: 200 },
    );
  }
}
