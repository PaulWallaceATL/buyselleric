import { NextResponse } from "next/server";
import { getSparkODataConfig, sparkODataGet } from "@/lib/spark-odata";

export const dynamic = "force-dynamic";

/**
 * Lightweight Spark RESO Web API connectivity check (no secrets in response).
 * Open `/api/spark/ping` after deploy to confirm the access token is wired up.
 */
export async function GET(): Promise<NextResponse> {
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

  try {
    const data = await sparkODataGet<{ value?: unknown[] }>(cfg, {
      $filter: "ListPrice ge 1",
      $top: "1",
      $select: "ListingKey,ListingId,City,StateOrProvince",
    });
    const sampleCount = Array.isArray(data.value) ? data.value.length : 0;
    return NextResponse.json({
      ok: true,
      apiFeedId: cfg.apiFeedId || null,
      entityPath: cfg.entityPath,
      baseUrl: cfg.baseUrl,
      sampleCount,
      hint: "If sampleCount=0, your MLS may not have approved listing data yet, or the active filter excludes everything.",
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
