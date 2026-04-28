import { NextResponse } from "next/server";
import { bridgeODataGet, getBridgeODataConfig } from "@/lib/bridge-odata";

export const dynamic = "force-dynamic";

/**
 * Lightweight Bridge connectivity check (no secrets in response).
 * Open `/api/bridge/ping` after deploy if listings stay empty.
 */
export async function GET(): Promise<NextResponse> {
  const cfg = getBridgeODataConfig();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "not_configured", hint: "Set BRIDGE_SERVER_TOKEN and BRIDGE_DATASET_ID on Vercel, then redeploy." },
      { status: 200 },
    );
  }

  try {
    await bridgeODataGet(cfg, {
      $filter: "ListPrice ge 1",
      $top: "1",
      $select: "ListingKey,ListingId",
    });
    return NextResponse.json({
      ok: true,
      datasetId: cfg.datasetId,
      entityPath: cfg.entityPath,
      hint: "If listings are still empty, try BRIDGE_ODATA_ENTITY=Properties or idx/Properties (see Bridge docs for your feed).",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        datasetId: cfg.datasetId,
        entityPath: cfg.entityPath,
        hint: "Check token, dataset id, and entity path. Vercel → Logs → filter by bridgeSearchWithFilters or this route.",
      },
      { status: 200 },
    );
  }
}
