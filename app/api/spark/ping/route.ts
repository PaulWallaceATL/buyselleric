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
): Promise<CountedProbe> {
  if (!cfg) return { label, filter, count: null, error: "no_config" };
  try {
    const data = await sparkODataGet<{ value?: Array<Record<string, unknown>>; ["@odata.count"]?: number }>(cfg, {
      $filter: filter,
      $top: "1",
      $select: "ListingKey,ListingId,City,StateOrProvince",
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

    const probes = await Promise.all([
      probeCount(cfg, "any", "ListPrice ge 1"),
      probeCount(cfg, "active_titlecase", "StandardStatus eq 'Active'"),
      probeCount(cfg, "active_lower_value", "StandardStatus eq 'active'"),
      probeCount(cfg, "active_upper_value", "StandardStatus eq 'ACTIVE'"),
      probeCount(cfg, "active_tolower_fn", "tolower(StandardStatus) eq 'active'"),
      probeCount(
        cfg,
        "active_or_variants",
        "(StandardStatus eq 'Active' or StandardStatus eq 'active' or StandardStatus eq 'ACTIVE')",
      ),
      probeCount(cfg, "state_GA", "StateOrProvince eq 'GA'"),
      probeCount(cfg, "city_macon_eq", "City eq 'Macon'"),
      probeCount(
        cfg,
        "active_macon_GA_combined",
        "(StandardStatus eq 'Active' or StandardStatus eq 'active' or StandardStatus eq 'ACTIVE') and City eq 'Macon' and StateOrProvince eq 'GA'",
      ),
      probeCount(
        cfg,
        "active_GA_only",
        "(StandardStatus eq 'Active') and StateOrProvince eq 'GA'",
      ),
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
